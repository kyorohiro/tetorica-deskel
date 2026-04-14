import {
  useRef,
  forwardRef,
  useImperativeHandle,
  useCallback,
  useState,
} from "react";
import { ColorCount } from "./nativeScreenshot";
import { appState, useAppState } from "./state";
import { Download, BrushCleaning, Monitor, Image } from "lucide-react";
import { useDialog } from "./useDialog";
import { handleExport } from "./colorPalette";
import { AppColorAnalysisMode, drawColorAnalysisChart, RedrawParams } from "./colorAnalysisDarw";
import { isTauri } from "./native";

type AppColorAnalysisHandle = {
  redraw: (props?: { colors: ColorCount[]; colors01: ColorCount[] }) => void;
  setVisible: (visible: boolean) => void;
  getCanvas: () => HTMLCanvasElement | null;
};

const toolbarButtonBase =
  "flex items-center gap-2 rounded-2xl border px-2 py-2 m-0.5 text-xs transition-colors outline-none";

function toolbarButtonClass(active = false) {
  return `${toolbarButtonBase} ${active
    ? "border-emerald-500 bg-emerald-950 text-emerald-300"
    : "border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 active:bg-slate-700"
    }`;
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
    console.log(">>next", next);
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
      console.log(">> setModeAndRedraw", mode, colorsRef.current)
      setColorAnalysisMode(mode);
      redraw({ colorAnalysisMode: mode });
    },
    [redraw]
  );

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
          display: "none",
        }}
      >
        <canvas id="color-analysis" ref={canvasRef} className="w-full h-full" />
      </div>

      <div
        className={`fixed bottom-4 right-4 z-9999 flex items-end gap-2 pointer-events-auto ${state.tool === "color" ? "flex" : "hidden"
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
          className={`overflow-hidden rounded-2xl bg-slate-950/80 shadow-xl backdrop-blur transition-all duration-200 ${colorToolbarOpen
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
            {
              //
            }
            {
              isTauri() && <div className="flex items-center gap-2">
                <div className="flex flex-col gap-1 rounded-2xl border border-slate-700 bg-slate-900 p-1 sm:flex-row sm:items-center">
                  <span
                    className="
              inline-flex items-center justify-center
              rounded-xl
              bg-slate-800/80
              px-2 py-1 m-0
              text-xs font-medium uppercase tracking-wide
              text-slate-400
              select-none
              sm:rounded-l-xl sm:rounded-r-none
            "
                  >
                    <span className="text-xs">Target</span>
                  </span>

                  <div className="flex flex-col gap-1 justify-center sm:flex-row">
                    {(["image", "screen"] as const).map((mode) => (
                      <button
                        key={mode}
                        className={`flex flex-row rounded-xl px-2 py-1 m-0.5 text-xs ${state.target == mode
                          ? "border border-amber-500 bg-amber-950 text-amber-300"
                          : "text-slate-100 hover:bg-slate-800"
                          }`}
                        onClick={() => {
                          appState.setTarget(mode);
                        }}
                      >
                        {mode === "image" ? <Image size={12} /> :<Monitor size={12} />}
                         <span className="text-xs px-1 sm:hidden">{mode}</span>
                      </button>
                     
                    ))}
                  </div>
                </div>
              </div>
            }
            {
              //
            }
          </div>
        </div>
      </div>
    </>
  );
});

export { AppColorAnalysis };
export type { AppColorAnalysisHandle };