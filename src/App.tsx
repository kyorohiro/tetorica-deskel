import { useCallback, useEffect, useRef, useState } from "react"
import { draw, resizeCanvas } from "./deskel"
import { showToolbar, initToolbar} from "./toolbar"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { updateWindowTitle, toggleAlwaysOnTop, toggleClickCursorThrough } from "./window";
import { setupShortcuts } from "./shortcut";

import { saveSettings, state } from "./state";
import "./style.css"

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  console.log(">> state", JSON.stringify(state));
  const [grid, setGrid] = useState(state.grid)
  const [opacity, setOpacity] = useState(state.opacity)

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
          <button id="toggleClickCursor" onClick={toggleClickCursorThrough}>cursor: off</button>
          <button id="togglePin" onClick={toggleAlwaysOnTop}>pin: off</button>
        </div>
        <div className="toolbar-row">
          <label>
            color
            <input id="color" type="color" value="#00ff88" onChange={() => {
              const color = document.getElementById("color") as HTMLInputElement;
              state.color = color.value;
              const canvas = canvasRef.current
              if (!canvas) return

              const ctx = canvas.getContext("2d")
              if (!ctx) return
              draw({ canvas, ctx });
              saveSettings();
            }} />
          </label>
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