export const PROFILES = {
  WEAK_TV: {
    name: "WEAK_TV",
    allowCodecs: ["hevc"],
    allowHDR: false,
    allowDolbyVision: false,
    allow10bit: false,
    blockRemux: true,
    warnLosslessAudio: true,
    maxFileSizeGB: 25,
    maxResolution: 2160
  },
  ANDROID_TV: {
    name: "ANDROID_TV",
    allowCodecs: ["hevc", "h264"],
    allowHDR: true,
    allowDolbyVision: true,
    allow10bit: true,
    blockRemux: true,
    warnLosslessAudio: true,
    maxFileSizeGB: 40,
    maxResolution: 2160
  },
  PC: {
    name: "PC",
    allowCodecs: ["hevc", "h264"],
    allowHDR: true,
    allowDolbyVision: true,
    allow10bit: true,
    blockRemux: false,
    warnLosslessAudio: false,
    maxFileSizeGB: 80,
    maxResolution: 2160
  }
};
