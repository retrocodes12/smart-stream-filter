import { promises as fs } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import pkg from "stremio-addon-sdk";
const { addonBuilder, serveHTTP } = pkg;
import express from "express";

import { PROFILES } from "./src/profiles.js";
import { evaluateStream } from "./src/filter.js";
import { fetchUpstreamStreams } from "./src/upstream.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const manifestPath = join(__dirname, "public", "manifest.json");
const manifest = JSON.parse(await fs.readFile(manifestPath, "utf-8"));

const builder = new addonBuilder(manifest);

function normalizeStream(stream) {
  const name = stream?.name || stream?.title || "Stream";
  return {
    ...stream,
    name,
    description: stream?.description || "",
    size: typeof stream?.size === "number" ? stream.size : undefined,
    source: stream?.source || "Unknown"
  };
}

function tokenizeName(name) {
  return (name || "")
    .toLowerCase()
    .replace(/[^\w\s.-]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

function detectCodecFromName(name) {
  const n = (name || "").toLowerCase();
  if (n.includes("hevc") || n.includes("x265") || n.includes("h265")) return "hevc";
  if (n.includes("x264") || n.includes("h264") || n.includes("avc")) return "h264";
  return "unknown";
}

function detectResolutionFromName(name) {
  const n = (name || "").toLowerCase();
  if (n.includes("2160p") || n.includes("4k")) return 2160;
  if (n.includes("1080p")) return 1080;
  if (n.includes("720p")) return 720;
  return 0;
}

function getCodecPreference(name) {
  const codec = detectCodecFromName(name);
  if (codec === "hevc") return 0;
  if (codec === "h264") return 1;
  return 2;
}

function isSimilarSize(a, b) {
  if (!a || !b) return false;
  const diff = Math.abs(a - b);
  const avg = (a + b) / 2;
  return diff / avg <= 0.1;
}

function isDuplicateStream(a, b) {
  const resA = detectResolutionFromName(a.name);
  const resB = detectResolutionFromName(b.name);
  if (resA && resB && resA !== resB) return false;

  const codecA = detectCodecFromName(a.name);
  const codecB = detectCodecFromName(b.name);
  if (codecA !== "unknown" && codecB !== "unknown" && codecA !== codecB) return false;

  if (a.size && b.size && !isSimilarSize(a.size, b.size)) return false;

  const tokensA = new Set(tokenizeName(a.name));
  const tokensB = new Set(tokenizeName(b.name));
  if (!tokensA.size || !tokensB.size) return false;
  let overlap = 0;
  for (const token of tokensA) if (tokensB.has(token)) overlap += 1;
  const similarity = overlap / Math.max(tokensA.size, tokensB.size);
  return similarity >= 0.6;
}

function mergeWarnings(a, b) {
  const merged = new Set([...(a || []), ...(b || [])]);
  return Array.from(merged);
}

const SOURCE_PRIORITY = ["Torrentio", "MediaFusion"];

function getSourcePriority(source) {
  const index = SOURCE_PRIORITY.indexOf(source);
  return index === -1 ? SOURCE_PRIORITY.length : index;
}

builder.defineStreamHandler(async (args) => {
  const upstreamStreams = await fetchUpstreamStreams(args);
  const selectedProfileKey = args?.config?.profile || "WEAK_TV";
  const profile = PROFILES[selectedProfileKey] || PROFILES.WEAK_TV;
  const autoPick = args?.config?.auto_pick === true;

  const evaluatedAll = upstreamStreams
    .map((stream) => normalizeStream(stream))
    .map((stream, index) => {
      const { playable, warnings, score } = evaluateStream(stream, profile);
      return { stream, warnings, score, index, playable };
    });

  const evaluatedPlayable = evaluatedAll.filter((entry) => entry.playable);

  const deduped = [];
  for (const entry of evaluatedPlayable) {
    const existingIndex = deduped.findIndex((item) =>
      isDuplicateStream(item.stream, entry.stream)
    );
    if (existingIndex === -1) {
      deduped.push(entry);
      continue;
    }
    const existing = deduped[existingIndex];
    if (entry.score > existing.score) {
      deduped[existingIndex] = {
        ...entry,
        warnings: mergeWarnings(existing.warnings, entry.warnings)
      };
    } else {
      deduped[existingIndex] = {
        ...existing,
        warnings: mergeWarnings(existing.warnings, entry.warnings)
      };
    }
  }

  const scoredStreams = deduped
    .map((entry) => {
      const icon = entry.score >= 80 ? "⭐" : entry.score >= 40 ? "⚠️" : "❌";
      const warningText = entry.warnings.length ? `${entry.warnings.join(" • ")} | ` : "";
      const originalName = entry.stream.name;
      const name = `[${entry.stream.source}] ${icon} ${entry.score}% | ${warningText}${originalName}`;
      return {
        stream: { ...entry.stream, name },
        score: entry.score,
        index: entry.index,
        originalName,
        sourcePriority: getSourcePriority(entry.stream.source)
      };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.index - b.index;
    });

  let streams = scoredStreams.map((entry) => entry.stream);

  if (autoPick) {
    const eligible = scoredStreams.filter((entry) => entry.score >= 40);
    let picked = null;

    if (eligible.length) {
      picked = [...eligible].sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const sizeA = typeof a.stream.size === "number" ? a.stream.size : Infinity;
        const sizeB = typeof b.stream.size === "number" ? b.stream.size : Infinity;
        if (sizeA !== sizeB) return sizeA - sizeB;
        const codecA = getCodecPreference(a.originalName);
        const codecB = getCodecPreference(b.originalName);
        if (codecA !== codecB) return codecA - codecB;
        if (a.sourcePriority !== b.sourcePriority) return a.sourcePriority - b.sourcePriority;
        return a.index - b.index;
      })[0];
    }

    if (picked) {
      streams = [{ ...picked.stream, name: `▶ AUTO | ${picked.stream.name}` }];
    } else {
      const fallbackSource = scoredStreams.length
        ? scoredStreams
        : evaluatedAll
            .map((entry) => {
              const icon = entry.score >= 80 ? "⭐" : entry.score >= 40 ? "⚠️" : "❌";
              const warningText = entry.warnings.length ? `${entry.warnings.join(" • ")} | ` : "";
              const name = `[${entry.stream.source}] ${icon} ${entry.score}% | ${warningText}${entry.stream.name}`;
              return { stream: { ...entry.stream, name }, score: entry.score, index: entry.index };
            })
            .sort((a, b) => {
              if (b.score !== a.score) return b.score - a.score;
              return a.index - b.index;
            });

      streams = fallbackSource
        .slice(0, 3)
        .map((entry) => ({ ...entry.stream, name: `❌ ${entry.stream.name}` }));
    }
  }

  return { streams };
});

const addon = builder.getInterface();

const app = express();
app.get("/", (_req, res) => {
  res.status(200).send("OK");
});

serveHTTP(addon, {
  server: app,
  host: "0.0.0.0",
  port: Number(process.env.PORT)
});
