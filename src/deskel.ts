
import { AppDeskelPoint } from "./AppDeskel";
import { state } from "./state";

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
  params.ctx.strokeStyle = hexToRgba(state.color, state.opacity);
  params.ctx.lineWidth = state.lineWidth;

  for (let x = 0; x <= params.w; x += state.grid) {
    params.ctx.beginPath();
    params.ctx.moveTo(x, 0);
    params.ctx.lineTo(x, params.h);
    params.ctx.stroke();
  }

  for (let y = 0; y <= params.h; y += state.grid) {
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
  params.ctx.strokeStyle = hexToRgba(state.color, Math.min(1, state.opacity + 0.15));
  params.ctx.lineWidth = Math.max(2, state.lineWidth + 1);

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

function drawMeasureTicks(params: {
  ctx: CanvasRenderingContext2D
  start: AppDeskelPoint
  current: AppDeskelPoint
  mainColor: string
  shadowColor: string
  step?: number
  skipEnds?: boolean
}): void {
  const {
    ctx,
    start,
    current,
    mainColor,
    shadowColor,
    step = 20,
    skipEnds = true,
  } = params

  const dx = current.x - start.x
  const dy = current.y - start.y
  const len = Math.sqrt(dx * dx + dy * dy)

  if (len < 1) return

  const ux = dx / len
  const uy = dy / len

  // 法線ベクトル
  const nx = -uy
  const ny = ux

  const startOffset = skipEnds ? step : 0
  const endOffset = skipEnds ? len - step : len

  if (endOffset <= startOffset) return

  for (let d = startOffset, i = 1; d < endOffset; d += step, i++) {
    let tickHalf = 4

    // 5本ごとに長く、10本ごとにさらに長く
    if (i % 10 === 0) {
      tickHalf = 10
    } else if (i % 5 === 0) {
      tickHalf = 7
    }

    const px = start.x + ux * d
    const py = start.y + uy * d

    const x1 = px - nx * tickHalf
    const y1 = py - ny * tickHalf
    const x2 = px + nx * tickHalf
    const y2 = py + ny * tickHalf

    // shadow
    ctx.beginPath()
    ctx.lineWidth = 2
    ctx.strokeStyle = shadowColor
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()

    // main
    ctx.beginPath()
    ctx.lineWidth = 1
    ctx.strokeStyle = mainColor
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
  }

  //
  {
    ctx.beginPath()
    ctx.lineWidth = 1
    ctx.fillStyle = mainColor
    ctx.arc((current.x - start.x) / 2 + start.x, (current.y - start.y) / 2 + start.y, 3, 0, Math.PI * 2);
    ctx.fill();
    //
    ctx.beginPath()
    ctx.lineWidth = 1
    ctx.fillStyle = mainColor
    ctx.arc((current.x - start.x) / 3 + start.x, (current.y - start.y) / 3 + start.y, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath()
    ctx.lineWidth = 1
    ctx.fillStyle = mainColor
    ctx.arc((current.x - start.x) * 2 / 3 + start.x, (current.y - start.y) * 2 / 3 + start.y, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function normalizeAngle180(deg: number): number {
  let a = deg % 360
  if (a > 180) a -= 360
  if (a <= -180) a += 360
  return a
}

function drawMeasure(params: {
  canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, start?: AppDeskelPoint | null, current?: AppDeskelPoint | null, dragging?: boolean
}): void {
  if (!params.ctx) {
    return;
  }


  if (!params.start || !params.current || !params.dragging) return;
  const rgbaParams = hexToRgbaParams(state.color, 0.8);
  const hslaParams = rgbaToHsla(rgbaParams);
  const shadowHslaParams = makeShadowColorFromGrid(
    hslaParams.h,
    hslaParams.s,
    hslaParams.l,
    hslaParams.a,
  );
  const shadowRgbaParams = hslaToRgba(shadowHslaParams);
  const dx = params.current.x - params.start.x;
  const dy = params.current.y - params.start.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
  const angle = (deg + 360) % 360;

  const shadowColor = `rgba(${shadowRgbaParams.r}, ${shadowRgbaParams.g}, ${shadowRgbaParams.b}, ${shadowRgbaParams.a})`;
  const mainColor = `rgba(${rgbaParams.r}, ${rgbaParams.g}, ${rgbaParams.b}, ${rgbaParams.a})`;

  // line
  params.ctx.lineWidth = 8
  params.ctx.strokeStyle = shadowColor;
  params.ctx.beginPath();
  params.ctx.moveTo(params.start.x, params.start.y);
  params.ctx.lineTo(params.current.x, params.current.y);
  params.ctx.stroke();
  //
  params.ctx.fillStyle = shadowColor;
  params.ctx.beginPath();
  params.ctx.arc(params.start.x, params.start.y, 10, 0, Math.PI * 2);
  params.ctx.arc(params.current.x, params.current.y, 10, 0, Math.PI * 2);
  params.ctx.fill();
  //
  // line
  params.ctx.strokeStyle = mainColor
  params.ctx.lineWidth = 2
  params.ctx.beginPath();
  params.ctx.moveTo(params.start.x, params.start.y);
  params.ctx.lineTo(params.current.x, params.current.y);
  params.ctx.stroke();

  params.ctx.fillStyle = mainColor
  params.ctx.beginPath();
  params.ctx.arc(params.start.x, params.start.y, 4, 0, Math.PI * 2);
  params.ctx.arc(params.current.x, params.current.y, 4, 0, Math.PI * 2);
  params.ctx.fill();
  //
  //
  drawMeasureTicks({
    ctx: params.ctx,
    start: params.start,
    current: params.current,
    mainColor,
    shadowColor,
    step: 20,
  })
  //
  // circle
  // circle: center = start, radius = len
  {
    params.ctx.lineWidth = 3
    params.ctx.strokeStyle = shadowColor;
    params.ctx.beginPath();
    params.ctx.arc(params.start.x, params.start.y, len, 0, Math.PI * 2);
    params.ctx.stroke();

    params.ctx.lineWidth = 1
    params.ctx.strokeStyle = mainColor;
    params.ctx.beginPath();
    params.ctx.arc(params.start.x, params.start.y, len, 0, Math.PI * 2);
    params.ctx.stroke();
  }

  //
  // text
  //const mx = (params.start.x + params.current.x) / 2;
  //const my = (params.start.y + params.current.y) / 2;
  const mx = params.current.x;
  const my = params.current.y;
  {
    const ctx = params.ctx

    const text1 = `len: ${len.toFixed(1)}`
    const text2 = `deg: ${normalizeAngle180(-1*angle).toFixed(1)}°  (${(360-angle).toFixed(1)})`

    const x = mx + 8
    const y1 = my - 8
    const y2 = my + 10

    ctx.font = "12px sans-serif"

    const m1 = ctx.measureText(text1)
    const m2 = ctx.measureText(text2)

    const padX = 4
    const padY = 4
    const lineHeight = 22

    const w = Math.max(m1.width, m2.width) + padX * 2
    const top = y1 - lineHeight + 2

    ctx.fillStyle = shadowColor;
    params.ctx.beginPath();
    ctx.fillRect(x - padX, top - padY, w, lineHeight * 2 + padY * 2)

    ctx.fillStyle = mainColor;
    ctx.fillText(text1, x, y1)
    ctx.fillText(text2, x, y2)
  }

  //params.ctx.fillText(`len: ${len.toFixed(1)}`, mx + 8, my - 8);
  //params.ctx.fillText(`deg: ${angle.toFixed(1)}°`, mx + 8, my + 10);
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
  const rad = (state.rotation * Math.PI) / 180
  params.ctx.translate(cx, cy)
  params.ctx.rotate(rad)
  params.ctx.translate(-cx, -cy)

  drawGrid({ canvas: params.canvas, ctx: params.ctx, w, h });
  drawCross({ canvas: params.canvas, ctx: params.ctx, w, h });
  params.ctx.restore()
}

export {
  resizeCanvas,
  draw,
  drawCross,
  drawGrid,
  drawMeasure
}