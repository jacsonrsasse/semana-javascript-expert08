import ViewProcessor from "./videoProcessor.js";
import Mp4Demuxer from "./mp4Demuxer.js";
import CanvasRender from "./canvasRender.js";

const qvgaConstraints = {
  width: 320,
  height: 240,
};

const vgaConstraints = {
  width: 640,
  height: 480,
};
const hdConstraints = {
  width: 1200,
  height: 720,
};

const encoderConfig = {
  default: {
    bitrate: 10e6,
    ...qvgaConstraints,
  },
  webm: {
    codec: "vp09.00.10.08",
    pt: 4,
    hardwareAcceleration: "prefer-software",
  },
  mp4: {
    codec: "avc1.42002A",
    pt: 1,
    hardwareAcceleration: "prefer-hardware",
    avc: {
      format: "annexb",
    },
  },
};

const mp4Demuxer = new Mp4Demuxer();
const videoProcessor = new ViewProcessor({
  mp4Demuxer,
});

onmessage = async ({ data }) => {
  await videoProcessor.start({
    file: data.file,
    encoderConfig: {
      ...encoderConfig.default,
      ...encoderConfig.webm,
    },
    renderFrame: CanvasRender.getRender(data.canvas),
  });

  self.postMessage({
    status: "done",
  });
};
