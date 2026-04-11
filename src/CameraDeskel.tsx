import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

type GridMode = "none" | "cross" | "rule3" | "rule4" | "rule9";
type SourceType = "none" | "camera" | "image" | "video";
type ControlMode = "none" | "rotate" | "scale" | "move";

type TransformState = {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  mirrorX: boolean;
};

type ControlDragState = {
  mode: Exclude<ControlMode, "none">;
  pointerId: number;
  startPointerX: number;
  startPointerY: number;
  startTransform: TransformState;
  centerX: number;
  centerY: number;
  startAngle: number;
};

const INITIAL_TRANSFORM: TransformState = {
  x: 0,
  y: 0,
  scale: 1,
  rotation: 0,
  mirrorX: false,
};

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((t) => t.stop());
}

function degToRad(deg: number) {
  return (deg * Math.PI) / 180;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function controlLabel(mode: Exclude<ControlMode, "none">) {
  if (mode === "rotate") return "Rotate";
  if (mode === "scale") return "Scale";
  return "Move";
}

function normalizeAngleDelta(rad: number) {
  while (rad > Math.PI) rad -= Math.PI * 2;
  while (rad < -Math.PI) rad += Math.PI * 2;
  return rad;
}

export default function CameraDeskel() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const hiddenVideoRef = useRef<HTMLVideoElement | null>(null);
  const hiddenImageRef = useRef<HTMLImageElement | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const rafRef = useRef<number | null>(null);

  const transformRef = useRef<TransformState>(INITIAL_TRANSFORM);
  const controlDragRef = useRef<ControlDragState | null>(null);

  const [sourceType, setSourceType] = useState<SourceType>("none");
  const [status, setStatus] = useState("no source");
  const [error, setError] = useState("");
  const [gridMode, setGridMode] = useState<GridMode>("rule3");
  const [opacity, setOpacity] = useState(0.85);
  const [lineWidth, setLineWidth] = useState(1.2);
  const [transform, setTransform] = useState<TransformState>(INITIAL_TRANSFORM);
  const [activeControl, setActiveControl] = useState<ControlMode>("none");

  useEffect(() => {
    transformRef.current = transform;
  }, [transform]);

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

    controlDragRef.current = null;

    setSourceType("none");
    setStatus("no source");
    setError("");
    setActiveControl("none");
    setTransform(INITIAL_TRANSFORM);
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
      const finalScale = baseScale * transform.scale;

      ctx.save();
      ctx.translate(width / 2 + transform.x, height / 2 + transform.y);
      ctx.rotate(degToRad(transform.rotation));
      ctx.scale(transform.mirrorX ? -finalScale : finalScale, finalScale);

      if ((sourceType === "camera" || sourceType === "video") && video) {
        ctx.drawImage(
          video,
          -size.width / 2,
          -size.height / 2,
          size.width,
          size.height
        );
      } else if (sourceType === "image" && img) {
        ctx.drawImage(
          img,
          -size.width / 2,
          -size.height / 2,
          size.width,
          size.height
        );
      }

      ctx.restore();
    }

    drawOverlay(ctx, width, height);
  }, [drawOverlay, getSourceSize, sourceType, transform]);

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

      setTransform(INITIAL_TRANSFORM);
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
      setTransform(INITIAL_TRANSFORM);

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

      const rect = e.currentTarget.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);

      e.currentTarget.setPointerCapture(e.pointerId);

      controlDragRef.current = {
        mode,
        pointerId: e.pointerId,
        startPointerX: e.clientX,
        startPointerY: e.clientY,
        startTransform: transformRef.current,
        centerX,
        centerY,
        startAngle,
      };

      setActiveControl(mode);
    },
    []
  );

  const handleControlPointerMove = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      const state = controlDragRef.current;
      if (!state || state.pointerId !== e.pointerId) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      const dx = e.clientX - state.startPointerX;
      const dy = e.clientY - state.startPointerY;

      if (state.mode === "move") {
        setTransform({
          ...state.startTransform,
          x: state.startTransform.x + dx,
          y: state.startTransform.y + dy,
        });
        return;
      }

      if (state.mode === "scale") {
        const nextScale = clamp(
          state.startTransform.scale * Math.exp(-dy * 0.01),
          0.2,
          5
        );

        setTransform({
          ...state.startTransform,
          scale: nextScale,
        });
        return;
      }

      if (state.mode === "rotate") {
        const currentAngle = Math.atan2(
          e.clientY - state.centerY,
          e.clientX - state.centerX
        );
        const deltaRad = normalizeAngleDelta(currentAngle - state.startAngle);
        const deltaDeg = (deltaRad * 180) / Math.PI;

        setTransform({
          ...state.startTransform,
          rotation: state.startTransform.rotation + deltaDeg,
        });
      }
    },
    []
  );

  const endControlDrag = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      const state = controlDragRef.current;
      if (!state || state.pointerId !== e.pointerId) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }

      controlDragRef.current = null;
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
      onPointerCancel: endControlDrag,
    }),
    [beginControlDrag, endControlDrag, handleControlPointerMove]
  );

  const controlButtonClass = (mode: Exclude<ControlMode, "none">) =>
    `flex h-14 w-14 select-none items-center justify-center rounded-full border text-[11px] font-medium shadow-lg backdrop-blur touch-none ${
      activeControl === mode
        ? "border-emerald-400 bg-emerald-500/30 text-emerald-100"
        : "border-slate-500/80 bg-slate-900/70 text-slate-100 hover:bg-slate-800/80"
    }`;

  return (
    <div className="flex flex-col gap-3 text-slate-100">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 p-3">
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
          onClick={() => setTransform(INITIAL_TRANSFORM)}
        >
          Reset
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

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={transform.mirrorX}
            onChange={(e) =>
              setTransform((prev) => ({
                ...prev,
                mirrorX: e.target.checked,
              }))
            }
          />
          Mirror
        </label>
      </div>

      <div className="text-sm text-slate-300">
        <div>Status: {status}</div>
        <div>Bottom controls only: rotate / scale / move</div>
        {error ? <div className="text-rose-400">Error: {error}</div> : null}
      </div>

      <div
        ref={hostRef}
        className="relative w-full max-w-[720px] overflow-hidden rounded-2xl border border-slate-700 bg-black aspect-[3/4] touch-none"
      >
        <canvas
          ref={previewCanvasRef}
          className="absolute inset-0 h-full w-full touch-none"
        />

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
      </div>

      <video ref={hiddenVideoRef} className="hidden" muted playsInline />
      <img ref={hiddenImageRef} className="hidden" alt="" />
    </div>
  );
}