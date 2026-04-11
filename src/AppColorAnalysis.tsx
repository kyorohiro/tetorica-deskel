import {
  useRef,
  forwardRef,
  useImperativeHandle,
  useCallback,
  useEffect,
  useState,
} from "react";
import { ColorCount } from "./nativeScreenshot";
import { useAppState } from "./state";
import { Download, BrushCleaning } from "lucide-react";
import { useDialog } from "./useDialog";
import { handleExport } from "./colorPalette";

type AppColorAnalysisMode = "hue-saturation" | "hue-lightness";

type RedrawParams = {
  colors: ColorCount[];
  colors01: ColorCount[];
  colorAnalysisMode: AppColorAnalysisMode;
};

type AppColorAnalysisHandle = {
  redraw: (props?: { colors: ColorCount[]; colors01: ColorCount[] }) => void;
  setVisible: (visible: boolean) => void;
  getCanvas: () => HTMLCanvasElement | null;
};

const CHART_SIZE = 320;
const OPTION_SIZE = 22 * 6 + 10;
const OPTION_OFFSET_X = OPTION_SIZE / 2;
const OPTION_OFFSET_Y = OPTION_SIZE / 2;
const MAX_RADIUS = 145;

const toolbarButtonBase =
  "flex items-center gap-2 rounded-2xl border px-2 py-2 m-0.5 text-xs transition-colors outline-none";

function toolbarButtonClass(active = false) {
  return `${toolbarButtonBase} ${
    active
      ? "border-emerald-500 bg-emerald-950 text-emerald-300"
      : "border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 active:bg-slate-700"
  }`;
}

