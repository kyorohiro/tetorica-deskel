import { RefObject } from "react";
import { AppBackgroundImageCanvasHandle } from "../app/AppBackgroundImageCanvas";
import { SubToolbar, ModeButton } from "../../parts/AppDeskelToolbarParts";
import { useDialog } from "../utils/useDialog";
import { makeFilenameWithTimestamp, saveFileWithFallback } from "../../utils";
import { showToast } from "../utils/toast";
import { getVideo } from "../../natives/nativeWebScreenshot";
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
  const handleExportImage = async () => {
    if (props.appBackgroundImageCanvasRef?.current) {
      if (!props.appBackgroundImageCanvasRef.current.hasImage()) {
        console.log("not found image");
        return
      }
      const data = await props.appBackgroundImageCanvasRef.current.getBlob();
      if (data) {
        await saveFileWithFallback({
          title: "Save Procreate Palette",
          filename: makeFilenameWithTimestamp(`image`, `png`),
          data,
          filters: [
            { name: "png", extensions: ["png"] },
          ],
          mimeType: "application/octet-stream",
          showToast,
        });
      }
    }
  };

  const handleClearImage = async () => {
    if (props.appBackgroundImageCanvasRef?.current) {
      await props.appBackgroundImageCanvasRef.current.clear();;
    }
  };

  return (
    <SubToolbar
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
          handleExportImage();
        }}
        title="set unit"
        className="justify-center px-2 py-1"
      >
        Export
      </ModeButton>

      <ModeButton
        active={false}
        onClick={() => {
          //props.setMeasureMode("setUnit");
          handleClearImage();
        }}
        title="set unit"
        className="justify-center px-2 py-1"
      >
        Clear
      </ModeButton>
      {
        //
      }
      <ModeButton
        active={false}
        onClick={async () => {
          //props.setMeasureMode("setUnit");
          //const data = await captureSelfAreaFromDisplaySurface(document.getElementById('root')!);
          const data = await getVideo();
          await props.appBackgroundImageCanvasRef!.current!.addVideo(data!);
        }}
        title="set unit"
        className="justify-center px-2 py-1"
      >
        Capture
      </ModeButton>
    </SubToolbar>
  );
}

export { AppDeskelImageToolbar };
export type { MeasureMode, QuadMode };