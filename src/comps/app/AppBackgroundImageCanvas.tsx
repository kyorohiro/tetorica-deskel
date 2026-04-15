import {
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useRef,
} from "react";
import { useDialog } from "../utils/useDialog";
import { useSyncExternalStore } from "react";
import { canvasToBlob, getCurrentViewportSize, waitNextFrame } from "../../utils";
import { cleanupVideo } from "../../natives/nativeWebScreenshot";

type CropImageResult = {
    blob: Blob;
    width: number;
    height: number;
};

type AppBackgroundImageCanvasHandle = {
    hasImage: () => boolean;
    addImage: (data: Blob) => Promise<void>;
    addVideo: (data: HTMLVideoElement) => Promise<void>;
    clear: () => Promise<void>;
    getCropImage: (rect: {
        x: number;
        y: number;
        width: number;
        height: number;
    }) => Promise<CropImageResult | null>;
    getBlob: () => Promise<Blob | null | undefined>;
};

const INITIAL_FIT_RATIO = 0.7;

const AppBackgroundImageCanvas = forwardRef<AppBackgroundImageCanvasHandle, {}>(
    function (_, ref) {
        const dialog = useDialog();
        const canvasRef = useRef<HTMLCanvasElement | null>(null);
        const wrapRef = useRef<HTMLDivElement | null>(null);

        const imageRef = useRef<ImageBitmap | null>(null);

        // ★ 追加
        const videoRef = useRef<HTMLVideoElement | null>(null);
        const videoHostRef = useRef<HTMLDivElement | null>(null);

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

            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            const image = imageRef.current;
            if (!image) return;

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

            canvas.style.width = `${cssWidth}px`;
            canvas.style.height = `${cssHeight}px`;

            canvas.width = Math.floor(cssWidth * dpr);
            canvas.height = Math.floor(cssHeight * dpr);

            redrawAll();
        }, [redrawAll]);

        useEffect(() => {
            const onResize = () => resizeCanvas();
            onResize();
            window.addEventListener("resize", onResize);
            return () => window.removeEventListener("resize", onResize);
        }, [resizeCanvas]);

        useImperativeHandle(
            ref,
            () => ({
                hasImage: () =>
                    imageRef.current != null || videoRef.current != null,

                getBlob: async () => {
                    let canvas = canvasRef.current;
                    if (canvas) {
                        return canvasToBlob({ canvas });
                    } else {
                        return null;
                    }
                },

                // ★ ここが今回の本命
                addVideo: async (data: HTMLVideoElement) => {
                    await waitNextFrame();
                    resizeCanvas();

                    // image消す
                    imageRef.current?.close?.();
                    imageRef.current = null;

                    // 既存video削除
                    if (videoRef.current?.parentNode) {
                        videoRef.current.parentNode.removeChild(videoRef.current);
                    }

                    const host = videoHostRef.current;
                    if (!host) return;

                    videoRef.current = data;

                    data.style.position = "absolute";
                    data.style.inset = "0";
                    data.style.width = "100%";
                    data.style.height = "100%";
                    data.style.objectFit = "contain";
                    data.style.pointerEvents = "none";
                    data.muted = true;
                    data.playsInline = true;

                    host.innerHTML = "";
                    host.appendChild(data);

                    try {
                        await data.play();
                    } catch { }

                    setBackgroundImageExists(true);
                    redrawAll();
                },

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
                        //
                        //
                        // video消す
                        if (videoRef.current?.parentNode) {
                            videoRef.current.parentNode.removeChild(videoRef.current);
                        }
                        cleanupVideo(videoRef.current);
                        videoRef.current = null;
                        //
                        //
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

                    if (videoRef.current) {
                        const stream = videoRef.current.srcObject;
                        if (stream instanceof MediaStream) {
                            stream.getTracks().forEach((t) => t.stop());
                        }

                        videoRef.current.remove();
                        videoRef.current = null;
                    }

                    setBackgroundImageExists(false);
                    redrawAll();
                },
                getCropImage: async (_rect) => {
                    console.log("> getCropImage", _rect);

                    const image = imageRef.current;
                    if (image) {
                        const draw = lastDrawRef.current;
                        if (draw.drawWidth <= 0 || draw.drawHeight <= 0 || draw.drawScale <= 0) {
                            console.log(">> invalid draw info");
                            return null;
                        }

                        const imageLeft = draw.x;
                        const imageTop = draw.y;
                        const imageRight = draw.x + draw.drawWidth;
                        const imageBottom = draw.y + draw.drawHeight;

                        const selLeft = _rect.x;
                        const selTop = _rect.y;
                        const selRight = _rect.x + _rect.width;
                        const selBottom = _rect.y + _rect.height;

                        const clippedLeft = Math.max(selLeft, imageLeft);
                        const clippedTop = Math.max(selTop, imageTop);
                        const clippedRight = Math.min(selRight, imageRight);
                        const clippedBottom = Math.min(selBottom, imageBottom);

                        const clippedWidth = clippedRight - clippedLeft;
                        const clippedHeight = clippedBottom - clippedTop;

                        if (clippedWidth <= 0 || clippedHeight <= 0) {
                            console.log(">> clipped size <= 0");
                            return null;
                        }

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
                            console.log(">> src size <= 0");
                            return null;
                        }

                        const canvas = document.createElement("canvas");
                        canvas.width = srcWidth;
                        canvas.height = srcHeight;

                        const ctx = canvas.getContext("2d");
                        if (!ctx) {
                            console.log(">> ctx is null");
                            return null;
                        }

                        ctx.drawImage(
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

                        const blob = await new Promise<Blob | null>((resolve) =>
                            canvas.toBlob(resolve, "image/png")
                        );

                        if (!blob) {
                            console.log(">> blob is null");
                            return null;
                        }

                        console.log(">> image crop", srcWidth, srcHeight);
                        return {
                            blob,
                            width: srcWidth,
                            height: srcHeight,
                        };
                    } else {
                        const video = videoRef.current;
                        const wrap = wrapRef.current;

                        if (video && wrap) {
                            const wrapRect = wrap.getBoundingClientRect();
                            const wrapWidth = wrapRect.width;
                            const wrapHeight = wrapRect.height;

                            const videoWidth = video.videoWidth;
                            const videoHeight = video.videoHeight;

                            if (wrapWidth <= 0 || wrapHeight <= 0 || videoWidth <= 0 || videoHeight <= 0) {
                                console.log(">> invalid video or wrap size");
                                return null;
                            }

                            // CSS の objectFit: contain と同じ計算
                            const fitScale = Math.min(
                                wrapWidth / videoWidth,
                                wrapHeight / videoHeight,
                                1
                            );

                            const drawWidth = videoWidth * fitScale;
                            const drawHeight = videoHeight * fitScale;
                            const drawX = (wrapWidth - drawWidth) / 2;
                            const drawY = (wrapHeight - drawHeight) / 2;

                            // _rect は wrap 内座標
                            const selLeft = _rect.x;
                            const selTop = _rect.y;
                            const selRight = _rect.x + _rect.width;
                            const selBottom = _rect.y + _rect.height;

                            // video の表示範囲と交差した部分だけ切り出す
                            const videoLeft = drawX;
                            const videoTop = drawY;
                            const videoRight = drawX + drawWidth;
                            const videoBottom = drawY + drawHeight;

                            const clippedLeft = Math.max(selLeft, videoLeft);
                            const clippedTop = Math.max(selTop, videoTop);
                            const clippedRight = Math.min(selRight, videoRight);
                            const clippedBottom = Math.min(selBottom, videoBottom);

                            const clippedWidth = clippedRight - clippedLeft;
                            const clippedHeight = clippedBottom - clippedTop;

                            if (clippedWidth <= 0 || clippedHeight <= 0) {
                                console.log(">> clipped video size <= 0");
                                return null;
                            }

                            // wrap 内の表示座標 -> 元 video 座標へ逆変換
                            const srcX = Math.max(0, Math.floor((clippedLeft - drawX) / fitScale));
                            const srcY = Math.max(0, Math.floor((clippedTop - drawY) / fitScale));
                            const srcWidth = Math.min(
                                videoWidth - srcX,
                                Math.ceil(clippedWidth / fitScale)
                            );
                            const srcHeight = Math.min(
                                videoHeight - srcY,
                                Math.ceil(clippedHeight / fitScale)
                            );

                            if (srcWidth <= 0 || srcHeight <= 0) {
                                console.log(">> src video size <= 0");
                                return null;
                            }

                            const canvas = document.createElement("canvas");
                            canvas.width = srcWidth;
                            canvas.height = srcHeight;

                            const ctx = canvas.getContext("2d");
                            if (!ctx) {
                                console.log(">> ctx is null");
                                return null;
                            }

                            ctx.drawImage(
                                video,
                                srcX,
                                srcY,
                                srcWidth,
                                srcHeight,
                                0,
                                0,
                                srcWidth,
                                srcHeight
                            );

                            const blob = await new Promise<Blob | null>((resolve) =>
                                canvas.toBlob(resolve, "image/png")
                            );

                            if (!blob) {
                                console.log(">> blob is null");
                                return null;
                            }

                            console.log(">> video crop", srcWidth, srcHeight);
                            return {
                                blob,
                                width: srcWidth,
                                height: srcHeight,
                            };
                        }

                        console.log(">> return null");
                        return null;
                    }
                },
            }),
            [redrawAll, resizeCanvas]
        );

        return (
            <div className="fixed inset-0 z-0">
                <div ref={wrapRef} className="absolute inset-0 overflow-hidden">
                    <canvas
                        ref={canvasRef}
                        className="block absolute inset-0"
                    />

                    {/* ★ video表示レイヤー */}
                    <div
                        ref={videoHostRef}
                        className="absolute inset-0 pointer-events-none"
                    />
                </div>
            </div>
        );
    }
);

/// --- state ---
let _sharedState = { hasImage: false };
const _sharedStateListeners = new Set<() => void>();

function _emit() {
    _sharedStateListeners.forEach((l) => l());
}

function setBackgroundImageExists(v: boolean) {
    if (_sharedState.hasImage === v) return;
    _sharedState = { hasImage: v };
    _emit();
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

export { AppBackgroundImageCanvas, useBackgroundImageState };
export type { AppBackgroundImageCanvasHandle };