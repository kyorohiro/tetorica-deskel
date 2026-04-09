import {
  useRef,
  forwardRef,
  useImperativeHandle,
  useCallback,
  useEffect,
  useState,
} from "react";
import { ColorCount } from "./screenshot";
import { useAppState } from "./state";
import { Download, BrushCleaning } from "lucide-react";
import { useDialog } from "./useDialog";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { showToast } from "./toast";
import { createSwatchesFile } from "procreate-swatches";

type AppColorAnalysisMode = "hue-saturation" | "hue-lightness";

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace("#", "").trim();
  const value =
    normalized.length === 3
      ? normalized.split("").map((c) => c + c).join("")
      : normalized;

  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);

  return [r, g, b];
}


async function exportProcreateSwatches(
  paletteName: string,
  colors: ColorCount[]
) {
  const limited = colors.slice(0, 30);

  const swatchColors = limited.map((color) => {
    const rgb = hexToRgb(color.hex);
    return [rgb, "rgb"] as const;
  });

  const data = await createSwatchesFile(
    paletteName,
    swatchColors,
    "uint8array"
  ) as Uint8Array;

  const path = await save({
    title: "Save Procreate Palette",
    defaultPath: `${paletteName}.swatches`,
    filters: [{ name: "Procreate Swatches", extensions: ["swatches"] }],
  });

  if (!path) return;

  console.log("> data", data);
  await writeFile(path, data);
  showToast(`> saved Procreate palette: ${path}`);
}

async function exportPalettePng(colors: ColorCount[]) {
  const size = 1024;
  const padding = 32;
  const cols = Math.ceil(Math.sqrt(colors.length));
  //const rows = Math.ceil(colors.length / cols);
  const cell = Math.floor((size - padding * 2) / cols);

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get canvas context");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);

  colors.forEach((color, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = padding + col * cell;
    const y = padding + row * cell;

    ctx.fillStyle = color.hex;
    ctx.fillRect(x, y, cell, cell);
  });

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error("Failed to create PNG blob"));
    }, "image/png");
  });

  const path = await save({
    title: "Save Palette PNG",
    defaultPath: "palette.png",
    filters: [{ name: "PNG Image", extensions: ["png"] }],
  });

  if (!path) return;

  const bytes = new Uint8Array(await blob.arrayBuffer());
  await writeFile(path, bytes);

  console.log("> saved png:", path);
  showToast(`> saved png: ${path}`);
}

async function exportPaletteCsv(colors: ColorCount[]) {
  const lines = [
    ["index", "hex", "ratio", "hue_angle", "hsv_saturation"].join(","),
    ...colors.map((color, index) =>
      [
        index + 1,
        color.hex,
        color.ratio,
        color.hue_angle,
        color.hsv_saturation,
      ].join(",")
    ),
  ];

  const csvText = lines.join("\n");
  const path = await save({
    title: "Save Palette CSV",
    defaultPath: "palette.csv",
    filters: [{ name: "CSV", extensions: ["csv"] }],
  });

  if (!path) return;

  const bytes = new TextEncoder().encode(csvText);
  await writeFile(path, bytes);

  console.log("> saved csv:", path);
  showToast(`> saved csv: ${path}`);
}

type AppColorAnalysisHandle = {
  redraw: (props?: { colors: ColorCount[], colors01: ColorCount[] }) => void;
  setVisible: (visible: boolean) => void;
  getCanvas: () => HTMLCanvasElement | null;
};

