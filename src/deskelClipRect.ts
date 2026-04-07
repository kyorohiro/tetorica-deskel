import { appState } from "./state";
import { hexToRgbaParams, hslaToRgba, makeShadowColorFromGrid, rgbaToHsla } from "./deskelCommon";

function drawClipRect(params: {
  canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, start?: { x: number, y: number } | null, current?: { x: number, y: number } | null, dragging?: boolean
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


function drawClipQuad(params: {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  points: { x: number; y: number }[];
  dragging?: boolean;
}): void {
  const { ctx, points, dragging } = params;

  if (!ctx || !dragging || points.length < 4) {
    return;
  }

  const rgbaParams = hexToRgbaParams(appState.getState().color, 0.8);
  const hslaParams = rgbaToHsla(rgbaParams);
  const shadowHslaParams = makeShadowColorFromGrid(
    hslaParams.h,
    hslaParams.s,
    hslaParams.l,
    hslaParams.a
  );
  const shadowRgbaParams = hslaToRgba(shadowHslaParams);

  const shadowColor = `rgba(${shadowRgbaParams.r}, ${shadowRgbaParams.g}, ${shadowRgbaParams.b}, ${shadowRgbaParams.a})`;
  const mainColor = `rgba(${rgbaParams.r}, ${rgbaParams.g}, ${rgbaParams.b}, ${rgbaParams.a})`;
  const fillColor = `rgba(${rgbaParams.r}, ${rgbaParams.g}, ${rgbaParams.b}, 0.12)`;

  const traceQuad = () => {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.closePath();
  };

  // 面を薄く塗る
  ctx.fillStyle = fillColor;
  traceQuad();
  ctx.fill();

  // 1. シャドウ枠
  ctx.lineWidth = 3;
  ctx.strokeStyle = shadowColor;
  traceQuad();
  ctx.stroke();

  // 2. メイン枠
  ctx.lineWidth = 1;
  ctx.strokeStyle = mainColor;
  traceQuad();
  ctx.stroke();

  // 3. 頂点ハンドル
  for (const p of points) {
    // shadow
    ctx.fillStyle = shadowColor;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
    ctx.fill();

    // main
    ctx.fillStyle = mainColor;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}


function drawPoint(params: {
  canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, current?: { x: number, y: number } | null
}): void {
  if (!params.ctx) {
    return;
  }


  if (!params.current) return;
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


  params.ctx.lineWidth = 3
  params.ctx.strokeStyle = shadowColor;
  params.ctx.beginPath();
  params.ctx.arc(params.current.x, params.current.y, 8, 0, Math.PI * 2, false);
  params.ctx.stroke();
  //
  params.ctx.fillStyle = shadowColor;
  params.ctx.beginPath();
  params.ctx.arc(params.current.x, params.current.y, 8, 0, Math.PI * 2, false);
  params.ctx.fill();

  params.ctx.lineWidth = 1
  params.ctx.strokeStyle = mainColor;
  params.ctx.beginPath();
  params.ctx.arc(params.current.x, params.current.y, 6, 0, Math.PI * 2, false);
  params.ctx.stroke();
  //
  params.ctx.fillStyle = mainColor;
  params.ctx.beginPath();
  params.ctx.arc(params.current.x, params.current.y, 6, 0, Math.PI * 2, false);
  params.ctx.fill();

}

function calcDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function findNearestQuadPointIndex(
  p: { x: number; y: number },
  points: { x: number; y: number }[],
  threshold = 12
): number {
  let minIndex = -1;
  let minDist = Infinity;

  for (let i = 0; i < points.length; i++) {
    const d = calcDistance(p, points[i]);
    if (d < minDist) {
      minDist = d;
      minIndex = i;
    }
  }

  return minDist <= threshold ? minIndex : -1;
}
export {
  drawClipRect,
  drawPoint,
  drawClipQuad,
  findNearestQuadPointIndex,
}