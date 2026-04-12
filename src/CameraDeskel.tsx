import React, { RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { appState, useAppState } from "./state";
import { RotateCcw, Scan } from "lucide-react";
import { AppBackgroundImageCanvasHandle } from "./AppBackgroundImageCanvas";
import { useDialog } from "./useDialog";
import { captureAndCrop } from "./nativeScreenshot";
import { isTauri } from "./native";

type GridMode = "none" | "cross" | "rule3" | "rule4" | "rule9";
type SourceType = "none" | "camera" | "image" | "video";
type ControlMode = "none" | "rotate" | "scale" | "move";

type DeskelRatioPreset = {
  id: string;
  label: string;
  width: number;
  height: number;
};

const DESKEL_RATIO_PRESETS: DeskelRatioPreset[] = [
  { id: "3x4-portrait", label: "3:4", width: 3, height: 4 },
  { id: "3x4-landscape", label: "4:3", width: 4, height: 3 },

  { id: "4x5-portrait", label: "4:5", width: 4, height: 5 },
  { id: "4x5-landscape", label: "5:4", width: 5, height: 4 },

  { id: "a4-portrait", label: "A4(p)", width: 210, height: 297 },
  { id: "a4-landscape", label: "A4(l)", width: 297, height: 210 },

  { id: "b5-portrait", label: "B5(p)", width: 182, height: 257 },
  { id: "b5-landscape", label: "B5(l))", width: 257, height: 182 },

  { id: "16x9-portrait", label: "16:9", width: 9, height: 16 },
  { id: "16x9-landscape", label: "9:16", width: 16, height: 9 },

  { id: "1x1", label: "1:1", width: 1, height: 1 },
];

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((t) => t.stop());
}

function controlLabel(mode: Exclude<ControlMode, "none">) {
  if (mode === "rotate") return "Rotate";
  if (mode === "scale") return "Scale";
  return "Move";
}

