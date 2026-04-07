import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { draw, resizeCanvas } from "./deskel";
import { drawMeasure } from "./deskelMeasure";
import { drawClipRect, drawClipQuad, findNearestQuadPointIndex } from "./deskelClipRect";
import { useAppState } from "./state";
import {
  captureAndCropToAnalysis,
  captureAndCropToDownloads,
  ColorCount,
} from "./screenshot";
import { ChainMeasure } from "./deskelChainMesure";

import { showToast } from "./toast";
import { platform } from "@tauri-apps/plugin-os";
import { useDialog } from "./useDialog";
import { openPrivacySettings } from "./permissionCheck";
import { getRectFromPoints } from "./utils";
//import { drawPerspectiveRulerByUnitBaseRange } from "./deskelMeasurePerspectiveRuler";

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
  }
>(function (props, ref) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const startRef = useRef<AppDeskelPoint | null>(null);
  const currentRef = useRef<AppDeskelPoint | null>(null);
  const clipQuadRef = useRef<AppDeskelPoint[]>([{ x: 200, y: 200 }, { x: 300, y: 200 }, { x: 300, y: 300 }, { x: 200, y: 300 }]); // 台形を定義して、射系変換の基準点とする
  const clipQuadDraggingPointIndexRef = useRef<number>(-1);
  const draggingRef = useRef(false);
  const [, setDragging] = useState(false);
  const chainMesureRef = useRef<ChainMeasure>(new ChainMeasure());
  const [measureMode, setMeasureMode] = useState<"line" | "chain" | "setUnit" | "setVanishingPoint">(
    "line",
  );
  const [isMac, setIsMac] = useState(false);

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
        const p = await platform();
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
  }, []);

  async function onPointerUp() {
    //updateDragging(false);

    if (!startRef.current || !currentRef.current) return;

    //const x = Math.min(startRef.current.x, currentRef.current.x);
    //const y = Math.min(startRef.current.y, currentRef.current.y);
    const width = Math.abs(startRef.current.x - currentRef.current.x);
    const height = Math.abs(startRef.current.y - currentRef.current.y);

    if (!canvasRef.current || width < 8 || height < 8) return;

    // color check
    const selectedRect = getRectFromPoints({
      //canvas: canvasRef.current!,
      start: startRef.current,
      current: currentRef.current,
    });
    if (uAppState.tool == "capture") {
      try {
        //
        // ensureScreenCapturePermission() の コメントを確認してね
        //if (!await await ensureScreenCapturePermission()) {
        //  return
        //}
        const ret = await captureAndCropToDownloads({
          path: undefined,
          targetRect: selectedRect,
        });
        showToast(ret);
      } catch (e) {
        if (e instanceof Error) {
          showToast(e.message);
        } else {
          showToast(`${e}`);
        }
      }
    }
    if (uAppState.tool == "color") {
      try {
        //
        // ensureScreenCapturePermission() の コメントを確認してね
        //if (!await await ensureScreenCapturePermission()) {
        //  return
        //}
        const ret = await captureAndCropToAnalysis({
          targetRect: selectedRect,
        });
        if (props.onColorAnalysis) {
          props.onColorAnalysis(ret.colors, ret.colors01);
        }
      } catch (e) {
        console.log(e);
        if (e instanceof Error) {
          showToast(e.message);
        } else {
          showToast(`${e}`);
        }
      }
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
    if (uAppState.tool == "measure") {
      //console.log({ measureMode });
      if (measureMode == "line") {
        drawMeasure({
          canvas,
          ctx,
          start,
          current,
          dragging,
          chainLength: chainMesureRef.current.getLength(
            current ? { x: current?.x, y: current.y } : undefined,
          ),
          measureUnit: uAppState.measureUnit,
        });
        //
        if (clipQuadRef.current && clipQuadRef.current.length == 4) {
          drawClipQuad({
            canvas,
            ctx,
            points: clipQuadRef.current,
            dragging: true
          })
        }
      } else if (measureMode == "chain") {
        // redraw時
        chainMesureRef.current.draw(ctx, {
          color: uAppState.color,
          lineWidth: 1,
        });
      } else if (measureMode == "setUnit") {
        drawMeasure({
          canvas,
          ctx,
          start,
          current,
          dragging,
          chainLength: chainMesureRef.current.getLength(
            current ? { x: current?.x, y: current.y } : undefined,
          ),
          measureUnit: uAppState.measureUnit,
        });
      } else if (measureMode == "setVanishingPoint" && current) {
        //vanishingRectRef.current = { x: current.x, y: current.y };
      }
      if (clipQuadRef.current && clipQuadRef.current.length == 4) {
          drawClipQuad({
            canvas,
            ctx,
            points: clipQuadRef.current,
            dragging: true
          })
      }
    } else if (uAppState.tool == "color" || uAppState.tool == "capture") {
      drawClipRect({ canvas, ctx, start, current, dragging });
    }
  }, [uAppState.tool, measureMode, uAppState.color]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onMouseDown = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const p = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };

      chainMesureRef.current.setChainLengthMin(uAppState.measureUnit);
      startRef.current = p;
      currentRef.current = p;
      setDraggingValue(true);
      chainMesureRef.current.update(p);
      redraw();
      //
      const pointIndex = findNearestQuadPointIndex(p, clipQuadRef.current, 14);
      clipQuadDraggingPointIndexRef.current = pointIndex;
      console.log(">> pointIndex:", pointIndex);
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current || !startRef.current) return;

      const rect = canvas.getBoundingClientRect();
      currentRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };

      chainMesureRef.current.update(currentRef.current);

      if(clipQuadDraggingPointIndexRef.current != -1) {
        const index = clipQuadDraggingPointIndexRef.current;
        clipQuadRef.current[index] = { ...currentRef.current };
      }
      redraw();
    };

    const onMouseUp = async () => {
      setDraggingValue(false);
      chainMesureRef.current.clear();
      redraw();

      if (measureMode === "setUnit" && startRef.current && currentRef.current) {
        const dx = currentRef.current.x - startRef.current.x;
        const dy = currentRef.current.y - startRef.current.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        uAppState.measureUnit = len / 5;
        uAppState.measureUnitSet = {
          start: { ...startRef.current },
          end: { ...currentRef.current },
        };
        showToast(`Measure unit set to ${uAppState.measureUnit.toFixed(2)} pixels`);
      }

      clipQuadDraggingPointIndexRef.current = -1;
      await onPointerUp();
    };

    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mouseup", onMouseUp);

    redraw({ isResizeCanvas: true });

    return () => {
      canvas.removeEventListener("mousedown", onMouseDown);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mouseup", onMouseUp);
    };
  }, [redraw, measureMode, uAppState]);

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
      {
        // Measure Sub Toolbar
      }
      {
        <div
          className={`fixed bottom-4 right-4 z-[9999] flex flex-wrap items-center justify-end gap-2 rounded-2xl border border-slate-800 bg-slate-950/80 p-2 shadow-xl backdrop-blur ${uAppState.tool == "measure" ? "block" : "hidden"
            }`}
        >
          <button
            className={`flex items-center gap-2 rounded-2xl border px-3 py-3 text-sm transition-colors outline-none ${measureMode == "line"
              ? "border-emerald-500 bg-emerald-950 text-emerald-300"
              : "border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 active:bg-slate-700"
              }`}
            onClick={() => {
              console.log("chain measure line click");
              setMeasureMode("line");
            }}
            title="line measure"
            aria-label="line measure"
          >
            Line Measure
          </button>
          <button
            className={`flex items-center gap-2 rounded-2xl border px-3 py-3 text-sm transition-colors outline-none ${measureMode == "chain"
              ? "border-emerald-500 bg-emerald-950 text-emerald-300"
              : "border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 active:bg-slate-700"
              }`}
            onClick={() => {
              console.log("chain measure click");
              setMeasureMode("chain");
            }}
            title="chain measure"
            aria-label="chain measure"
          >
            Chain Measure
          </button>

          <button
            className={`flex items-center gap-2 rounded-2xl border px-3 py-3 text-sm transition-colors outline-none ${measureMode == "setUnit"
              ? "border-emerald-500 bg-emerald-950 text-emerald-300"
              : "border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 active:bg-slate-700"
              }`}
            onClick={() => {
              console.log("set unit click");
              setMeasureMode("setUnit");
            }}
            title="set unit"
            aria-label="set unit"
          >
            Set Unit
          </button>
          <button
            className={`flex items-center gap-2 rounded-2xl border px-3 py-3 text-sm transition-colors outline-none ${measureMode == "setVanishingPoint"
              ? "border-emerald-500 bg-emerald-950 text-emerald-300"
              : "border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 active:bg-slate-700"
              }`}
            onClick={() => {
              console.log("set vanishing point click");
              setMeasureMode("setVanishingPoint");
              dialog.showConfirmDialog({
                title: "Set Vanishing Point",
                body: "now creating", //"Click on the canvas to set the vanishing point for perspective measurement. This will be used as the reference point for perspective measurements.",
              });
            }}
            title="set vanishing point"
            aria-label="set vanishing point"
          >
            Set Quad
          </button>
        </div>
      }
      {
        <div
          className={`fixed top-4 right-4 z-[9999] items-center gap-2 ${(uAppState.tool === "capture" || uAppState.tool === "color") && isMac
            ? "flex"
            : "hidden"
            }`}
        >
          <button
            className="
        rounded-lg bg-black/60 px-3 py-2 text-sm text-white
        transition-opacity duration-200
        opacity-80
      "
            onClick={() => {
              console.log("CheckMac");
              void handleHelpMac();
            }}
            title="Screen capture help"
            aria-label="Screen capture help"
          >
            ?
          </button>
        </div>
      }
    </>
  );
});

export { AppDeslel };
export type { AppDeskelHandle, AppDeskelPoint };
