import type { MutableRefObject } from "react";
import { ToolMode } from "./state";

export type AppDeskelPoint = { x: number; y: number };

export type MeasureMode =
  | "line"
  | "chain"
  | "setUnit"
  | "setVanishingPoint";

export type QuadMode = "off" | "view" | "apply";

export type ToolTarget = "image" | "screen";

export type SelectionRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type DeskelStateSnapshot = {
  tool: ToolMode;
  target: ToolTarget;
  color: string;
  measureUnit: number;
  measureMode: MeasureMode;
  quadMode: QuadMode;
};

export type DeskelToolContext = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  state: DeskelStateSnapshot;

  startRef: MutableRefObject<AppDeskelPoint | null>;
  currentRef: MutableRefObject<AppDeskelPoint | null>;
  draggingRef: MutableRefObject<boolean>;

  setDragging: (value: boolean) => void;
  getPoint: (e: PointerEvent) => AppDeskelPoint;
  getSelectionRect: () => SelectionRect | null;
  requestRedraw: (props?: { isResizeCanvas: boolean }) => void;

  setMeasureUnit: (
    pixelsPerUnit: number,
    start: AppDeskelPoint,
    end: AppDeskelPoint,
  ) => void;

  captureFromImage: (rect: SelectionRect) => Promise<void>;
  captureFromScreen: (rect: SelectionRect) => Promise<void>;
  analyzeFromImage: (rect: SelectionRect) => Promise<void>;
  analyzeFromScreen: (rect: SelectionRect) => Promise<void>;

  showToast: (message: string) => void;
};

export interface DeskelToolHandler {
  redraw(ctx: DeskelToolContext): void;
  onPointerDown(ctx: DeskelToolContext, e: PointerEvent): void;
  onPointerMove(ctx: DeskelToolContext, e: PointerEvent): void;
  onPointerUp(ctx: DeskelToolContext, e: PointerEvent): Promise<void> | void;
  onPointerCancel(ctx: DeskelToolContext, e: PointerEvent): Promise<void> | void;
}