export default function CameraDeskel(props: {
  appBackgroundImageCanvasRef?: RefObject<AppBackgroundImageCanvasHandle | null>;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const hiddenVideoRef = useRef<HTMLVideoElement | null>(null);
  const hiddenImageRef = useRef<HTMLImageElement | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const rafRef = useRef<number | null>(null);

  const sessionRef = useRef<TransformSession | null>(null);
  const state = useAppState();

  const [dekselToolbarOpen, setDekselToolbarOpen] = useState(true);

  const [sourceType, setSourceType] = useState<SourceType>("none");
  const [status, setStatus] = useState("no source");
  const [error, setError] = useState("");
  const [gridMode, setGridMode] = useState<GridMode>("rule3");
  const [opacity, setOpacity] = useState(0.5);
  const [lineWidth, setLineWidth] = useState(1.2);
  const [activeControl, setActiveControl] = useState<ControlMode>("none");
  const [model, setModel] = useState<TransformModel>(() => cloneModel());
  const [pivot, setPivot] = useState<Point | null>(null);
  const [deskelRatioId, setDeskelRatioId] = useState("3x4-portrait");
  //
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const [cameraDeviceId, setCameraDeviceId] = useState("");


  const moveInput = useMemo(() => createMoveInput(), []);
  const rotateInput = useMemo(() => createRotateInput({ speed: 2.0 }), []);
  const scaleInput = useMemo(() => createScaleInput({ speed: 0.01 }), []);
  const dialog = useDialog();

  const deskelRatio = useMemo(() => {
    return (
      DESKEL_RATIO_PRESETS.find((v) => v.id === deskelRatioId) ??
      DESKEL_RATIO_PRESETS[0]
    );
  }, [deskelRatioId]);

  const deskelAspectRatio = useMemo(() => {
    return `${deskelRatio.width} / ${deskelRatio.height}`;
  }, [deskelRatio]);

  const deskelMaxWidth = useMemo(() => {
    return `calc(90vh * ${deskelRatio.width} / ${deskelRatio.height})`;
  }, [deskelRatio]);

  const canDrawMovingSource = useMemo(
    () => sourceType === "camera" || sourceType === "video",
    [sourceType]
  );
  const hasCanvasSource = sourceType !== "none";

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

  const refreshCameraDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videos = devices.filter((d) => d.kind === "videoinput");
      setCameraDevices(videos);

      setCameraDeviceId((prev) => {
        if (prev && videos.some((v) => v.deviceId === prev)) {
          return prev;
        }
        return videos[0]?.deviceId ?? "";
      });

      return videos;
    } catch {
      setCameraDevices([]);
      return [];
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
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      const whiteWidth = lineWidth;
      const blackWidth = lineWidth * 2;

      const strokeGuide = (draw: () => void) => {
        // 下地の黒
        ctx.beginPath();
        draw();
        ctx.strokeStyle = `rgba(0,0,0,${opacity})`;
        ctx.lineWidth = blackWidth;
        ctx.stroke();

        // 上の白
        ctx.beginPath();
        draw();
        ctx.strokeStyle = `rgba(255,255,255,${opacity})`;
        ctx.lineWidth = whiteWidth;
        ctx.stroke();
      };

      const drawVertical = (x: number) => {
        strokeGuide(() => {
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
        });
      };

      const drawHorizontal = (y: number) => {
        strokeGuide(() => {
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
        });
      };

      // 外枠
      strokeGuide(() => {
        ctx.rect(0.5, 0.5, width - 1, height - 1);
      });

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

      // 中心マーク
      const cx = width / 2;
      const cy = height / 2;
      const mark = 12;

      strokeGuide(() => {
        ctx.moveTo(cx - mark, cy);
        ctx.lineTo(cx + mark, cy);
        ctx.moveTo(cx, cy - mark);
        ctx.lineTo(cx, cy + mark);
      });

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

  const startCamera = useCallback(
    async (nextDeviceId?: string) => {
      setError("");
      setStatus("requesting camera...");

      try {
        cleanupObjectUrl();
        stopCamera();

        const requestedDeviceId = nextDeviceId || cameraDeviceId;

        let stream: MediaStream;

        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: requestedDeviceId
              ? {
                deviceId: { exact: requestedDeviceId },
              }
              : {
                facingMode: "environment",
              },
            audio: false,
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        }

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

        const track = stream.getVideoTracks()[0];
        const actualDeviceId = track?.getSettings?.().deviceId;
        if (actualDeviceId) {
          setCameraDeviceId(actualDeviceId);
        }

        await refreshCameraDevices();

        setModel(cloneModel());
        setPivot(null);
        setSourceType("camera");
        setStatus("camera started");
      } catch (e) {
        const message = e instanceof Error ? e.message : "failed to start camera";
        setError(message);
        setStatus("camera error");
      }
    },
    [cameraDeviceId, cleanupObjectUrl, refreshCameraDevices, stopCamera]
  );

  const switchCamera = useCallback(
    async (nextDeviceId: string) => {
      setCameraDeviceId(nextDeviceId);
      await startCamera(nextDeviceId);
    },
    [startCamera]
  );

  const cycleCamera = useCallback(async () => {
    if (cameraDevices.length <= 1) {
      return;
    }

    const currentIndex = cameraDevices.findIndex(
      (d) => d.deviceId === cameraDeviceId
    );
    const nextIndex =
      currentIndex >= 0 ? (currentIndex + 1) % cameraDevices.length : 0;

    const next = cameraDevices[nextIndex];
    if (!next) {
      return;
    }

    await switchCamera(next.deviceId);
  }, [cameraDevices, cameraDeviceId, switchCamera]);

  useEffect(() => {
    void refreshCameraDevices();

    const handler = () => {
      void refreshCameraDevices();
    };

    navigator.mediaDevices?.addEventListener?.("devicechange", handler);

    return () => {
      navigator.mediaDevices?.removeEventListener?.("devicechange", handler);
    };
  }, [refreshCameraDevices]);
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

  const setImageFromBlob = useCallback(
    async (blob: Blob, name = "capture.png") => {
      setError("");
      stopCamera();
      cleanupObjectUrl();

      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;

      setModel(cloneModel());
      setPivot(null);

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
      setStatus(`image loaded: ${name}`);
    },
    [cleanupObjectUrl, stopCamera]
  );
  const setBackgroundImage = useCallback(async () => {
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

    const previewUrl = URL.createObjectURL(blob);

    try {
      const ok = await dialog.showImageConfirmDialog({
        title: "Set background image",
        message: "Would you like to use this image as your background?",
        imageUrl: previewUrl,
        imageAlt: "background preview",
        okText: "Use image",
        cancelText: "Cancel",
      });

      if (!ok) {
        return;
      }

      if (props.appBackgroundImageCanvasRef?.current) {
        await props.appBackgroundImageCanvasRef.current.addImage(blob);
      }

      if (sourceType === "camera") {
        stopCamera();
        setSourceType("none");
      }

      appState.setTool("measure");
    } finally {
      URL.revokeObjectURL(previewUrl);
    }

  }, [dialog, props.appBackgroundImageCanvasRef, sourceType, stopCamera]);

  const onCaptureScreen = useCallback(async () => {
    try {
      setError("");
      setStatus("capturing screen...");

      const result = await captureAndCrop({
        targetRect: null,
        hideWindow: true,
      });

      const blob = new Blob([new Uint8Array(result.pngBuffer)], {
        type: "image/png",
      });

      await setImageFromBlob(blob, "screen-capture.png");
    } catch (e) {
      const message = e instanceof Error ? e.message : "failed to capture screen";
      setError(message);
      setStatus("capture error");
    }
  }, [setImageFromBlob]);

  useEffect(() => {
    if (state.tool !== "deskel" && sourceType === "camera") {
      stopCamera();
      setSourceType("none");
      setStatus("camera stopped");
    }
  }, [state.tool, sourceType, stopCamera]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden && sourceType === "camera") {
        stopCamera();
        setSourceType("none");
        setStatus("camera stopped");
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [sourceType, stopCamera]);
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
      <div
        className={`flex flex-col gap-3 text-slate-100 ${state.tool === "deskel" ? "flex" : "hidden"
          }`}
      >
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 p-3"></div>
      </div>

      <div
        className={`fixed inset-0 z-[1000] flex items-center justify-center p-4 pointer-events-none ${state.tool === "deskel" ? "flex" : "hidden"
          }`}
      >
        <div className="pointer-events-auto flex h-full w-[70vw] max-w-full flex-col items-center justify-center">
          <div
            ref={hostRef}
            className="absolute h-auto w-full max-h-[90vh] overflow-hidden rounded-2xl border border-slate-700 bg-black touch-none shadow-2xl"
            style={{
              width: "100%",
              aspectRatio: deskelAspectRatio,
              maxWidth: deskelMaxWidth,
              margin: "0 auto",
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

            <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[2600] flex justify-center">
              <div className="pointer-events-auto flex items-end gap-3 rounded-full border border-slate-600/60 bg-slate-950/70 px-3 py-2 shadow-2xl backdrop-blur">
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

            <div className="mb-2 shrink-0 text-center text-sm text-slate-300">
              <div>Status: {status}</div>
              <div className="hidden sm:block">
                Tap canvas to set pivot. Bottom controls: rotate / scale / move
              </div>
              {error ? <div className="text-rose-400">Error: {error}</div> : null}
            </div>
          </div>

          <video ref={hiddenVideoRef} className="hidden" muted playsInline />
          <img ref={hiddenImageRef} className="hidden" alt="" />
        </div>
      </div>

      <div
        className={`fixed inset-0 z-[2500] items-center justify-center gap-2 p-4 pointer-events-none ${state.tool === "deskel" && !hasCanvasSource ? "flex" : "hidden"
          }`}
      >
        <button
          className={`rounded-lg border border-slate-100 bg-slate-300 px-3 py-1.5 text-sm text-emerald-700 hover:bg-slate-200 ${state.tool === "deskel" ? "pointer-events-auto" : "pointer-events-none"
            }`}
          onClick={() => void startCamera(cameraDeviceId || undefined)}
        >
          Camera
        </button>

        <label
          className={`rounded-lg border border-slate-100 bg-slate-300 px-3 py-1.5 text-sm text-emerald-700 hover:bg-slate-200 ${state.tool === "deskel" ? "pointer-events-auto" : "pointer-events-none"
            }`}
        >
          Image/Video
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

        {isTauri() && (
          <button
            className={`rounded-lg border border-slate-100 bg-slate-300 px-3 py-1.5 text-sm text-emerald-700 hover:bg-slate-200 ${state.tool === "deskel" ? "pointer-events-auto" : "pointer-events-none"
              }`}
            onClick={() => void onCaptureScreen()}
          >
            Capture
          </button>
        )}
      </div>

      <div
        className={`fixed bottom-4 right-4 z-[9999] flex items-end gap-2 ${state.tool === "deskel" ? "flex" : "hidden"
          } ${state.tool === "deskel" ? "pointer-events-auto" : "pointer-events-none"}`}
      >
        <button
          className={`rounded-2xl border border-slate-700 bg-slate-900/90 px-3 py-3 text-xs text-slate-100 shadow-xl transition-colors hover:bg-slate-800 ${state.tool === "deskel" ? "pointer-events-auto" : "pointer-events-none"
            }`}
          onClick={() => {
            setDekselToolbarOpen(!dekselToolbarOpen);
          }}
          title="toggle deksel toolbar"
          aria-label="toggle deksel toolbar"
        >
          {dekselToolbarOpen ? ">" : "<"}
        </button>

        <div
          className={`overflow-hidden rounded-2xl bg-slate-950/80 shadow-xl backdrop-blur transition-all duration-200 ${dekselToolbarOpen
            ? "max-w-[1000px] translate-x-0 border border-slate-800 opacity-100"
            : "max-w-0 translate-x-2 border border-transparent opacity-0"
            }`}
        >
          <div className="flex flex-col gap-1 p-1 sm:flex-row sm:flex-wrap">
            <button
              className="m-0.5 rounded-2xl border border-emerald-500 bg-emerald-950 px-2 py-1 text-xs text-emerald-300"
              onClick={() => {
                sessionRef.current = null;
                setActiveControl("none");
                setModel(cloneModel());
                setPivot(null);
                clearSource();
              }}
              title="clear"
              aria-label="clear"
            >
              <RotateCcw size={12} />
            </button>

            <button
              className="m-0.5 rounded-2xl border border-b-rose-600 bg-emerald-950 px-2 py-1 text-xs text-red-300"
              title="scan"
              aria-label="save png"
              onClick={() => void setBackgroundImage()}
            >
              <Scan size={12} />
            </button>

            <label className="ml-0 flex flex-col items-center gap-0 text-xs text-amber-100 sm:flex-row sm:flex-wrap">
              Ratio
              <select
                className="rounded border border-slate-100 bg-slate-300 px-0 py-0 text-xs text-emerald-700 hover:bg-slate-200"
                value={deskelRatioId}
                onChange={(e) => setDeskelRatioId(e.target.value)}
              >
                {DESKEL_RATIO_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="ml-0 flex flex-col items-center gap-0 text-xs text-amber-100 sm:flex-row sm:flex-wrap">
              Grid
              <select
                className="rounded border border-slate-100 bg-slate-300 px-0 py-0 text-xs text-emerald-700 hover:bg-slate-200"
                value={gridMode}
                onChange={(e) => setGridMode(e.target.value as GridMode)}
              >
                <option value="none">none</option>
                <option value="cross">2x2</option>
                <option value="rule3">3x3</option>
                <option value="rule4">4x4</option>
                <option value="rule9">9x9</option>
              </select>
            </label>

            <label className="ml-0 flex flex-col items-center gap-0 text-xs text-amber-100 sm:flex-row sm:flex-wrap">
              Opacity
              <select
                className="rounded border border-slate-100 bg-slate-300 px-0 py-0 text-xs text-emerald-700 hover:bg-slate-200"
                value={opacity}
                onChange={(e) => setOpacity(+e.target.value)}
              >
                <option value="0">0</option>
                <option value="0.25">0.25</option>
                <option value="0.5">0.5</option>
                <option value="0.75">0.75</option>
                <option value="1">1</option>
              </select>
            </label>

            <label className="ml-0 flex flex-col items-center gap-0 text-xs text-amber-100 sm:flex-row sm:flex-wrap">
              Line
              <select
                className="rounded border border-slate-100 bg-slate-300 px-0 py-0 text-xs text-emerald-700 hover:bg-slate-200"
                value={lineWidth}
                onChange={(e) => setLineWidth(+e.target.value)}
              >
                <option value="0.1">0.1</option>
                <option value="0.6">0.6</option>
                <option value="1.2">1.2</option>
                <option value="2.4">2.4</option>
              </select>
            </label>
            { }
            {sourceType === "camera" && cameraDevices.length > 0 && (
              <>
                <label className="ml-0 flex flex-col items-center gap-0 text-xs text-amber-100 sm:flex-row sm:flex-wrap">
                  Camera
                  <select
                    className="rounded border border-slate-100 bg-slate-300 px-0 py-0 text-xs text-emerald-700 hover:bg-slate-200"
                    value={cameraDeviceId}
                    onChange={(e) => void switchCamera(e.target.value)}
                  >
                    {cameraDevices.map((device, index) => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label || `Camera ${index + 1}`}
                      </option>
                    ))}
                  </select>
                </label>

                {cameraDevices.length > 1 && (
                  <button
                    className="m-0.5 rounded-2xl border border-slate-700 bg-slate-900/90 px-2 py-1 text-xs text-slate-100"
                    onClick={() => void cycleCamera()}
                    title="switch camera"
                    aria-label="switch camera"
                  >
                    Flip
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}