function drawGuide(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number
) {
  ctx.strokeStyle = "rgba(20,20,20, 0.36)";
  ctx.lineWidth = 3;
  for (const ratio of [0.25, 0.5, 0.75, 1.0]) {
    ctx.beginPath();
    ctx.arc(centerX, centerY, MAX_RADIUS * ratio, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 1;
  for (const ratio of [0.25, 0.5, 0.75, 1.0]) {
    ctx.beginPath();
    ctx.arc(centerX, centerY, MAX_RADIUS * ratio, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(255,255,255,0.28)";
  ctx.beginPath();
  ctx.arc(centerX, centerY, MAX_RADIUS, 0, Math.PI * 2);
  ctx.stroke();
}

function drawColorDots(
  ctx: CanvasRenderingContext2D,
  colors: ColorCount[],
  centerX: number,
  centerY: number,
  mode: AppColorAnalysisMode
) {
  for (const color of colors) {
    const angleDeg = color.hue_angle - 90;
    const angleRad = (angleDeg * Math.PI) / 180;

    const source =
      mode === "hue-lightness" ? color.lightness : color.hsv_saturation;

    const radius = Math.max(0, Math.min(1, source)) * MAX_RADIUS;
    const x = centerX + Math.cos(angleRad) * radius;
    const y = centerY + Math.sin(angleRad) * radius;

    const minR = 1;
    const maxR = 12;
    const ratioScale = 40;
    const t0 = Math.min(1, Math.max(0, color.ratio * ratioScale));
    const t = t0 * t0 * (3 - 2 * t0);
    const dotRadius = minR + (maxR - minR) * t;

    ctx.beginPath();
    ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
    ctx.fillStyle = color.hex;
    ctx.fill();
  }

  ctx.beginPath();
  ctx.arc(centerX, centerY, 2, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,1.0)";
  ctx.fill();
}

function drawRightLegend(ctx: CanvasRenderingContext2D, colors: ColorCount[]) {
  const legendColors = colors.slice(0, 30);
  const legendX = CHART_SIZE + OPTION_OFFSET_X;
  const legendItemHeight = 26;
  const legendBoxSize = 14;
  const legendPaddingY = 10;
  const legendWidth = 150;
  const legendHeight =
    (legendColors.length / 2) * legendItemHeight + legendPaddingY * 2;
  const legendY = 12;

  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 1;
  ctx.strokeRect(legendX, legendY, legendWidth, legendHeight);

  legendColors.forEach((color, index) => {
    const itemY = legendY + legendPaddingY + (index % 10) * legendItemHeight;
    const chipX = legendX + 8 + Math.floor(index / 10) * 22;

    ctx.fillStyle = color.hex;
    ctx.fillRect(chipX, itemY + 2, legendBoxSize, legendBoxSize);

    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = 1;
    ctx.strokeRect(chipX, itemY + 2, legendBoxSize, legendBoxSize);
  });
}

function drawBottomLegend(
  ctx: CanvasRenderingContext2D,
  colors01: ColorCount[]
) {
  const legendColors = colors01.slice(0, 30);
  const legendBoxSize = 14;
  const legendGapX = 8;
  const legendGapY = 8;
  const legendPaddingX = 10;
  const legendPaddingY = 10;
  const legendCols = 10;
  const legendRows = Math.ceil(legendColors.length / legendCols);

  const legendWidth =
    legendPaddingX * 2 +
    legendCols * legendBoxSize +
    (legendCols - 1) * legendGapX;

  const legendHeight =
    legendPaddingY * 2 +
    legendRows * legendBoxSize +
    (legendRows - 1) * legendGapY;

  const legendX = 12;
  const legendY = CHART_SIZE + OPTION_OFFSET_Y;

  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 1;
  ctx.strokeRect(legendX, legendY, legendWidth, legendHeight);

  legendColors.forEach((color, index) => {
    const col = index % legendCols;
    const row = Math.floor(index / legendCols);
    const chipX =
      legendX + legendPaddingX + col * (legendBoxSize + legendGapX);
    const chipY =
      legendY + legendPaddingY + row * (legendBoxSize + legendGapY);

    ctx.fillStyle = color.hex;
    ctx.fillRect(chipX, chipY, legendBoxSize, legendBoxSize);

    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = 1;
    ctx.strokeRect(chipX, chipY, legendBoxSize, legendBoxSize);
  });
}

function drawColorAnalysisChart(
  canvas: HTMLCanvasElement,
  params: RedrawParams
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const width = CHART_SIZE;
  const height = CHART_SIZE;
  const centerX = width / 2 + OPTION_OFFSET_X;
  const centerY = height / 2 + OPTION_OFFSET_Y;

  const canvasWidth = width + OPTION_SIZE;
  const canvasHeight = height + OPTION_SIZE;

  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  ctx.fillStyle = "rgba(20,20,20,0.35)";
  ctx.fillRect(OPTION_OFFSET_X, OPTION_OFFSET_Y, width, height);

  drawGuide(ctx, centerX, centerY);
  drawColorDots(
    ctx,
    params.colors,
    centerX,
    centerY,
    params.colorAnalysisMode
  );
  drawRightLegend(ctx, params.colors);

  if (params.colors01.length > 0) {
    drawBottomLegend(ctx, params.colors01);
  }
}

const AppColorAnalysis = forwardRef<AppColorAnalysisHandle, {}>(function (_, ref) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const state = useAppState();
  const colorsRef = useRef<{ colors: ColorCount[]; colors01: ColorCount[] }>({
    colors: [],
    colors01: [],
  });

  const [colorAnalysisMode, setColorAnalysisMode] =
    useState<AppColorAnalysisMode>("hue-saturation");
  const [colorToolbarOpen, setColorToolbarOpen] = useState(true);

  const dialog = useDialog();

  const setVisible = useCallback((visible: boolean) => {
    if (!rootRef.current) return;
    rootRef.current.style.display = visible ? "block" : "none";
  }, []);

  const redraw = useCallback((props?: Partial<RedrawParams>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const next: RedrawParams = {
      colors: props?.colors ?? colorsRef.current.colors,
      colors01: props?.colors01 ?? colorsRef.current.colors01,
      colorAnalysisMode: props?.colorAnalysisMode ?? colorAnalysisMode,
    };

    colorsRef.current = {
      colors: next.colors,
      colors01: next.colors01,
    };

    drawColorAnalysisChart(canvas, next);
  }, [colorAnalysisMode]);

  const handleClear = useCallback(() => {
    setVisible(false);
  }, [setVisible]);

  const setModeAndRedraw = useCallback(
    (mode: AppColorAnalysisMode) => {
      setColorAnalysisMode(mode);
      redraw({ colorAnalysisMode: mode });
    },
    [redraw]
  );

  useEffect(() => {
    if (!rootRef.current) return;
    rootRef.current.style.display = "none";
    redraw({ colors: [], colors01: [], colorAnalysisMode });
  }, [redraw, colorAnalysisMode]);

  useImperativeHandle(
    ref,
    () => ({
      redraw: (props?: { colors: ColorCount[]; colors01: ColorCount[] }) => {
        redraw({
          colors: props?.colors ?? [],
          colors01: props?.colors01 ?? [],
        });
      },
      setVisible,
      getCanvas: () => canvasRef.current,
    }),
    [redraw, setVisible]
  );

  return (
    <>
      <div
        ref={rootRef}
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 8,
          pointerEvents: "none",
        }}
      >
        <canvas id="color-analysis" ref={canvasRef} className="w-full h-full" />
      </div>

      <div
        className={`fixed bottom-4 right-4 z-9999 flex items-end gap-2 pointer-events-auto ${
          state.tool === "color" ? "flex" : "hidden"
        }`}
      >
        <button
          className="rounded-2xl border border-slate-700 bg-slate-900/90 px-3 py-3 text-xs text-slate-100 shadow-xl transition-colors hover:bg-slate-800"
          onClick={() => setColorToolbarOpen((v) => !v)}
          title="toggle color toolbar"
          aria-label="toggle color toolbar"
        >
          {colorToolbarOpen ? ">" : "<"}
        </button>

        <div
          className={`overflow-hidden rounded-2xl bg-slate-950/80 shadow-xl backdrop-blur transition-all duration-200 ${
            colorToolbarOpen
              ? "max-w-[1000px] opacity-100 translate-x-0 border border-slate-800"
              : "max-w-0 opacity-0 translate-x-2 border border-transparent"
          }`}
        >
          <div className="flex flex-col gap-1 p-1 sm:flex-row sm:flex-wrap">
            <button
              className={toolbarButtonClass(colorAnalysisMode === "hue-saturation")}
              onClick={() => setModeAndRedraw("hue-saturation")}
              title="Saturation"
              aria-label="Saturation"
            >
              Saturation
            </button>

            <button
              className={toolbarButtonClass(colorAnalysisMode === "hue-lightness")}
              onClick={() => setModeAndRedraw("hue-lightness")}
              title="Lightness"
              aria-label="Lightness"
            >
              Lightness
            </button>

            <button
              className={toolbarButtonClass(false)}
              onClick={() =>
                handleExport({
                  dialog,
                  colors: colorsRef.current.colors,
                  colors01: colorsRef.current.colors01,
                })
              }
              title="Export"
              aria-label="Export"
            >
              <Download className="w-4 h-4" />
              Export
            </button>

            <button
              className={toolbarButtonClass(false)}
              onClick={handleClear}
              title="Clear"
              aria-label="Clear"
            >
              <BrushCleaning className="w-4 h-4" />
              Clear
            </button>
          </div>
        </div>
      </div>
    </>
  );
});

export { AppColorAnalysis };
export type { AppColorAnalysisHandle };