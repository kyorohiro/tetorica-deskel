import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Tool = "pen" | "eraser";

type Point = { x: number; y: number };

type Stroke = {
    tool: Tool;
    color: string;
    size: number;
    points: Point[];
};

const BG_COLOR = "#00000000";//"#111827";
const DEFAULT_COLOR = "#00ff88";
const PEN_SIZE = 2;
const ERASER_SIZE = 18;


function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
    if (stroke.points.length === 0) return;

    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.lineWidth = stroke.size;

    if (stroke.tool === "eraser") {
        ctx.globalCompositeOperation = "destination-out";
        ctx.strokeStyle = "rgba(0,0,0,1)";
    } else {
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = stroke.color;
    }

    if (stroke.points.length === 1) {
        const p = stroke.points[0];
        ctx.beginPath();
        ctx.arc(p.x, p.y, stroke.size / 2, 0, Math.PI * 2);
        if (stroke.tool === "eraser") {
            ctx.fillStyle = "rgba(0,0,0,1)";
        } else {
            ctx.fillStyle = stroke.color;
        }
        ctx.fill();
        ctx.restore();
        return;
    }

    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (let i = 1; i < stroke.points.length; i += 1) {
        const p = stroke.points[i];
        ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    ctx.restore();
}

function redrawAll(
    canvas: HTMLCanvasElement,
    strokes: Stroke[],
    draftStroke: Stroke | null
) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();

    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, rect.width, rect.height);

    for (const stroke of strokes) {
        drawStroke(ctx, stroke);
    }

    if (draftStroke) {
        drawStroke(ctx, draftStroke);
    }
}

//function getCanvasPoint(canvas: HTMLCanvasElement, clientX: number, clientY: number): Point {
//    const rect = canvas.getBoundingClientRect();
//    const scaleX = canvas.width / rect.width;
//    const scaleY = canvas.height / rect.height;
//
//    return {
//        x: (clientX - rect.left) * scaleX,
//        y: (clientY - rect.top) * scaleY,
//    };
//}
function getCanvasPoint(canvas: HTMLCanvasElement, clientX: number, clientY: number): Point {
    const rect = canvas.getBoundingClientRect();

    return {
        x: clientX - rect.left,
        y: clientY - rect.top,
    };
}

