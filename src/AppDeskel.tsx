import {
  useRef,
  forwardRef,
  useImperativeHandle,
  useCallback,
} from "react";
import { draw, resizeCanvas } from "./deskel";

type AppDeskelHandle = {
  redraw: (props?: { isResizeCanvas: boolean }) => void;
};

type Point = { x: number; y: number };

const AppDeslel = forwardRef<AppDeskelHandle, {}>(function (_, ref) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const startRef = useRef<Point | null>(null);
  const currentRef = useRef<Point | null>(null);
  const draggingRef = useRef(false);

  const cleanupRef = useRef<(() => void) | null>(null);

  const redraw = useCallback((props?: { isResizeCanvas: boolean }) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (props?.isResizeCanvas) {
      resizeCanvas({ canvas, ctx });
    }

    draw({ canvas, ctx });

    const start = startRef.current;
    const current = currentRef.current;
    const dragging = draggingRef.current;

    if (!start || !current || !dragging) return;

    const dx = current.x - start.x;
    const dy = current.y - start.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
    const angle = (deg + 360) % 360;

    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(current.x, current.y);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(start.x, start.y, 4, 0, Math.PI * 2);
    ctx.arc(current.x, current.y, 4, 0, Math.PI * 2);
    ctx.fill();

    const mx = (start.x + current.x) / 2;
    const my = (start.y + current.y) / 2;

    ctx.fillText(`len: ${len.toFixed(1)}`, mx + 8, my - 8);
    ctx.fillText(`deg: ${angle.toFixed(1)}°`, mx + 8, my + 10);
  }, []);

  const setCanvasRef = useCallback((canvas: HTMLCanvasElement | null) => {
    // まず前のcanvasの掃除
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }

    canvasRef.current = canvas;

    if (!canvas) {
      return;
    }

    const onMouseDown = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const p = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };

      startRef.current = p;
      currentRef.current = p;
      draggingRef.current = true;
      redraw();
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current || !startRef.current) return;

      const rect = canvas.getBoundingClientRect();
      currentRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
      redraw();
    };

    const onMouseUp = () => {
      draggingRef.current = false;
      redraw();
    };

    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mouseup", onMouseUp);

    redraw({ isResizeCanvas: true });

    cleanupRef.current = () => {
      canvas.removeEventListener("mousedown", onMouseDown);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mouseup", onMouseUp);
    };
  }, [redraw]);

  useImperativeHandle(
    ref,
    () => ({
      redraw,
    }),
    [redraw]
  );

  return (
    <div>
      <canvas key="deskel-default" id="deskel" ref={setCanvasRef} />
    </div>
  );
});

export { AppDeslel };
export type { AppDeskelHandle };