const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

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

export {
    sleep, waitNextFrame
}