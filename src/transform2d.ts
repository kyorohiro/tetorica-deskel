export type Point = {
  x: number;
  y: number;
};

// 3x3 affine matrix
// column-vector 前提:
// [ m00 m01 m02 ]
// [ m10 m11 m12 ]
// [ m20 m21 m22 ]
export type Mat3 = [
  number, number, number,
  number, number, number,
  number, number, number
];

export type TransformOp =
  | { kind: "translate"; dx: number; dy: number }
  | { kind: "rotate"; cx: number; cy: number; deg: number }
  | { kind: "scale"; cx: number; cy: number; sx: number; sy: number }
  | { kind: "matrix"; value: Mat3 };

export type TransformModel = {
  committed: TransformOp[];
  preview: TransformOp | null;
};

export function identityMat3(): Mat3 {
  return [
    1, 0, 0,
    0, 1, 0,
    0, 0, 1,
  ];
}

export function multiplyMat3(a: Mat3, b: Mat3): Mat3 {
  return [
    a[0] * b[0] + a[1] * b[3] + a[2] * b[6],
    a[0] * b[1] + a[1] * b[4] + a[2] * b[7],
    a[0] * b[2] + a[1] * b[5] + a[2] * b[8],

    a[3] * b[0] + a[4] * b[3] + a[5] * b[6],
    a[3] * b[1] + a[4] * b[4] + a[5] * b[7],
    a[3] * b[2] + a[4] * b[5] + a[5] * b[8],

    a[6] * b[0] + a[7] * b[3] + a[8] * b[6],
    a[6] * b[1] + a[7] * b[4] + a[8] * b[7],
    a[6] * b[2] + a[7] * b[5] + a[8] * b[8],
  ];
}

export function translateMat3(dx: number, dy: number): Mat3 {
  return [
    1, 0, dx,
    0, 1, dy,
    0, 0, 1,
  ];
}

export function rotateMat3(deg: number): Mat3 {
  const rad = (deg * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);

  return [
    c, -s, 0,
    s,  c, 0,
    0,  0, 1,
  ];
}

export function scaleMat3(sx: number, sy: number): Mat3 {
  return [
    sx, 0,  0,
    0,  sy, 0,
    0,  0,  1,
  ];
}

export function pivotRotateMat3(cx: number, cy: number, deg: number): Mat3 {
  return multiplyMat3(
    translateMat3(cx, cy),
    multiplyMat3(
      rotateMat3(deg),
      translateMat3(-cx, -cy)
    )
  );
}

export function pivotScaleMat3(
  cx: number,
  cy: number,
  sx: number,
  sy: number
): Mat3 {
  return multiplyMat3(
    translateMat3(cx, cy),
    multiplyMat3(
      scaleMat3(sx, sy),
      translateMat3(-cx, -cy)
    )
  );
}

export function opToMatrix(op: TransformOp): Mat3 {
  switch (op.kind) {
    case "translate":
      return translateMat3(op.dx, op.dy);

    case "rotate":
      return pivotRotateMat3(op.cx, op.cy, op.deg);

    case "scale":
      return pivotScaleMat3(op.cx, op.cy, op.sx, op.sy);

    case "matrix":
      return op.value;
  }
}

// ops は配列順に適用される
export function composeOps(ops: TransformOp[]): Mat3 {
  let result = identityMat3();

  for (const op of ops) {
    const m = opToMatrix(op);
    result = multiplyMat3(m, result);
  }

  return result;
}

export function getModelOps(model: TransformModel): TransformOp[] {
  return model.preview
    ? [...model.committed, model.preview]
    : model.committed;
}

export function getModelMatrix(model: TransformModel): Mat3 {
  return composeOps(getModelOps(model));
}

export function flattenCommitted(model: TransformModel): TransformModel {
  return {
    committed: [
      {
        kind: "matrix",
        value: composeOps(model.committed),
      },
    ],
    preview: model.preview,
  };
}

export function applyMat3ToPoint(m: Mat3, p: Point): Point {
  return {
    x: m[0] * p.x + m[1] * p.y + m[2],
    y: m[3] * p.x + m[4] * p.y + m[5],
  };
}

// CanvasRenderingContext2D#setTransform 用
// [a c e]
// [b d f]
// [0 0 1]
export function mat3ToCanvasTransform(m: Mat3) {
  return {
    a: m[0],
    b: m[3],
    c: m[1],
    d: m[4],
    e: m[2],
    f: m[5],
  };
}

export function cloneModel(model?: Partial<TransformModel>): TransformModel {
  return {
    committed: model?.committed ? [...model.committed] : [],
    preview: model?.preview ?? null,
  };
}

export interface TransformSession {
  move(current: Point): TransformOp | null;
  end(current: Point): TransformOp | null;
  cancel(): void;
}