function DeskelSimpleDrawCanvas() {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const wrapRef = useRef<HTMLDivElement | null>(null);

    const [tool, setTool] = useState<Tool>("pen");
    const [color, setColor] = useState(DEFAULT_COLOR);
    const [strokes, setStrokes] = useState<Stroke[]>([]);
    const [draftStroke, setDraftStroke] = useState<Stroke | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [canvasSize, setCanvasSize] = useState({ width: 1200, height: 760 });

    const activeSize = useMemo(() => {
        return tool === "eraser" ? ERASER_SIZE : PEN_SIZE;
    }, [tool]);

    const resizeCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const dpr = window.devicePixelRatio || 1;

        // いったんCSS側の幅でレイアウトさせる
        canvas.style.width = "100%";
        canvas.style.height = `${Math.max(100, Math.floor(window.innerHeight * 0.68))}px`;

        const rect = canvas.getBoundingClientRect();
        const width = Math.floor(rect.width);
        const height = Math.floor(rect.height);
        console.log("> rect", width, height);

        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        setCanvasSize({ width, height });
        redrawAll(canvas, strokes, draftStroke);
    }, [draftStroke, strokes]);

    useEffect(() => {
        resizeCanvas();
        window.addEventListener("resize", resizeCanvas);
        return () => window.removeEventListener("resize", resizeCanvas);
    }, [resizeCanvas]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        redrawAll(canvas, strokes, draftStroke);
    }, [strokes, draftStroke, canvasSize]);

    const startDraw = useCallback(
        (clientX: number, clientY: number) => {
            console.log(">> startDraw", clientX, clientY)
            const canvas = canvasRef.current;
            if (!canvas) return;
            const p = getCanvasPoint(canvas, clientX, clientY);
            setIsDrawing(true);
            setDraftStroke({
                tool,
                color,
                size: activeSize,
                points: [p],
            });
        },
        [activeSize, color, tool]
    );

    const moveDraw = useCallback((clientX: number, clientY: number) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        setDraftStroke((prev) => {
            if (!prev) return prev;
            const p = getCanvasPoint(canvas, clientX, clientY);
            return {
                ...prev,
                points: [...prev.points, p],
            };
        });
    }, []);

    const endDraw = useCallback(() => {
        setIsDrawing(false);
        setDraftStroke((prev) => {
            if (!prev) return null;
            setStrokes((current) => [...current, prev]);
            return null;
        });
    }, []);

    const onPointerDown = useCallback(
        (e: React.PointerEvent<HTMLCanvasElement>) => {
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            startDraw(e.clientX, e.clientY);
        },
        [startDraw]
    );

    const onPointerMove = useCallback(
        (e: React.PointerEvent<HTMLCanvasElement>) => {
            if (!isDrawing) return;
            moveDraw(e.clientX, e.clientY);
        },
        [isDrawing, moveDraw]
    );

    const onPointerUp = useCallback(
        (e: React.PointerEvent<HTMLCanvasElement>) => {
            if (!isDrawing) return;
            e.currentTarget.releasePointerCapture(e.pointerId);
            endDraw();
        },
        [endDraw, isDrawing]
    );

    const undo = useCallback(() => {
        setStrokes((prev) => prev.slice(0, -1));
    }, []);

    const clearAll = useCallback(() => {
        setStrokes([]);
        setDraftStroke(null);
    }, []);

    return (
        <div
            className="absolute left-3 top-3 z-20 flex items-center gap-2 select-none"
            style={{
                userSelect: "none",
                WebkitUserSelect: "none",
                WebkitTouchCallout: "none",
            }}
        >
            <div className="min-h-scree text-slate-50 p-4 md:p-6">
                <div className="mx-auto max-w-7xl space-y-4">

                    <div className="rounded-2xl border border-slate-800  shadow-xl">
                        <div className="space-y-3 p-3 md:p-4">

                            <div
                                ref={wrapRef}
                                className="rounded-2xl border border-slate-80 p-2"
                            >
                                <canvas
                                    ref={canvasRef}
                                    onPointerDown={onPointerDown}
                                    onPointerMove={onPointerMove}
                                    onPointerUp={onPointerUp}
                                    onPointerCancel={endDraw}
                                    className="block w-full touch-none rounded-x"
                                />
                            </div>

                            <div className="flex flex-wrap items-center gap-2 ">
                                <button
                                    className="rounded-2xl border border-slate-700 px-4 py-2 text-sm bg-slate-900 hover:bg-slate-800"
                                    onClick={() => setTool("pen")}
                                >
                                    ペン
                                </button>

                                <button
                                    className="rounded-2xl border border-slate-700 px-4 py-2 text-sm bg-slate-900 hover:bg-slate-800"
                                    onClick={() => setTool("eraser")}
                                >
                                    消しゴム
                                </button>

                                <label className="flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm">
                                    色
                                    <input
                                        type="color"
                                        value={color}
                                        onChange={(e) => setColor(e.target.value)}
                                        className="h-8 w-10 cursor-pointer border-0 bg-transparent p-0"
                                        disabled={tool === "eraser"}
                                    />
                                </label>

                                <button
                                    className="rounded-2xl border border-slate-700 px-4 py-2 text-sm bg-slate-900 hover:bg-slate-800 disabled:opacity-40"
                                    onClick={undo}
                                    disabled={strokes.length === 0}
                                >
                                    1つ戻す
                                </button>

                                <button
                                    className="rounded-2xl border border-slate-700 px-4 py-2 text-sm bg-slate-900 hover:bg-slate-800"
                                    onClick={clearAll}
                                >
                                    クリア
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}



export {
    DeskelSimpleDrawCanvas
}