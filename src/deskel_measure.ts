
import { AppDeskelPoint } from "./AppDeskel";
import { hexToRgbaParams, hslaToRgba, makeShadowColorFromGrid, rgbaToHsla } from "./deskel";
import { appState } from "./state";


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
    let lineWidth = 2;
    // 5本ごとに長く、10本ごとにさらに長く
    if (i % 10 === 0) {
      tickHalf = 10
      lineWidth = 8
    } else if (i % 5 === 0) {
      tickHalf = 7
      lineWidth = 6;
    }

    const px = start.x + ux * d
    const py = start.y + uy * d

    const x1 = px - nx * tickHalf
    const y1 = py - ny * tickHalf
    const x2 = px + nx * tickHalf
    const y2 = py + ny * tickHalf

    // shadow
    ctx.beginPath()
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = shadowColor
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()

    // main
    ctx.beginPath()
    ctx.lineWidth = lineWidth / 2;
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
  canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, start?: AppDeskelPoint | null, current?: AppDeskelPoint | null, dragging?: boolean,
  chainLength?:number,
  measureUnit?: number
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
    step: params.measureUnit ? params.measureUnit : 20,
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

    const text1 = `len: ${len.toFixed(1)}`;// (${params.chainLength ? params.chainLength.toFixed(1):""})`
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


export {
  drawMeasure,
}