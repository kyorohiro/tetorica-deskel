import { CollapsibleToolbar, ModeButton } from "./AppDeskelToolbarParts";

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
  visible: boolean;
  open: boolean;
  onToggle: () => void;
  captureMode: AppDeskelCaptureMode;
  onChangeCaptureMode: (mode: AppDeskelCaptureMode) => void;
  onClearCaptureImage: () => void;
}) {
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
    </CollapsibleToolbar>
  );
}

export { AppDeskelCaptureToolbar };
export type { AppDeskelCaptureMode };