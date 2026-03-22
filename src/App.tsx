import { useCallback, useEffect, useRef, useState } from "react"
import { draw, resizeCanvas } from "./deskel"
import { showToolbar } from "./toolbar"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { updateWindowTitle, toggleAlwaysOnTop } from "./window";

import { state } from "./state";
import "./style.css"

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [grid, setGrid] = useState(80)
  const [opacity, setOpacity] = useState(0.7)

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

    return () => {
      disposed = true
      off?.()
    }
  }, [handleResize])

  useEffect(() => {
    console.log(">> useEffect [grid, opacity]", [grid, opacity])
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    state.grid = grid;
    state.opacity = opacity;
    resizeCanvas({ canvas, ctx })
    draw({ canvas, ctx })
  }, [grid, opacity])

  return (
    <div id="app">
      <div id="toolbar" data-tauri-drag-region>
        <div className="toolbar-row">
          <button id="toggleClickCursor">cursor: off</button>
          <button id="togglePin" onClick={toggleAlwaysOnTop}>pin: off</button>
        </div>
        <label>
          grid
          <input
            type="range"
            min="20"
            max="300"
            value={grid}
            onChange={(e) => setGrid(Number(e.target.value))}
          />
        </label>

        <label>
          opacity
          <input
            type="range"
            min="0.05"
            max="1"
            step="0.05"
            value={opacity}
            onChange={(e) => setOpacity(Number(e.target.value))}
          />
        </label>
      </div>

      <div>
        <canvas ref={canvasRef} />
      </div>
    </div>
  )
}