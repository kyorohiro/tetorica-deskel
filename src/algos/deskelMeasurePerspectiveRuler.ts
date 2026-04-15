//
// 射影変換のコード
//
type Point = { x: number; y: number };

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * O を原点、U を 1単位点、V を消失点として
 * 線上の P を「実距離単位」に戻す
 */
function decodeVanished1D(
  p: Point,
  origin: Point,
  unit: Point,
  vanishing: Point
): number {
  const ov = dist(origin, vanishing);
  const ou = dist(origin, unit);
  const op = dist(origin, p);

  if (ov <= 1e-9) throw new Error("origin and vanishing are too close");
  if (ou <= 1e-9) throw new Error("origin and unit are too close");
  if (ou >= ov) throw new Error("unit must be between origin and vanishing");
  if (op >= ov) throw new Error("p must be between origin and vanishing");

  const su = ou / ov; // 1単位点の画面パラメータ
  const sp = op / ov; // Pの画面パラメータ

  // s = (k t) / (1 + k t) とみなし、
  // unit が t=1 になるよう k を決める
  const k = su / (1 - su);

  // sp = (k t)/(1 + k t) を t について解く
  const t = sp / (k * (1 - sp));
  return t;
}

//
//
//

//
//
//
type Matrix3x3 = [
  number, number, number,
  number, number, number,
  number, number, number
];

type PlaneDecoder = {
  H: Matrix3x3;    // plane -> screen
  Hinv: Matrix3x3; // screen -> plane
  width: number;
  height: number;
};

type QuadValidationResult = {
  valid: boolean;
  reason?: string;
};

function calcDistance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function add(a: Point, b: Point): Point {
  return { x: a.x + b.x, y: a.y + b.y };
}

function sub(a: Point, b: Point): Point {
  return { x: a.x - b.x, y: a.y - b.y };
}

function mul(v: Point, s: number): Point {
  return { x: v.x * s, y: v.y * s };
}

function dot(a: Point, b: Point): number {
  return a.x * b.x + a.y * b.y;
}

function normalize(v: Point): Point {
  const len = Math.hypot(v.x, v.y);
  if (len <= 1e-9) {
    throw new Error("ベクトル長が 0 です");
  }
  return { x: v.x / len, y: v.y / len };
}

/**
 * ベクトル (p1 -> p2) と (p1 -> p3) の外積
 */
function crossProduct(p1: Point, p2: Point, p3: Point): number {
  const ax = p2.x - p1.x;
  const ay = p2.y - p1.y;
  const bx = p3.x - p1.x;
  const by = p3.y - p1.y;
  return ax * by - ay * bx;
}

function isSamePoint(a: Point, b: Point, eps = 1e-9): boolean {
  return calcDistance(a, b) <= eps;
}

function segmentsIntersect(
  p1: Point,
  p2: Point,
  p3: Point,
  p4: Point,
  eps = 1e-9
): boolean {
  const c1 = crossProduct(p1, p2, p3);
  const c2 = crossProduct(p1, p2, p4);
  const c3 = crossProduct(p3, p4, p1);
  const c4 = crossProduct(p3, p4, p2);

  const s1 = c1 > eps ? 1 : c1 < -eps ? -1 : 0;
  const s2 = c2 > eps ? 1 : c2 < -eps ? -1 : 0;
  const s3 = c3 > eps ? 1 : c3 < -eps ? -1 : 0;
  const s4 = c4 > eps ? 1 : c4 < -eps ? -1 : 0;

  return s1 * s2 < 0 && s3 * s4 < 0;
}

function isConcaveQuadrilateral(
  p1: Point,
  p2: Point,
  p3: Point,
  p4: Point,
  eps = 1e-9
): boolean {
  const points = [p1, p2, p3, p4];
  const cp: number[] = [];

  for (let i = 0; i < 4; i++) {
    const prev = points[(i + 3) % 4];
    const curr = points[i];
    const next = points[(i + 1) % 4];
    cp.push(crossProduct(curr, next, prev));
  }

  const hasPositive = cp.some((v) => v > eps);
  const hasNegative = cp.some((v) => v < -eps);

  return hasPositive && hasNegative;
}

function polygonArea2(points: Point[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - a.y * b.x;
  }
  return sum;
}

