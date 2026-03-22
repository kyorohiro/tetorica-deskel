
import { state } from "./state";

let canvas: HTMLCanvasElement| undefined;
let ctx: CanvasRenderingContext2D| undefined | null;

function initCanvas () {
    canvas = document.getElementById("canvas") as HTMLCanvasElement;
    ctx = canvas.getContext("2d");
    if (!ctx) {
    throw new Error("2D context not available");
    }
}

function hexToRgba(hex: string, alpha: number): string {
  const value = hex.replace("#", "");
  const n = Number.parseInt(value, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function resizeCanvas(): void {
  if (!ctx) {
    return;
  }
  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth;
  const h = window.innerHeight;

  canvas!.width = Math.floor(w * dpr);
  canvas!.height = Math.floor(h * dpr);
  canvas!.style.width = `${w}px`;
  canvas!.style.height = `${h}px`;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  draw();
}

function drawGrid(w: number, h: number): void {
  if (!ctx) {
    return;
  }
  ctx.strokeStyle = hexToRgba(state.color, state.opacity);
  ctx.lineWidth = state.lineWidth;

  for (let x = 0; x <= w; x += state.grid) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }

  for (let y = 0; y <= h; y += state.grid) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
}

function drawCross(w: number, h: number): void {
  if (!ctx) {
    return;
  }
  ctx.strokeStyle = hexToRgba(state.color, Math.min(1, state.opacity + 0.15));
  ctx.lineWidth = Math.max(2, state.lineWidth + 1);

  ctx.beginPath();
  ctx.moveTo(w / 2, 0);
  ctx.lineTo(w / 2, h);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(0, h / 2);
  ctx.lineTo(w, h / 2);
  ctx.stroke();
}

function draw(): void {
  if (!ctx) {
    return;
  }
  const w = window.innerWidth;
  const h = window.innerHeight;

  ctx.clearRect(0, 0, w, h);
  drawGrid(w, h);
  drawCross(w, h);
}

export {
    initCanvas,
    resizeCanvas,
    draw,
    drawCross,
    drawGrid
}