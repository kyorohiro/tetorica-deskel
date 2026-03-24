import { useCallback, useEffect, useRef, useState } from "react"
import { draw, resizeCanvas } from "./deskel"
import { showToolbar, initToolbar } from "./toolbar"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { updateWindowTitle, toggleAlwaysOnTop, toggleClickCursorThrough } from "./window";
import { setupShortcuts } from "./shortcut";

import { saveSettings, state } from "./state";
import "./style.css"
import { captureAndCropToDownloads } from "./screenshot";
import { useDialog } from "./useDialog";

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  console.log(">> state", JSON.stringify(state));
  const [grid, setGrid] = useState(state.grid)
  const [opacity, setOpacity] = useState(state.opacity)
  const [rotation, setRotation] = useState(state.rotation)
  const [captureStatus, setCaptureStatus] = useState("")
  const dialog = useDialog();

  const handleColorCheck = async () => {
    try {
      await dialog.showConfirmDialog({
        title: "Save",
        body: "download folder"
      })
      setCaptureStatus("capturing...")
      //const path = await testMonitorScreenshot();
      const path = await captureAndCropToDownloads()
      setCaptureStatus(`saved: ${path}`)
    } catch (e) {
      console.error(e)
      setCaptureStatus(`error: ${String(e)}`)
    }
  }
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
    state.rotation = rotation
    saveSettings();
    resizeCanvas({ canvas, ctx })
    draw({ canvas, ctx })
  }, [grid, opacity, rotation])

  return (
    <div id="app">
      <div id="toolbar" data-tauri-drag-region>
        <div className="toolbar-row">
          <button id="toggleClickCursor" onClick={toggleClickCursorThrough}>cursor: off</button>
          <button id="togglePin" onClick={toggleAlwaysOnTop}>pin: off</button>

        </div>
        <div>
          <button onClick={handleColorCheck}>color check</button>
          <div>{captureStatus}</div>
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

        <label>
          rotation
          <input
            type="range"
            min="-180"
            max="180"
            value={rotation}
            onChange={(e) => setRotation(Number(e.target.value))}
          />
        </label>
      </div>

      <div>
        <canvas ref={canvasRef} />
      </div>
    </div>
  )
}