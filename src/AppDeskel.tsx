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
import { drawClipRect, drawClipQuad2, findNearestQuadPoint } from "./deskelClipRect";
import { useAppState, appState, CaptureMode } from "./state";

import {
  //calcCaptureAndCropParams,
  captureAndCrop,
  captureAndCropToAnalysis,
  //captureAndCropToDownloads,
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
//import { drawPerspectiveRulerByUnitBaseRange } from "./deskelMeasurePerspectiveRuler";


type AppDeskelHandle = {
  redraw: (props?: { isResizeCanvas: boolean }) => void;
  setVisible: (visible: boolean) => void;
  getCanvas: () => HTMLCanvasElement | null;
};

type AppDeskelPoint = { x: number; y: number };

type QuadMode = "off" | "view" | "apply";

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
  const clipQuadRef = useRef<AppDeskelPoint[]>([{ x: 200, y: 200 }, { x: 300, y: 200 }, { x: 300, y: 300 }, { x: 200, y: 300 }]); // 台形を定義して、射系変換の基準点とする
  const clipQuadDraggingPointIndexRef = useRef<number>(-1);
  const draggedCenterQuadRef = useRef<AppDeskelPoint>(undefined);
  const draggingRef = useRef(false);
  const [, setDragging] = useState(false);
  const chainMesureRef = useRef<ChainMeasure>(new ChainMeasure());
  const [measureMode, setMeasureMode] = useState<"line" | "chain" | "setUnit" | "setVanishingPoint">(
    "line",
  );
  const [captureMode, setCaptureMode] = useState<CaptureMode>("none");

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
        if (uAppState.target == "image" && props.appBackgroundImageCanvasRef) {
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

            // captureAndCrop と合わせて「view 上の選択矩形」をそのまま持たせる
            sourceWidth: window.innerWidth,
            sourceHeight: window.innerHeight,
            cropX: selectedRect.x,
            cropY: selectedRect.y,
            cropWidth: selectedRect.width,
            cropHeight: selectedRect.height,
          });
        } else {
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
        if (uAppState.target == "image" && props.appBackgroundImageCanvasRef) {
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

          if (props.onColorAnalysis) {
            await props.onColorAnalysis(ret.colors, ret.colors01);
          }
        } else {
          //
          // ensureScreenCapturePermission() の コメントを確認してね
          //if (!await await ensureScreenCapturePermission()) {
          //  return
          //}
          if (props.onBeforeCapture) {
            await props.onBeforeCapture();
          }
          const ret = await captureAndCropToAnalysis({
            targetRect: selectedRect,
          });
          if (props.onColorAnalysis) {
            await props.onColorAnalysis(ret.colors, ret.colors01);
          }
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
        if (clipQuadRef.current && clipQuadRef.current.length == 4 && quadMode != "off") {
          drawClipQuad2({
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
          currentPoint: current ?? undefined,
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
      if (clipQuadRef.current && clipQuadRef.current.length == 4 && quadMode != "off") {
        drawClipQuad2({
          canvas,
          ctx,
          points: clipQuadRef.current,
          dragging: true
        })
      }
    } else if (uAppState.tool == "color" || uAppState.tool == "capture") {
      drawClipRect({ canvas, ctx, start, current, dragging });
    }
  }, [uAppState.tool, measureMode, uAppState.color, quadMode]);

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
      const pointSet = findNearestQuadPoint(p, clipQuadRef.current, 14);
      if (pointSet.type == "center") {
        // 中央が選択
        draggedCenterQuadRef.current = { ...p };
      }
      const pointIndex = pointSet.index;
      //findNearestQuadPointIndex(p, clipQuadRef.current, 14);
      clipQuadDraggingPointIndexRef.current = pointIndex;
      //console.log(">> pointIndex:", pointIndex);
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current || !startRef.current) return;

      const rect = canvas.getBoundingClientRect();
      currentRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };

      chainMesureRef.current.update(currentRef.current);

      if (clipQuadDraggingPointIndexRef.current != -1) {
        const index = clipQuadDraggingPointIndexRef.current;
        clipQuadRef.current[index] = { ...currentRef.current };
      }
      if (draggedCenterQuadRef.current) {
        let _dx = currentRef.current.x - draggedCenterQuadRef.current.x;
        let _dy = currentRef.current.y - draggedCenterQuadRef.current.y;
        for (let i = 0; i < clipQuadRef.current.length; i++) {
          clipQuadRef.current[i].x += _dx
          clipQuadRef.current[i].y += _dy
        }
        draggedCenterQuadRef.current = { ...currentRef.current }
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
        if (len <= 5) {
          showToast(`Must be 5px or more.`);
          return
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
  }, [redraw, measureMode, uAppState, captureMode]);

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

      {/* Measure Sub Toolbar */}
      <div
        className={`fixed bottom-4 right-4 z-9999 flex items-end gap-2 ${uAppState.tool === "measure" ? "flex" : "hidden"
          }`}
      >
        {/* 展開パネル */}
        {/* 開閉タブ */}
        <button
          className="rounded-2xl border border-slate-700 bg-slate-900/90 px-3 py-3 text-xs text-slate-100 shadow-xl transition-colors hover:bg-slate-800"
          onClick={() => setMeasureToolbarOpen((v) => !v)}
          title="toggle measure toolbar"
          aria-label="toggle measure toolbar"
        >
          {measureToolbarOpen ? ">" : "<"}
        </button>
        <div
          className={`overflow-hidden rounded-2xl bg-slate-950/80 shadow-xl backdrop-blur transition-all duration-200 ${measureToolbarOpen
            ? "max-w-[1000px] opacity-100 translate-x-0 border border-slate-800"
            : "max-w-0 opacity-0 translate-x-2 border border-transparent"
            }`}
        >
          <div className="flex flex-col gap-1 p-1 sm:flex-row sm:flex-wrap">
            <button
              className={`flex items-center justify-center gap-1 rounded-2xl border px-2 py-1 m-0.5 text-xs transition-colors outline-none ${measureMode === "line"
                ? "border-emerald-500 bg-emerald-950 text-emerald-300"
                : "border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 active:bg-slate-700"
                }`}
              onClick={() => {
                console.log("line measure click");
                setMeasureMode("line");
              }}
              title="line measure"
              aria-label="line measure"
            >
              Line
            </button>

            <button
              className={`flex items-center justify-center gap-2 rounded-2xl border px-2 py-1 m-0.5 text-xs transition-colors outline-none ${measureMode === "chain"
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
              Chain
            </button>

            <button
              className={`flex items-center justify-center gap-2 rounded-2xl border px-2 py-1 m-0.5 text-xs transition-colors outline-none ${measureMode === "setUnit"
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

            <div className="flex items-center gap-2">
              <div
                className="
      flex flex-col gap-1
      rounded-2xl border border-slate-700 bg-slate-900 p-1
      sm:flex-row sm:items-center
    "
              >
                <span
                  className="
                    inline-flex items-center justify-center
                    rounded-xl
                    bg-slate-800/80
                    px-2 py-1 m-0.5 
                    text-xs font-medium uppercase tracking-wide
                    text-slate-400
                    select-none
                    sm:rounded-l-xl sm:rounded-r-none
                  "
                >
                  Quad
                </span>

                <div className="flex flex-col gap-1 sm:flex-row">
                  {(["off", "view", "apply"] as const).map((mode) => (
                    <button
                      key={mode}
                      className={`rounded-xl px-2 py-1 m-0.5 text-xs ${quadMode === mode
                        ? "border border-amber-500 bg-amber-950 text-amber-300"
                        : "text-slate-100 hover:bg-slate-800"
                        }`}
                      onClick={() => {
                        setQuadMode(mode);
                        if (mode === "apply") {
                          dialog.showConfirmDialog({
                            title: "Quad Apply",
                            body: "now creating",
                          });
                        }
                      }}
                    >
                      {mode === "off" ? "Off" : mode === "view" ? "View" : "Apply"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 開閉タブ */}
      </div>
      {
        // color menu
      }
      <div
        className={`fixed top-4 right-4 z-9999 items-center gap-2 ${(uAppState.tool === "capture" || uAppState.tool === "color") && isMac
          ? "flex"
          : "hidden"
          }`}
      >
        <button
          className="
          rounded-lg bg-black/60 px-3 py-2 text-xs text-white
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
      {
        // capture sub menu
      }
      {/* Measure Sub Toolbar */}
      <div
        className={`fixed bottom-4 right-4 z-9999 flex items-end p-1 m-1 gap-1 ${uAppState.tool === "capture" ? "flex" : "hidden"
          }`}
      >
        {/* 展開パネル */}
        {/* 開閉タブ */}
        <button
          className="rounded-2xl border border-slate-700 bg-slate-900/90 px-2 py-2 m-0.5 text-xs text-slate-100 shadow-xl transition-colors hover:bg-slate-800"
          onClick={() => setCaptureToolbarOpen((v) => !v)}
          title="toggle measure toolbar"
          aria-label="toggle measure toolbar"
        >
          {captureToolbarOpen ? ">" : "<"}
        </button>
        <div
          className={`overflow-hidden rounded-2xl bg-slate-950/80 shadow-xl backdrop-blur transition-all duration-200 ${captureToolbarOpen
            ? "max-w-[1200px] translate-x-0 border border-slate-800 opacity-100"
            : "max-w-0 translate-x-2 border border-transparent opacity-0"
            }`}
        >
          <div className="flex flex-col gap-1 p-2 sm:flex-row sm:flex-wrap">
            <button
              className={`flex items-center gap-1 rounded-2xl border px-2 py-2 m-0.5 text-xs transition-colors outline-none ${captureMode === "none"
                ? "border-emerald-500 bg-emerald-950 text-emerald-300"
                : "border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 active:bg-slate-700"
                }`}
              onClick={() => {
                setCaptureMode("none");
                appState.setCaptureMode("none");
              }}
              title="none"
              aria-label="none"
            >
              None
            </button>

            <button
              className={`flex items-center gap-2 rounded-2xl border px-2 py-2 m-0.5 text-xs transition-colors outline-none ${captureMode === "lightness"
                ? "border-emerald-500 bg-emerald-950 text-emerald-300"
                : "border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 active:bg-slate-700"
                }`}
              onClick={() => {
                setCaptureMode("lightness");
                appState.setCaptureMode("lightness");
              }}
              title="grayscale value check"
              aria-label="grayscale value check"
            >
              Value
            </button>

            <button
              className={`flex items-center gap-2 rounded-2xl border px-2 py-2 m-0.5 text-xs  transition-colors outline-none ${captureMode === "protan"
                ? "border-emerald-500 bg-emerald-950 text-emerald-300"
                : "border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 active:bg-slate-700"
                }`}
              onClick={() => {
                setCaptureMode("protan");
                appState.setCaptureMode("protan");
              }}
              title="protan preview"
              aria-label="protan preview"
            >
              Protan
            </button>

            <button
              className={`flex items-center gap-2 rounded-2xl border px-2 py-2 m-0.5 text-xs transition-colors outline-none ${captureMode === "deutan"
                ? "border-emerald-500 bg-emerald-950 text-emerald-300"
                : "border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 active:bg-slate-700"
                }`}
              onClick={() => {
                setCaptureMode("deutan");
                appState.setCaptureMode("deutan");
              }}
              title="deutan preview"
              aria-label="deutan preview"
            >
              Deutan
            </button>

            <button
              className={`flex items-center gap-2 rounded-2xl border px-2 py-2 m-0.5 text-xs transition-colors outline-none ${captureMode === "tritan"
                ? "border-emerald-500 bg-emerald-950 text-emerald-300"
                : "border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 active:bg-slate-700"
                }`}
              onClick={() => {
                setCaptureMode("tritan");
                appState.setCaptureMode("tritan");
              }}
              title="tritan preview"
              aria-label="tritan preview"
            >
              Tritan
            </button>

            <button
              className={`flex items-center gap-2 rounded-2xl border px-2 py-2 m-0.5 text-xs transition-colors outline-none ${false
                ? "border-emerald-500 bg-emerald-950 text-emerald-300"
                : "border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 active:bg-slate-700"
                }`}
              onClick={() => {
                appState.setCaptureImage(undefined);
              }}
              title="clear capture image"
              aria-label="clear capture image"
            >
              Clear
            </button>
          </div>
        </div>

        {/* 開閉タブ */}
      </div>
    </>
  );
});

export { AppDeslel };
export type { AppDeskelHandle, AppDeskelPoint };
