import { drawClipRect } from "./deskelClipRect";
import type {
  DeskelToolContext,
  DeskelToolHandler,
} from "./DeskelToolHandler";

export class CaptureHandler implements DeskelToolHandler {
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
      await ctx.captureFromImage(rect);
    } else {
      await ctx.captureFromScreen(rect);
    }
  }

  onPointerCancel(ctx: DeskelToolContext) {
    ctx.setDragging(false);
  }
}