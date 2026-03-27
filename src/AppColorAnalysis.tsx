import {
  useRef,
  forwardRef,
  useImperativeHandle,
  useCallback,
  useEffect,
} from "react";
import { ColorCount } from "./screenshot";

type AppColorAnalysisHandle = {
  redraw: (props?: { colors: ColorCount[] }) => void;
};

const AppColorAnalysis = forwardRef<AppColorAnalysisHandle, {}>(function (_, ref) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const redraw = useCallback((props?: { colors: ColorCount[] }) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    //
  }, []);

  useEffect(()=>{
    if(!canvasRef.current){
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0,0,canvas.width,canvas.height);

    //ctx.fillStyle = "blue"; 
    //ctx.fillRect(0,0,canvas.width,canvas.height);
  }, [canvasRef]);

  useImperativeHandle(
    ref,
    () => ({
      redraw,
    }),
    [redraw]
  );

  return (
    <div style={{
      position: "absolute",
      top: "42px",
      left: "12px",
      zIndex: 8
    }} >
      <canvas key="color-analysis-default" id="color-analysis" ref={canvasRef} />
    </div >
  );
});

export { AppColorAnalysis };
export type { AppColorAnalysisHandle };