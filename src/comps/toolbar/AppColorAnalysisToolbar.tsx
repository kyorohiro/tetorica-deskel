import { appState, useAppState } from "../../state";
import { Download, BrushCleaning, Monitor, Image } from "lucide-react";
import { handleExport } from "../../colorPalette";
import { isTauri } from "../../natives/native";
import { SubToolbar, toolbarButtonClass } from "../../parts/AppDeskelToolbarParts";
import { AppColorAnalysisMode } from "../../colorAnalysisDarw";
import { useDialog } from "../../useDialog";
import { ColorCount } from "../../natives/nativeScreenshot";

const AppColorAnalysisToolbar = (props: {
  colorToolbarOpen: boolean,
  setColorToolbarOpen: (v: boolean) => void,
  colorAnalysisMode: AppColorAnalysisMode,
  setModeAndRedraw: (v: AppColorAnalysisMode) => void,
  colorsRef: React.RefObject<{
    colors: ColorCount[];
    colors01: ColorCount[];
  }>,
  handleClear: () => void
}) => {
  const uAppState = useAppState();
  const dialog = useDialog();

  return (
    <>
      <SubToolbar open={props.colorToolbarOpen} onToggle={() => props.setColorToolbarOpen(!props.colorToolbarOpen)} hidden={uAppState.tool !== "color"}>
        <button
          className={toolbarButtonClass(props.colorAnalysisMode === "hue-saturation")}
          onClick={() => props.setModeAndRedraw("hue-saturation")}
          title="Saturation"
          aria-label="Saturation"
        >
          Saturation
        </button>

        <button
          className={toolbarButtonClass(props.colorAnalysisMode === "hue-lightness")}
          onClick={() => props.setModeAndRedraw("hue-lightness")}
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
              colors: props.colorsRef.current.colors,
              colors01: props.colorsRef.current.colors01,
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
          onClick={props.handleClear}
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
                    className={`flex flex-row rounded-xl px-2 py-1 m-0.5 text-xs ${uAppState.target == mode
                      ? "border border-amber-500 bg-amber-950 text-amber-300"
                      : "text-slate-100 hover:bg-slate-800"
                      }`}
                    onClick={() => {
                      appState.setTarget(mode);
                    }}
                  >
                    {mode === "image" ? <Image size={12} /> : <Monitor size={12} />}
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
      </SubToolbar>

    </>
  );
};

export { AppColorAnalysisToolbar };
