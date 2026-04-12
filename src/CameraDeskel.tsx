import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Point, TransformModel, TransformSession } from "./transform2d";
import {
    cloneModel,
    commitPreview,
    clearPreview,
    createMoveInput,
    createRotateInput,
    createScaleInput,
    getModelMatrix,
    mat3ToCanvasTransform,
    multiplyMat3,
    scaleMat3,
    translateMat3,
} from "./transform2d";
import { useAppState } from "./state";

type GridMode = "none" | "cross" | "rule3" | "rule4" | "rule9";
type SourceType = "none" | "camera" | "image" | "video";
type ControlMode = "none" | "rotate" | "scale" | "move";

function stopStream(stream: MediaStream | null) {
    stream?.getTracks().forEach((t) => t.stop());
}

function controlLabel(mode: Exclude<ControlMode, "none">) {
    if (mode === "rotate") return "Rotate";
    if (mode === "scale") return "Scale";
    return "Move";
}

export default function CameraDeskel() {
    const hostRef = useRef<HTMLDivElement | null>(null);
    const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

    const hiddenVideoRef = useRef<HTMLVideoElement | null>(null);
    const hiddenImageRef = useRef<HTMLImageElement | null>(null);

    const streamRef = useRef<MediaStream | null>(null);
    const objectUrlRef = useRef<string | null>(null);
    const rafRef = useRef<number | null>(null);

    const sessionRef = useRef<TransformSession | null>(null);
    const state = useAppState();

    const [sourceType, setSourceType] = useState<SourceType>("none");
    const [status, setStatus] = useState("no source");
    const [error, setError] = useState("");
    const [gridMode, setGridMode] = useState<GridMode>("rule3");
    const [opacity, setOpacity] = useState(0.85);
    const [lineWidth, setLineWidth] = useState(1.2);
    const [activeControl, setActiveControl] = useState<ControlMode>("none");
    const [model, setModel] = useState<TransformModel>(() => cloneModel());
    const [pivot, setPivot] = useState<Point | null>(null);

    const moveInput = useMemo(() => createMoveInput(), []);
    const rotateInput = useMemo(() => createRotateInput({ speed: 2.0 }), []);
    const scaleInput = useMemo(() => createScaleInput({ speed: 0.01 }), []);

    const canDrawMovingSource = useMemo(
        () => sourceType === "camera" || sourceType === "video",
        [sourceType]
    );

    const cleanupObjectUrl = useCallback(() => {
        if (objectUrlRef.current) {
            URL.revokeObjectURL(objectUrlRef.current);
            objectUrlRef.current = null;
        }
    }, []);

    const stopCamera = useCallback(() => {
        stopStream(streamRef.current);
        streamRef.current = null;

        const video = hiddenVideoRef.current;
        if (video) {
            video.pause();
            video.srcObject = null;
            video.removeAttribute("src");
            video.load();
        }
    }, []);

    const clearSource = useCallback(() => {
        stopCamera();
        cleanupObjectUrl();

        const img = hiddenImageRef.current;
        if (img) {
            img.removeAttribute("src");
        }

        sessionRef.current = null;
        setSourceType("none");
        setStatus("no source");
        setError("");
        setActiveControl("none");
        setModel(cloneModel());
        setPivot(null);
    }, [cleanupObjectUrl, stopCamera]);

    const getSourceSize = useCallback((): { width: number; height: number } | null => {
        const video = hiddenVideoRef.current;
        const img = hiddenImageRef.current;

        if ((sourceType === "camera" || sourceType === "video") && video) {
            if (video.videoWidth > 0 && video.videoHeight > 0) {
                return { width: video.videoWidth, height: video.videoHeight };
            }
        }

        if (sourceType === "image" && img) {
            if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                return { width: img.naturalWidth, height: img.naturalHeight };
            }
        }

        return null;
    }, [sourceType]);

    const getDefaultPivotPoint = useCallback((): Point => {
        const host = hostRef.current;
        if (!host) {
            return { x: 0, y: 0 };
        }

        const rect = host.getBoundingClientRect();
        return {
            x: rect.width / 2,
            y: rect.height / 2,
        };
    }, []);

    const getPivotPoint = useCallback((): Point => {
        return pivot ?? getDefaultPivotPoint();
    }, [getDefaultPivotPoint, pivot]);

    const clientToLocalPoint = useCallback((clientX: number, clientY: number): Point => {
        const host = hostRef.current;
        if (!host) {
            return { x: 0, y: 0 };
        }

        const rect = host.getBoundingClientRect();
        return {
            x: clientX - rect.left,
            y: clientY - rect.top,
        };
    }, []);

    const drawOverlay = useCallback(
        (ctx: CanvasRenderingContext2D, width: number, height: number) => {
            ctx.save();
            ctx.strokeStyle = `rgba(255,255,255,${opacity})`;
            ctx.lineWidth = lineWidth;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";

            ctx.strokeRect(0.5, 0.5, width - 1, height - 1);

            const drawVertical = (x: number) => {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, height);
                ctx.stroke();
            };

            const drawHorizontal = (y: number) => {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(width, y);
                ctx.stroke();
            };

            if (
                gridMode === "cross" ||
                gridMode === "rule3" ||
                gridMode === "rule4" ||
                gridMode === "rule9"
            ) {
                drawVertical(width / 2);
                drawHorizontal(height / 2);
            }

            if (gridMode === "rule3" || gridMode === "rule9") {
                drawVertical(width / 3);
                drawVertical((width * 2) / 3);
                drawHorizontal(height / 3);
                drawHorizontal((height * 2) / 3);
            }

            if (gridMode === "rule4" || gridMode === "rule9") {
                drawVertical(width / 4);
                drawVertical((width * 3) / 4);
                drawHorizontal(height / 4);
                drawHorizontal((height * 3) / 4);
            }

            if (gridMode === "rule9") {
                for (let i = 1; i < 9; i++) {
                    drawVertical((width * i) / 9);
                    drawHorizontal((height * i) / 9);
                }
            }

            const cx = width / 2;
            const cy = height / 2;
            const mark = 12;
            ctx.beginPath();
            ctx.moveTo(cx - mark, cy);
            ctx.lineTo(cx + mark, cy);
            ctx.moveTo(cx, cy - mark);
            ctx.lineTo(cx, cy + mark);
            ctx.stroke();

            ctx.restore();
        },
        [gridMode, lineWidth, opacity]
    );

    const drawPivotMarker = useCallback((ctx: CanvasRenderingContext2D, p: Point) => {
        ctx.save();
        ctx.strokeStyle = "rgba(255, 140, 0, 0.95)";
        ctx.lineWidth = 1.5;

        ctx.beginPath();
        ctx.moveTo(p.x - 10, p.y);
        ctx.lineTo(p.x + 10, p.y);
        ctx.moveTo(p.x, p.y - 10);
        ctx.lineTo(p.x, p.y + 10);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
    }, []);

    const drawPreview = useCallback(() => {
        const host = hostRef.current;
        const canvas = previewCanvasRef.current;
        if (!host || !canvas) {
            return;
        }

        const rect = host.getBoundingClientRect();
        const width = Math.max(1, Math.floor(rect.width));
        const height = Math.max(1, Math.floor(rect.height));
        const dpr = window.devicePixelRatio || 1;

        canvas.width = Math.max(1, Math.floor(width * dpr));
        canvas.height = Math.max(1, Math.floor(height * dpr));
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
            return;
        }

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, width, height);

        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, width, height);

        const size = getSourceSize();
        const video = hiddenVideoRef.current;
        const img = hiddenImageRef.current;

        if (size) {
            const baseScale = Math.max(width / size.width, height / size.height);

            const baseMatrix = multiplyMat3(
                translateMat3(
                    (width - size.width * baseScale) / 2,
                    (height - size.height * baseScale) / 2
                ),
                scaleMat3(baseScale, baseScale)
            );

            const modelMatrix = getModelMatrix(model);
            const totalMatrix = multiplyMat3(modelMatrix, baseMatrix);
            const t = mat3ToCanvasTransform(totalMatrix);

            ctx.save();
            ctx.setTransform(
                t.a * dpr,
                t.b * dpr,
                t.c * dpr,
                t.d * dpr,
                t.e * dpr,
                t.f * dpr
            );

            if ((sourceType === "camera" || sourceType === "video") && video) {
                ctx.drawImage(video, 0, 0, size.width, size.height);
            } else if (sourceType === "image" && img) {
                ctx.drawImage(img, 0, 0, size.width, size.height);
            }

            ctx.restore();
        }

        drawOverlay(ctx, width, height);
        drawPivotMarker(ctx, getPivotPoint());
    }, [drawOverlay, drawPivotMarker, getPivotPoint, getSourceSize, model, sourceType]);

    const startCamera = useCallback(async () => {
        setError("");
        setStatus("requesting camera...");

        try {
            cleanupObjectUrl();
            stopCamera();

            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: "environment",
                },
                audio: false,
            });

            const video = hiddenVideoRef.current;
            if (!video) {
                stopStream(stream);
                throw new Error("video element not found");
            }

            streamRef.current = stream;
            video.srcObject = stream;
            video.muted = true;
            video.playsInline = true;
            await video.play();

            setModel(cloneModel());
            setPivot(null);
            setSourceType("camera");
            setStatus("camera started");
        } catch (e) {
            const message = e instanceof Error ? e.message : "failed to start camera";
            setError(message);
            setStatus("camera error");
        }
    }, [cleanupObjectUrl, stopCamera]);

    const onPickFile = useCallback(
        async (file: File | null) => {
            if (!file) {
                return;
            }

            setError("");
            stopCamera();
            cleanupObjectUrl();

            const url = URL.createObjectURL(file);
            objectUrlRef.current = url;
            setModel(cloneModel());
            setPivot(null);

            if (file.type.startsWith("image/")) {
                const img = hiddenImageRef.current;
                if (!img) {
                    setError("image element not found");
                    return;
                }

                await new Promise<void>((resolve, reject) => {
                    img.onload = () => resolve();
                    img.onerror = () => reject(new Error("failed to load image"));
                    img.src = url;
                });

                setSourceType("image");
                setStatus(`image loaded: ${file.name}`);
                return;
            }

            if (file.type.startsWith("video/")) {
                const video = hiddenVideoRef.current;
                if (!video) {
                    setError("video element not found");
                    return;
                }

                video.srcObject = null;
                video.src = url;
                video.loop = true;
                video.muted = true;
                video.playsInline = true;

                await new Promise<void>((resolve, reject) => {
                    video.onloadedmetadata = () => resolve();
                    video.onerror = () => reject(new Error("failed to load video"));
                });

                await video.play().catch(() => {
                    // no-op
                });

                setSourceType("video");
                setStatus(`video loaded: ${file.name}`);
                return;
            }

            setError("unsupported file type");
            setStatus("load error");
        },
        [cleanupObjectUrl, stopCamera]
    );

    const savePng = useCallback(async () => {
        const canvas = previewCanvasRef.current;
        if (!canvas) {
            return;
        }

        const blob = await new Promise<Blob | null>((resolve) => {
            canvas.toBlob((b) => resolve(b), "image/png");
        });

        if (!blob) {
            return;
        }

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "deskel-cut.png";
        a.click();
        URL.revokeObjectURL(url);
    }, []);

    useEffect(() => {
        drawPreview();
    }, [drawPreview]);

    useEffect(() => {
        const host = hostRef.current;
        if (!host) {
            return;
        }

        const ro = new ResizeObserver(() => {
            drawPreview();
        });

        ro.observe(host);

        const onResize = () => drawPreview();
        window.addEventListener("resize", onResize);

        return () => {
            ro.disconnect();
            window.removeEventListener("resize", onResize);
        };
    }, [drawPreview]);

    useEffect(() => {
        if (!canDrawMovingSource) {
            if (rafRef.current !== null) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }
            return;
        }

        const tick = () => {
            drawPreview();
            rafRef.current = requestAnimationFrame(tick);
        };

        tick();

        return () => {
            if (rafRef.current !== null) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }
        };
    }, [canDrawMovingSource, drawPreview]);

    useEffect(() => {
        return () => {
            stopCamera();
            cleanupObjectUrl();
            if (rafRef.current !== null) {
                cancelAnimationFrame(rafRef.current);
            }
        };
    }, [cleanupObjectUrl, stopCamera]);

    const beginControlDrag = useCallback(
        (
            mode: Exclude<ControlMode, "none">,
            e: React.PointerEvent<HTMLButtonElement>
        ) => {
            e.preventDefault();
            e.stopPropagation();

            //const start = { x: e.clientX, y: e.clientY };
            const start = clientToLocalPoint(e.clientX, e.clientY);
            const pivotPoint = getPivotPoint();

            let session: TransformSession | null = null;

            if (mode === "move") {
                session = moveInput.begin({
                    start,
                    pivot: pivotPoint,
                    model,
                });
            } else if (mode === "rotate") {
                session = rotateInput.begin({
                    start,
                    pivot: pivotPoint,
                    model,
                });
            } else if (mode === "scale") {
                session = scaleInput.begin({
                    start,
                    pivot: pivotPoint,
                    model,
                });
            }

            if (!session) {
                return;
            }

            e.currentTarget.setPointerCapture(e.pointerId);
            sessionRef.current = session;
            setActiveControl(mode);
        },
        [getPivotPoint, model, moveInput, rotateInput, scaleInput, clientToLocalPoint]
    );

    const handleControlPointerMove = useCallback(
        (e: React.PointerEvent<HTMLButtonElement>) => {
            const session = sessionRef.current;
            if (!session) {
                return;
            }

            e.preventDefault();
            e.stopPropagation();

            const p = clientToLocalPoint(e.clientX, e.clientY);

            const nextPreview = session.move(p);

            setModel((prev) => ({
                ...prev,
                preview: nextPreview,
            }));
        },
        [clientToLocalPoint]
    );

    const endControlDrag = useCallback(
        (e: React.PointerEvent<HTMLButtonElement>) => {
            const session = sessionRef.current;
            if (!session) {
                return;
            }

            e.preventDefault();
            e.stopPropagation();

            const p = clientToLocalPoint(e.clientX, e.clientY);

            const finalPreview = session.end(p);

            setModel((prev) =>
                commitPreview({
                    ...prev,
                    preview: finalPreview,
                })
            );

            if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                e.currentTarget.releasePointerCapture(e.pointerId);
            }

            sessionRef.current = null;
            setActiveControl("none");
        },
        [clientToLocalPoint]
    );

    const cancelControlDrag = useCallback(
        (e: React.PointerEvent<HTMLButtonElement>) => {
            const session = sessionRef.current;
            if (!session) {
                return;
            }

            e.preventDefault();
            e.stopPropagation();

            session.cancel();

            setModel((prev) => clearPreview(prev));

            if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                e.currentTarget.releasePointerCapture(e.pointerId);
            }

            sessionRef.current = null;
            setActiveControl("none");
        },
        []
    );

    const makeControlHandlers = useCallback(
        (mode: Exclude<ControlMode, "none">) => ({
            onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) =>
                beginControlDrag(mode, e),
            onPointerMove: handleControlPointerMove,
            onPointerUp: endControlDrag,
            onPointerCancel: cancelControlDrag,
        }),
        [beginControlDrag, cancelControlDrag, endControlDrag, handleControlPointerMove]
    );

    const controlButtonClass = (mode: Exclude<ControlMode, "none">) =>
        `flex h-14 w-14 select-none items-center justify-center rounded-full border text-[11px] font-medium shadow-lg backdrop-blur touch-none ${activeControl === mode
            ? "border-emerald-400 bg-emerald-500/30 text-emerald-100"
            : "border-slate-500/80 bg-slate-900/70 text-slate-100 hover:bg-slate-800/80"
        }`;

    return (
        <>
            <div className={`flex flex-col gap-3 text-slate-100 ${state.tool === "deskel" ? "flex" : "hidden"}`}>
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 p-3 z-3000">
                    <button
                        className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm hover:bg-slate-800"
                        onClick={() => void startCamera()}
                    >
                        Start Camera
                    </button>

                    <label className="cursor-pointer rounded-lg border border-slate-600 px-3 py-1.5 text-sm hover:bg-slate-800">
                        Open Image/Video
                        <input
                            type="file"
                            accept="image/*,video/*"
                            className="hidden"
                            onChange={(e) => {
                                const file = e.target.files?.[0] ?? null;
                                void onPickFile(file);
                                e.currentTarget.value = "";
                            }}
                        />
                    </label>

                    <button
                        className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm hover:bg-slate-800"
                        onClick={clearSource}
                    >
                        Clear
                    </button>

                    <button
                        className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm hover:bg-slate-800"
                        onClick={() => void savePng()}
                    >
                        Save PNG
                    </button>

                    <button
                        className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm hover:bg-slate-800"
                        onClick={() => {
                            sessionRef.current = null;
                            setActiveControl("none");
                            setModel(cloneModel());
                            setPivot(null);
                        }}
                    >
                        Reset
                    </button>

                    <button
                        className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm hover:bg-slate-800"
                        onClick={() => setPivot(null)}
                    >
                        Pivot Center
                    </button>

                    <label className="ml-2 flex items-center gap-2 text-sm">
                        Grid
                        <select
                            className="rounded border border-slate-600 bg-slate-950 px-2 py-1"
                            value={gridMode}
                            onChange={(e) => setGridMode(e.target.value as GridMode)}
                        >
                            <option value="none">none</option>
                            <option value="cross">cross</option>
                            <option value="rule3">3x3</option>
                            <option value="rule4">4x4</option>
                            <option value="rule9">9x9</option>
                        </select>
                    </label>

                    <label className="flex items-center gap-2 text-sm">
                        Opacity
                        <input
                            type="range"
                            min="0.1"
                            max="1"
                            step="0.05"
                            value={opacity}
                            onChange={(e) => setOpacity(Number(e.target.value))}
                        />
                        <span className="w-10 text-right">{opacity.toFixed(2)}</span>
                    </label>

                    <label className="flex items-center gap-2 text-sm">
                        Line
                        <input
                            type="range"
                            min="0.5"
                            max="4"
                            step="0.1"
                            value={lineWidth}
                            onChange={(e) => setLineWidth(Number(e.target.value))}
                        />
                        <span className="w-10 text-right">{lineWidth.toFixed(1)}</span>
                    </label>
                </div>
            </div>
            { 
                // deskel
            }
            <div className={`fixed inset-0 z-1000 flex items-center justify-center p-4 pointer-events-none ${state.tool === "deskel" ? "flex" : "hidden"}`}>
                <div className="pointer-events-auto flex flex-col items-center w-[70vw] max-w-full h-full justify-center">


                    {/* 
                        メインコンテナ: 
                        1. aspect-[3/4] で比率固定
                        2. max-h-[70vh] (または 80vh) で高さの限界値を指定
                        3. w-auto と合わせることで、高さが限界に達すると幅も縮小される（比率維持）
                    */}
                    <div
                        ref={hostRef}
                        className="absolute h-auto w-full max-h-[90vh] aspect-[3/4] overflow-hidden rounded-2xl border border-slate-700 bg-black touch-none shadow-2xl"
                        style={{
                            width: '100%',
                            maxWidth: 'calc(90vh * 3 / 4)', // 高さが限界に達した時、横幅も比率に合わせて止める
                            margin: '0 auto'
                        }}
                    >
                        <canvas
                            ref={previewCanvasRef}
                            className="absolute inset-0 h-full w-full touch-none"
                            onPointerDown={(e) => {
                                if (activeControl !== "none") return;
                                const p = clientToLocalPoint(e.clientX, e.clientY);
                                setPivot(p);
                            }}
                        />

                        {/* コントローラー */}
                        <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex justify-center">
                            <div className="pointer-events-auto flex items-end gap-3 rounded-full border border-slate-600/60 bg-slate-950/40 px-3 py-2 backdrop-blur">
                                {(["rotate", "scale", "move"] as const).map((mode) => (
                                    <div key={mode} className="flex flex-col items-center gap-1">
                                        <button
                                            type="button"
                                            className={controlButtonClass(mode)}
                                            {...makeControlHandlers(mode)}
                                        >
                                            {mode === "rotate" ? "↻" : mode === "scale" ? "⤢" : "✥"}
                                        </button>
                                        <div className="text-[10px] text-slate-200">
                                            {controlLabel(mode)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                                            {/* ステータス表示 */}
                    <div className="mb-2 text-center text-sm text-slate-300 shrink-0">
                        <div>Status: {status}</div>
                        <div className="hidden sm:block">Tap canvas to set pivot. Bottom controls: rotate / scale / move</div>
                        {error ? <div className="text-rose-400">Error: {error}</div> : null}
                    </div>
                    </div>

                    <video ref={hiddenVideoRef} className="hidden" muted playsInline />
                    <img ref={hiddenImageRef} className="hidden" alt="" />
                </div>
                
            </div>

        </>
    );
}