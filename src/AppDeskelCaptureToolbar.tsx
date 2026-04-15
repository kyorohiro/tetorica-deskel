import { RefObject } from "react";
import { CollapsibleToolbar, ModeButton } from "./parts/AppDeskelToolbarParts";
import { ScreenCaptureCanvasHandle } from "./AppScreenCaptureCanvas";
import { makeFilenameWithTimestamp, saveFileWithFallback } from "./utils";
import { showToast } from "./toast";
import { Monitor, Image } from "lucide-react";
import { isTauri } from "./native";
import { appState, useAppState } from "./state";

type AppDeskelCaptureMode =
  | "none"
  | "lightness"
  | "protan"
  | "deutan"
  | "tritan";

const CAPTURE_MODE_ITEMS: {
  key: AppDeskelCaptureMode;
  label: string;
  title: string;
}[] = [
    { key: "none", label: "None", title: "none" },
    { key: "lightness", label: "Grayscale", title: "grayscale value check" },
    { key: "protan", label: "Protan", title: "protan preview" },
    { key: "deutan", label: "Deutan", title: "deutan preview" },
    { key: "tritan", label: "Tritan", title: "tritan preview" },
  ];

function AppDeskelCaptureToolbar(props: {
  appScreenCaptureCanvasRef?: RefObject<ScreenCaptureCanvasHandle | null>
  visible: boolean;
  open: boolean;
  onToggle: () => void;
  captureMode: AppDeskelCaptureMode;
  onChangeCaptureMode: (mode: AppDeskelCaptureMode) => void;
  onClearCaptureImage: () => void;
}) {
  const state = useAppState()
  const hundleExport = async () => {
    if (props.appScreenCaptureCanvasRef && props.appScreenCaptureCanvasRef.current) {
      const data = await props.appScreenCaptureCanvasRef.current?.getBlobFromCanvas();
      if (data) {
        await saveFileWithFallback({
          title: "Save Procreate Palette",
          filename: makeFilenameWithTimestamp(`captureimage`, `png`),
          data,
          filters: [
            { name: "Png", extensions: ["png"] },
          ],
          mimeType: "application/octet-stream",
          showToast,
        });
      }
    }
    return;
  }
  return (
    <CollapsibleToolbar
      open={props.open}
      onToggle={props.onToggle}
      hidden={!props.visible}
    >
      {CAPTURE_MODE_ITEMS.map((item) => (
        <ModeButton
          key={item.key}
          active={props.captureMode === item.key}
          onClick={() => {
            props.onChangeCaptureMode(item.key);
          }}
          title={item.title}
        >
          {item.label}
        </ModeButton>
      ))}

      <ModeButton
        active={false}
        onClick={props.onClearCaptureImage}
        title="clear capture image"
      >
        Clear
      </ModeButton>

      <ModeButton
        active={false}
        onClick={hundleExport}
        title="clear capture image"
      >
        Export
      </ModeButton>
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
    </CollapsibleToolbar>
  );
}

export { AppDeskelCaptureToolbar };
export type { AppDeskelCaptureMode };