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
  mp4Decoder(encoderConfig, stream) {
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

        this.#mp4Demuxer
          .run(stream, {
            onConfig(config) {
              decoder.configure(config);
            },
            /** @param {EncodedVideoChunk} chunk */
            onChunk(chunk) {
              // trigger the output
              decoder.decode(chunk);
            },
          })
          .then(() => {
            setTimeout(() => {
              controller.close();
            }, 1000);
          });
      },
    });
  }

  async start({ file, encoderConfig, renderFrame }) {
    const stream = file.stream();
    const filename = file.name.split("/").pop().replace(".mp4", "");
    await this.mp4Decoder(encoderConfig, stream).pipeTo(
      new WritableStream({
        write(frame) {
          renderFrame(frame);
        },
      })
    );
  }
}
