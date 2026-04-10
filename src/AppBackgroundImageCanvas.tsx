import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

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

type AppBackgroundImageCanvasHandle = {
  addImage: (data: Blob) => Promise<void>;
  clear: () => Promise<void>;
};

const AppBackgroundImageCanvas = forwardRef<AppBackgroundImageCanvasHandle, {}>(
  function (_, ref) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const wrapRef = useRef<HTMLDivElement | null>(null);

    const [canvasSize, setCanvasSize] = useState({ width: 1200, height: 760 });

    // 読み込んだ画像を保持
    const imageRef = useRef<ImageBitmap | null>(null);

    const redrawAll = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const rect = canvas.getBoundingClientRect();

      ctx.clearRect(0, 0, rect.width, rect.height);

      const image = imageRef.current;
      if (!image) {
        return;
      }

      // 元画像サイズのまま中央表示
      const drawWidth = image.width;
      const drawHeight = image.height;
      const x = (rect.width - drawWidth) / 2;
      const y = (rect.height - drawHeight) / 2;

      ctx.drawImage(image, x, y, drawWidth, drawHeight);
    }, []);

    const resizeCanvas = useCallback(() => {
      const canvas = canvasRef.current;
      const wrap = wrapRef.current;
      if (!canvas || !wrap) return;

      const dpr = window.devicePixelRatio || 1;
      const rect = wrap.getBoundingClientRect();
      const width = Math.floor(rect.width);
      const height = Math.floor(rect.height);

      canvas.style.width = "100%";
      canvas.style.height = "100%";

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // CSSピクセル基準で描けるようにする
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      setCanvasSize({ width, height });
      redrawAll();
    }, [redrawAll]);

    useEffect(() => {
      resizeCanvas();
      window.addEventListener("resize", resizeCanvas);
      return () => window.removeEventListener("resize", resizeCanvas);
    }, [resizeCanvas]);

    useEffect(() => {
      redrawAll();
    }, [canvasSize, redrawAll]);

    useImperativeHandle(
      ref,
      () => ({
        addImage: async (data: Blob) => {
          console.log("> Canvas.addImage", data);
          const image = await createImageBitmap(data);

          // 前の ImageBitmap を解放
          imageRef.current?.close?.();
          imageRef.current = image;

          redrawAll();
        },
        clear: async () => {
          console.log("> Canvas.clear");
          imageRef.current?.close?.();
          imageRef.current = null;
          redrawAll();
        }
      }),
      [redrawAll]
    );

    return (
      <div
        className="fixed inset-0 z-0 select-none"
        style={{
          userSelect: "none",
          WebkitUserSelect: "none",
          WebkitTouchCallout: "none",
        }}
      >
        <div className="h-screen w-screen text-slate-50">
          <div className="flex h-full w-full flex-col">
            <div className="flex-1 p-0">
              <div className="h-full w-full rounded-2xl border border-slate-800 shadow-xl">
                <div className="flex h-full w-full flex-col space-y-0 p-0">
                  <div
                    ref={wrapRef}
                    className="min-h-0 flex-1 rounded-2xl border border-slate-800 p-0 m-1"
                  >
                    <canvas
                      ref={canvasRef}
                      className="block h-full w-full touch-none rounded-xl"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

export { AppBackgroundImageCanvas, getCanvasPoint };

export type { AppBackgroundImageCanvasHandle };