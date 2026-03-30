import {
  useRef,
  forwardRef,
  useImperativeHandle,
  useCallback,
} from "react";
import { draw, drawClipRect, drawMeasure, resizeCanvas } from "./deskel";
import { useAppState } from "./state";

type AppDeskelHandle = {
  redraw: (props?: { isResizeCanvas: boolean }) => void;
  setVisible: (visible: boolean) => void;
  getCanvas: () => HTMLCanvasElement | null;
};

type AppDeskelPoint = { x: number; y: number };

const AppDeslel = forwardRef<AppDeskelHandle, {}>(function (_, ref) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const startRef = useRef<AppDeskelPoint | null>(null);
  const currentRef = useRef<AppDeskelPoint | null>(null);
  const draggingRef = useRef(false);

  const cleanupRef = useRef<(() => void) | null>(null);
  const uAppState = useAppState();

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
    if(uAppState.tool == "measure") {
      drawMeasure({ canvas, ctx, start, current, dragging });
    }
    else if(uAppState.tool == "color") {
      drawClipRect ({ canvas, ctx, start, current, dragging });
    }
  }, [uAppState.tool]);

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
      setVisible: (visible: boolean) => {
        if (!rootRef.current) return;
        rootRef.current.style.display = visible ? "block" : "none";
      },
      getCanvas: () => canvasRef.current,
    }),
    [redraw]
  );

  return (
    <div ref={rootRef}>
      <canvas key="deskel-default" id="deskel" ref={setCanvasRef} />
    </div>
  );
});

export { AppDeslel };
export type { AppDeskelHandle, AppDeskelPoint };