import { RefObject, useEffect, useState } from "react";
import { saveSettings, appState, useAppState, ToolMode } from "../../state";
import { setAlwaysOnTop, setClickThrough } from "../../window";
import { showToast } from "../utils/toast";
import { Menu, MousePointerClick, Pin, Image, Monitor } from "lucide-react";
import { isTauri } from "../../natives/native";
import { AppBackgroundImageCanvasHandle } from "../../AppBackgroundImageCanvas";
import { AppColorAnalysisHandle } from "../../AppColorAnalysis";
import { isPwaDistributionLocation, isRunningAsPwa, PWA_URL, updatePwaNow } from "../../natives/pwa";
import { AppImportImageHandle } from "../../AppImportImage";


function ToolbarSection(props: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <label className="flex items-center m-0 text-xs">{props.title}</label>
      <div className="px-3">{props.children}</div>
    </>
  );
}

function ToolbarToggle(props: {
  visible: boolean;
  checked: boolean;
  onChange: (checked: boolean) => void | Promise<void>;
  tooltip: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}) {
  return (
    <div
      className={`
        rounded-lg bg-black/60 px-1 py-1 text-sm text-white
        transition-opacity duration-200
        flex items-center justify-center
        ${!props.visible ? "opacity-80" : "opacity-0"}
      `}
    >
      <div
        className="group relative inline-flex"
        onClick={(e) => e.stopPropagation()}
      >
        <label className="flex cursor-pointer flex-row items-center justify-center gap-1 text-center">
          {props.leftIcon && (
            <span className="inline-flex">{props.leftIcon}</span>
          )}

          <input
            type="checkbox"
            checked={props.checked}
            className="peer sr-only"
            onChange={(e) => {
              void props.onChange(e.target.checked);
            }}
          />

          <div className="relative h-6 w-11 rounded-full bg-slate-600 transition-colors after:absolute after:start-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full" />

          {props.rightIcon && (
            <span className="inline-flex">{props.rightIcon}</span>
          )}
        </label>

        <div className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 -translate-x-1/2 whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-xs text-white opacity-0 shadow-md transition-opacity group-hover:opacity-100">
          {props.tooltip}
        </div>
      </div>
    </div>
  );
}

function ToolbarActionButton(props: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={props.onClick}
      className={`rounded-lg border px-3 py-1 text-sm shadow transition ${
        props.active
          ? "border-sky-400 bg-sky-700 text-white"
          : "border-slate-500 bg-slate-800 text-white hover:bg-slate-700"
      }`}
    >
      {props.children}
    </button>
  );
}

const TOOL_ITEMS: { key: ToolMode; label: string }[] = [
  { key: "measure", label: "Measure" },
  { key: "draw", label: "Draw" },
  { key: "capture", label: "Capture" },
  { key: "color", label: "Color" },
  { key: "deskel", label: "Deskel" },
  { key: "image", label: "Image" },
];