const AppColorAnalysis = forwardRef<AppColorAnalysisHandle, {}>(function (_, ref) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const state = useAppState();
  const colorsRef = useRef<{ colors: ColorCount[], colors01: ColorCount[] }>({ colors: [], colors01: [] });
  const [colorAnalysisMode, setColorAnalysisMode] = useState<AppColorAnalysisMode>("hue-saturation");

  const { showSelectDialog } = useDialog();
  const setVisible = useCallback((visible: boolean) => {
    if (!rootRef.current) return;
    rootRef.current.style.display = visible ? "block" : "none";
  }, []);
  const handleClear = useCallback(() => {
    setVisible(false);
  }, []);

  const handleExport = useCallback(async () => {
    console.log("> handleExport");

    const selectedColorType = await showSelectDialog({
      title: "Export Palette",
      message: "Choose a palette source.",
      options: [
        {
          value: "color-count",
          label: "Color (Count)",
          description: "Export colors based on appearance frequency.",
        },
        {
          value: "color-clustering",
          label: "Color (Clustering)",
          description: "Export colors based on clustering results.",
        },
      ],
      cancelText: "Cancel",
    });

    if (selectedColorType === null) {
      console.log("> canceled: color type");
      return;
    }

    const selectedFormat = await showSelectDialog({
      title: "Export Format",
      message: "Choose a format.",
      options: [
        {
          value: "procreate-swatches",
          label: "Procreate (.swatches)",
          description: "Export colors as a Procreate palette file.",
        },
        {
          value: "png",
          label: "PNG",
          description: "Export colors as a palette image.",
        },
        {
          value: "csv",
          label: "CSV",
          description: "Export colors as a CSV file.",
        },
      ],
      cancelText: "Cancel",
    });

    if (selectedFormat === null) {
      console.log("> canceled: format");
      return;
    }

    const exportColors =
      selectedColorType === "color-count"
        ? colorsRef.current.colors
        : colorsRef.current.colors01;

    if (!exportColors || exportColors.length === 0) {
      console.log("> no colors to export");
      return;
    }

    try {
      switch (selectedFormat) {
        case "procreate-swatches":
          await exportProcreateSwatches("Deskel Palette", exportColors);
          break;
        case "png":
          await exportPalettePng(exportColors);
          break;
        case "csv":
          await exportPaletteCsv(exportColors);
          break;
        default:
          console.log("> unknown format:", selectedFormat);
          break;
      }
    } catch (e) {
      console.error("> export failed", e);
      showToast(`> export failed: ${e}`);
    }
  }, [showSelectDialog]);

  const redraw = useCallback((props?: { colors: ColorCount[], colors01: ColorCount[], colorAnalysisMode: AppColorAnalysisMode }) => {
    console.log("> redraw", props);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    colorsRef.current = {
      colors: props?.colors ?? [],
      colors01: props?.colors01 ?? [],
    }
    const colors = props?.colors ?? [];

    canvas.getClientRects();
    const width = 320;
    const height = 320;
    const optWidth = 22 * 6 + 10;
    const optHeight = 22 * 6 + 10;
    const optX = optWidth / 2;
    const optY = optHeight / 2;
    const centerX = width / 2 + optX;
    const centerY = height / 2 + optY;
    const maxRadius = 145;

    const canvasWidth = width + optWidth;
    const canvasHeight = height + optHeight;

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // 背景

    ctx.fillStyle = "rgba(20,20,20,0.35)";
    ctx.fillRect(optX, optY, width, height);


    // ガイド円
    ctx.strokeStyle = "rgba(20,20,20, 0.36)";
    ctx.lineWidth = 3;

    for (const ratio of [0.25, 0.5, 0.75, 1.0]) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, maxRadius * ratio, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 1;

    for (const ratio of [0.25, 0.5, 0.75, 1.0]) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, maxRadius * ratio, 0, Math.PI * 2);
      ctx.stroke();
    }
    // 十字ガイド
    /*
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - maxRadius);
    ctx.lineTo(centerX, centerY + maxRadius);
    ctx.moveTo(centerX - maxRadius, centerY);
    ctx.lineTo(centerX + maxRadius, centerY);
    ctx.stroke();
    */

    // 外周リング
    ctx.strokeStyle = "rgba(255,255,255,0.28)";
    ctx.beginPath();
    ctx.arc(centerX, centerY, maxRadius, 0, Math.PI * 2);
    ctx.stroke();


    // heatmap
    /*
    for (const color of colors) {
      const angleDeg = color.hue_angle - 90;
      const angleRad = (angleDeg * Math.PI) / 180;

      const radius = Math.max(0, Math.min(1, color.hsv_saturation)) * maxRadius;
      const x = centerX + Math.cos(angleRad) * radius;
      const y = centerY + Math.sin(angleRad) * radius;

      //const heatRadius = Math.max(10, Math.min(40, 10 + color.ratio * 200));
      const t = Math.sqrt(color.ratio);
      const heatRadius = Math.max(10, Math.min(40, 10 + t * 30));
      const alpha = Math.max(0.08, Math.min(0.35, color.ratio * 3.0));

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(x, y, heatRadius, 0, Math.PI * 2);
      ctx.fillStyle = color.hex;
      ctx.fill();
      ctx.restore();
    }
    */

    // 色点を描く
    for (const color of colors) {
      const angleDeg = color.hue_angle - 90; // 0°を上にしたい
      const angleRad = (angleDeg * Math.PI) / 180;

      let radius: number;
      let x: number;
      let y: number;
      if (props?.colorAnalysisMode === "hue-lightness") {
        //console.log("> hue-lightness", colorAnalysisMode , color.lightness)
        radius = Math.max(0, Math.min(1, color.lightness)) * maxRadius;
      } else {
        //console.log("> hue-saturation", colorAnalysisMode , color.hsv_saturation)
        radius = Math.max(0, Math.min(1, color.hsv_saturation)) * maxRadius;
      }
      x = centerX + Math.cos(angleRad) * radius;
      y = centerY + Math.sin(angleRad) * radius;

      //
      // 見やすい書き方だが正確ではない
      //let x: number;
      //let y: number;

      // 無彩色は中央の縦ラインに並べる
      //const sat = Math.max(0, Math.min(1, color.hsv_saturation));
      //const val = Math.max(0, Math.min(1, color.value));
      //
      //if (sat < 0.05) {
      //  const graySpread = maxRadius * 0.25;
      //  x = centerX;
      //  y = centerY + (0.5 - val) * 2 * graySpread;
      //} else {
      //  const radius = sat * maxRadius;
      //  x = centerX + Math.cos(angleRad) * radius;
      //  y = centerY + Math.sin(angleRad) * radius;
      //}

      // ratio で点サイズ調整
      // [01]
      //const t = color.ratio;
      //const dotRadius = Math.max(1, Math.min(12, 1 + t * 30));

      // [02]
      //const t = Math.sqrt(color.ratio);
      //const dotRadius = Math.max(1, Math.min(12, 1 + t*30));

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

      // 白っぽい色や黒っぽい色でも見えるように枠線
      //ctx.lineWidth = 1;
      //ctx.strokeStyle = "rgba(255,255,255,0.65)";
      //ctx.stroke();
    }

    // 中心点
    ctx.beginPath();
    ctx.arc(centerX, centerY, 2, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,1.0)";
    ctx.fill();
    //
    {
      // 左下に上位10色の一覧を描く
      const legendColors = colors.slice(0, 30);

      const legendX = width + optX;
      const legendItemHeight = 26;
      const legendBoxSize = 14;
      const legendPaddingY = 10;
      const legendWidth = 150;
      const legendHeight = legendColors.length / 2 * legendItemHeight + legendPaddingY * 2;
      const legendY = 12;//height - legendHeight - 12;

      // 背景
      //ctx.fillStyle = "rgba(0,0,0,0.45)";
      //ctx.fillRect(legendX, legendY, legendWidth, legendHeight);

      // 枠
      ctx.strokeStyle = "rgba(255,255,255,0.18)";
      ctx.lineWidth = 1;
      ctx.strokeRect(legendX, legendY, legendWidth, legendHeight);

      ctx.font = "12px sans-serif";
      ctx.textBaseline = "middle";

      legendColors.forEach((color, index) => {
        const itemY = legendY + legendPaddingY + (index % 10) * legendItemHeight;

        // 色チップ
        ctx.fillStyle = color.hex;
        ctx.fillRect(legendX + 8 + Math.floor(index / 10) * 22, itemY + 2, legendBoxSize, legendBoxSize);

        ctx.strokeStyle = "rgba(255,255,255,0.8)";
        ctx.lineWidth = 1;
        ctx.strokeRect(legendX + 8 + Math.floor(index / 10) * 22, itemY + 2, legendBoxSize, legendBoxSize);

        // テキスト
        //ctx.fillStyle = "rgba(255,255,255,0.92)";
        //const percent = (color.ratio * 100).toFixed(1);
        //ctx.fillText(
        //  `${index + 1}. ${color.hex} ${percent}%`,
        //  legendX + 30,
        //  itemY + 9
        //);
      });
    }
    if (props?.colors01) {
      const legendColors = props.colors01.slice(0, 30);

      const legendBoxSize = 14;
      const legendGapX = 8;
      const legendGapY = 8;
      const legendPaddingX = 10;
      const legendPaddingY = 10;
      const legendCols = 10; // 1行に並べる数
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
      const legendY = height + optY; //- legendHeight - 12;

      // 枠
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
        // ctx.fillRect(legendX + 8 + Math.floor(index/10)* 22, itemY + 2, legendBoxSize, legendBoxSize);

        ctx.strokeStyle = "rgba(255,255,255,0.8)";
        ctx.lineWidth = 1;
        ctx.strokeRect(chipX, chipY, legendBoxSize, legendBoxSize);
      });
    }
  }, []);

  useEffect(() => {
    if (!rootRef.current) return;
    rootRef.current.style.display = "none";
    console.log("> AppColorAnalysis mounted, hidden by default");
    redraw({ colors: [], colors01: [], colorAnalysisMode });
  }, [redraw]);

  useImperativeHandle(
    ref,
    () => ({
      redraw:(props?: { colors: ColorCount[], colors01: ColorCount[] }) => {
        console.log("> AppColorAnalysis imperative redraw", props);
        redraw({ colors: props?.colors || [], colors01: props?.colors01 || [], colorAnalysisMode })
      },
      setVisible: setVisible,
      getCanvas: () => canvasRef.current,
    }),
    [redraw, colorAnalysisMode]
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
      {
        // 共通toolbar 
        // 置き場所はここで良いか? 共通化すべきか..迷いどころ
      }
      {
        <div
          className={`fixed bottom-4 right-4 z-9999 flex flex-wrap items-center justify-end gap-2 rounded-2xl border border-slate-800 bg-slate-950/80 p-1 shadow-xl backdrop-blur pointer-events-auto ${state.tool == "color" ? "block" : "hidden"
            }`}
        >
          <button
            className={`flex items-center gap-2 rounded-2xl border px-2 py-2 m-0.5 text-xs transition-colors outline-none ${colorAnalysisMode == "hue-saturation"
              ? "border-emerald-500 bg-emerald-950 text-emerald-300"
              : "border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 active:bg-slate-700"
              }`}
            onClick={() => {
              console.log("chain measure line click");
              setColorAnalysisMode("hue-saturation");
              redraw({colors: colorsRef.current.colors, colors01: colorsRef.current.colors01, colorAnalysisMode: "hue-saturation"});

            }}
            title="Save"
            aria-label="Save"
          >
            Saturation
          </button>
          <button
            className={`flex items-center gap-2 rounded-2xl border px-2 py-2 m-0.5 text-xs transition-colors outline-none ${colorAnalysisMode == "hue-lightness"
              ? "border-emerald-500 bg-emerald-950 text-emerald-300"
              : "border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 active:bg-slate-700"
              }`}
            onClick={() => {
              console.log("chain measure click");
              setColorAnalysisMode("hue-lightness");
              redraw({colors: colorsRef.current.colors, colors01: colorsRef.current.colors01, colorAnalysisMode: "hue-lightness"});
            }}
            title="Save"
            aria-label="Save"
          >
            Lightness
          </button>
          {}
          <button
            className={`flex items-center gap-2 rounded-2xl border px-2 py-2 m-0.5 text-xs transition-colors outline-none ${false
              ? "border-emerald-500 bg-emerald-950 text-emerald-300"
              : "border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 active:bg-slate-700"
              }`}
            onClick={handleExport}
            title="Save"
            aria-label="Save"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <button
            className={`flex items-center gap-2 rounded-2xl border px-2 py-2 m-0.5 text-xs transition-colors outline-none ${false
              ? "border-emerald-500 bg-emerald-950 text-emerald-300"
              : "border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 active:bg-slate-700"
              }`}
            onClick={handleClear}
            title="Clear"
            aria-label="Clear"
          >
            <BrushCleaning className="w-4 h-4" />
            Clear
          </button>
        </div>
      }
    </>
  );
});

export { AppColorAnalysis };
export type { AppColorAnalysisHandle };