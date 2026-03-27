import { invoke } from "@tauri-apps/api/core"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { platform } from "@tauri-apps/plugin-os"

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));
export type ColorCount = {
  r: number;
  g: number;
  b: number;
  hex: string;
  count: number;
  ratio: number;
  hue: number;  // 0..360
  hue_angle: number;      // 色相環用
  hsl_saturation: number; // 0..1
  lightness: number;      // 0..1
  hsv_saturation: number; // 0..1
  value: number;         // 0..1
};

type ColorAnalysisResult = {
  width: number;
  height: number;
  total_pixels: number;
  colors: ColorCount[];
};



export async function captureAndCropToAnalysis(params: {}) {
  console.log("> captureAndCropToAnaluze", params);
  const appWindow = getCurrentWindow()


  //appWindow.setDecorations(false);
  const pos = await appWindow.innerPosition()
  const size = await appWindow.innerSize()
  let scale = await appWindow.scaleFactor()
  const outerPos = await appWindow.outerPosition()
  const outerSize = await appWindow.outerSize()
  const isWindows = platform() === "windows"
  const isMac = platform() === "macos"

  const customTitleBar = document.getElementById("custom-title-bar")
  let titlebarHight = 0;
  if (customTitleBar != null) {
    titlebarHight = customTitleBar.getBoundingClientRect().height;
  }

  if (isWindows) {
    titlebarHight = titlebarHight * scale;
    scale = 1.0;
  }
  if (isMac) {
    if ((await appWindow.outerPosition()).y == (await appWindow.innerPosition()).y) {
      titlebarHight = 30;
    }
  }

  console.log({
    pos,
    outerPos,
    size,
    outerSize,
    titlebarHight,
  })

  const toolbar = document.getElementById("toolbar")
  try {
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
    console.log(">> invoke");
    const result = await invoke<ColorAnalysisResult>("analyze_region_colors", {
      x: x,
      y: y,
      width: width,
      height: height,
      quantizeStep: 32,
      topN: 1000,
    });
    console.log(">> result", result);
    return result;
  } catch (e) {
    console.log(">> error", e);
    throw e;
  } finally {
    if (toolbar) {
      toolbar.style.display = ""
    }
  }
  //appWindow.setDecorations(true);
}

export async function captureAndCropToDownloads(params: { path: string | undefined | null }) {
  console.log("> captureAndCropToDownloads", params);
  const appWindow = getCurrentWindow()


  //appWindow.setDecorations(false);
  const pos = await appWindow.innerPosition()
  const size = await appWindow.innerSize()
  let scale = await appWindow.scaleFactor()
  const outerPos = await appWindow.outerPosition()
  const outerSize = await appWindow.outerSize()
  const isWindows = platform() === "windows"
  const isMac = platform() === "macos"

  const customTitleBar = document.getElementById("custom-title-bar")
  let titlebarHight = 0;
  if (customTitleBar != null) {
    titlebarHight = customTitleBar.getBoundingClientRect().height;
  }

  if (isWindows) {
    titlebarHight = titlebarHight * scale;
    scale = 1.0;
  }
  if (isMac) {
    if ((await appWindow.outerPosition()).y == (await appWindow.innerPosition()).y) {
      titlebarHight = 30;
    }
  }

  console.log({
    pos,
    outerPos,
    size,
    outerSize,
    titlebarHight,
  })

  const toolbar = document.getElementById("toolbar")
  try {
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
      path: params.path
    })
    return path
  } finally {
    if (toolbar) {
      toolbar.style.display = ""
    }
  }
  //appWindow.setDecorations(true);
}