function isValidQuad(
  p1: Point,
  p2: Point,
  p3: Point,
  p4: Point,
  eps = 1e-9
): QuadValidationResult {
  const points = [p1, p2, p3, p4];

  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      if (isSamePoint(points[i], points[j], eps)) {
        return {
          valid: false,
          reason: `point ${i} and point ${j} are too close or identical`,
        };
      }
    }
  }

  const area2 = polygonArea2(points);
  if (Math.abs(area2) <= eps) {
    return {
      valid: false,
      reason: "quad area is too small",
    };
  }

  if (segmentsIntersect(p1, p2, p3, p4, eps)) {
    return {
      valid: false,
      reason: "quad is self-intersecting (p1-p2 crosses p3-p4)",
    };
  }

  if (segmentsIntersect(p2, p3, p4, p1, eps)) {
    return {
      valid: false,
      reason: "quad is self-intersecting (p2-p3 crosses p4-p1)",
    };
  }

  if (isConcaveQuadrilateral(p1, p2, p3, p4, eps)) {
    return {
      valid: false,
      reason: "quad is concave",
    };
  }

  return { valid: true };
}

function applyHomography(p: Point, H: Matrix3x3): Point {
  const x = p.x;
  const y = p.y;

  const X = H[0] * x + H[1] * y + H[2];
  const Y = H[3] * x + H[4] * y + H[5];
  const W = H[6] * x + H[7] * y + H[8];

  if (Math.abs(W) < 1e-12) {
    throw new Error("Homography の適用に失敗しました (w ≈ 0)");
  }

  return {
    x: X / W,
    y: Y / W,
  };
}

function invertMatrix3x3(m: Matrix3x3): Matrix3x3 {
  const [
    a, b, c,
    d, e, f,
    g, h, i,
  ] = m;

  const A =  e * i - f * h;
  const B = -(d * i - f * g);
  const C =  d * h - e * g;
  const D = -(b * i - c * h);
  const E =  a * i - c * g;
  const F = -(a * h - b * g);
  const G =  b * f - c * e;
  const H = -(a * f - c * d);
  const I =  a * e - b * d;

  const det = a * A + b * B + c * C;

  if (Math.abs(det) < 1e-12) {
    throw new Error("3x3行列を反転できません (det ≈ 0)");
  }

  const invDet = 1 / det;

  return [
    A * invDet, D * invDet, G * invDet,
    B * invDet, E * invDet, H * invDet,
    C * invDet, F * invDet, I * invDet,
  ];
}

function solveLinearSystem8x8(A: number[][], b: number[]): number[] {
  const n = 8;
  const M = A.map((row, r) => [...row, b[r]]);

  for (let col = 0; col < n; col++) {
    let pivotRow = col;
    let maxAbs = Math.abs(M[col][col]);

    for (let r = col + 1; r < n; r++) {
      const v = Math.abs(M[r][col]);
      if (v > maxAbs) {
        maxAbs = v;
        pivotRow = r;
      }
    }

    if (maxAbs < 1e-12) {
      throw new Error("連立方程式を解けません (pivot ≈ 0)");
    }

    if (pivotRow !== col) {
      [M[col], M[pivotRow]] = [M[pivotRow], M[col]];
    }

    const pivot = M[col][col];
    for (let c = col; c <= n; c++) {
      M[col][c] /= pivot;
    }

    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = M[r][col];
      for (let c = col; c <= n; c++) {
        M[r][c] -= factor * M[col][c];
      }
    }
  }

  return M.map((row) => row[n]);
}

function computeHomographyFrom4Points(
  src: [Point, Point, Point, Point],
  dst: [Point, Point, Point, Point]
): Matrix3x3 {
  const A: number[][] = [];
  const b: number[] = [];

  for (let k = 0; k < 4; k++) {
    const { x: u, y: v } = src[k];
    const { x, y } = dst[k];

    A.push([u, v, 1, 0, 0, 0, -u * x, -v * x]);
    b.push(x);

    A.push([0, 0, 0, u, v, 1, -u * y, -v * y]);
    b.push(y);
  }

  const h = solveLinearSystem8x8(A, b);

  return [
    h[0], h[1], h[2],
    h[3], h[4], h[5],
    h[6], h[7], 1,
  ];
}

