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

function getCurrentViewportSize(
    wrap: HTMLDivElement | null,
    canvas: HTMLCanvasElement | null
): { width: number; height: number } {
    const wrapRect = wrap?.getBoundingClientRect();

    const width = Math.max(
        1,
        Math.floor(
            wrapRect?.width ||
            canvas?.clientWidth ||
            window.innerWidth ||
            1024
        )
    );

    const height = Math.max(
        1,
        Math.floor(
            wrapRect?.height ||
            canvas?.clientHeight ||
            window.innerHeight ||
            1024
        )
    );

    return { width, height };
}

function getCanvasPoint(
    canvas: HTMLCanvasElement,
    clientX: number,
    clientY: number
): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();

    return {
        x: clientX - rect.left,
        y: clientY - rect.top,
    };
}

function normalizeToBytes(buffer: unknown): Uint8Array {
  if (buffer instanceof Uint8Array) {
    return buffer;
  }

  if (buffer instanceof ArrayBuffer) {
    return new Uint8Array(buffer);
  }

  if (Array.isArray(buffer)) {
    return new Uint8Array(buffer);
  }

  if (
    buffer &&
    typeof buffer === "object" &&
    "buffer" in (buffer as Record<string, unknown>)
  ) {
    const view = buffer as ArrayBufferView;
    if (view.buffer instanceof ArrayBuffer) {
      return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
    }
  }

  throw new Error(`Unsupported buffer type: ${Object.prototype.toString.call(buffer)}`);
}

import { save } from "@tauri-apps/plugin-dialog";
import { writeFileForNative } from "./native";


function isTauri() {
  return "__TAURI_INTERNALS__" in window;
}



type SaveFileData =
  | string
  | Blob
  | ArrayBuffer
  | ArrayBufferView;

type SaveFileOptions = {
  title: string;
  filename: string;
  data: SaveFileData;
  filters?: {
    name: string;
    extensions: string[];
  }[];
  mimeType?: string;
  showToast?: (message: string) => void;
};

function isArrayBufferView(value: unknown): value is ArrayBufferView {
  return ArrayBuffer.isView(value);
}

async function normalizeToUint8Array(data: SaveFileData): Promise<Uint8Array> {
  if (typeof data === "string") {
    return new TextEncoder().encode(data);
  }

  if (data instanceof Blob) {
    return new Uint8Array(await data.arrayBuffer());
  }

  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }

  if (isArrayBufferView(data)) {
    const bytes = new Uint8Array(data.byteLength);
    bytes.set(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
    return bytes;
  }

  throw new Error("Unsupported save data type");
}

async function normalizeToBlobPart(data: SaveFileData): Promise<BlobPart> {
  if (typeof data === "string") {
    return data;
  }

  if (data instanceof Blob) {
    return data;
  }

  if (data instanceof ArrayBuffer) {
    return data;
  }

  if (isArrayBufferView(data)) {
    const bytes = new Uint8Array(data.byteLength);
    bytes.set(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
    return bytes;
  }

  throw new Error("Unsupported blob data type");
}

export async function saveFileWithFallback({
  title,
  filename,
  data,
  filters,
  mimeType = "application/octet-stream",
  showToast,
}: SaveFileOptions) {
  if (isTauri()) {
    const path = await save({
      title,
      defaultPath: filename,
      filters,
    });

    if (!path) return null;

    const bytes = await normalizeToUint8Array(data);
    await writeFileForNative(path, bytes);
    showToast?.(`saved: ${path}`);
    return path;
  }

  const blob =
    data instanceof Blob
      ? data
      : new Blob([await normalizeToBlobPart(data)], { type: mimeType });

  const url = URL.createObjectURL(blob);

  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();

    showToast?.(`downloaded: ${filename}`);
    return filename;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function makeTimestampForFilename(date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  const ms = String(date.getMilliseconds()).padStart(3, "0");

  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}-${ms}`;
}

function makeFilenameWithTimestamp(prefix = "captureimage", ext = "png") {
  return `${prefix}-${makeTimestampForFilename()}.${ext}`;
}
export {
  sleep, waitNextFrame, getRectFromPoints, getCanvasPoint, getCurrentViewportSize, normalizeToBytes, makeFilenameWithTimestamp
}