
import { AppDeskelPoint } from "./AppDeskel";
import { appState } from "./state";

type Rgba = {
  r: number
  g: number
  b: number
  a: number
}

type Hsla = {
  h: number
  s: number
  l: number
  a: number
}
function hexToRgbaParams(hex: string, alpha: number): Rgba {
  const value = hex.replace("#", "");
  const n = Number.parseInt(value, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return { r, g, b, a: alpha };
}

function hexToRgba(hex: string, alpha: number): string {
  const value = hex.replace("#", "");
  const n = Number.parseInt(value, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function rgbaToHsla({ r, g, b, a }: Rgba): Hsla {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255

  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const delta = max - min

  let h = 0
  const l = (max + min) / 2

  let s = 0

  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1))

    switch (max) {
      case rn:
        h = 60 * (((gn - bn) / delta) % 6)
        break
      case gn:
        h = 60 * ((bn - rn) / delta + 2)
        break
      case bn:
        h = 60 * ((rn - gn) / delta + 4)
        break
    }
  }

  if (h < 0) h += 360

  return {
    h,
    s: s * 100,
    l: l * 100,
    a,
  }
}

function hslaToRgba({ h, s, l, a }: Hsla): Rgba {
  const sn = s / 100
  const ln = l / 100

  const c = (1 - Math.abs(2 * ln - 1)) * sn
  const hh = h / 60
  const x = c * (1 - Math.abs((hh % 2) - 1))

  let r1 = 0
  let g1 = 0
  let b1 = 0

  if (0 <= hh && hh < 1) {
    r1 = c
    g1 = x
  } else if (1 <= hh && hh < 2) {
    r1 = x
    g1 = c
  } else if (2 <= hh && hh < 3) {
    g1 = c
    b1 = x
  } else if (3 <= hh && hh < 4) {
    g1 = x
    b1 = c
  } else if (4 <= hh && hh < 5) {
    r1 = x
    b1 = c
  } else if (5 <= hh && hh < 6) {
    r1 = c
    b1 = x
  }

  const m = ln - c / 2

  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
    a,
  }
}
function resizeCanvas(params: { canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D }): void {
  //console.log("> resizeCanvas", params);
  if (!params.ctx) {
    return;
  }
  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth;
  const h = window.innerHeight;

  params.canvas!.width = Math.floor(w * dpr);
  params.canvas!.height = Math.floor(h * dpr);
  params.canvas!.style.width = `${w}px`;
  params.canvas!.style.height = `${h}px`;

  params.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  draw({ canvas: params.canvas, ctx: params.ctx });
}

function drawGrid(params: { canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, w: number, h: number }): void {
  if (!params.ctx) {
    return;
  }
  params.ctx.strokeStyle = hexToRgba(appState.getState().color, appState.getState().opacity);
  params.ctx.lineWidth = appState.getState().lineWidth;

  for (let x = 0; x <= params.w; x += appState.getState().grid) {
    params.ctx.beginPath();
    params.ctx.moveTo(x, 0);
    params.ctx.lineTo(x, params.h);
    params.ctx.stroke();
  }

  for (let y = 0; y <= params.h; y += appState.getState().grid) {
    params.ctx.beginPath();
    params.ctx.moveTo(0, y);
    params.ctx.lineTo(params.w, y);
    params.ctx.stroke();
  }
}

function drawCross(params: { canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, w: number, h: number }): void {
  if (!params.ctx) {
    return;
  }
  params.ctx.strokeStyle = hexToRgba(appState.getState().color, Math.min(1, appState.getState().opacity + 0.15));
  params.ctx.lineWidth = Math.max(2, appState.getState().lineWidth + 1);

  params.ctx.beginPath();
  params.ctx.moveTo(params.w / 2, 0);
  params.ctx.lineTo(params.w / 2, params.h);
  params.ctx.stroke();

  params.ctx.beginPath();
  params.ctx.moveTo(0, params.h / 2);
  params.ctx.lineTo(params.w, params.h / 2);
  params.ctx.stroke();
}

