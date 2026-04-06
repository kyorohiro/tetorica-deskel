const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

/**
 * Waits for the next animation frame, and can wait for multiple frames if needed.
 * @param count 
 * @returns 
 */
function waitNextFrame(count = 2): Promise<void> {
  return new Promise((resolve) => {
    const step = () => {
      if (count <= 0) {
        resolve();
        return;
      }
      count--;
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

// CSS座標をCanvas座標に変換する関数
// ただし、CanvasのサイズをCSSサイズと同じにしているので、この関数は使用していない
function getRectFromPoints(params: {
  start: { x: number; y: number };
  current: { x: number; y: number };
  canvas?: HTMLCanvasElement;
  withScale?: boolean;
}): { x: number; y: number; width: number; height: number } {
  if (params.withScale && params.canvas) {
    const rect = params.canvas.getBoundingClientRect();
    const scaleX = params.canvas.width / rect.width;
    const scaleY = params.canvas.height / rect.height;

    const left = Math.min(params.start.x, params.current.x);
    const top = Math.min(params.start.y, params.current.y);
    const right = Math.max(params.start.x, params.current.x);
    const bottom = Math.max(params.start.y, params.current.y);

    return {
      x: left * scaleX,
      y: top * scaleY,
      width: (right - left) * scaleX,
      height: (bottom - top) * scaleY,
    };
  } else {
    const x = Math.min(params.start.x, params.current.x);
    const y = Math.min(params.start.y, params.current.y);
    const width = Math.abs(params.current.x - params.start.x);
    const height = Math.abs(params.current.y - params.start.y);

    return { x, y, width, height };
  }

}

export {
  sleep, waitNextFrame, getRectFromPoints
}