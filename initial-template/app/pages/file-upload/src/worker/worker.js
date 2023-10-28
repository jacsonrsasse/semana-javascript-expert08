import ViewProcessor from "./videoProcessor.js";
import Mp4Demuxer from "./mp4Demuxer.js";
import CanvasRender from "./canvasRender.js";
import WebMWriter from "../deps/webm-writer2.js";
import Service from "./service.js";

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

const webMWriterConfig = {
  codec: "VP9",
  ...encoderConfig.default,
};

const mp4Demuxer = new Mp4Demuxer();
const service = new Service({
  url: "http://localhost:3000",
});
const webMWriter = new WebMWriter(webMWriterConfig);
const videoProcessor = new ViewProcessor({
  mp4Demuxer,
  webMWriter,
  service,
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
