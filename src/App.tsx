import { useCallback, useEffect, useRef } from "react"
import { showToolbar, initToolbar } from "./toolbar"
import { updateWindowTitle } from "./window";
import { setupShortcuts } from "./nativeShortcut";

import "./style.css"
import { AppToolbar } from "./AppToolbar";
import { AppDeslel } from "./AppDeskel";
import type { AppDeskelHandle } from "./AppDeskel";
import { AppColorAnalysis, AppColorAnalysisHandle } from "./AppColorAnalysis";
import { AppSimpleDrawCanvas } from "./AppSimpleDrawCanvas";
import { ColorCount } from "./nativeScreenshot";
import { useAppState, appState } from "./state";
import ScreenCaptureCanvas from "./AppScreenCaptureCanvas";
import { getAppWindow, isTauri } from "./native";
import { AppBackgroundImageCanvas, AppBackgroundImageCanvasHandle } from "./AppBackgroundImageCanvas";

export default function App() {
  const deskelRef = useRef<AppDeskelHandle | null>(null);
  const colorAnalysisRef = useRef<AppColorAnalysisHandle | null>(null);
  const appBackgroundImageCanvasRef = useRef<AppBackgroundImageCanvasHandle|null>(null);
  const state = useAppState();

  useEffect(()=>{
    if(!isTauri()) {
      // Taruiでないなら image だけ
      appState.setTarget("image");
    }
  },[]);

  const handleResize = useCallback(({ payload }: { payload: { width: number; height: number } }) => {
    console.log(">> win.onResized NEW !", payload)
    deskelRef.current?.redraw({ isResizeCanvas: true });
    showToolbar()
    updateWindowTitle().catch((e)=>{
      console.log(e);
    })
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
    let disposed = false;
    let off: undefined | (() => void);

    const setupTauriOnly = async () => {
      const win = await getAppWindow();
      if (!win) {
        return;
      }
      await setupShortcuts();
      const unlisten = await win.onResized(handleResize);

      if (disposed) {
        unlisten();
        return;
      }

      off = unlisten;
    };

    setupTauriOnly();
    
    initToolbar();
    showToolbar();

    return () => {
      disposed = true;
      off?.();
    };
  }, [handleResize]);

  const onChangeStateForToolbar = useCallback(() => {
    deskelRef.current?.redraw();
  }, []);

  return (
    <div id="app" className="relative w-screen h-screen">
      {
      <div className="" >
        <AppBackgroundImageCanvas ref={appBackgroundImageCanvasRef} />
      </div>
      }
      <div className="absolute inset-0 z-10">
        <ScreenCaptureCanvas image={state.captureImage} mode={state.captureMode} />
      </div>


      <div className="absolute inset-0 z-20">
        <AppDeslel ref={deskelRef} onColorAnalysis={onColorAnalysis} appBackgroundImageCanvasRef={appBackgroundImageCanvasRef}/>
      </div>

      <div className={`absolute inset-0 z-30 ${state.tool === "color" ? "pointer-events-none" : "pointer-events-none"}`}>
        <AppColorAnalysis ref={colorAnalysisRef} />
      </div>

      <div
        className={`absolute inset-0 z-40 ${state.tool === "draw" ? "pointer-events-auto" : "pointer-events-none"
          }`}
      >
        <AppSimpleDrawCanvas />
      </div>

      <div className="absolute top-0 left-0 z-50">
        <AppToolbar onChangeState={onChangeStateForToolbar} appBackgroundImageCanvasRef={appBackgroundImageCanvasRef} appColorAnalysisRef={colorAnalysisRef}/>
      </div>
    </div>
  );
}