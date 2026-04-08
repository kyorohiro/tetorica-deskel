import { invoke } from "@tauri-apps/api/core"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { platform } from "@tauri-apps/plugin-os"
//import { waitNextFrame } from "./utils";

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
  colors01: ColorCount[]; // 候補
};


type TargetRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

// targetRect :  window/canvas 内の CSS px 座標
export async function captureAndCropToAnalysis(params: { targetRect?: TargetRect | null; }) {
  console.log("> captureAndCropToAnaluze", params);
  const appWindow = getCurrentWindow()

  const caputureRect = await calcCaptureAndCropParams({targetRect:params.targetRect});
  const toolbar = document.getElementById("toolbar")
  try {
    if (toolbar != null) {
      toolbar.style.display = "none";
    }
    await sleep(300);
    // 
    // mac だと 透明にしてゴーストが残ることがあるので Window を非表示にする
    //
    await appWindow.hide()

    // visibleがfalseになるまで待つ
    for (let i = 0; i < 10; i++) {
      const visible = await appWindow.isVisible()
      if (!visible) break
      await new Promise(r => setTimeout(r, 16))
    }

    // 念のため1フレーム
    //await waitNextFrame(1)
    await sleep(25);

    const result = await invoke<ColorAnalysisResult>("analyze_region_colors", {
      x: caputureRect.x,
      y: caputureRect.y,
      width: caputureRect.width,
      height: caputureRect.height,
      quantizeStep: 32,
      topN: 1000,
    });
    console.log(">> result", result);
    return result;
  }  catch(e) {
    console.log(e);
    if (typeof e === "string") {
      throw new Error(e);
    } else if ( e instanceof Error) {
      throw e;
    } else {
      throw new Error(JSON.stringify(e));
    }
  } finally {
    if (toolbar) {
      toolbar.style.display = ""
    }
    await appWindow.show()
  }
  //appWindow.setDecorations(true);
}


export type ScreenCaptureImage = {
  path: string;

  // 表示用: window / canvas 内の CSS px 座標
  viewWidth: number;
  viewHeight: number;
  x: number;
  y: number;
  width: number;
  height: number;

  // デバッグ用: Rust に渡した実キャプチャ座標
  captureX: number;
  captureY: number;
  captureWidth: number;
  captureHeight: number;
};


function getDefaultTargetRect(): TargetRect {
  return {
    x: 0,
    y: 0,
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

function calcScreenCaptureViewRect(params: {
  targetRect?: TargetRect | null;
}): {
  viewWidth: number;
  viewHeight: number;
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const target = params.targetRect ?? getDefaultTargetRect();

  return {
    viewWidth: window.innerWidth,
    viewHeight: window.innerHeight,
    x: target.x,
    y: target.y,
    width: target.width,
    height: target.height,
  };
}

// targetRect : window/canvas 内の CSS px 座標
export async function calcCaptureAndCropParams(params: {
  targetRect?: TargetRect | null;
}): Promise<{ x: number; y: number; width: number; height: number }> {
  console.log("> calcCaptureAndCropParams", params);

  const appWindow = getCurrentWindow();

  const innerPos = await appWindow.innerPosition();
  const innerSize = await appWindow.innerSize();
  const outerPos = await appWindow.outerPosition();
  const outerSize = await appWindow.outerSize();

  let scale = await appWindow.scaleFactor();
  const scaleFactor = scale;
  const os = await platform();
  const isWindows = os === "windows";
  const isMac = os === "macos";

  const customTitleBar = document.getElementById("custom-title-bar");

  // CSS px 基準
  let titlebarHeightCss = 0;
  if (customTitleBar) {
    titlebarHeightCss = customTitleBar.getBoundingClientRect().height;
  }

  // capture 用の補正値
  let titlebarHeightForCapture = titlebarHeightCss;

  if (isWindows) {
    // 現状の実測ルールを維持
    titlebarHeightForCapture = titlebarHeightCss * scale;
    scale = 1.0;
  }

  if (isMac) {
    const latestOuterPos = await appWindow.outerPosition();
    const latestInnerPos = await appWindow.innerPosition();

    if (latestOuterPos.y === latestInnerPos.y) {
      titlebarHeightForCapture = 30 * scale;
    }
  }

  console.log("> capture window info", {
    innerPos,
    innerSize,
    outerPos,
    outerSize,
    scale,
    scaleFactor,
    os,
    titlebarHeightCss,
    titlebarHeightForCapture,
  });

  const target = params.targetRect ?? null;
  const targetX = target ? target.x * scaleFactor : 0;
  const targetY = target ? target.y * scaleFactor : 0;
  const targetWidth = target ? target.width * scaleFactor : innerSize.width;
  const targetHeight = target
    ? target.height * scaleFactor
    : innerSize.height - titlebarHeightForCapture;

  const captureX = Math.round((innerPos.x + targetX) / scale);
  const captureY = Math.round((innerPos.y + titlebarHeightForCapture + targetY) / scale);
  const captureWidth = Math.round(targetWidth / scale);
  const captureHeight = Math.round(targetHeight / scale);

  console.log("> capture rect", {
    target,
    captureX,
    captureY,
    captureWidth,
    captureHeight,
  });

  return {
    x: captureX,
    y: captureY,
    width: captureWidth,
    height: captureHeight,
  };
}

// targetRect : window/canvas 内の CSS px 座標
export async function captureAndCropToDownloads(params: {
  path?: string | null;
  targetRect?: TargetRect | null;
}): Promise<ScreenCaptureImage> {
  console.log("> captureAndCropToDownloads", params);

  const captureRect = await calcCaptureAndCropParams({
    targetRect: params.targetRect,
  });

  const viewRect = calcScreenCaptureViewRect({
    targetRect: params.targetRect,
  });

  const toolbar = document.getElementById("toolbar");

  try {
    if (toolbar) {
      toolbar.style.display = "none";
    }

    await sleep(300);

    const path = await invoke<string>("capture_and_crop_to_downloads", {
      x: captureRect.x,
      y: captureRect.y,
      width: captureRect.width,
      height: captureRect.height,
      path: params.path ?? "",
    });

    return {
      path,
      viewWidth: viewRect.viewWidth,
      viewHeight: viewRect.viewHeight,
      x: viewRect.x,
      y: viewRect.y,
      width: viewRect.width,
      height: viewRect.height,
      captureX: captureRect.x,
      captureY: captureRect.y,
      captureWidth: captureRect.width,
      captureHeight: captureRect.height,
    };
  } catch (e) {
    console.log(e);
    if (typeof e === "string") {
      throw new Error(e);
    } else if (e instanceof Error) {
      throw e;
    } else {
      throw new Error(JSON.stringify(e));
    }
  } finally {
    if (toolbar) {
      toolbar.style.display = "";
    }
  }
}