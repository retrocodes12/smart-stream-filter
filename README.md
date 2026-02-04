# Smart Stream Filter

Smart Stream Filter is a Stremio addon that fetches streams from Torrentio and filters them based on a hardware-aware profile for weak TVs and low-power devices.

## What It Does
- Pulls upstream streams from Torrentio
- Applies a selectable device profile to filter streams
- Enforces codec, size, resolution, and keyword rules based on the profile
 - Adds warning labels to risky streams instead of removing them

## How It Works
The addon exposes the `stream` resource for `movie` and `series`. When Stremio requests streams, it fetches results from Torrentio and applies the selected profile filters before returning the list.

## Device Profiles
Device profiles control how strict the filtering is based on your hardware.

How to select a profile:
- Install the addon in Stremio, then open its settings.
- Choose a profile from the dropdown and save.

Profile guidance:
- `WEAK_TV`: Best for weak TVs and low-power devices. Strict filtering, HEVC-only, blocks HDR/10bit and heavy audio formats.
- `ANDROID_TV`: Balanced for typical Android TV devices. Allows HEVC and x264 with HDR/10bit, blocks REMUX and lossless audio.
- `PC`: Best for desktop/laptop playback. Minimal blocking and highest size allowance.

## Warning Labels
Streams are not removed when they violate a profile rule (except for completely incompatible codecs). Instead, the addon prefixes stream names with warning labels:
- `⚠️` means risky but still playable
- `❌` means very likely to fail on the selected device

Warnings do not block playback; they are there to help you choose a more reliable stream. Profiles still control how strict the warnings are.

## Playability Score
Each stream is assigned a Playability Score (0–100%) based on risk factors like codec efficiency, size, HDR/Dolby Vision, audio format, and resolution. This score is a heuristic to help you pick the most reliable stream, not a guarantee of smooth playback.

Legend:
- `⭐` score ≥ 80
- `⚠️` score 40–79
- `❌` score < 40

## Upstream Providers
The addon pulls streams from multiple upstream sources and merges them into one list. Duplicate-looking streams are de-duplicated, and the highest-scoring entry is kept. Higher scores generally indicate a better chance of smooth playback on your selected profile.

Current upstreams:
- Torrentio
- MediaFusion

## Auto-Pick Best Stream
Auto-Pick mode returns only the single best-ranked stream instead of a full list. This is useful for TVs, parents, or non-technical users who want a single reliable option without choosing.

How it works:
- Picks the highest Playability Score (ignoring streams below 40).
- Ties are broken by smaller file size, then HEVC preference, then upstream priority.
- If nothing meets the minimum, it returns the top 3 low-score streams with ❌ labels as a fallback.

To disable Auto-Pick and keep manual control, turn off the `Auto Pick Best Stream` option in the addon settings.

## Deploy On Railway
1. Push this repository to GitHub.
2. In Railway, create a new project and connect your GitHub repo.
3. Railway will auto-detect the Node.js app and deploy it.
4. No manual start is required; Railway runs `npm start` automatically and uses `process.env.PORT`.

## Install In Stremio
After deployment, open the addon manifest URL from Railway in Stremio:

`https://<your-railway-domain>/manifest.json`

## Local Run
```bash
npm install
npm start
```