export interface TransformInput {
  begin(args: {
    start: Point;
    pivot: Point;
    model: TransformModel;
  }): TransformSession;
}

export function createMoveInput(): TransformInput {
  return {
    begin({ start }) {
      return {
        move(current) {
          return {
            kind: "translate",
            dx: current.x - start.x,
            dy: current.y - start.y,
          };
        },
        end(current) {
          return {
            kind: "translate",
            dx: current.x - start.x,
            dy: current.y - start.y,
          };
        },
        cancel() {},
      };
    },
  };
}

export function createRotateInput(): TransformInput {
  return {
    begin({ start, pivot }) {
      const startAngle = Math.atan2(start.y - pivot.y, start.x - pivot.x);

      return {
        move(current) {
          const currentAngle = Math.atan2(
            current.y - pivot.y,
            current.x - pivot.x
          );
          const deltaRad = normalizeAngle(currentAngle - startAngle);
          const deg = (deltaRad * 180) / Math.PI;

          return {
            kind: "rotate",
            cx: pivot.x,
            cy: pivot.y,
            deg,
          };
        },
        end(current) {
          const currentAngle = Math.atan2(
            current.y - pivot.y,
            current.x - pivot.x
          );
          const deltaRad = normalizeAngle(currentAngle - startAngle);
          const deg = (deltaRad * 180) / Math.PI;

          return {
            kind: "rotate",
            cx: pivot.x,
            cy: pivot.y,
            deg,
          };
        },
        cancel() {},
      };
    },
  };
}

export function createScaleInput(options?: {
  speed?: number;
  minScale?: number;
  maxScale?: number;
}): TransformInput {
  const speed = options?.speed ?? 0.01;
  const minScale = options?.minScale ?? 0.2;
  const maxScale = options?.maxScale ?? 5;

  return {
    begin({ start, pivot }) {
      return {
        move(current) {
          const dy = current.y - start.y;
          const s = clamp(Math.exp(-dy * speed), minScale, maxScale);

          return {
            kind: "scale",
            cx: pivot.x,
            cy: pivot.y,
            sx: s,
            sy: s,
          };
        },
        end(current) {
          const dy = current.y - start.y;
          const s = clamp(Math.exp(-dy * speed), minScale, maxScale);

          return {
            kind: "scale",
            cx: pivot.x,
            cy: pivot.y,
            sx: s,
            sy: s,
          };
        },
        cancel() {},
      };
    },
  };
}

export function commitPreview(model: TransformModel): TransformModel {
  if (!model.preview) {
    return model;
  }

  return {
    committed: [...model.committed, model.preview],
    preview: null,
  };
}

export function clearPreview(model: TransformModel): TransformModel {
  return {
    committed: [...model.committed],
    preview: null,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeAngle(rad: number) {
  while (rad > Math.PI) rad -= Math.PI * 2;
  while (rad < -Math.PI) rad += Math.PI * 2;
  return rad;
}

/*
import {
  TransformModel,
  TransformInput,
  createMoveInput,
  createRotateInput,
  createScaleInput,
  commitPreview,
  clearPreview,
  getModelMatrix,
  mat3ToCanvasTransform,
} from "./transform2d";

let model: TransformModel = {
  committed: [],
  preview: null,
};

let session: ReturnType<TransformInput["begin"]> | null = null;

const moveInput = createMoveInput();
const rotateInput = createRotateInput();
const scaleInput = createScaleInput();

function beginMove(startX: number, startY: number) {
  session = moveInput.begin({
    start: { x: startX, y: startY },
    pivot: { x: 0, y: 0 },
    model,
  });
}

function beginRotate(startX: number, startY: number, pivotX: number, pivotY: number) {
  session = rotateInput.begin({
    start: { x: startX, y: startY },
    pivot: { x: pivotX, y: pivotY },
    model,
  });
}

function beginScale(startX: number, startY: number, pivotX: number, pivotY: number) {
  session = scaleInput.begin({
    start: { x: startX, y: startY },
    pivot: { x: pivotX, y: pivotY },
    model,
  });
}

function movePointer(x: number, y: number) {
  if (!session) return;
  model = {
    ...model,
    preview: session.move({ x, y }),
  };
}

function endPointer(x: number, y: number) {
  if (!session) return;
  model = {
    ...model,
    preview: session.end({ x, y }),
  };
  model = commitPreview(model);
  session = null;
}

function cancelPointer() {
  session?.cancel();
  model = clearPreview(model);
  session = null;
}
*/

/*
const m = getModelMatrix(model);
const t = mat3ToCanvasTransform(m);

ctx.setTransform(t.a, t.b, t.c, t.d, t.e, t.f);
ctx.drawImage(image, 0, 0);
*/