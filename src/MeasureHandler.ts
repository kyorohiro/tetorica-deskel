import { ChainMeasure } from "./deskelChainMesure";
import { drawMeasure } from "./deskelMeasure";
import {
  drawClipQuad2,
  findNearestQuadPoint,
} from "./deskelClipRect";
import type {
  AppDeskelPoint,
  DeskelToolContext,
  DeskelToolHandler,
} from "./DeskelToolHandler";

export class MeasureHandler implements DeskelToolHandler {
  private chainMeasure = new ChainMeasure();
  private clipQuad: AppDeskelPoint[] = [
    { x: 200, y: 200 },
    { x: 300, y: 200 },
    { x: 300, y: 300 },
    { x: 200, y: 300 },
  ];
  private clipQuadDraggingPointIndex = -1;
  private draggedCenterQuad?: AppDeskelPoint;

  redraw(ctx: DeskelToolContext) {
    const { canvas, ctx: canvasCtx, state } = ctx;
    const start = ctx.startRef.current;
    const current = ctx.currentRef.current;
    const dragging = ctx.draggingRef.current;

    if (state.measureMode === "line" || state.measureMode === "setUnit") {
      drawMeasure({
        canvas,
        ctx: canvasCtx,
        start,
        current,
        dragging,
        chainLength: this.chainMeasure.getLength(
          current ? { x: current.x, y: current.y } : undefined,
        ),
        measureUnit: state.measureUnit,
      });
    } else if (state.measureMode === "chain") {
      this.chainMeasure.draw(canvasCtx, {
        color: state.color,
        lineWidth: 1,
        currentPoint: current ?? undefined,
      });
    }

    if (state.quadMode !== "off") {
      drawClipQuad2({
        canvas,
        ctx: canvasCtx,
        points: this.clipQuad,
        dragging: true,
      });
    }
  }

  onPointerDown(ctx: DeskelToolContext, e: PointerEvent) {
    const p = ctx.getPoint(e);

    this.chainMeasure.setChainLengthMin(ctx.state.measureUnit);
    ctx.startRef.current = p;
    ctx.currentRef.current = p;
    ctx.setDragging(true);
    this.chainMeasure.update(p);

    const pointSet = findNearestQuadPoint(p, this.clipQuad, 14);
    if (pointSet.type === "center") {
      this.draggedCenterQuad = { ...p };
    }
    this.clipQuadDraggingPointIndex = pointSet.index;
  }

  onPointerMove(ctx: DeskelToolContext, e: PointerEvent) {
    if (!ctx.draggingRef.current || !ctx.startRef.current) return;

    const current = ctx.getPoint(e);
    ctx.currentRef.current = current;
    this.chainMeasure.update(current);

    if (this.clipQuadDraggingPointIndex !== -1) {
      this.clipQuad[this.clipQuadDraggingPointIndex] = { ...current };
    }

    if (this.draggedCenterQuad) {
      const dx = current.x - this.draggedCenterQuad.x;
      const dy = current.y - this.draggedCenterQuad.y;
      for (let i = 0; i < this.clipQuad.length; i++) {
        this.clipQuad[i].x += dx;
        this.clipQuad[i].y += dy;
      }
      this.draggedCenterQuad = { ...current };
    }
  }

  onPointerUp(ctx: DeskelToolContext) {
    ctx.setDragging(false);
    this.chainMeasure.clear();

    if (
      ctx.state.measureMode === "setUnit" &&
      ctx.startRef.current &&
      ctx.currentRef.current
    ) {
      const start = ctx.startRef.current;
      const current = ctx.currentRef.current;
      const dx = current.x - start.x;
      const dy = current.y - start.y;
      const len = Math.sqrt(dx * dx + dy * dy);

      if (len <= 5) {
        ctx.showToast("Must be 5px or more.");
      } else {
        ctx.setMeasureUnit(len / 5, start, current);
      }
    }

    this.clipQuadDraggingPointIndex = -1;
    this.draggedCenterQuad = undefined;
  }

  onPointerCancel(ctx: DeskelToolContext) {
    ctx.setDragging(false);
    this.chainMeasure.clear();
    this.clipQuadDraggingPointIndex = -1;
    this.draggedCenterQuad = undefined;
  }
}