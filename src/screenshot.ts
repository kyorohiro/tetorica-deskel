import { invoke } from "@tauri-apps/api/core"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { platform } from "@tauri-apps/plugin-os"

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

export async function captureAndCropToDownloads(params: { path: string | undefined | null }) {
  console.log("> captureAndCropToDownloads", params);
  const appWindow = getCurrentWindow()


  //appWindow.setDecorations(false);
  const pos = await appWindow.innerPosition()
  const size = await appWindow.innerSize()
  let scale = await appWindow.scaleFactor()
  const isWindows = (await platform()) === "windows"


  const customTitleBar = document.getElementById("custom-title-bar")
  let titlebarHight = 0;
  if (customTitleBar != null) {
    titlebarHight = customTitleBar.getBoundingClientRect().height;
  }
  if(isWindows) {
    titlebarHight = titlebarHight * scale;
    scale = 1.0;
  }
  console.log({
    pos,
    opos: appWindow.outerPosition(),
    size,
    osize: appWindow.outerSize(),
    titlebarHight,
  })
  const toolbar = document.getElementById("toolbar")
  if (toolbar != null) {
    toolbar.style.display = "none";
  }
  await sleep(300);

  //const rect = target.getBoundingClientRect()
  //const x = Math.round((pos.x + rect.left) / scale)
  //const y = Math.round((pos.y + rect.top) / scale)
  //const width = Math.round(rect.width / scale)
  //const height = Math.round(rect.height / scale)
  const x = Math.round(pos.x / scale);
  const y = Math.round(pos.y / scale + titlebarHight);
  const width = Math.round(size.width / scale);
  const height = Math.round(size.height / scale - titlebarHight);
  const path = await invoke<string>("capture_and_crop_to_downloads", {
    x: x,
    y: y,
    width: width,
    height: height,
    path: params.path,
  })
  if (toolbar) {
    toolbar.style.display = ""
  }
  //appWindow.setDecorations(true);
  return path
}