export default class ViewProcessor {
  #mp4Demuxer;
  #webMWriter;
  #service;

  /**
   *
   * @param {object} options
   * @param {import('./mp4Demuxer.js').default} options.mp4Demuxer
   * @param {import('../deps/webm-writer2.js').default} options.webMWriter
   * @param {import('./service.js').default} options.service
   */
  constructor({ mp4Demuxer, webMWriter, service }) {
    this.#mp4Demuxer = mp4Demuxer;
    this.#webMWriter = webMWriter;
    this.#service = service;
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
            // const { supported } = await VideoDecoder.isConfigSupported(config);
            // if (!supported) {
            //   console.error(
            //     "mp4Muxer VideoDecoder config not supported",
            //     config
            //   );
            //   return;
            // }
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

  transformIntoWebM() {
    const writable = new WritableStream({
      write: (chunk) => {
        this.#webMWriter.addFrame(chunk);
      },
      close() {},
    });
    return {
      readable: this.#webMWriter.getStream(),
      writable,
    };
  }

  upload(filename, resolution, type) {
    const chunks = [];
    let byteCount = 0;
    let segmentCount = 0;

    const triggerUpload = async (chunks) => {
      const blob = new Blob(chunks, { type: "video/webm" });

      await this.#service.uploadFile({
        filename: `${filename}-${resolution}.${++segmentCount}.${type}`,
        fileBuffer: blob,
      });

      // reseta o array
      chunks.length = 0;
      byteCount = 0;
    };

    return new WritableStream({
      /**
       * @param {object} options
       * @param {Uint8Array} options.data
       */
      async write({ data }) {
        chunks.push(data);
        byteCount += data.byteLength;

        if (byteCount <= 10e6) return;

        await triggerUpload(chunks);
        // renderFrame(frame);
      },
      async close() {
        if (!chunks.length) return;

        await triggerUpload(chunks);
      },
    });
  }

  async start({ file, encoderConfig, renderFrame }) {
    const stream = file.stream();
    const filename = file.name.split("/").pop().replace(".mp4", "");
    await this.mp4Decoder(stream)
      .pipeThrough(this.encode144p(encoderConfig))
      .pipeThrough(this.renderDecodedFramesAndGetEncodedChunks(renderFrame))
      .pipeThrough(this.transformIntoWebM())
      .pipeTo(this.upload(filename, "144p", "webm"));
  }
}
