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



///
/// 台形
///
type Point = { x: number; y: number };

/**
 * 8x8 の連立方程式をガウス消去で解く
 */
function solveLinear8(a: number[][], b: number[]): number[] {
  const n = 8;
  const m = a.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(m[row][col]) > Math.abs(m[pivot][col])) {
        pivot = row;
      }
    }

    if (Math.abs(m[pivot][col]) < 1e-10) {
      throw new Error("homography solve failed");
    }

    [m[col], m[pivot]] = [m[pivot], m[col]];

    const div = m[col][col];
    for (let j = col; j <= n; j++) {
      m[col][j] /= div;
    }

    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = m[row][col];
      for (let j = col; j <= n; j++) {
        m[row][j] -= factor * m[col][j];
      }
    }
  }

  return m.map((row) => row[n]);
}

/**
 * unit square [(0,0), (1,0), (1,1), (0,1)] → quad への homography を作る
 *
 * points の順序:
 *   0: A = left-top
 *   1: B = right-top
 *   2: C = right-bottom
 *   3: D = left-bottom
 */
function createSquareToQuadHomography(points: Point[]): number[] {
  const src = [
    { u: 0, v: 0, x: points[0].x, y: points[0].y },
    { u: 1, v: 0, x: points[1].x, y: points[1].y },
    { u: 1, v: 1, x: points[2].x, y: points[2].y },
    { u: 0, v: 1, x: points[3].x, y: points[3].y },
  ];

  // x = (a*u + b*v + c) / (g*u + h*v + 1)
  // y = (d*u + e*v + f) / (g*u + h*v + 1)
  // unknowns = [a,b,c,d,e,f,g,h]
  const A: number[][] = [];
  const B: number[] = [];

  for (const p of src) {
    const { u, v, x, y } = p;

    A.push([u, v, 1, 0, 0, 0, -x * u, -x * v]);
    B.push(x);

    A.push([0, 0, 0, u, v, 1, -y * u, -y * v]);
    B.push(y);
  }

  return solveLinear8(A, B);
}

function projectPoint(h: number[], u: number, v: number): Point {
  const [a, b, c, d, e, f, g, hh] = h;
  const den = g * u + hh * v + 1;
  return {
    x: (a * u + b * v + c) / den,
    y: (d * u + e * v + f) / den,
  };
}

function drawProjectedLine(params: {
  ctx: CanvasRenderingContext2D;
  h: number[];
  from: { u: number; v: number };
  to: { u: number; v: number };
  segments?: number;
}): void {
  const { ctx, h, from, to, segments = 32 } = params;

  const p0 = projectPoint(h, from.u, from.v);
  ctx.beginPath();
  ctx.moveTo(p0.x, p0.y);

  for (let i = 1; i <= segments; i++) {
    const t = i / segments;
    const u = from.u + (to.u - from.u) * t;
    const v = from.v + (to.v - from.v) * t;
    const p = projectPoint(h, u, v);
    ctx.lineTo(p.x, p.y);
  }

  ctx.stroke();
}

function drawClipQuad2(params: {
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

  const shadowColor = `rgba(${shadowRgbaParams.r}, ${shadowRgbaParams.g}, ${shadowRgbaParams.b}, 0.35)`;
  const mainColor = `rgba(${rgbaParams.r}, ${rgbaParams.g}, ${rgbaParams.b}, 0.55)`;
  const fillColor = `rgba(${rgbaParams.r}, ${rgbaParams.g}, ${rgbaParams.b}, 0.04)`;
  const guideColor = `rgba(${rgbaParams.r}, ${rgbaParams.g}, ${rgbaParams.b}, 0.55)`;

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

  // 3. 分割ガイド
  // points:
  //   0=A 左上, 1=B 右上, 2=C 右下, 3=D 左下
  try {
    const h = createSquareToQuadHomography(points);

    ctx.save();
    ctx.strokeStyle = guideColor;
    ctx.lineWidth = 1.5;

    // 欲しい分割
    const fractions = [3/4, 1 / 4, 1 / 2, 1 / 3, 2 / 3, 
      //
      1/8, 3/8, 5/8, 7/8];

    // 横方向の分割線（上辺AB → 下辺DC に向かう）
    for (const v of fractions) {

      //
      ctx.strokeStyle = shadowColor;
      ctx.lineWidth = 1.8;
      ctx.setLineDash([5, 0]);
      drawProjectedLine({
        ctx,
        h,
        from: { u: 0, v },
        to: { u: 1, v },
      });
      //
      ctx.strokeStyle = mainColor;
      //
      if(v== 1/3 || v == 2/3) {
        ctx.lineWidth = 1.2;
        ctx.setLineDash([5, 10]);
      } else if(v ==1/4 || v == 3/4) {
        ctx.lineWidth = 1.5;
        ctx.setLineDash([2, 1]);
      } else if(v == 1/8 || v == 3/8 || v == 5/8 || v == 7/8) {
        ctx.lineWidth = 0.8;
        ctx.setLineDash([2, 1]);
      }
      drawProjectedLine({
        ctx,
        h,
        from: { u: 0, v },
        to: { u: 1, v },
      });
    }

    // 縦方向の分割線（左辺AD → 右辺BC に向かう）
    for (const u of fractions) {

      //
      ctx.strokeStyle = shadowColor;
      ctx.lineWidth = 1.8;
      ctx.setLineDash([5, 0]);
      drawProjectedLine({
        ctx,
        h,
        from: { u, v: 0 },
        to: { u, v: 1 },
      });
      //
      ctx.strokeStyle = mainColor;
      if(u== 1/3 || u == 2/3) {
        ctx.lineWidth = 1.2;
        ctx.setLineDash([5, 10]);
      } else if(u ==1/4 || u == 3/4) {
        ctx.lineWidth = 1.5;
        ctx.setLineDash([2, 1]);
      } else if(u == 1/8 || u == 3/8 || u == 5/8 || u == 7/8) {
        ctx.lineWidth = 0.8;
        ctx.setLineDash([2,1]);
      }

      drawProjectedLine({
        ctx,
        h,
        from: { u, v: 0 },
        to: { u, v: 1 },
      });    
    }
    ctx.setLineDash([5, 0]);

    // 中央強調（1/2 だけ少し太く）
    ctx.strokeStyle = shadowColor;
    ctx.lineWidth = 3.5;

    drawProjectedLine({
      ctx,
      h,
      from: { u: 0, v: 1 / 2 },
      to: { u: 1, v: 1 / 2 },
    });

    drawProjectedLine({
      ctx,
      h,
      from: { u: 1 / 2, v: 0 },
      to: { u: 1 / 2, v: 1 },
    });

    ctx.strokeStyle = mainColor;
    ctx.lineWidth = 2.2;

    drawProjectedLine({
      ctx,
      h,
      from: { u: 0, v: 1 / 2 },
      to: { u: 1, v: 1 / 2 },
    });

    drawProjectedLine({
      ctx,
      h,
      from: { u: 1 / 2, v: 0 },
      to: { u: 1 / 2, v: 1 },
    });
    ctx.restore();
  } catch (e) {
    console.warn("drawClipQuad: guide line generation failed", e);
  }

  // 4. 頂点ハンドル
  for (const p of points) {
    ctx.fillStyle = shadowColor;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = mainColor;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}
export {
  drawClipRect,
  drawPoint,
  drawClipQuad,
  findNearestQuadPointIndex,
  createSquareToQuadHomography,
  projectPoint,
  drawProjectedLine,
  drawClipQuad2
}