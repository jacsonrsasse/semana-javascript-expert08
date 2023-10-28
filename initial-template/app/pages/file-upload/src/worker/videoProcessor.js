export default class ViewProcessor {
  #mp4Demuxer;

  /**
   *
   * @param {object} options
   * @param {import('./mp4Demuxer.js').default} options.mp4Demuxer
   */
  constructor({ mp4Demuxer }) {
    this.#mp4Demuxer = mp4Demuxer;
  }

  /**
   *
   * @returns ReadableStream
   */
  mp4Decoder(stream) {
    return new ReadableStream({
      start: async (controller) => {
        const decoder = new VideoDecoder({
          error(e) {
            console.log("Erro at mp4Decoder", e);
            controller.error(e);
          },
          /** @param {VideoFrame} frame */
          output(frame) {
            controller.enqueue(frame);
          },
        });

        this.#mp4Demuxer.run(stream, {
          async onConfig(config) {
            const { supported } = await VideoDecoder.isConfigSupported(config);
            if (!supported) {
              console.error(
                "mp4Muxer VideoDecoder config not supported",
                config
              );
              return;
            }
            decoder.configure(config);
          },
          /** @param {EncodedVideoChunk} chunk */
          onChunk(chunk) {
            // trigger the output
            decoder.decode(chunk);
          },
        });
      },
    });
  }

  encode144p(encoderConfig) {
    let _encoder;
    const readableStream = new ReadableStream({
      start: async (controller) => {
        const { supported } = await VideoEncoder.isConfigSupported(
          encoderConfig
        );
        if (!supported) {
          const message = "encode144p VideoEncoder config not supported";
          console.error(message, encoderConfig);
          controller.error(message);
          return;
        }

        _encoder = new VideoEncoder({
          /**
           * @param {EncodedVideoChunk} chunk
           * @param {EncodedVideoChunkMetadata} config
           */
          output: (chunk, config) => {
            if (config.decoderConfig) {
              const decoderConfig = {
                type: "config",
                config: config.decoderConfig,
              };
              controller.enqueue(decoderConfig);
            }
            controller.enqueue(chunk);
          },
          error: (error) => {
            console.error("VideoEncoder 144p", error);
            controller.error(error);
          },
        });

        await _encoder.configure(encoderConfig);
      },
    });
    const writableStream = new WritableStream({
      async write(frame) {
        _encoder.encode(frame);
        frame.close();
      },
    });

    return {
      readable: readableStream,
      writable: writableStream,
    };
  }

  renderDecodedFramesAndGetEncodedChunks(renderFrame) {
    let _decoder;
    return new TransformStream({
      start(controller) {
        _decoder = new VideoDecoder({
          output(frame) {
            renderFrame(frame);
          },
          error(error) {
            console.error("error at renderFrames", error);
            controller.error(error);
          },
        });
      },
      /**
       *
       * @param {EncodedVideoChunk} encodedChunk
       * @param {TransformStreamDefaultController} controller
       */
      async transform(encodedChunk, controller) {
        if (encodedChunk.type === "config") {
          await _decoder.configure(encodedChunk.config);
          return;
        }

        _decoder.decode(encodedChunk);
        controller.enqueue(encodedChunk);
      },
    });
  }

  async start({ file, encoderConfig, renderFrame }) {
    const stream = file.stream();
    const filename = file.name.split("/").pop().replace(".mp4", "");
    await this.mp4Decoder(stream)
      .pipeThrough(this.encode144p(encoderConfig))
      .pipeThrough(this.renderDecodedFramesAndGetEncodedChunks(renderFrame))
      .pipeTo(
        new WritableStream({
          write(frame) {
            // renderFrame(frame);
          },
        })
      );
  }
}
