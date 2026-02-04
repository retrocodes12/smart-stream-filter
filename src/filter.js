const RESOLUTION_ORDER = [720, 1080, 2160];

function normalizeName(name) {
  return (name || "").toLowerCase();
}

function detectCodec(name) {
  if (name.includes("hevc") || name.includes("x265") || name.includes("h265")) return "hevc";
  if (name.includes("x264") || name.includes("h264") || name.includes("avc")) return "h264";
  return "unknown";
}

function detectResolution(name) {
  if (name.includes("2160p") || name.includes("4k")) return 2160;
  if (name.includes("1080p")) return 1080;
  if (name.includes("720p")) return 720;
  return 0;
}

function parseSizeGB(stream) {
  if (typeof stream?.size === "number") {
    return stream.size / (1024 ** 3);
  }
  const title = normalizeName(stream?.title || stream?.name);
  const match = title.match(/(\d+(?:\.\d+)?)\s*(gb|gib)/i);
  if (match) return parseFloat(match[1]);
  const matchMb = title.match(/(\d+(?:\.\d+)?)\s*(mb|mib)/i);
  if (matchMb) return parseFloat(matchMb[1]) / 1024;
  return 0;
}

function includesAny(name, keywords) {
  return keywords.some((keyword) => name.includes(keyword));
}

export function evaluateStream(stream, profile) {
  const name = normalizeName(stream?.name || stream?.title || "");
  const warnings = [];
  let score = 100;

  const codec = detectCodec(name);
  const resolution = detectResolution(name);
  const sizeGB = parseSizeGB(stream);

  if (profile?.allowCodecs?.length && codec !== "unknown" && !profile.allowCodecs.includes(codec)) {
    return { playable: false, warnings, score: 0 };
  }

  const hasHDR = includesAny(name, ["hdr"]);
  const hasDolbyVision = includesAny(name, ["dolby vision", "dolbyvision", "dv"]);
  const has10bit = includesAny(name, ["10bit", "10 bit", "10-bit"]);
  const hasRemux = includesAny(name, ["remux"]);
  const hasLosslessAudio = includesAny(name, [
    "truehd",
    "dts-hd",
    "dts hd",
    "dts-hd ma",
    "dts ma",
    "atmos",
    "flac"
  ]);

  if (hasRemux && profile?.blockRemux) {
    return { playable: false, warnings, score: 0 };
  }

  if (hasHDR && profile?.allowHDR === false) {
    warnings.push("HDR not supported");
    score -= 15;
  }
  if (hasDolbyVision && profile?.allowDolbyVision === false) {
    warnings.push("Dolby Vision not supported");
    score -= 15;
  }
  if (has10bit && profile?.allow10bit === false) warnings.push("10bit not supported");

  if (hasRemux && !profile?.blockRemux) {
    warnings.push("REMUX – very high bitrate");
    score -= 30;
  }

  if (hasLosslessAudio && profile?.warnLosslessAudio) {
    warnings.push("Lossless audio may cause buffering");
    score -= 15;
  }

  if (codec === "h264" && profile?.name === "WEAK_TV") {
    warnings.push("x264 is inefficient for this device");
    score -= 20;
  }

  if (profile?.maxFileSizeGB && sizeGB && sizeGB > profile.maxFileSizeGB) {
    const veryLarge = sizeGB > profile.maxFileSizeGB * 1.5;
    warnings.push(
      veryLarge
        ? "Very likely to fail: too large for this device"
        : "Too large for this device"
    );
    score -= veryLarge ? 25 : 10;
  }

  if (profile?.maxResolution && resolution) {
    const allowed = RESOLUTION_ORDER.includes(resolution)
      ? resolution <= profile.maxResolution
      : true;
    if (!allowed) warnings.push("Resolution exceeds device limits");
    if (resolution === profile.maxResolution && profile?.name === "WEAK_TV") {
      warnings.push("Near device resolution limit");
      score -= 10;
    }
  }

  if (codec === "unknown" || (!resolution && !sizeGB)) {
    warnings.push("Unknown codec or metadata");
    score -= 10;
  }

  if (score < 0) score = 0;
  if (score > 100) score = 100;

  return { playable: true, warnings, score };
}
