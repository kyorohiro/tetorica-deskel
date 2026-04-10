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

type AppBackgroundImageCanvasHandle = {
    addImage: (data: Blob) => Promise<void>;
    clear: () => Promise<void>;
};

const INITIAL_FIT_RATIO = 0.7;

const AppBackgroundImageCanvas = forwardRef<AppBackgroundImageCanvasHandle, {}>(
    function (_, ref) {
        const canvasRef = useRef<HTMLCanvasElement | null>(null);
        const wrapRef = useRef<HTMLDivElement | null>(null);
        const imageRef = useRef<ImageBitmap | null>(null);

        const cssSizeRef = useRef({ width: 0, height: 0 });
        const dprRef = useRef(1);

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
            console.log(">>", { x, y, drawWidth, drawHeight, drawScale });

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