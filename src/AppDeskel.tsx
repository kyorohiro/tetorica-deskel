import {
  useRef,
  forwardRef,
  useImperativeHandle,
  useCallback,
  useEffect,
  useState,
} from "react";
import { draw, drawClipRect, drawMeasure, resizeCanvas } from "./deskel";
import { useAppState } from "./state";
import { captureAndCropToAnalysis, captureAndCropToDownloads, ColorCount } from "./screenshot";
import { showToast } from "./toast";
import { ChainMeasure } from "./chainMesure";
//import { //canCaptureForeignWindow, hasPermission, 
//  openPrivacySettings, probePermission
//} from "./permissionCheck";
import { platform } from "@tauri-apps/plugin-os"
import { useDialog } from "./useDialog";
import { openPrivacySettings } from "./permissionCheck";
import { getRectFromPoints } from "./utils";

type AppDeskelHandle = {
  redraw: (props?: { isResizeCanvas: boolean }) => void;
  setVisible: (visible: boolean) => void;
  getCanvas: () => HTMLCanvasElement | null;
};

type AppDeskelPoint = { x: number; y: number };


const AppDeslel = forwardRef<AppDeskelHandle, { onColorAnalysis?: (colors: ColorCount[], colors01: ColorCount[]) => Promise<void> }>(function (props, ref) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const startRef = useRef<AppDeskelPoint | null>(null);
  const currentRef = useRef<AppDeskelPoint | null>(null);
  const draggingRef = useRef(false);
  const [dragging, setDragging] = useState(false);
  const chainMesureRef = useRef<ChainMeasure>(new ChainMeasure());
  const state = useAppState();
  const [measureMode, setMeasureMode] = useState<"line" | "chain" | "setUnit">("line");
  const [isMac, setIsMac] = useState(false);
  const dialog = useDialog();
  const cleanupRef = useRef<(() => void) | null>(null);
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
        "Move to settings now?"
    });
    if (result) {
      await openPrivacySettings();
    }
  }, []);
  //
  // アクセス権や 対象のWindowの状態から判断するためのコード
  // ではあるが、MacOS の場合は、
  // - アクセス権
  // 更新後に再度権限を付与しないと動かないのに、付与済みと判定されるため、参考程度にしか使えない
  // - キャプチャー対応のアプリ数
  // キャプチャー対象がDesktopの場合は、これでもダメなので、参考程度にしか使えない
  // "?"マークのヘルプボタンも用意して、そこからユーザーに設定を促すようにした
  //  async function ensureScreenCapturePermission(): Promise<boolean> {
  //    const permissionResult = await probePermission();
  //    console.log("probePermission result", permissionResult);
  //
  //    if (permissionResult.status === "granted") {
  //      return true;
  //    }
  //
  //    if (permissionResult.status === "indeterminate") {
  //      // 判定不能なので、ここでは止めない
  //      // 実キャプチャで最終判断する
  //      if (permissionResult.status === "indeterminate") {
  //        showToast("Screen capture permission is indeterminate; proceeding to actual capture.");
  //        return true;
  //      }
  //      return true;
  //    }
  //
  //    // denied
  //    showToast("Screen capture permission required.");
  //
  //    await dialog.showConfirmDialog({
  //      title: "Screen Capture Reset Required",
  //      body:
  //        "Please go to Settings -> Privacy & Security -> Screen Recording & System Audio.\n\n" +
  //        "IMPORTANT: You must select 'tetorica-deskel' and click the '-' (minus) button to remove it first, then click '+' to add it back.\n\n" +
  //        "Simply toggling it Off and On will NOT work.",
  //    });
  //
  //    await openPrivacySettings();
  //    return false;
  //  }
  //
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
        const ret = await captureAndCropToDownloads({ path: undefined, targetRect: selectedRect })
        showToast(ret);
      } catch (e) {
        if (e instanceof Error) {
          showToast(e.message)
        } else {
          showToast(`${e}`);
        }
      }
    }
    if (uAppState.tool == "color") {
      try {
        //
        // アクセス権や 対象のWindowの状態から判断するためのコード
        // ではあるが、MacOS の場合は、
        // - アクセス権
        // 更新後に再度権限を付与しないと動かないのに、付与済みと判定されるため、参考程度にしか使えない
        // - キャプチャー対応のアプリ数
        // キャプチャー対象がDesktopの場合は、これでもダメなので、参考程度にしか使えない
        // "?"マークのヘルプボタンも用意して、そこからユーザーに設定を促すようにした
        //if (!await await ensureScreenCapturePermission()) {
        //  return
        //}
        const ret = await captureAndCropToAnalysis({ targetRect: selectedRect })
        if (props.onColorAnalysis) {
          props.onColorAnalysis(ret.colors, ret.colors01);
        }
      } catch (e) {
        console.log(e);
        if (e instanceof Error) {
          showToast(e.message)
        } else {
          showToast(`${e}`);
        }
      }
    }
  }
  useEffect(() => {
    if (dragging) return;
    onPointerUp();
  }, [dragging]);

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
      console.log({ measureMode });
      if (measureMode == "line") {
        drawMeasure({
          canvas, ctx, start, current, dragging,
          chainLength: chainMesureRef.current.getLength(current ? { x: current?.x, y: current.y } : undefined),
          measureUnit: state.measureUnit,
        });
      } else if (measureMode == "chain") {
        // redraw時
        chainMesureRef.current.draw(ctx, {
          color: uAppState.color,
          lineWidth: 1,
        });
      } else if (measureMode == "setUnit") {
        drawMeasure({
          canvas, ctx, start, current, dragging,
          chainLength: chainMesureRef.current.getLength(current ? { x: current?.x, y: current.y } : undefined),
          measureUnit: state.measureUnit,
        });
      }
    }
    else if (uAppState.tool == "color" || uAppState.tool == "capture") {
      drawClipRect({ canvas, ctx, start, current, dragging });
    }
  }, [uAppState.tool, measureMode, uAppState.color]);

  const setCanvasRef = useCallback((canvas: HTMLCanvasElement | null) => {
    // まず前のcanvasの掃除
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }

    canvasRef.current = canvas;

    if (!canvas) {
      return;
    }

    const onMouseDown = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const p = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };

      chainMesureRef.current.setChainLengthMin(state.measureUnit);
      startRef.current = p;
      currentRef.current = p;
      //draggingRef.current = true;
      setDraggingValue(true);
      chainMesureRef.current.update({ x: startRef.current.x, y: startRef.current.y });
      redraw();
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current || !startRef.current) return;

      const rect = canvas.getBoundingClientRect();
      currentRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
      //
      // pointermove とかで
      chainMesureRef.current.update({ x: currentRef.current.x, y: currentRef.current.y });

      redraw();
    };

    const onMouseUp = () => {
      //draggingRef.current = false;
      setDraggingValue(false);
      chainMesureRef.current.clear()

      redraw();
      if (measureMode == "setUnit" && startRef.current && currentRef.current) {
        // 単位設定モードで、線分が引かれている状態でマウスアップした場合は、その線分の長さを単位として設定する
        const dx = currentRef.current.x - startRef.current.x;
        const dy = currentRef.current.y - startRef.current.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        state.measureUnit = len / 5;
        showToast(`Measure unit set to ${state.measureUnit.toFixed(2)} pixels`); // トーストで単位設定を通知
      }
    };

    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mouseup", onMouseUp);

    redraw({ isResizeCanvas: true });

    cleanupRef.current = () => {
      canvas.removeEventListener("mousedown", onMouseDown);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mouseup", onMouseUp);
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
    [redraw]
  );

  return (
    <>
      <div ref={rootRef}>
        <canvas key="deskel-default" id="deskel" ref={setCanvasRef} />
      </div>
      {
        // Measure Sub Toolbar
      }
      {
        <div
          className={`fixed bottom-4 right-4 z-[9999] flex flex-wrap items-center justify-end gap-2 rounded-2xl border border-slate-800 bg-slate-950/80 p-2 shadow-xl backdrop-blur ${state.tool == "measure" ? "block" : "hidden"
            }`}
        >
          <button
            className={`flex items-center gap-2 rounded-2xl border px-3 py-3 text-sm transition-colors outline-none ${measureMode == "line"
              ? "border-emerald-500 bg-emerald-950 text-emerald-300"
              : "border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 active:bg-slate-700"
              }`}
            onClick={() => {
              console.log("chain measure line click");
              setMeasureMode("line")
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
              setMeasureMode("chain")
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
              setMeasureMode("setUnit")
            }}
            title="set unit"
            aria-label="set unit"
          >
            Set Unit
          </button>
        </div>
      }
      {
        <div
          className={`fixed top-4 right-4 z-[9999] items-center gap-2 ${(state.tool === "capture" || state.tool === "color") && isMac ? "flex" : "hidden"
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