function createPlaneDecoderFromQuad(params: {
  quad: [Point, Point, Point, Point];
  width: number;
  height: number;
}): PlaneDecoder {
  const { quad, width, height } = params;

  const valid = isValidQuad(quad[0], quad[1], quad[2], quad[3]);
  if (!valid.valid) {
    throw new Error(valid.reason ?? "invalid quad");
  }

  if (!(width > 0) || !(height > 0)) {
    throw new Error("width, height は 0 より大きい必要があります");
  }

  const planeRect: [Point, Point, Point, Point] = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ];

  const H = computeHomographyFrom4Points(planeRect, quad);
  const Hinv = invertMatrix3x3(H);

  return {
    H,
    Hinv,
    width,
    height,
  };
}

function decodeVanished2D(screenPoint: Point, decoder: PlaneDecoder): Point {
  return applyHomography(screenPoint, decoder.Hinv);
}

function encodePlanePointToScreen(planePoint: Point, decoder: PlaneDecoder): Point {
  return applyHomography(planePoint, decoder.H);
}

function drawCrossTick(
  ctx: CanvasRenderingContext2D,
  point: Point,
  normal: Point,
  length: number
): void {
  const half = length / 2;
  ctx.beginPath();
  ctx.moveTo(
    point.x - normal.x * half,
    point.y - normal.y * half
  );
  ctx.lineTo(
    point.x + normal.x * half,
    point.y + normal.y * half
  );
  ctx.stroke();
}

function drawPerspectiveRuler(params: {
  ctx: CanvasRenderingContext2D;
  baseQuad: [Point, Point, Point, Point];
  start: Point;
  current: Point;
  unitBaseStart: Point;
  unitBaseEnd: Point;
  tickPixelLength?: number;
  quadWidth?: number;
  quadHeight?: number;
  strokeStyle?: string;
  lineWidth?: number;
}): void {
  const {
    ctx,
    baseQuad,
    start,
    current,
    unitBaseStart,
    unitBaseEnd,
    tickPixelLength = 10,
    quadWidth = 1,
    quadHeight = 1,
    strokeStyle = "#00ff88",
    lineWidth = 1,
  } = params;

  const decoder = createPlaneDecoderFromQuad({
    quad: baseQuad,
    width: quadWidth,
    height: quadHeight,
  });

  // 画面 -> 平面
  const startPlane = decodeVanished2D(start, decoder);
  const currentPlane = decodeVanished2D(current, decoder);
  const unitBaseStartPlane = decodeVanished2D(unitBaseStart, decoder);
  const unitBaseEndPlane = decodeVanished2D(unitBaseEnd, decoder);

  // 平面上の1unit長
  const unitLength = calcDistance(unitBaseStartPlane, unitBaseEndPlane);
  if (unitLength <= 1e-9) {
    throw new Error("unitBaseStart と unitBaseEnd が近すぎます");
  }

  // 定規方向
  const rulerVec = sub(currentPlane, startPlane);
  const rulerLen = Math.hypot(rulerVec.x, rulerVec.y);
  if (rulerLen <= 1e-9) {
    return;
  }

  const rulerDir = normalize(rulerVec);

  // 平面上の法線
  const rulerNormalPlane: Point = {
    x: -rulerDir.y,
    y: rulerDir.x,
  };

  // 何本打つか
  const tickCount = Math.floor(rulerLen / unitLength);

  ctx.save();
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = lineWidth;

  // 本線
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(current.x, current.y);
  ctx.stroke();

  // 目盛り
  for (let i = 0; i <= tickCount; i++) {
    const planePoint = add(startPlane, mul(rulerDir, unitLength * i));
    const screenPoint = encodePlanePointToScreen(planePoint, decoder);

    // 法線方向も画面へ写して、画面上の目盛り向きを作る
    const planeNormalTip = add(planePoint, rulerNormalPlane);
    const screenNormalTip = encodePlanePointToScreen(planeNormalTip, decoder);
    const screenNormal = normalize(sub(screenNormalTip, screenPoint));

    drawCrossTick(ctx, screenPoint, screenNormal, tickPixelLength);
  }

  ctx.restore();
}
export {
  decodeVanished1D,
  decodeVanished2D,
  encodePlanePointToScreen,
  createPlaneDecoderFromQuad,
  isConcaveQuadrilateral,
  isValidQuad,
  drawPerspectiveRuler,
  dot,
}

export type {
  Point,
  PlaneDecoder
}



/**
 * TODO
 * 1. 点が重なっていない
 * 隣接点や同一点を弾く
 * 
 * 2. 自己交差していない
 * isValidQuad
 */