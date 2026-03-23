import { invoke } from "@tauri-apps/api/core"
import { getCurrentWindow } from "@tauri-apps/api/window"

export async function captureAndCropToDownloads() {
  const appWindow = getCurrentWindow()

  const pos = await appWindow.innerPosition()
  const size = await appWindow.innerSize()
  const scale = await appWindow.scaleFactor()

  const path = await invoke<string>("capture_and_crop_to_downloads", {
    x: Math.round(pos.x / scale),
    y: Math.round(pos.y / scale),
    width: Math.round(size.width / scale),
    height: Math.round(size.height / scale),
  })

  return path
}