type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function getSelfRectCss(targetEl: HTMLElement): Rect {
  const rect = targetEl.getBoundingClientRect();
  return {
    x: window.screenX + rect.left,
    y: window.screenY + rect.top,
    width: rect.width,
    height: rect.height,
  };
}

async function getVideo(): Promise<HTMLVideoElement> {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: true,
    selfBrowserSurface: "exclude",
    preferCurrentTab: false,
  } as any);

  const video = document.createElement("video");
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;

  await video.play();

  await new Promise<void>((resolve) => {
    if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
      resolve();
      return;
    }
    video.onloadedmetadata = () => resolve();
  });

  return video;
}

async function getImageFromVideo(
  video: HTMLVideoElement,
  targetEl: HTMLElement
): Promise<Blob | null> {
  const selfRectCss = getSelfRectCss(targetEl);

  // 画面全体共有前提
  const scaleX = video.videoWidth / screen.width;
  const scaleY = video.videoHeight / screen.height;

  const sx = Math.round(selfRectCss.x * scaleX);
  const sy = Math.round(selfRectCss.y * scaleY);
  const sw = Math.round(selfRectCss.width * scaleX);
  const sh = Math.round(selfRectCss.height * scaleY);

  const canvas = document.createElement("canvas");
  canvas.width = sw;
  canvas.height = sh;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");

  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);

  return await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png")
  );
}

function stopVideo(video: HTMLVideoElement) {
  const stream = video.srcObject;
  if (stream instanceof MediaStream) {
    stream.getTracks().forEach((t) => t.stop());
  }
  video.srcObject = null;
}

async function captureRectFromVideo(
  video: HTMLVideoElement,
  rectCss: Rect
): Promise<Blob | null> {
  const scaleX = video.videoWidth / screen.width;
  const scaleY = video.videoHeight / screen.height;

  const sx = Math.round(rectCss.x * scaleX);
  const sy = Math.round(rectCss.y * scaleY);
  const sw = Math.round(rectCss.width * scaleX);
  const sh = Math.round(rectCss.height * scaleY);

  const canvas = document.createElement("canvas");
  canvas.width = sw;
  canvas.height = sh;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");

  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);

  return await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png")
  );
}
function cleanupVideo(video: HTMLVideoElement | null) {
    if (!video) return;

    const stream = video.srcObject;
    if (stream instanceof MediaStream) {
        stream.getTracks().forEach((t) => t.stop());
    }

    video.pause();
    video.srcObject = null;
    video.remove();
}
export {
    stopVideo,
    getImageFromVideo,
    getVideo,
    getSelfRectCss,
    cleanupVideo,
    captureRectFromVideo
}