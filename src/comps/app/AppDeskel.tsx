import {
  forwardRef,
  RefObject,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { draw, resizeCanvas } from "../../algos/deskel";
import { useAppState, appState } from "../../state";
import {
  captureAndCrop,
  captureAndCropToAnalysis,
  ColorCount,
} from "../../natives/nativeScreenshot";
import { showToast } from "../utils/toast";
import { useDialog } from "../utils/useDialog";
import { openPrivacySettings } from "../../natives/nativePermissionCheck";
import { getRectFromPoints } from "../../utils";
import { getTaurPlatformInfo } from "../../natives/native";
import { AppBackgroundImageCanvasHandle } from "./AppBackgroundImageCanvas";
import { analyzeImageBlob } from "../../algos/colorAnalysis";
import { AppDeskelMeasureToolbar } from "../toolbar/AppDeskelMeasureToolbar";
import { AppDeskelImageToolbar } from "../toolbar/AppDeskelImageToolbar";
import {
  AppDeskelCaptureToolbar,
  AppDeskelCaptureMode,
} from "../toolbar/AppDeskelCaptureToolbar";

import type {
  AppDeskelPoint,
  DeskelToolContext,
  DeskelToolHandler,
  MeasureMode,
  QuadMode,
  SelectionRect,
} from "../../DeskelToolHandler";
import { MeasureHandler } from "../../MeasureHandler";
import { CaptureHandler } from "../../CaptureHandler";
import { ColorHandler } from "../../ColorHandler";
import { ScreenCaptureCanvasHandle } from "./AppScreenCaptureCanvas";

type AppDeskelHandle = {
  redraw: (props?: { isResizeCanvas: boolean }) => void;
  setVisible: (visible: boolean) => void;
  getCanvas: () => HTMLCanvasElement | null;
};

const AppDeslel = forwardRef<
  AppDeskelHandle,
  {
    onColorAnalysis?: (
      colors: ColorCount[],
      colors01: ColorCount[],
    ) => Promise<void>;
    onBeforeCapture?: () => Promise<void>;
    appBackgroundImageCanvasRef: RefObject<AppBackgroundImageCanvasHandle | null>;
    appScreenCaptureCanvasRef: RefObject<ScreenCaptureCanvasHandle|null>;
  }
>(function AppDeslel(props, ref) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const startRef = useRef<AppDeskelPoint | null>(null);
  const currentRef = useRef<AppDeskelPoint | null>(null);
  const draggingRef = useRef(false);
  const [, setDragging] = useState(false);

  const [measureMode, setMeasureMode] = useState<MeasureMode>("line");
  const [quadMode, setQuadMode] = useState<QuadMode>("off");
  const [isMac, setIsMac] = useState(false);

  const dialog = useDialog();
  const uAppState = useAppState();

  const measureHandlerRef = useRef(new MeasureHandler());
  const captureHandlerRef = useRef(new CaptureHandler());
  const colorHandlerRef = useRef(new ColorHandler());

  const [captureToolbarOpen, setCaptureToolbarOpen] = useState(true);
  const [measureToolbarOpen, setMeasureToolbarOpen] = useState(true);
  const [imageToolbarOpen, setImageToolbarOpen] = useState(true);
  

  const setDraggingValue = useCallback((value: boolean) => {
    if (draggingRef.current === value) return;
    draggingRef.current = value;
    setDragging(value);
  }, []);

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

  const getSelectionRect = useCallback((): SelectionRect | null => {
    if (!startRef.current || !currentRef.current || !canvasRef.current) {
      return null;
    }

    const width = Math.abs(startRef.current.x - currentRef.current.x);
    const height = Math.abs(startRef.current.y - currentRef.current.y);

    if (width < 8 || height < 8) {
      return null;
    }

    return getRectFromPoints({
      start: startRef.current,
      current: currentRef.current,
    });
  }, []);

  const captureFromImage = useCallback(
    async (selectedRect: SelectionRect) => {
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
    },
    [props.appBackgroundImageCanvasRef],
  );

  const captureFromScreen = useCallback(async (selectedRect: SelectionRect) => {
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
  }, []);

  const analyzeFromImage = useCallback(
    async (selectedRect: SelectionRect) => {
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
    },
    [props.appBackgroundImageCanvasRef, props.onColorAnalysis],
  );

  const analyzeFromScreen = useCallback(async (selectedRect: SelectionRect) => {
    await props.onBeforeCapture?.();
    const ret = await captureAndCropToAnalysis({
      targetRect: selectedRect,
    });
    await props.onColorAnalysis?.(ret.colors, ret.colors01);
  }, [props.onBeforeCapture, props.onColorAnalysis]);

  const setMeasureUnit = useCallback(
    (pixelsPerUnit: number, start: AppDeskelPoint, end: AppDeskelPoint) => {
      appState.setMeasureUnit(pixelsPerUnit);
      uAppState.measureUnitSet = {
        start: { ...start },
        end: { ...end },
      };
      showToast(`Measure unit set to ${pixelsPerUnit.toFixed(2)} pixels`);
    },
    [uAppState],
  );

  const getPoint = useCallback((e: PointerEvent): AppDeskelPoint => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }, []);

  const getCurrentHandler = useCallback((): DeskelToolHandler => {
    const tool = uAppState.tool;
    if (tool === "measure") return measureHandlerRef.current;
    if (tool === "capture") return captureHandlerRef.current;
    return colorHandlerRef.current;
  }, [uAppState.tool]);

  const createToolContext = useCallback(
    (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): DeskelToolContext => {
      return {
        canvas,
        ctx,
        state: {
          tool: uAppState.tool,
          target: uAppState.target as "image" | "screen",
          color: uAppState.color,
          measureUnit: uAppState.measureUnit,
          measureMode,
          quadMode,
        },
        startRef,
        currentRef,
        draggingRef,
        setDragging: setDraggingValue,
        getPoint,
        getSelectionRect,
        requestRedraw: () => {},
        setMeasureUnit,
        captureFromImage,
        captureFromScreen,
        analyzeFromImage,
        analyzeFromScreen,
        showToast,
      };
    },
    [
      uAppState.tool,
      uAppState.target,
      uAppState.color,
      uAppState.measureUnit,
      measureMode,
      quadMode,
      setDraggingValue,
      getPoint,
      getSelectionRect,
      setMeasureUnit,
      captureFromImage,
      captureFromScreen,
      analyzeFromImage,
      analyzeFromScreen,
    ],
  );

  const redraw = useCallback(
    (props?: { isResizeCanvas: boolean }) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      if (props?.isResizeCanvas) {
        resizeCanvas({ canvas, ctx });
      }

      draw({ canvas, ctx });

      const toolCtx = createToolContext(canvas, ctx);
      toolCtx.requestRedraw = redraw;
      getCurrentHandler().redraw(toolCtx);
    },
    [createToolContext, getCurrentHandler],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.style.touchAction = "none";

    const onPointerDown = (e: PointerEvent) => {
      const handler = getCurrentHandler();
      const ctx = createToolContext(canvas, canvas.getContext("2d")!);
      ctx.requestRedraw = redraw;

      handler.onPointerDown(ctx, e);
      canvas.setPointerCapture?.(e.pointerId);
      redraw();
    };

    const onPointerMove = (e: PointerEvent) => {
      const handler = getCurrentHandler();
      const ctx = createToolContext(canvas, canvas.getContext("2d")!);
      ctx.requestRedraw = redraw;

      handler.onPointerMove(ctx, e);
      redraw();
    };

    const onPointerUp = async (e: PointerEvent) => {
      const handler = getCurrentHandler();
      const ctx = createToolContext(canvas, canvas.getContext("2d")!);
      ctx.requestRedraw = redraw;

      try {
        await handler.onPointerUp(ctx, e);
      } catch (err) {
        console.error(err);
        if (err instanceof Error) {
          showToast(err.message);
        } else {
          showToast(String(err));
        }
      }
      redraw();
    };

    const onPointerCancel = async (e: PointerEvent) => {
      const handler = getCurrentHandler();
      const ctx = createToolContext(canvas, canvas.getContext("2d")!);
      ctx.requestRedraw = redraw;

      try {
        await handler.onPointerCancel(ctx, e);
      } catch (err) {
        console.error(err);
      }
      redraw();
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
  }, [createToolContext, getCurrentHandler, redraw]);

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

      <AppDeskelImageToolbar visible={uAppState.tool === "image"} open={imageToolbarOpen}  onToggle={() => setImageToolbarOpen((v) => !v)} appBackgroundImageCanvasRef={props.appBackgroundImageCanvasRef}/>
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
       appScreenCaptureCanvasRef={props.appScreenCaptureCanvasRef}
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