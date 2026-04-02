import { useCallback, useEffect, useRef } from "react"
import { showToolbar, initToolbar } from "./toolbar"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { updateWindowTitle } from "./window";
import { setupShortcuts } from "./shortcut";

import "./style.css"
import { AppToolbar } from "./AppToolbar";
import { AppDeslel } from "./AppDeskel";
import type { AppDeskelHandle } from "./AppDeskel";
import { AppColorAnalysis, AppColorAnalysisHandle } from "./AppColorAnalysis";
import { AppSimpleDrawCanvas } from "./AppSimpleDrawCanvas";
import { captureAndCropToAnalysis, ColorCount } from "./screenshot";
import { sleep } from "./utils";
import { useAppState } from "./state";
import { showToast } from "./toast";

export default function App() {
  //const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const deskelRef = useRef<AppDeskelHandle | null>(null);
  const colorAnalysisRef = useRef<AppColorAnalysisHandle | null>(null);
  const state = useAppState();

  const handleResize = useCallback(({ payload }: { payload: { width: number; height: number } }) => {
    console.log(">> win.onResized NEW !", payload)
    deskelRef.current?.redraw({ isResizeCanvas: true });
    showToolbar()
    updateWindowTitle()
  }, [])

  const onColorAnalysis = async (colors: ColorCount[], colors01: ColorCount[]): Promise<void> => {
    colorAnalysisRef.current?.redraw({
      colors,
      colors01
    });
    const colorAnalysis = colorAnalysisRef.current;
    if (colorAnalysis) {
      colorAnalysis.setVisible(true);
    }
    return;
  };

  useEffect(() => {
    const win = getCurrentWindow()
    let disposed = false
    let off: undefined | (() => void)

    const setup = async () => {
      const unlisten = await win.onResized(handleResize)

      if (disposed) {
        unlisten()
        return
      }

      off = unlisten
    }

    setup()
    setupShortcuts();
    initToolbar();
    showToolbar();
    return () => {
      disposed = true
      off?.()
    }
  }, [handleResize])

  const onChangeStateForToolbar = useCallback(() => {
    deskelRef.current?.redraw();
  }, []);
  const onClickColorCheck = useCallback(async () => {
    console.log(">> onClickColorCheck ");
    if (deskelRef.current && colorAnalysisRef.current) {
      console.log(">> >> visible ", false);
      const deskel = deskelRef.current;
      const colorAnalysis = colorAnalysisRef.current;
      try {

        deskel.setVisible(false);
        colorAnalysis.setVisible(false);
        console.log("> false");
        await sleep(1000);
        console.log("> redraw");
        const params = await captureAndCropToAnalysis({})
        colorAnalysisRef.current?.redraw(params);
      } catch (e) {
        if (e instanceof Error) {
          showToast(e.message)
        } else {
          showToast(`${e}`);
        }
      } finally {
        const deskel = deskelRef.current;
        deskel.setVisible(true);
        colorAnalysis.setVisible(true);
        console.log(">> >> visible ", true);
      }
    }
  }, []);
  const onClickClearColorCheck = useCallback(async () => {
    console.log(">> onClickClearColorCheck  ");
    if (deskelRef.current && colorAnalysisRef.current) {
      console.log(">> >> visible ", false);
      const colorAnalysis = colorAnalysisRef.current;
      colorAnalysis.setVisible(false);
    }
  }, []);
  return (
    <div id="app">
      <AppToolbar
        onChangeState={onChangeStateForToolbar}
        onClickColorCheck={onClickColorCheck}
        onClickClearColorCheck={onClickClearColorCheck}
      />

      <AppDeslel ref={deskelRef} onColorAnalysis={onColorAnalysis} />
      <AppColorAnalysis ref={colorAnalysisRef} />

      {
        //
        // どっちにしよ..
        //<div
        //  className={state.tool === "draw" ? "block pointer-events-auto" : "hidden pointer-events-none"}
        //>
        //  <AppSimpleDrawCanvas />
        //</div>
      }
      {
      <div
        className={state.tool === "draw" ? "pointer-events-auto" : "pointer-events-none"}
      >
        <AppSimpleDrawCanvas />
      </div>
      }

      {
        // 共通toolbar 
        // 置き場所はここで良いか? 共通化すべきか..迷いどころ
      }
      {
        /*
      <div
        className={`fixed bottom-4 right-4 z-[9999] flex flex-wrap items-center justify-end gap-2 rounded-2xl border border-slate-800 bg-slate-950/80 p-2 shadow-xl backdrop-blur ${true ? "block" : "hidden"
          }`}
      >       <button
        className={`rounded-2xl border px-3 py-3 text-sm ${true
          ? "border-emerald-500 bg-emerald-950 text-emerald-300"
          : "border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"
          }`}
        onClick={() => true}
        title="ペン"
        aria-label="ペン"
      >
          demo
        </button>
      </div>
      */
      }
    </div>
  )
}