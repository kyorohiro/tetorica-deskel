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
  setVisible: (visible: boolean) => void;
  getCanvas: () => HTMLCanvasElement | null;
};

const AppColorAnalysis = forwardRef<AppColorAnalysisHandle, {}>(function (_, ref) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const redraw = useCallback((props?: { colors: ColorCount[] }) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const colors = props?.colors ?? [];

    const width = 220;
    const height = 220;
    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = 80;

    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height);

    // 背景
    ctx.fillStyle = "rgba(20,20,20,0.35)";
    ctx.fillRect(0, 0, width, height);

    // ガイド円
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 1;

    for (const ratio of [0.25, 0.5, 0.75, 1.0]) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, maxRadius * ratio, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 十字ガイド
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - maxRadius);
    ctx.lineTo(centerX, centerY + maxRadius);
    ctx.moveTo(centerX - maxRadius, centerY);
    ctx.lineTo(centerX + maxRadius, centerY);
    ctx.stroke();

    // 外周リング
    ctx.strokeStyle = "rgba(255,255,255,0.28)";
    ctx.beginPath();
    ctx.arc(centerX, centerY, maxRadius, 0, Math.PI * 2);
    ctx.stroke();

    // heatmap
    for (const color of colors) {
      const angleDeg = color.hue_angle - 90;
      const angleRad = (angleDeg * Math.PI) / 180;

      const radius = Math.max(0, Math.min(1, color.hsv_saturation)) * maxRadius;
      const x = centerX + Math.cos(angleRad) * radius;
      const y = centerY + Math.sin(angleRad) * radius;

      const heatRadius = Math.max(10, Math.min(40, 10 + color.ratio * 200));
      const alpha = Math.max(0.08, Math.min(0.35, color.ratio * 3.0));

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(x, y, heatRadius, 0, Math.PI * 2);
      ctx.fillStyle = color.hex;
      ctx.fill();
      ctx.restore();
    }
    // 色点を描く
    for (const color of colors) {
      const angleDeg = color.hue_angle - 90; // 0°を上にしたい
      const angleRad = (angleDeg * Math.PI) / 180;

      const radius = Math.max(0, Math.min(1, color.hsv_saturation)) * maxRadius;

      const x = centerX + Math.cos(angleRad) * radius;
      const y = centerY + Math.sin(angleRad) * radius;

      // ratio で点サイズ調整
      const dotRadius = Math.max(4, Math.min(18, 4 + color.ratio * 80));

      ctx.beginPath();
      ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
      ctx.fillStyle = color.hex;
      ctx.fill();

      // 白っぽい色や黒っぽい色でも見えるように枠線
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(255,255,255,0.65)";
      ctx.stroke();
    }

    // 中心点
    ctx.beginPath();
    ctx.arc(centerX, centerY, 2, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.fill();
  }, []);

  useEffect(() => {
    if (!rootRef.current) return;
    rootRef.current.style.display = "none";
    redraw({ colors: [] });
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
    <div
      ref={rootRef}
      style={{
        position: "absolute",
        top: "42px",
        left: "12px",
        zIndex: 8,
        pointerEvents: "none",
      }}
    >
      <canvas id="color-analysis" ref={canvasRef} />
    </div>
  );
});

export { AppColorAnalysis };
export type { AppColorAnalysisHandle };