let _canvas = {};
let _context = {};

export default class CanvasRender {
  /** @param {VideoFrame} frame */
  static draw(frame) {
    const { displayHeight, displayWidth } = frame;
    _canvas.width = displayWidth;
    _canvas.height = displayHeight;

    _context.drawImage(frame, 0, 0, displayWidth, displayHeight);
    frame.close();
  }

  static getRender(canvas) {
    _canvas = canvas;
    _context = canvas.getContext("2d");

    const render = this;
    let pendingFrame = null;

    return (frame) => {
      const renderAnimationFrame = () => {
        render.draw(pendingFrame);
        pendingFrame = null;
      };

      if (!pendingFrame) {
        requestAnimationFrame(renderAnimationFrame);
      } else {
        pendingFrame.close();
      }

      pendingFrame = frame;
    };
  }
}