function makeShadowColorFromGrid(h: number, s: number, l: number, a: number) {
  const shadowH = (h + 180) % 360
  const shadowS = s * 0.55
  const shadowL = Math.max(l, 70) // HSLのLを0-100で扱う想定
  return { h: shadowH, s: shadowS, l: shadowL, a }
}

function drawClipRect(params: {
  canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, start?: AppDeskelPoint | null, current?: AppDeskelPoint | null, dragging?: boolean
}): void {
  if (!params.ctx) {
    return;
  }


  if (!params.start || !params.current || !params.dragging) return;
  const rgbaParams = hexToRgbaParams(appState.getState().color, 0.8);
  const hslaParams = rgbaToHsla(rgbaParams);
  const shadowHslaParams = makeShadowColorFromGrid(
    hslaParams.h,
    hslaParams.s,
    hslaParams.l,
    hslaParams.a,
  );
  const shadowRgbaParams = hslaToRgba(shadowHslaParams);
  const shadowColor = `rgba(${shadowRgbaParams.r}, ${shadowRgbaParams.g}, ${shadowRgbaParams.b}, ${shadowRgbaParams.a})`;
  const mainColor = `rgba(${rgbaParams.r}, ${rgbaParams.g}, ${rgbaParams.b}, ${rgbaParams.a})`;

  // line
  params.ctx.lineWidth = 3
  params.ctx.strokeStyle = shadowColor;
  params.ctx.beginPath();
  params.ctx.moveTo(params.start.x, params.start.y);
  params.ctx.lineTo(params.start.x, params.current.y);
  params.ctx.lineTo(params.current.x, params.current.y);
  params.ctx.lineTo(params.current.x, params.start.y);
  params.ctx.lineTo(params.start.x, params.start.y);

  params.ctx.stroke();
  //
  params.ctx.fillStyle = shadowColor;
  params.ctx.beginPath();
  params.ctx.arc(params.start.x, params.start.y, 6, 0, Math.PI * 2);
  params.ctx.arc(params.current.x, params.current.y, 6, 0, Math.PI * 2);
  params.ctx.fill();

    params.ctx.lineWidth = 1
  params.ctx.strokeStyle = mainColor;
  params.ctx.beginPath();
  params.ctx.moveTo(params.start.x, params.start.y);
  params.ctx.lineTo(params.start.x, params.current.y);
  params.ctx.lineTo(params.current.x, params.current.y);
  params.ctx.lineTo(params.current.x, params.start.y);
  params.ctx.lineTo(params.start.x, params.start.y);

  params.ctx.stroke();
  //
  params.ctx.fillStyle = mainColor;
  params.ctx.beginPath();
  params.ctx.arc(params.start.x, params.start.y, 3, 0, Math.PI * 2);
  params.ctx.arc(params.current.x, params.current.y, 3, 0, Math.PI * 2);
  params.ctx.fill();
  
}

function draw(params: { canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D }): void {
  if (!params.ctx) {
    return;
  }
  const w = window.innerWidth;
  const h = window.innerHeight;

  params.ctx.clearRect(0, 0, w, h);
  params.ctx.save();
  const cx = w / 2
  const cy = h / 2
  const rad = (appState.getState().rotation * Math.PI) / 180
  params.ctx.translate(cx, cy)
  params.ctx.rotate(rad)
  params.ctx.translate(-cx, -cy)

  drawGrid({ canvas: params.canvas, ctx: params.ctx, w, h });
  //drawCross({ canvas: params.canvas, ctx: params.ctx, w, h });
  params.ctx.restore()
}

export {
  resizeCanvas,
  draw,
  drawCross,
  drawGrid,
  drawClipRect,
  //
  makeShadowColorFromGrid,
  hexToRgbaParams,
  rgbaToHsla,
  hslaToRgba
}