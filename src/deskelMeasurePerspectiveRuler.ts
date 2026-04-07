type Point = {
  x: number;
  y: number;
};

type Tick = {
  index: number;
  point: Point;
  tickStart: Point;
  tickEnd: Point;
};

function sub(a: Point, b: Point): Point {
  return { x: a.x - b.x, y: a.y - b.y };
}

function add(a: Point, b: Point): Point {
  return { x: a.x + b.x, y: a.y + b.y };
}

function mul(v: Point, s: number): Point {
  return { x: v.x * s, y: v.y * s };
}

function dot(a: Point, b: Point): number {
  return a.x * b.x + a.y * b.y;
}

function calcDistance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function normalize(vx: number, vy: number): Point {
  const len = Math.hypot(vx, vy);
  if (len <= 1e-6) {
    throw new Error("ベクトル長が 0 です");
  }
  return { x: vx / len, y: vy / len };
}

/**
 * p を origin から dir 方向の直線へ射影した点を返す
 * dir は正規化済みを想定
 */
function projectPointToRay(origin: Point, dir: Point, p: Point): Point {
  const op = sub(p, origin);
  const t = dot(op, dir);
  return add(origin, mul(dir, t));
}

/**
 * origin -> vanishingPoint の直線上で、
 * n 個目の等間隔点の透視投影位置を返す
 *
 * unitS:
 *   1単位が origin->vanishingPoint 全体に対して占める比率
 */
function calcPerspectivePoint(
  origin: Point,
  vanishingPoint: Point,
  unitS: number,
  index: number
): Point {
  if (index === 0) return origin;

  const lambda = (index * unitS) / (1 + (index - 1) * unitS);

  return {
    x: origin.x + (vanishingPoint.x - origin.x) * lambda,
    y: origin.y + (vanishingPoint.y - origin.y) * lambda,
  };
}

/**
 * 基準長 unitBaseStart -> unitBaseEnd を unitBaseDivisions 分割した 1単位を使い、
 * start から current まで隙間なく目盛りを生成する
 *
 * 目盛りは start -> vanishingPoint 方向へ並ぶ
 * current はその方向へ射影して終端として使う
 */
function createPerspectiveRulerTicksByUnitBaseRange(
  vanishingPoint: Point,
  unitBaseStart: Point,
  unitBaseEnd: Point,
  start: Point,
  current: Point,
  unitBaseDivisions: number,
  tickPixelLength = 10
): Tick[] {
  if (unitBaseDivisions <= 0 || !Number.isFinite(unitBaseDivisions)) {
    throw new Error("unitBaseDivisions は 1 以上の数である必要があります");
  }

  const dir = normalize(
    vanishingPoint.x - start.x,
    vanishingPoint.y - start.y
  );
  const normal = { x: -dir.y, y: dir.x };

  // 基準長を消失点方向へ射影
  const baseDir = normalize(
    vanishingPoint.x - unitBaseStart.x,
    vanishingPoint.y - unitBaseStart.y
  );

  const baseEndProjected = projectPointToRay(unitBaseStart, baseDir, unitBaseEnd);

  const svBase = calcDistance(unitBaseStart, vanishingPoint);
  const scBase = calcDistance(unitBaseStart, baseEndProjected);

  if (svBase <= 1e-6) {
    throw new Error("unitBaseStart と vanishingPoint が同じです");
  }

  if (scBase <= 1e-6) {
    throw new Error("unitBaseStart と unitBaseEnd が近すぎます");
  }

  if (scBase >= svBase) {
    throw new Error("unitBaseEnd は unitBaseStart と vanishingPoint の間にある必要があります");
  }

  // 基準長全体の比率
  const baseS = scBase / svBase;

  // 1単位ぶんの比率
  const unitS = baseS / unitBaseDivisions;

  if (unitS <= 1e-9) {
    throw new Error("unitS が小さすぎます");
  }

  // current も start->vanishingPoint 方向へ射影
  const currentProjected = projectPointToRay(start, dir, current);

  const startToCurrent = dot(sub(currentProjected, start), dir);
  const startToVanishing = dot(sub(vanishingPoint, start), dir);

  if (startToVanishing <= 1e-6) {
    throw new Error("start と vanishingPoint が同じです");
  }

  if (startToCurrent <= 1e-6) {
    return [
      {
        index: 0,
        point: start,
        tickStart: {
          x: start.x - normal.x * (tickPixelLength / 2),
          y: start.y - normal.y * (tickPixelLength / 2),
        },
        tickEnd: {
          x: start.x + normal.x * (tickPixelLength / 2),
          y: start.y + normal.y * (tickPixelLength / 2),
        },
      },
    ];
  }

  // current が start と vanishingPoint の間にある前提
  if (startToCurrent >= startToVanishing) {
    throw new Error("current は start と vanishingPoint の間にある必要があります");
  }

  const out: Tick[] = [];
  let index = 0;

  while (true) {
    const p = calcPerspectivePoint(start, vanishingPoint, unitS, index);

    const dist = dot(sub(p, start), dir);

    if (dist > startToCurrent + 1e-6) {
      break;
    }

    const half = tickPixelLength / 2;

    out.push({
      index,
      point: p,
      tickStart: {
        x: p.x - normal.x * half,
        y: p.y - normal.y * half,
      },
      tickEnd: {
        x: p.x + normal.x * half,
        y: p.y + normal.y * half,
      },
    });

    index += 1;

    if (index > 10000) {
      throw new Error("目盛り数が多すぎます");
    }
  }

  return out;
}

function drawPerspectiveRulerByUnitBaseRange(
  ctx: CanvasRenderingContext2D,
  vanishingPoint: Point,
  unitBaseStart: Point,
  unitBaseEnd: Point,
  start: Point,
  current: Point,
  unitBaseDivisions: number,
  tickPixelLength = 10
) {
  const ticks = createPerspectiveRulerTicksByUnitBaseRange(
    vanishingPoint,
    unitBaseStart,
    unitBaseEnd,
    start,
    current,
    unitBaseDivisions,
    tickPixelLength
  );

  const dir = normalize(
    vanishingPoint.x - start.x,
    vanishingPoint.y - start.y
  );
  const currentProjected = projectPointToRay(start, dir, current);

  ctx.save();
  ctx.strokeStyle = "#00ff88";
  ctx.lineWidth = 1;

  // 定規の本線は start -> current まで
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(currentProjected.x, currentProjected.y);
  ctx.stroke();

  for (const tick of ticks) {
    ctx.beginPath();
    ctx.moveTo(tick.tickStart.x, tick.tickStart.y);
    ctx.lineTo(tick.tickEnd.x, tick.tickEnd.y);
    ctx.stroke();
  }

  ctx.restore();
}

export {
  createPerspectiveRulerTicksByUnitBaseRange,
  drawPerspectiveRulerByUnitBaseRange,
};

export type { Point, Tick };