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
import { DeskelSimpleDrawCanvas } from "./DeskelSimpleDrawCanvas"; 
import { captureAndCropToAnalysis } from "./screenshot";
import { sleep } from "./utils";

export default function App() {
  //const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const deskelRef = useRef<AppDeskelHandle | null>(null);
  const colorAnalysisRef = useRef<AppColorAnalysisHandle | null>(null);

  const handleResize = useCallback(({ payload }: { payload: { width: number; height: number } }) => {
    console.log(">> win.onResized NEW !", payload)
    deskelRef.current?.redraw({ isResizeCanvas: true });
    showToolbar()
    updateWindowTitle()
  }, [])

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
      } finally {
        const deskel = deskelRef.current;
        deskel.setVisible(true);
        colorAnalysis.setVisible(true);
        console.log(">> >> visible ", true);
      }
    }
  }, []);
  const onClickClearColorCheck = useCallback( async () => {
    console.log(">> onClickClearColorCheck  ");
    if (deskelRef.current && colorAnalysisRef.current) {
      console.log(">> >> visible ", false);
      const colorAnalysis = colorAnalysisRef.current;
      colorAnalysis.setVisible(false);
    }
  }, []);
  return (
    <div id="app">
      { /*<CustomTitlebar/> */} 
      <AppToolbar onChangeState={onChangeStateForToolbar} onClickColorCheck={onClickColorCheck} onClickClearColorCheck={onClickClearColorCheck}/>
      <AppDeslel ref={deskelRef} />
      <AppColorAnalysis ref={colorAnalysisRef} />
      <DeskelSimpleDrawCanvas />

    </div>
  )
}