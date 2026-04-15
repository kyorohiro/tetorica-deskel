import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppState } from "../../state";
import { AppDeskelDrawToolbar } from "../toolbar/AppDeskelDrawToolbar";

type Tool = "pen" | "eraser" | "line";

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

function AppSimpleDrawCanvas() {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const wrapRef = useRef<HTMLDivElement | null>(null);

    const [tool, setTool] = useState<Tool>("pen");
    const [color, setColor] = useState(DEFAULT_COLOR);
    const [strokes, setStrokes] = useState<Stroke[]>([]);
    const [draftStroke, setDraftStroke] = useState<Stroke | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [canvasSize, setCanvasSize] = useState({ width: 1200, height: 760 });
    //const [currentPoint, setCurrentPoint] = useState<Point | null>(null);
    //const [startPoint, setStartPoint] = useState<Point | null>(null);
    const [drawToolbarOpen, setDrawToolbarOpen] = useState<boolean>(true);

    const state = useAppState();

    const activeSize = useMemo(() => {
        return tool === "eraser" ? ERASER_SIZE : PEN_SIZE;
    }, [tool]);

    //
    // canvas内部は dpr 倍の解像度
    //
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
            //setCurrentPoint(p);
            //setStartPoint(p);
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
            //setCurrentPoint(p);
            if (prev.tool === "line" && prev.points.length >= 1) {
                return {
                    ...prev,
                    points: [prev.points[0], p]
                }
            } else {
                return {
                    ...prev,
                    points: [...prev.points, p],
                };
            }
        });
    }, []);

    const endDraw = useCallback(() => {
        setIsDrawing(false);
        setDraftStroke((prev) => {
            if (!prev) return null;
            console.log()
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
        <>
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
                                    {
                                        
                                    }
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            {
                // Subtoolbar
                <AppDeskelDrawToolbar
                    color={color}
                    setColor={async (v) => { setColor(v) }}
                    tool={tool}
                    setTool={async (v) => { setTool(v) }}
                    drawToolbarOpen={drawToolbarOpen}
                    setDrawToolbarOpen={async (v) => setDrawToolbarOpen(v)}
                    toolMode={state.tool}
                    undo={() => { undo() }}
                    hasUndo={strokes.length >= 0}
                    clearAll={() => { clearAll() }}
                />
            }
        </>
    );
}



export {
    AppSimpleDrawCanvas
}

export type {
    Tool
}