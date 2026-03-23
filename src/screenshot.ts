import { invoke } from "@tauri-apps/api/core"
import { getCurrentWindow } from "@tauri-apps/api/window"

export async function captureAndCropToDownloads() {
  const appWindow = getCurrentWindow()

  const pos = await appWindow.outerPosition()
  const size = await appWindow.outerSize()

  const path = await invoke<string>("capture_and_crop_to_downloads", {
    x: Math.round(pos.x),
    y: Math.round(pos.y),
    width: Math.round(size.width),
    height: Math.round(size.height),
  })

  return path
}