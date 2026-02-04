import fetch from "node-fetch";

const UPSTREAMS = [
  { name: "Torrentio", baseUrl: "https://torrentio.strem.fun" },
  { name: "MediaFusion", baseUrl: "https://mediafusion.elfhosted.com" }
];

async function fetchFromUpstream(upstream, type, id) {
  const url = `${upstream.baseUrl}/stream/${encodeURIComponent(type)}/${encodeURIComponent(id)}.json`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "smart-stream-filter" } });
    if (!res.ok) return [];
    const data = await res.json();
    const streams = Array.isArray(data?.streams) ? data.streams : [];
    return streams.map((stream) => ({ ...stream, source: upstream.name }));
  } catch {
    return [];
  }
}

export async function fetchUpstreamStreams(args) {
  const { type, id } = args || {};
  if (!type || !id) return [];

  const results = await Promise.all(
    UPSTREAMS.map((upstream) => fetchFromUpstream(upstream, type, id))
  );

  return results.flat();
}
