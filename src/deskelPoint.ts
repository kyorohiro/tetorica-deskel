import { appState } from "./state";
import { hexToRgbaParams, hslaToRgba, makeShadowColorFromGrid, rgbaToHsla } from "./deskelCommon";

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

export {
    drawPoint
}