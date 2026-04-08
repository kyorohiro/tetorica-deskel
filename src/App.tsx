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
import { ColorCount } from "./screenshot";
import { useAppState } from "./state";
import ScreenCaptureCanvas from "./AppScreenCaptureCanvas";

export default function App() {
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

  return (
    <div id="app">
      <AppToolbar
        onChangeState={onChangeStateForToolbar}
      />
      <AppDeslel ref={deskelRef} onColorAnalysis={onColorAnalysis} />
      <AppColorAnalysis ref={colorAnalysisRef} />
      {
        // Simple Draw Canvas
      }
      <div
        className={state.tool === "draw" ? "pointer-events-auto" : "pointer-events-none"}
      >
        <AppSimpleDrawCanvas />
      </div>
      <div
      className={state.tool === "capture" ? "pointer-events-none" : "pointer-events-none"}>
        <ScreenCaptureCanvas image={state.captureImage} />
      </div>
    </div>
  )
}