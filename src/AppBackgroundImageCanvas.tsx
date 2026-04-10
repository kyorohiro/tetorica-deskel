import {
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useRef,
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

type CropImageResult = {
  blob: Blob;
  width: number;
  height: number;
};

type AppBackgroundImageCanvasHandle = {
  addImage: (data: Blob) => Promise<void>;
  clear: () => Promise<void>;
  getCropImage: (rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => Promise<CropImageResult | null>;
};

const INITIAL_FIT_RATIO = 0.7;

const AppBackgroundImageCanvas = forwardRef<AppBackgroundImageCanvasHandle, {}>(

    function (_, ref) {
        const canvasRef = useRef<HTMLCanvasElement | null>(null);
        const wrapRef = useRef<HTMLDivElement | null>(null);
        const imageRef = useRef<ImageBitmap | null>(null);

        const cssSizeRef = useRef({ width: 0, height: 0 });
        const dprRef = useRef(1);
        const lastDrawRef = useRef({
            x: 0,
            y: 0,
            drawWidth: 0,
            drawHeight: 0,
            drawScale: 1,
        });
        const redrawAll = useCallback(() => {
            const canvas = canvasRef.current;
            if (!canvas) return;

            const ctx = canvas.getContext("2d");
            if (!ctx) return;

            const { width, height } = cssSizeRef.current;
            const dpr = dprRef.current;

            if (width <= 0 || height <= 0) return;

            // 内部ピクセル全体を消す
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // CSSピクセル基準に戻す
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            const image = imageRef.current;
            if (!image) return;


            //ctx.drawImage(image, x, y, drawWidth, drawHeight);
            const fitScale = Math.min(
                width / image.width,
                height / image.height,
                1
            );

            const drawScale = fitScale * INITIAL_FIT_RATIO;
            const drawWidth = image.width * drawScale;
            const drawHeight = image.height * drawScale;
            const x = (width - drawWidth) / 2;
            const y = (height - drawHeight) / 2;

            lastDrawRef.current = {
                x,
                y,
                drawWidth,
                drawHeight,
                drawScale,
            };

            ctx.drawImage(image, x, y, drawWidth, drawHeight);
        }, []);

        const resizeCanvas = useCallback(() => {
            const canvas = canvasRef.current;
            const wrap = wrapRef.current;
            if (!canvas || !wrap) return;

            const rect = wrap.getBoundingClientRect();
            const cssWidth = Math.max(1, Math.floor(rect.width));
            const cssHeight = Math.max(1, Math.floor(rect.height));
            const dpr = window.devicePixelRatio || 1;

            dprRef.current = dpr;
            cssSizeRef.current = { width: cssWidth, height: cssHeight };

            // CSS表示サイズを明示固定
            canvas.style.width = `${cssWidth}px`;
            canvas.style.height = `${cssHeight}px`;

            // 内部解像度
            canvas.width = Math.floor(cssWidth * dpr);
            canvas.height = Math.floor(cssHeight * dpr);

            redrawAll();
        }, [redrawAll]);

        useEffect(() => {
            const onResize = () => {
                resizeCanvas();
            };

            onResize();
            window.addEventListener("resize", onResize);

            return () => {
                window.removeEventListener("resize", onResize);
            };
        }, [resizeCanvas]);


        useImperativeHandle(
            ref,
            () => ({
                addImage: async (data: Blob) => {
                    const image = await createImageBitmap(data);
                    imageRef.current?.close?.();
                    imageRef.current = image;
                    resizeCanvas();
                },
                clear: async () => {
                    imageRef.current?.close?.();
                    imageRef.current = null;
                    redrawAll();
                },
                getCropImage: async (rect) => {
                    const image = imageRef.current;
                    if (!image) return null;

                    const draw = lastDrawRef.current;
                    if (draw.drawWidth <= 0 || draw.drawHeight <= 0 || draw.drawScale <= 0) {
                        return null;
                    }

                    // 選択矩形を、表示中画像の範囲に合わせて画像座標へ逆変換
                    const imageLeft = draw.x;
                    const imageTop = draw.y;
                    const imageRight = draw.x + draw.drawWidth;
                    const imageBottom = draw.y + draw.drawHeight;

                    const selLeft = rect.x;
                    const selTop = rect.y;
                    const selRight = rect.x + rect.width;
                    const selBottom = rect.y + rect.height;

                    // 画像の表示範囲と交差した部分だけ使う
                    const clippedLeft = Math.max(selLeft, imageLeft);
                    const clippedTop = Math.max(selTop, imageTop);
                    const clippedRight = Math.min(selRight, imageRight);
                    const clippedBottom = Math.min(selBottom, imageBottom);

                    const clippedWidth = clippedRight - clippedLeft;
                    const clippedHeight = clippedBottom - clippedTop;

                    if (clippedWidth <= 0 || clippedHeight <= 0) {
                        return null;
                    }

                    // CSS px -> 元画像 px
                    const srcX = Math.max(0, Math.floor((clippedLeft - draw.x) / draw.drawScale));
                    const srcY = Math.max(0, Math.floor((clippedTop - draw.y) / draw.drawScale));
                    const srcWidth = Math.min(
                        image.width - srcX,
                        Math.ceil(clippedWidth / draw.drawScale)
                    );
                    const srcHeight = Math.min(
                        image.height - srcY,
                        Math.ceil(clippedHeight / draw.drawScale)
                    );

                    if (srcWidth <= 0 || srcHeight <= 0) {
                        return null;
                    }

                    const outCanvas = document.createElement("canvas");
                    outCanvas.width = srcWidth;
                    outCanvas.height = srcHeight;

                    const outCtx = outCanvas.getContext("2d");
                    if (!outCtx) return null;

                    outCtx.drawImage(
                        image,
                        srcX,
                        srcY,
                        srcWidth,
                        srcHeight,
                        0,
                        0,
                        srcWidth,
                        srcHeight
                    );

                    const blob = await new Promise<Blob | null>((resolve) => {
                        outCanvas.toBlob((b) => resolve(b), "image/png");
                    });

                    if (!blob) return null;

                    return {
                        blob,
                        width: srcWidth,
                        height: srcHeight,
                    };
                },
            }),
            [redrawAll, resizeCanvas]
        );

        return (
            <div className="fixed inset-0 z-0">
                <div ref={wrapRef} className="absolute inset-0 overflow-hidden">
                    <canvas
                        ref={canvasRef}
                        className="block"
                    />
                </div>
            </div>
        );
    }
);

export { AppBackgroundImageCanvas, getCanvasPoint };
export type { AppBackgroundImageCanvasHandle };