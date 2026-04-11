import {
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useRef,
} from "react";
import { useDialog } from "./useDialog";
import { useSyncExternalStore } from "react";
import { getCurrentViewportSize, waitNextFrame } from "./utils";

type CropImageResult = {
    blob: Blob;
    width: number;
    height: number;
};

type AppBackgroundImageCanvasHandle = {
    hasImage: () => boolean;
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
        const _stateShared = useBackgroundImageState();
        const dialog = useDialog();
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
                hasImage: () => imageRef.current != undefined && imageRef.current != null,
                addImage: async (data: Blob) => {
                    console.log("> addImage ", data);

                    await waitNextFrame();
                    resizeCanvas();

                    const preview = await createImageBitmap(data);

                    try {
                        await waitNextFrame();
                        resizeCanvas();

                        const { width: maxW, height: maxH } = getCurrentViewportSize(
                            wrapRef.current,
                            canvasRef.current
                        );

                        const needsShrink = preview.width > maxW || preview.height > maxH;

                        let nextImage: ImageBitmap;

                        if (needsShrink) {
                            const okToShrink = await dialog.showConfirmDialog({
                                title: "Large Image",
                                body: "This image is large. Shrink it to fit the screen before processing?",
                                cancelText: "Keep Original",
                                okText: "Shrink"
                            });

                            if (okToShrink) {
                                const scale = Math.min(maxW / preview.width, maxH / preview.height, 1);
                                const targetW = Math.max(1, Math.round(preview.width * scale));
                                const targetH = Math.max(1, Math.round(preview.height * scale));

                                preview.close();

                                nextImage = await createImageBitmap(data, {
                                    resizeWidth: targetW,
                                    resizeHeight: targetH,
                                    resizeQuality: "high",
                                });
                            } else {
                                nextImage = preview;
                            }
                        } else {
                            nextImage = preview;
                        }

                        imageRef.current?.close?.();
                        imageRef.current = nextImage;
                        resizeCanvas();
                        setBackgroundImageExists(true);
                    } catch (e) {
                        preview.close();
                        throw e;
                    }
                },
                clear: async () => {
                    imageRef.current?.close?.();
                    imageRef.current = null;
                    setBackgroundImageExists(false);
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

///---
/// 外部と共有する状態
///---
let _sharedState: {
  hasImage: boolean;
} = { hasImage: false };

const _sharedStateListeners = new Set<() => void>();

function _sharedStateEmit() {
  _sharedStateListeners.forEach((l) => l());
}

function setBackgroundImageExists(v: boolean) {
  if (_sharedState.hasImage === v) return;

  _sharedState = {
    ..._sharedState,
    hasImage: v,
  };

  _sharedStateEmit();
}

function useBackgroundImageState() {
  return useSyncExternalStore(
    (listener) => {
      _sharedStateListeners.add(listener);
      return () => _sharedStateListeners.delete(listener);
    },
    () => _sharedState
  );
}

export { AppBackgroundImageCanvas, useBackgroundImageState, setBackgroundImageExists };
export type { AppBackgroundImageCanvasHandle };