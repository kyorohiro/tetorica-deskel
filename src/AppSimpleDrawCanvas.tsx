import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Pencil,
    Eraser,
    Palette,
    Undo2,
    Trash2,
} from "lucide-react";

type Tool = "pen" | "eraser";

type Point = { x: number; y: number };

type Stroke = {
    tool: Tool;
    color: string;
    size: number;
    opacity: number;
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
    ctx.globalAlpha = stroke.opacity ?? 1;

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
        ctx.fillStyle = stroke.tool === "eraser"
            ? "rgba(0,0,0,1)"
            : stroke.color;
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
        const wrap = wrapRef.current;
        if (!canvas || !wrap) return;

        const dpr = window.devicePixelRatio || 1;
        const rect = wrap.getBoundingClientRect();
        const width = Math.floor(rect.width);
        const height = Math.floor(rect.height);

        // いったんCSS側の幅でレイアウトさせる
        //canvas.style.width = "100%";
        //canvas.style.height = `${Math.max(100, Math.floor(window.innerHeight * 0.68))}px`;
        //console.log("> rect", width, height);

        // ここで style.height を固定しない
        canvas.style.width = "100%";
        canvas.style.height = "100%";

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
                opacity: 0.5,
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
                                        onPointerDown={onPointerDown}
                                        onPointerMove={onPointerMove}
                                        onPointerUp={onPointerUp}
                                        onPointerCancel={endDraw}
                                        className="block h-full w-full touch-none rounded-xl"
                                    />
                                </div>

                                <div className="fixed bottom-4 right-4 z-30 flex flex-wrap items-center justify-end gap-2 rounded-2xl border border-slate-800 bg-slate-950/80 p-2 shadow-xl backdrop-blur">
                                    <button
                                        className={`rounded-2xl border px-3 py-3 text-sm ${tool === "pen"
                                            ? "border-emerald-500 bg-emerald-950 text-emerald-300"
                                            : "border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"
                                            }`}
                                        onClick={() => setTool("pen")}
                                        title="ペン"
                                        aria-label="ペン"
                                    >
                                        <Pencil size={18} />
                                    </button>

                                    <button
                                        className={`rounded-2xl border px-3 py-3 text-sm ${tool === "eraser"
                                            ? "border-emerald-500 bg-emerald-950 text-emerald-300"
                                            : "border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"
                                            }`}
                                        onClick={() => setTool("eraser")}
                                        title="消しゴム"
                                        aria-label="消しゴム"
                                    >
                                        <Eraser size={18} />
                                    </button>

                                    <label
                                        className="flex items-center justify-center rounded-2xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm"
                                        title="色"
                                        aria-label="色"
                                    >
                                        <div className="relative flex items-center justify-center">
                                            <Palette size={18} className="pointer-events-none" color={color} />
                                            <input
                                                type="color"
                                                value={color}
                                                onChange={(e) => setColor(e.target.value)}
                                                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                                                disabled={tool === "eraser"}
                                            />
                                        </div>
                                    </label>

                                    <button
                                        className="rounded-2xl border border-slate-700 bg-slate-900 px-3 py-3 text-sm text-slate-100 hover:bg-slate-800 disabled:opacity-40"
                                        onClick={undo}
                                        disabled={strokes.length === 0}
                                        title="1つ戻す"
                                        aria-label="1つ戻す"
                                    >
                                        <Undo2 size={18} />
                                    </button>

                                    <button
                                        className="rounded-2xl border border-slate-700 bg-slate-900 px-3 py-3 text-sm text-slate-100 hover:bg-slate-800"
                                        onClick={clearAll}
                                        title="クリア"
                                        aria-label="クリア"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}



export {
    DeskelSimpleDrawCanvas as AppSimpleDrawCanvas
}