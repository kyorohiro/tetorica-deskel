
import { state } from "./state";

function hexToRgba(hex: string, alpha: number): string {
  const value = hex.replace("#", "");
  const n = Number.parseInt(value, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function resizeCanvas(params: {canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D}): void {
  console.log("> resizeCanvas", params);
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
  draw({canvas: params.canvas, ctx: params.ctx});
}

function drawGrid(params: {canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, w: number, h: number}): void {
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

function drawCross(params: {canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, w: number, h: number}): void {
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

function draw(params: {canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D}): void {
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

  drawGrid({canvas: params.canvas, ctx: params.ctx, w, h});
  drawCross({canvas: params.canvas, ctx: params.ctx, w, h});
  params.ctx.restore()
}

export {
    resizeCanvas,
    draw,
    drawCross,
    drawGrid
}