export function AppToolbar(props: {
  onChangeState?: () => void;
  appBackgroundImageCanvasRef?: RefObject<AppBackgroundImageCanvasHandle | null>;
  appColorAnalysisRef?: RefObject<AppColorAnalysisHandle | null>;
  appImportImageRef?: RefObject<AppImportImageHandle | null>;
}) {
  const [visible, setVisible] = useState(false);
  const [menuPinned, setMenuPinned] = useState(false);
  const uAppState = useAppState();

  const closeMenuIfNeeded = () => {
    if (!menuPinned) {
      setVisible(false);
    }
  };

  useEffect(() => {
    saveSettings(appState.getState());
    props.onChangeState?.();
  }, [uAppState, props]);

  const handleClearImage = async () => {
    if (props.appBackgroundImageCanvasRef?.current) {
      await props.appBackgroundImageCanvasRef.current.clear();
      props.onChangeState?.();
    }
  };

  const tauriMode = isTauri();

  return (
    <>
      <div
        className="absolute left-3 top-1 z-20 flex items-center gap-2"
        style={{ zIndex: 99999 }}
      >
        <button
          onClick={() => setVisible((v) => !v)}
          className="rounded-lg bg-black/60 px-3 py-2 text-sm text-white transition-opacity duration-200 opacity-80"
        >
          <Menu size={12} />
        </button>

        {tauriMode && (
          <ToolbarToggle
            visible={visible}
            checked={uAppState.clickThrough}
            onChange={async (next) => {
              const info = await setClickThrough(next);
              showToast(info);
            }}
            tooltip="click through"
            leftIcon={<MousePointerClick size={12} />}
          />
        )}

        {tauriMode && (
          <ToolbarToggle
            visible={visible}
            checked={uAppState.alwaysOnTop}
            onChange={async (next) => {
              await setAlwaysOnTop(next);
            }}
            tooltip="always on top"
            leftIcon={<Pin size={12} />}
          />
        )}

        {tauriMode && (
          <ToolbarToggle
            visible={visible}
            checked={uAppState.target === "screen"}
            onChange={() => {
              if (uAppState.target === "screen") {
                appState.setTarget("image");
              } else {
                appState.setTarget("screen");
              }
            }}
            tooltip="analysis target : monitor or imported image"
            leftIcon={<Image size={12} />}
            rightIcon={<Monitor size={12} />}
          />
        )}
      </div>

      <div
        id="toolbar"
        className={`
          absolute left-3 top-[52px] z-10
          rounded-xl bg-[rgba(20,20,20,0.6)]
          px-[10px] py-2 text-white select-none
          backdrop-blur-[6px]
          transition-opacity duration-200
          space-y-2
          ${visible ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}
        `}
        style={{ zIndex: 99999 }}
      >
        <div className="absolute right-3 top-0">
          <label className="flex items-center justify-between gap-2 text-xs">
            <span className="inline-flex items-center">
              <Pin size={12} />
            </span>
            <button
              type="button"
              onClick={() => setMenuPinned((v) => !v)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                menuPinned ? "bg-blue-600" : "bg-slate-600"
              }`}
              aria-pressed={menuPinned}
              title="keep menu open"
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                  menuPinned ? "translate-x-5" : "translate-x-1"
                }`}
              />
            </button>
          </label>
        </div>

        <ToolbarSection title="Pen">
          <div className="flex flex-wrap items-center gap-2">
            {TOOL_ITEMS.map((item) => (
              <ToolbarActionButton
                key={item.key}
                active={uAppState.tool === item.key}
                onClick={() => {
                  appState.setTool(item.key);
                  closeMenuIfNeeded();
                }}
              >
                {item.label}
              </ToolbarActionButton>
            ))}
          </div>
        </ToolbarSection>

        <ToolbarSection title="Grid">
          <div className="toolbar-row">
            <label className="flex items-center gap-1.5 text-xs">
              color
              <input
                id="color"
                type="color"
                value={appState.getState().color}
                onChange={(e) => {
                  appState.getState().color = e.target.value;
                  props.onChangeState?.();
                }}
              />
            </label>
          </div>

          <label className="flex items-center gap-1.5 text-xs">
            grid
            <input
              type="range"
              min="20"
              max="300"
              value={appState.getState().grid}
              onChange={(e) => appState.setGrid(Number(e.target.value))}
            />
          </label>

          <label className="flex items-center gap-1.5 text-xs">
            opacity
            <input
              type="range"
              min="0.05"
              max="1"
              step="0.05"
              value={appState.getState().opacity}
              onChange={(e) => appState.setOpacity(Number(e.target.value))}
            />
          </label>

          <label className="flex items-center gap-1.5 text-xs">
            rotation
            <input
              type="range"
              min="-180"
              max="180"
              value={appState.getState().rotation}
              onChange={(e) => appState.setRotation(Number(e.target.value))}
            />
          </label>
        </ToolbarSection>

        <ToolbarSection title="Import">
          <div className="flex flex-wrap items-center gap-2">
            <ToolbarActionButton
              onClick={() => {
                void props.appImportImageRef?.current?.handleImportImage();
              }}
            >
              Image
            </ToolbarActionButton>

            <ToolbarActionButton
              onClick={() => {
                void handleClearImage();
                closeMenuIfNeeded();
              }}
            >
              Clear
            </ToolbarActionButton>
          </div>
        </ToolbarSection>

        <ToolbarSection title="Capture">
          <div className="flex flex-wrap items-center gap-2">
            <ToolbarActionButton
              onClick={() => {
                // 要修正
                appState.setCaptureImage(undefined);
                closeMenuIfNeeded();
              }}
            >
              Clear
            </ToolbarActionButton>
          </div>
        </ToolbarSection>

        <ToolbarSection title="Color Check">
          <ToolbarActionButton
            onClick={() => {
              props.appColorAnalysisRef?.current?.setVisible(false);
              closeMenuIfNeeded();
            }}
          >
            Clear
          </ToolbarActionButton>
        </ToolbarSection>

        {!isPwaDistributionLocation() && !tauriMode && (
          <ToolbarSection title="PWA">
            <ToolbarActionButton
              onClick={() => {
                window.open(PWA_URL, "_blank", "noopener,noreferrer");
              }}
            >
              Open PWA Page
            </ToolbarActionButton>
          </ToolbarSection>
        )}
        {isRunningAsPwa() && !tauriMode && (
          <ToolbarSection title="PWA">
            <ToolbarActionButton
              onClick={async () => {
                //
                //hardResetPwa();
                await updatePwaNow();
              }}
            >
              Update PWA Now
            </ToolbarActionButton>
          </ToolbarSection>
        )}
      </div>
    </>
  );
}
export {
  ToolbarToggle
}