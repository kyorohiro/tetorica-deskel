import { RefObject } from "react";
import { AppBackgroundImageCanvasHandle } from "./AppBackgroundImageCanvas";
import { CollapsibleToolbar, ModeButton } from "./AppDeskelToolbarParts";
import { useDialog } from "./useDialog";

type MeasureMode = "line" | "chain" | "setUnit" | "setVanishingPoint";
type QuadMode = "off" | "view" | "apply";

function AppDeskelImageToolbar(props: {
  appBackgroundImageCanvasRef?: RefObject<AppBackgroundImageCanvasHandle | null>;
  visible: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const dialog = useDialog();
    const handleImportImage = async () => {
        const ret = await dialog.showFileDialog({});
        if (props.appBackgroundImageCanvasRef?.current) {
            if (ret?.files && ret.files.length > 0) {
                await props.appBackgroundImageCanvasRef.current.addImage(ret.files[0]);
                //syncBackgroundImageState()
            }
        }
    };
  return (
    <CollapsibleToolbar
      open={props.open}
      onToggle={props.onToggle}
      hidden={!props.visible}
    >
      <ModeButton
        active={false}
        onClick={() => {
          //
           handleImportImage();
        }}
        title="chain measure"
        className="justify-center px-2 py-1"
      >
        Import
      </ModeButton>

      <ModeButton
        active={false}
        onClick={() => {
          //props.setMeasureMode("setUnit");
        }}
        title="set unit"
        className="justify-center px-2 py-1"
      >
        Export
      </ModeButton>

    </CollapsibleToolbar>
  );
}

export { AppDeskelImageToolbar };
export type { MeasureMode, QuadMode };