import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

type GridMode = "none" | "cross" | "rule3" | "rule4" | "rule9";
type SourceType = "none" | "camera" | "image" | "video";

type TransformState = {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  mirrorX: boolean;
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

export default function CameraDeskel() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const hiddenVideoRef = useRef<HTMLVideoElement | null>(null);
  const hiddenImageRef = useRef<HTMLImageElement | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const rafRef = useRef<number | null>(null);

  const dragRef = useRef<{
    active: boolean;
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  }>({
    active: false,
    pointerId: -1,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
  });

  const [sourceType, setSourceType] = useState<SourceType>("none");
  const [status, setStatus] = useState("no source");
  const [error, setError] = useState("");
  const [gridMode, setGridMode] = useState<GridMode>("rule3");
  const [opacity, setOpacity] = useState(0.85);
  const [lineWidth, setLineWidth] = useState(1.2);
  const [transform, setTransform] = useState<TransformState>(INITIAL_TRANSFORM);

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

    setSourceType("none");
    setStatus("no source");
    setError("");
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

      // outer border
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

      if (gridMode === "cross" || gridMode === "rule3" || gridMode === "rule4" || gridMode === "rule9") {
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

      // center mark
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

    // background
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
        ctx.drawImage(video, -size.width / 2, -size.height / 2, size.width, size.height);
      } else if (sourceType === "image" && img) {
        ctx.drawImage(img, -size.width / 2, -size.height / 2, size.width, size.height);
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
          // Safari などで自動再生が失敗しても、最初のフレーム描画はできることがある
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
    console.log(">> save/png")
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

  return (
    <div className="flex flex-col gap-3 text-slate-100">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 p-3">
        <button
          className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm hover:bg-slate-800"
          onClick={startCamera}
        >
          Start Camera
        </button>

        <label className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm hover:bg-slate-800 cursor-pointer">
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
          onClick={savePng}
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
          Rotation
          <input
            type="range"
            min="-180"
            max="180"
            step="1"
            value={transform.rotation}
            onChange={(e) =>
              setTransform((prev) => ({
                ...prev,
                rotation: Number(e.target.value),
              }))
            }
          />
          <span className="w-14 text-right">{transform.rotation}°</span>
        </label>

        <label className="flex items-center gap-2 text-sm">
          Zoom
          <input
            type="range"
            min="0.2"
            max="5"
            step="0.01"
            value={transform.scale}
            onChange={(e) =>
              setTransform((prev) => ({
                ...prev,
                scale: Number(e.target.value),
              }))
            }
          />
          <span className="w-12 text-right">{transform.scale.toFixed(2)}</span>
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
        <div>
          Drag: move / Wheel: zoom / Slider: rotate
        </div>
        {error ? <div className="text-rose-400">Error: {error}</div> : null}
      </div>

      <div
        ref={hostRef}
        className="relative w-full max-w-[720px] overflow-hidden rounded-2xl border border-slate-700 bg-black aspect-[3/4] touch-none"
      >
        <canvas
          ref={previewCanvasRef}
          className="absolute inset-0 h-full w-full"
          onPointerDown={(e) => {
            const canvas = previewCanvasRef.current;
            if (!canvas) {
              return;
            }

            dragRef.current = {
              active: true,
              pointerId: e.pointerId,
              startX: e.clientX,
              startY: e.clientY,
              originX: transform.x,
              originY: transform.y,
            };

            canvas.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            const drag = dragRef.current;
            if (!drag.active || drag.pointerId !== e.pointerId) {
              return;
            }

            const dx = e.clientX - drag.startX;
            const dy = e.clientY - drag.startY;

            setTransform((prev) => ({
              ...prev,
              x: drag.originX + dx,
              y: drag.originY + dy,
            }));
          }}
          onPointerUp={(e) => {
            const drag = dragRef.current;
            if (drag.pointerId !== e.pointerId) {
              return;
            }

            dragRef.current.active = false;
          }}
          onPointerCancel={(e) => {
            const drag = dragRef.current;
            if (drag.pointerId !== e.pointerId) {
              return;
            }

            dragRef.current.active = false;
          }}
          onWheel={(e) => {
            e.preventDefault();

            const factor = e.deltaY < 0 ? 1.05 : 0.95;

            setTransform((prev) => ({
              ...prev,
              scale: Math.min(5, Math.max(0.2, prev.scale * factor)),
            }));
          }}
        />
      </div>

      {/* hidden sources */}
      <video ref={hiddenVideoRef} className="hidden" muted playsInline />
      <img ref={hiddenImageRef} className="hidden" alt="" />
    </div>
  );
}
