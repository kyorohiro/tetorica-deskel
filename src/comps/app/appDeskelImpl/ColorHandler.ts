import { drawClipRect } from "../../../algos/deskelClipRect";
import type {
  DeskelToolContext,
  DeskelToolHandler,
} from "./DeskelToolHandler";

export class ColorHandler implements DeskelToolHandler {
  redraw(ctx: DeskelToolContext) {
    drawClipRect({
      canvas: ctx.canvas,
      ctx: ctx.ctx,
      start: ctx.startRef.current,
      current: ctx.currentRef.current,
      dragging: ctx.draggingRef.current,
    });
  }

  onPointerDown(ctx: DeskelToolContext, e: PointerEvent) {
    const p = ctx.getPoint(e);
    ctx.startRef.current = p;
    ctx.currentRef.current = p;
    ctx.setDragging(true);
  }

  onPointerMove(ctx: DeskelToolContext, e: PointerEvent) {
    if (!ctx.draggingRef.current || !ctx.startRef.current) return;
    ctx.currentRef.current = ctx.getPoint(e);
  }

  async onPointerUp(ctx: DeskelToolContext) {
    ctx.setDragging(false);

    const rect = ctx.getSelectionRect();
    if (!rect) return;

    if (ctx.state.target === "image") {
      await ctx.analyzeFromImage(rect);
    } else {
      await ctx.analyzeFromScreen(rect);
    }
  }

  onPointerCancel(ctx: DeskelToolContext) {
    ctx.setDragging(false);
  }
}
