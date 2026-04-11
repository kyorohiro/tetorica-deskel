import {
  forwardRef,
  RefObject,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { draw, resizeCanvas } from "./deskel";
import { drawMeasure } from "./deskelMeasure";
import {
  drawClipRect,
  drawClipQuad2,
  findNearestQuadPoint,
} from "./deskelClipRect";
import { useAppState, appState } from "./state";
import {
  captureAndCrop,
  captureAndCropToAnalysis,
  ColorCount,
} from "./nativeScreenshot";
import { ChainMeasure } from "./deskelChainMesure";
import { showToast } from "./toast";
import { useDialog } from "./useDialog";
import { openPrivacySettings } from "./nativePermissionCheck";
import { getRectFromPoints } from "./utils";
import { getTaurPlatformInfo } from "./native";
import { AppBackgroundImageCanvasHandle } from "./AppBackgroundImageCanvas";
import { analyzeImageBlob } from "./colorAnalysis";
import {
  AppDeskelMeasureToolbar,
  MeasureMode,
  QuadMode,
} from "./AppDeskelMeasureToolbar";
import {
  AppDeskelCaptureToolbar,
  AppDeskelCaptureMode,
} from "./AppDeskelCaptureToolbar";

type AppDeskelHandle = {
  redraw: (props?: { isResizeCanvas: boolean }) => void;
  setVisible: (visible: boolean) => void;
  getCanvas: () => HTMLCanvasElement | null;
};

type AppDeskelPoint = { x: number; y: number };

const AppDeslel = forwardRef<
  AppDeskelHandle,
  {
    onColorAnalysis?: (
      colors: ColorCount[],
      colors01: ColorCount[],
    ) => Promise<void>;
    onBeforeCapture?: () => Promise<void>;
    appBackgroundImageCanvasRef: RefObject<AppBackgroundImageCanvasHandle | null>;
  }
>(function (props, ref) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const startRef = useRef<AppDeskelPoint | null>(null);
  const currentRef = useRef<AppDeskelPoint | null>(null);
  const clipQuadRef = useRef<AppDeskelPoint[]>([
    { x: 200, y: 200 },
    { x: 300, y: 200 },
    { x: 300, y: 300 },
    { x: 200, y: 300 },
  ]);
  const clipQuadDraggingPointIndexRef = useRef<number>(-1);
  const draggedCenterQuadRef = useRef<AppDeskelPoint>(undefined);
  const draggingRef = useRef(false);
  const [, setDragging] = useState(false);
  const chainMesureRef = useRef<ChainMeasure>(new ChainMeasure());

  const [measureMode, setMeasureMode] = useState<MeasureMode>("line");
  const [measureToolbarOpen, setMeasureToolbarOpen] = useState(true);
  const [captureToolbarOpen, setCaptureToolbarOpen] = useState(true);
  const [isMac, setIsMac] = useState(false);
  const [quadMode, setQuadMode] = useState<QuadMode>("off");

  const dialog = useDialog();
  const uAppState = useAppState();

  function setDraggingValue(value: boolean) {
    if (draggingRef.current === value) return;
    draggingRef.current = value;
    setDragging(value);
  }

  useEffect(() => {
    let mounted = true;

    void (async () => {
      try {
        const p = await getTaurPlatformInfo();
        if (mounted) {
          setIsMac(p === "macos");
        }
      } catch (e) {
        console.error(e);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const handleHelpMac = useCallback(async () => {
    const result = await dialog.showConfirmDialog({
      title: "Screen Capture Reset Required",
      body:
        "Please go to Settings -> Privacy & Security -> Screen Recording & System Audio.\n\n" +
        "IMPORTANT: You must select 'tetorica-deskel' and click the '-' (minus) button to remove it first, then click '+' to add it back.\n\n" +
        "Simply toggling it Off and On will NOT work.\r\n" +
        "Move to settings now?",
    });
    if (result) {
      await openPrivacySettings();
    }
  }, [dialog]);

  function handleAsyncError(e: unknown) {
    console.log(e);
    if (e instanceof Error) {
      showToast(e.message);
    } else {
      showToast(`${e}`);
    }
  }

  async function handleCaptureSelection(
    selectedRect: ReturnType<typeof getRectFromPoints>,
  ) {
    if (uAppState.target === "image" && props.appBackgroundImageCanvasRef) {
      const result = await props.appBackgroundImageCanvasRef.current?.getCropImage({
        x: selectedRect.x,
        y: selectedRect.y,
        width: selectedRect.width,
        height: selectedRect.height,
      });

      if (!result) {
        showToast("Failed to crop image.");
        return;
      }

      const arrayBuffer = await result.blob.arrayBuffer();
      const pngBuffer = new Uint8Array(arrayBuffer);

      appState.setCaptureImage({
        buffer: pngBuffer as any,
        sourceWidth: window.innerWidth,
        sourceHeight: window.innerHeight,
        cropX: selectedRect.x,
        cropY: selectedRect.y,
        cropWidth: selectedRect.width,
        cropHeight: selectedRect.height,
      });
      return;
    }

    const ret = await captureAndCrop({
      targetRect: selectedRect,
      hideWindow: true,
    });

    appState.setCaptureImage({
      buffer: ret.pngBuffer,
      sourceWidth: ret.viewWidth,
      sourceHeight: ret.viewHeight,
      cropX: ret.x,
      cropY: ret.y,
      cropWidth: ret.width,
      cropHeight: ret.height,
    });
  }

  async function handleColorSelection(
    selectedRect: ReturnType<typeof getRectFromPoints>,
  ) {
    if (uAppState.target === "image" && props.appBackgroundImageCanvasRef) {
      const cropResult = await props.appBackgroundImageCanvasRef.current?.getCropImage({
        x: selectedRect.x,
        y: selectedRect.y,
        width: selectedRect.width,
        height: selectedRect.height,
      });

      if (!cropResult) {
        showToast("Failed to analyze image.");
        return;
      }

      const ret = await analyzeImageBlob(cropResult.blob, 32, 1000);
      await props.onColorAnalysis?.(ret.colors, ret.colors01);
      return;
    }

    if (props.onBeforeCapture) {
      await props.onBeforeCapture();
    }

    const ret = await captureAndCropToAnalysis({
      targetRect: selectedRect,
    });

    await props.onColorAnalysis?.(ret.colors, ret.colors01);
  }

  async function handleSelectionComplete() {
    if (!startRef.current || !currentRef.current) return;

    const width = Math.abs(startRef.current.x - currentRef.current.x);
    const height = Math.abs(startRef.current.y - currentRef.current.y);

    if (!canvasRef.current || width < 8 || height < 8) return;

    const selectedRect = getRectFromPoints({
      start: startRef.current,
      current: currentRef.current,
    });

    try {
      if (uAppState.tool === "capture") {
        await handleCaptureSelection(selectedRect);
      } else if (uAppState.tool === "color") {
        await handleColorSelection(selectedRect);
      }
    } catch (e) {
      handleAsyncError(e);
    }
  }

  const redraw = useCallback((props?: { isResizeCanvas: boolean }) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (props?.isResizeCanvas) {
      resizeCanvas({ canvas, ctx });
    }

    draw({ canvas, ctx });

    const start = startRef.current;
    const current = currentRef.current;
    const dragging = draggingRef.current;

    if (uAppState.tool === "measure") {
      if (measureMode === "line") {
        drawMeasure({
          canvas,
          ctx,
          start,
          current,
          dragging,
          chainLength: chainMesureRef.current.getLength(
            current ? { x: current.x, y: current.y } : undefined,
          ),
          measureUnit: uAppState.measureUnit,
        });
      } else if (measureMode === "chain") {
        chainMesureRef.current.draw(ctx, {
          color: uAppState.color,
          lineWidth: 1,
          currentPoint: current ?? undefined,
        });
      } else if (measureMode === "setUnit") {
        drawMeasure({
          canvas,
          ctx,
          start,
          current,
          dragging,
          chainLength: chainMesureRef.current.getLength(
            current ? { x: current.x, y: current.y } : undefined,
          ),
          measureUnit: uAppState.measureUnit,
        });
      } else if (measureMode === "setVanishingPoint" && current) {
        // reserved
      }

      if (clipQuadRef.current.length === 4 && quadMode !== "off") {
        drawClipQuad2({
          canvas,
          ctx,
          points: clipQuadRef.current,
          dragging: true,
        });
      }
    } else if (uAppState.tool === "color" || uAppState.tool === "capture") {
      drawClipRect({ canvas, ctx, start, current, dragging });
    }
  }, [
    uAppState.tool,
    measureMode,
    uAppState.color,
    quadMode,
    uAppState.measureUnit,
  ]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.style.touchAction = "none";

    const getPoint = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };

    const onPointerDown = (e: PointerEvent) => {
      const p = getPoint(e);

      chainMesureRef.current.setChainLengthMin(uAppState.measureUnit);
      startRef.current = p;
      currentRef.current = p;
      setDraggingValue(true);
      chainMesureRef.current.update(p);
      redraw();

      const pointSet = findNearestQuadPoint(p, clipQuadRef.current, 14);
      if (pointSet.type === "center") {
        draggedCenterQuadRef.current = { ...p };
      }
      clipQuadDraggingPointIndexRef.current = pointSet.index;

      canvas.setPointerCapture?.(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!draggingRef.current || !startRef.current) return;

      currentRef.current = getPoint(e);
      chainMesureRef.current.update(currentRef.current);

      if (clipQuadDraggingPointIndexRef.current !== -1) {
        const index = clipQuadDraggingPointIndexRef.current;
        clipQuadRef.current[index] = { ...currentRef.current };
      }

      if (draggedCenterQuadRef.current) {
        const dx = currentRef.current.x - draggedCenterQuadRef.current.x;
        const dy = currentRef.current.y - draggedCenterQuadRef.current.y;
        for (let i = 0; i < clipQuadRef.current.length; i++) {
          clipQuadRef.current[i].x += dx;
          clipQuadRef.current[i].y += dy;
        }
        draggedCenterQuadRef.current = { ...currentRef.current };
      }

      redraw();
    };

    const finishPointer = async () => {
      setDraggingValue(false);
      chainMesureRef.current.clear();
      redraw();

      if (measureMode === "setUnit" && startRef.current && currentRef.current) {
        const dx = currentRef.current.x - startRef.current.x;
        const dy = currentRef.current.y - startRef.current.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len <= 5) {
          showToast("Must be 5px or more.");
          return;
        }
        appState.setMeasureUnit(len / 5);
        uAppState.measureUnitSet = {
          start: { ...startRef.current },
          end: { ...currentRef.current },
        };
        showToast(`Measure unit set to ${uAppState.measureUnit.toFixed(2)} pixels`);
      }

      clipQuadDraggingPointIndexRef.current = -1;
      draggedCenterQuadRef.current = undefined;
      await handleSelectionComplete();
    };

    const onPointerUp = () => {
      void finishPointer();
    };

    const onPointerCancel = () => {
      void finishPointer();
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerCancel);

    redraw({ isResizeCanvas: true });

    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerCancel);
    };
  }, [redraw, measureMode, uAppState, uAppState.captureMode, uAppState.measureUnit]);

  useEffect(() => {
    const handleResize = () => {
      redraw({ isResizeCanvas: true });
    };

    window.addEventListener("resize", handleResize);
    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [redraw]);

  useImperativeHandle(
    ref,
    () => ({
      redraw,
      setVisible: (visible: boolean) => {
        if (!rootRef.current) return;
        rootRef.current.style.display = visible ? "block" : "none";
      },
      getCanvas: () => canvasRef.current,
    }),
    [redraw],
  );

  return (
    <>
      <div ref={rootRef}>
        <canvas key="deskel-default" id="deskel" ref={canvasRef} />
      </div>

      <AppDeskelMeasureToolbar
        visible={uAppState.tool === "measure"}
        open={measureToolbarOpen}
        onToggle={() => setMeasureToolbarOpen((v) => !v)}
        measureMode={measureMode}
        setMeasureMode={setMeasureMode}
        quadMode={quadMode}
        setQuadMode={setQuadMode}
        onApplyQuad={() => {
          void dialog.showConfirmDialog({
            title: "Quad Apply",
            body: "now creating",
          });
        }}
      />

      <div
        className={`fixed top-4 right-4 z-9999 items-center gap-2 ${
          (uAppState.tool === "capture" || uAppState.tool === "color") && isMac
            ? "flex"
            : "hidden"
        }`}
      >
        <button
          className="rounded-lg bg-black/60 px-3 py-2 text-xs text-white transition-opacity duration-200 opacity-80"
          onClick={() => {
            void handleHelpMac();
          }}
          title="Screen capture help"
          aria-label="Screen capture help"
        >
          ?
        </button>
      </div>

      <AppDeskelCaptureToolbar
        visible={uAppState.tool === "capture"}
        open={captureToolbarOpen}
        onToggle={() => setCaptureToolbarOpen((v) => !v)}
        captureMode={uAppState.captureMode as AppDeskelCaptureMode}
        onChangeCaptureMode={(mode) => {
          appState.setCaptureMode(mode);
        }}
        onClearCaptureImage={() => {
          appState.setCaptureImage(undefined);
        }}
      />
    </>
  );
});

export { AppDeslel };
export type { AppDeskelHandle, AppDeskelPoint };