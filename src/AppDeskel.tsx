import { useRef, forwardRef, useImperativeHandle } from "react";
import { draw, resizeCanvas } from "./deskel";

type AppDeskelHandle = {
  redraw: () => void
}
const AppDeslel = forwardRef<AppDeskelHandle, {}>(function (_, ref) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    const redraw = () => {
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext("2d")
        if (!ctx) return

        resizeCanvas({ canvas, ctx })

        draw({canvas, ctx })

        console.log("redraw!")
    }
    useImperativeHandle(ref, () => ({
        redraw,
    }), [])
    return (
        <div>
            <canvas id="deskel" ref={canvasRef} />
        </div>);
});

export {
    AppDeslel
}

export type {
    AppDeskelHandle
}