import {
  useRef,
  forwardRef,
  useImperativeHandle,
  useCallback,
  useEffect,
  useState,
} from "react";
import { draw, drawClipRect, drawMeasure, resizeCanvas } from "./deskel";
import { useAppState } from "./state";
import { captureAndCropToAnalysis, captureAndCropToDownloads, ColorCount } from "./screenshot";
import { showToast } from "./toast";
import { ChainMeasure, ChainPoint } from "./chainMesure";

type AppDeskelHandle = {
  redraw: (props?: { isResizeCanvas: boolean }) => void;
  setVisible: (visible: boolean) => void;
  getCanvas: () => HTMLCanvasElement | null;
};

type AppDeskelPoint = { x: number; y: number };

type AppDeskelRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

//
// CSS座標で持つ
function getRectFromPoints(params: {
  start: AppDeskelPoint;
  current: AppDeskelPoint;
}): AppDeskelRect {
  const x = Math.min(params.start.x, params.current.x);
  const y = Math.min(params.start.y, params.current.y);
  const width = Math.abs(params.current.x - params.start.x);
  const height = Math.abs(params.current.y - params.start.y);

  return { x, y, width, height };
}

//function getRectFromPoints(params: {
//  start: AppDeskelPoint;
//  current: AppDeskelPoint;
//  canvas: HTMLCanvasElement;
//}): AppDeskelRect {
//  const rect = params.canvas.getBoundingClientRect();
//  const scaleX = params.canvas.width / rect.width;
//  const scaleY = params.canvas.height / rect.height;
//
//  const left = Math.min(params.start.x, params.current.x);
//  const top = Math.min(params.start.y, params.current.y);
//  const right = Math.max(params.start.x, params.current.x);
//  const bottom = Math.max(params.start.y, params.current.y);
//
//  return {
//    x: left * scaleX,
//    y: top * scaleY,
//    width: (right - left) * scaleX,
//    height: (bottom - top) * scaleY,
//  };
//}

const AppDeslel = forwardRef<AppDeskelHandle, { onColorAnalysis?: (colors: ColorCount[], colors01: ColorCount[]) => Promise<void> }>(function (props, ref) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const startRef = useRef<AppDeskelPoint | null>(null);
  const currentRef = useRef<AppDeskelPoint | null>(null);
  const draggingRef = useRef(false);
  const [dragging, setDragging] = useState(false);
  const chainMesureRef = useRef<ChainMeasure>(new ChainMeasure());

  function setDraggingValue(value: boolean) {
    if (draggingRef.current === value) return;

    draggingRef.current = value;
    setDragging(value);
  }

  const cleanupRef = useRef<(() => void) | null>(null);
  const uAppState = useAppState();

  //
  async function onPointerUp() {
    //updateDragging(false);

    if (!startRef.current || !currentRef.current) return;

    //const x = Math.min(startRef.current.x, currentRef.current.x);
    //const y = Math.min(startRef.current.y, currentRef.current.y);
    const width = Math.abs(startRef.current.x - currentRef.current.x);
    const height = Math.abs(startRef.current.y - currentRef.current.y);

    if (!canvasRef.current || width < 8 || height < 8) return;

    // color check
    const selectedRect = getRectFromPoints({
      //canvas: canvasRef.current!,
      start: startRef.current,
      current: currentRef.current,
    });
    if (uAppState.tool == "capture") {
      const ret = await captureAndCropToDownloads({ path: undefined, targetRect: selectedRect })
      showToast(ret);
    }
    if (uAppState.tool == "color") {
      const ret = await captureAndCropToAnalysis({ targetRect: selectedRect })
      if (props.onColorAnalysis) {
        props.onColorAnalysis(ret.colors, ret.colors01);
      }
    }
    //const ret = await captureAndCropToAnalysis({
    //  targetRect: selectedRect
    //})
    // まずは動作確認
    //console.log(ret);    
  }
  useEffect(() => {
    if (dragging) return;
    onPointerUp();
  }, [dragging]);

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
    if (uAppState.tool == "measure") {
      drawMeasure({ canvas, ctx, start, current, dragging });

      // redraw時
      chainMesureRef.current.draw(ctx, {
        color: uAppState.color,
        lineWidth: 1,
        showPoints: true,
        showLength: true,
      });
    }
    else if (uAppState.tool == "color" || uAppState.tool == "capture") {
      drawClipRect({ canvas, ctx, start, current, dragging });
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
      //draggingRef.current = true;
      setDraggingValue(true);
      chainMesureRef.current.update({x:startRef.current.x, y: startRef.current.y});
      redraw();
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current || !startRef.current) return;

      const rect = canvas.getBoundingClientRect();
      currentRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
      //
      // pointermove とかで
      chainMesureRef.current.update({ x: currentRef.current.x, y: currentRef.current.y });

      redraw();
    };

    const onMouseUp = () => {
      //draggingRef.current = false;
      setDraggingValue(false);
      chainMesureRef.current.clear()
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