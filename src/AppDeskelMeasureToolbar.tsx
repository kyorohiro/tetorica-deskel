import { SubToolbar, ModeButton } from "./parts/AppDeskelToolbarParts";

type MeasureMode = "line" | "chain" | "setUnit" | "setVanishingPoint";
type QuadMode = "off" | "view" | "apply";

function AppDeskelMeasureToolbar(props: {
  visible: boolean;
  open: boolean;
  onToggle: () => void;
  measureMode: MeasureMode;
  setMeasureMode: (mode: MeasureMode) => void;
  quadMode: QuadMode;
  setQuadMode: (mode: QuadMode) => void;
  onApplyQuad?: () => void;
}) {
  return (
    <SubToolbar
      open={props.open}
      onToggle={props.onToggle}
      hidden={!props.visible}
    >
      <ModeButton
        active={props.measureMode === "line"}
        onClick={() => {
          props.setMeasureMode("line");
        }}
        title="line measure"
        className="justify-center gap-1 px-2 py-1"
      >
        Line
      </ModeButton>

      <ModeButton
        active={props.measureMode === "chain"}
        onClick={() => {
          props.setMeasureMode("chain");
        }}
        title="chain measure"
        className="justify-center px-2 py-1"
      >
        Chain
      </ModeButton>

      <ModeButton
        active={props.measureMode === "setUnit"}
        onClick={() => {
          props.setMeasureMode("setUnit");
        }}
        title="set unit"
        className="justify-center px-2 py-1"
      >
        Set Unit
      </ModeButton>

      <div className="flex items-center gap-2">
        <div className="flex flex-col gap-1 rounded-2xl border border-slate-700 bg-slate-900 p-1 sm:flex-row sm:items-center">
          <span
            className="
              inline-flex items-center justify-center
              rounded-xl
              bg-slate-800/80
              px-2 py-1 m-0.5
              text-xs font-medium uppercase tracking-wide
              text-slate-400
              select-none
              sm:rounded-l-xl sm:rounded-r-none
            "
          >
            Quad
          </span>

          <div className="flex flex-col gap-1 sm:flex-row">
            {(["off", "view", "apply"] as const).map((mode) => (
              <button
                key={mode}
                className={`rounded-xl px-2 py-1 m-0.5 text-xs ${
                  props.quadMode === mode
                    ? "border border-amber-500 bg-amber-950 text-amber-300"
                    : "text-slate-100 hover:bg-slate-800"
                }`}
                onClick={() => {
                  props.setQuadMode(mode);
                  if (mode === "apply") {
                    props.onApplyQuad?.();
                  }
                }}
              >
                {mode === "off" ? "Off" : mode === "view" ? "View" : "Apply"}
              </button>
            ))}
          </div>
        </div>
      </div>
    </SubToolbar>
  );
}

export { AppDeskelMeasureToolbar };
export type { MeasureMode, QuadMode };