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

export {
    drawClipRect
}