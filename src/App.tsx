import { useCallback, useEffect, useRef, useState } from "react"
import { draw, resizeCanvas } from "./deskel"
import { showToolbar, initToolbar } from "./toolbar"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { updateWindowTitle, toggleAlwaysOnTop, toggleClickCursorThrough } from "./window";
import { setupShortcuts } from "./shortcut";

import { saveSettings, state } from "./state";
import "./style.css"
import { captureAndCropToDownloads } from "./screenshot";
//import { useDialog } from "./useDialog";
import { save } from "@tauri-apps/plugin-dialog";
//import { CustomTitlebar } from "./CustomTitlebar";

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  //console.log(">> state", JSON.stringify(state));
  const [grid, setGrid] = useState(state.grid)
  const [opacity, setOpacity] = useState(state.opacity)
  const [rotation, setRotation] = useState(state.rotation)
  const [captureStatus, setCaptureStatus] = useState("")
  //const dialog = useDialog();

  const handleColorCheck = async () => {
    try {
      //await dialog.showConfirmDialog({
      //  title: "Save",
      //  body: "download folder"
      //})
      const filePath = await save({
        title: "画像を保存",
        defaultPath: "deskel-crop.png",
        filters: [
          {
            name: "PNG Image",
            extensions: ["png"],
          },
        ],
      })
      setCaptureStatus("capturing...")
      //const path = await testMonitorScreenshot();
      const path = await captureAndCropToDownloads({ path: filePath ?? undefined })
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
      { /*<CustomTitlebar/> */ }
      <div id="toolbar">
        <div className="toolbar-row">
          <button
            id="toggleClickCursor"
            onClick={toggleClickCursorThrough}
            className="rounded-lg border border-slate-500 bg-slate-800 px-3 py-2 text-sm text-white shadow hover:bg-slate-700 active:translate-y-px"
          >cursor: off</button>
          <button
            id="togglePin"
            onClick={toggleAlwaysOnTop}
            className="rounded-lg border border-slate-500 bg-slate-800 px-3 py-2 text-sm text-white shadow hover:bg-slate-700 active:translate-y-px"
          >pin: off</button>

        </div>
        <div>
          <button
            onClick={handleColorCheck}
            className="rounded-lg border border-slate-500 bg-slate-800 px-3 py-2 text-sm text-white shadow hover:bg-slate-700 active:translate-y-px"
          >capture</button>
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