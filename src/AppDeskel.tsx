import {
  useRef,
  forwardRef,
  useImperativeHandle,
  useEffect,
  useCallback,
  useState,
} from "react";
import { draw, resizeCanvas } from "./deskel";

type AppDeskelHandle = {
  redraw: (props?: { isResizeCanvas: boolean }) => void;
};

type Point = { x: number; y: number };

const AppDeslel = forwardRef<AppDeskelHandle, {}>(function (_, ref) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [start, setStart] = useState<Point | null>(null);
  const [current, setCurrent] = useState<Point | null>(null);
  const [dragging, setDragging] = useState(false);

  // listener内で最新値を見るためのref
  const startRef = useRef<Point | null>(null);
  const currentRef = useRef<Point | null>(null);
  const draggingRef = useRef(false);

  const redraw = useCallback((props?: { isResizeCanvas: boolean }) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (props?.isResizeCanvas) {
      resizeCanvas({ canvas, ctx });
    }

    draw({ canvas, ctx });

    const s = startRef.current;
    const c = currentRef.current;
    const d = draggingRef.current;

    if (!s || !c || !d) return;

    const dx = c.x - s.x;
    const dy = c.y - s.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
    const angle = (deg + 360) % 360;

    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(c.x, c.y);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(s.x, s.y, 4, 0, Math.PI * 2);
    ctx.arc(c.x, c.y, 4, 0, Math.PI * 2);
    ctx.fill();

    const mx = (s.x + c.x) / 2;
    const my = (s.y + c.y) / 2;

    ctx.fillText(`len: ${len.toFixed(1)}`, mx + 8, my - 8);
    ctx.fillText(`deg: ${angle.toFixed(1)}°`, mx + 8, my + 10);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onMouseDown = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const p = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };

      startRef.current = p;
      currentRef.current = p;
      draggingRef.current = true;

      setStart(p);
      setCurrent(p);
      setDragging(true);

      redraw();
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current || !startRef.current) return;

      const rect = canvas.getBoundingClientRect();
      const p = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };

      currentRef.current = p;
      setCurrent(p);

      redraw();
    };

    const onMouseUp = () => {
      draggingRef.current = false;
      setDragging(false);
      redraw();
    };

    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mouseup", onMouseUp);

    redraw({ isResizeCanvas: true });

    return () => {
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
      <canvas id="deskel" ref={canvasRef} />
    </div>
  );
});

export { AppDeslel };
export type { AppDeskelHandle };