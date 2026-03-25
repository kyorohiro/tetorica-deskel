import { useCallback, useEffect, useRef } from "react"
import { draw, resizeCanvas } from "./deskel"
import { showToolbar, initToolbar } from "./toolbar"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { updateWindowTitle } from "./window";
import { setupShortcuts } from "./shortcut";

import "./style.css"
import { AppToolbar } from "./AppToolbar";


export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const handleResize = useCallback(({ payload }: { payload: { width: number; height: number } }) => {
    console.log(">> win.onResized NEW !", payload)

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    resizeCanvas({ canvas, ctx })
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

  const onChangeStateForToolbar = useCallback(()=>{
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    resizeCanvas({ canvas, ctx })
    draw({ canvas, ctx })
  },[]);

  return (
    <div id="app">
      { /*<CustomTitlebar/> */ }
      <AppToolbar onChangeState={onChangeStateForToolbar}/>
      <div>
        <canvas ref={canvasRef} />
      </div>
    </div>
  )
}