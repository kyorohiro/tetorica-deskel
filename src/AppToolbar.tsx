import { RefObject, useEffect, useState } from "react"
import { saveSettings, appState, useAppState } from "./state";
import { setAlwaysOnTop, setClickThrough } from "./window";
import { showToast } from "./toast";
import { Menu, MousePointerClick, Pin, Image, Monitor } from "lucide-react";
import { isTauri } from "./native";
import { useDialog } from "./useDialog";
import { AppBackgroundImageCanvasHandle } from "./AppBackgroundImageCanvas";
import { AppColorAnalysisHandle } from "./AppColorAnalysis";
import { isPwaDistributionLocation, PWA_URL } from "./pwa";

export function AppToolbar(props: {
    onChangeState?: () => void
    appBackgroundImageCanvasRef?: RefObject<AppBackgroundImageCanvasHandle | null>;
    appColorAnalysisRef?: RefObject<AppColorAnalysisHandle | null>;
}) {
    const [visible, setVisible] = useState(false);
    const [hasBackgroundImage, setHasBackgroundImage] = useState(false);
    const [menuPinned, setMenuPinned] = useState(false);
    const uAppState = useAppState();
    const dialog = useDialog();

    const closeMenuIfNeeded = () => {
        if (!menuPinned) {
            setVisible(false);
        }
    };
    useEffect(() => {
        console.log(">> useEffect [grid, opacity]", [appState.getState()]);
        saveSettings(appState.getState());
        if (props.onChangeState) {
            props.onChangeState();
        }
    }, [appState.getState()]);

    useEffect(() => {
        setHasBackgroundImage(!!props.appBackgroundImageCanvasRef?.current?.hasImage());
    }, [props.appBackgroundImageCanvasRef]);

    const syncBackgroundImageState = () => {
        setHasBackgroundImage(!!props.appBackgroundImageCanvasRef?.current?.hasImage());
        props.onChangeState?.();
    };

    const handleImportImage = async () => {
        const ret = await dialog.showFileDialog({});
        if (props.appBackgroundImageCanvasRef?.current) {
            if (ret?.files && ret.files.length > 0) {
                await props.appBackgroundImageCanvasRef.current.addImage(ret.files[0]);
                syncBackgroundImageState();
            }
        }
    };

    const handleClearImage = async () => {
        if (props.appBackgroundImageCanvasRef?.current) {
            props.appBackgroundImageCanvasRef.current.clear();
            syncBackgroundImageState();
        }
    };

    return (
        <>
            <div className="absolute left-3 top-1 z-20 flex items-center gap-2" style={{ zIndex: 99999 }}>
                <button
                    onClick={() => setVisible(v => !v)}
                    className="rounded-lg bg-black/60 px-3 py-2 text-sm text-white transition-opacity duration-200 opacity-80"
                >
                    <Menu size={12} />
                </button>

                {isTauri() &&
                    <div
                        className={`
                        rounded-lg bg-black/60 px-1 py-1 text-sm text-white
                        transition-opacity duration-200
                        flex items-center justify-center
                        ${!visible ? "opacity-80" : "opacity-0"}
                    `}
                    >
                        <div
                            className="group relative inline-flex"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <label className="flex cursor-pointer flex-row items-center justify-center gap-1 text-center">
                                <input
                                    type="checkbox"
                                    checked={uAppState.clickThrough}
                                    className="peer sr-only"
                                    onChange={async (e) => {
                                        const next = e.target.checked;
                                        const info = await setClickThrough(next);
                                        showToast(info);
                                    }}
                                />

                                <span className="inline-flex">
                                    <MousePointerClick size={12} />
                                </span>

                                <div className="relative h-6 w-11 rounded-full bg-slate-600 transition-colors after:absolute after:start-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full" />
                            </label>

                            <div className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 -translate-x-1/2 whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-xs text-white opacity-0 shadow-md transition-opacity group-hover:opacity-100">
                                click through
                            </div>
                        </div>
                    </div>
                }

                {isTauri() &&
                    <div
                        className={`
                        rounded-lg bg-black/60 px-1 py-1 text-sm text-white
                        transition-opacity duration-200
                        flex items-center justify-center
                        ${!visible ? "opacity-80" : "opacity-0"}
                    `}
                    >
                        <div
                            className="group relative inline-flex"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <label className="flex cursor-pointer flex-row items-center justify-center gap-1 text-center">
                                <input
                                    type="checkbox"
                                    checked={uAppState.alwaysOnTop}
                                    className="peer sr-only"
                                    onChange={async (e) => {
                                        const next = e.target.checked;
                                        await setAlwaysOnTop(next);
                                    }}
                                />

                                <span className="inline-flex">
                                    <Pin size={12} />
                                </span>

                                <div className="relative h-6 w-11 rounded-full bg-slate-600 transition-colors after:absolute after:start-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full" />
                            </label>

                            <div className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 -translate-x-1/2 whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-xs text-white opacity-0 shadow-md transition-opacity group-hover:opacity-100">
                                always on top
                            </div>
                        </div>
                    </div>
                }

                {isTauri() &&
                    <div
                        className={`
                        rounded-lg bg-black/60 px-1 py-1 text-sm text-white
                        transition-opacity duration-200
                        flex items-center justify-center
                        ${!visible ? "opacity-80" : "opacity-0"}
                    `}
                    >
                        <div
                            className="group relative inline-flex"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <label className="flex cursor-pointer flex-row items-center justify-center gap-1 text-center">
                                <span className="inline-flex">
                                    <Image size={12} />
                                </span>
                                <input
                                    type="checkbox"
                                    checked={uAppState.target == "screen"}
                                    className="peer sr-only"
                                    onChange={async () => {
                                        if (uAppState.target == "screen") {
                                            appState.setTarget("image");
                                        } else {
                                            appState.setTarget("screen");
                                        }
                                    }}
                                />
                                <div className="relative h-6 w-11 rounded-full bg-slate-600 transition-colors after:absolute after:start-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full" />

                                <span className="inline-flex">
                                    <Monitor size={12} />
                                </span>
                            </label>

                            <div className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 -translate-x-1/2 whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-xs text-white opacity-0 shadow-md transition-opacity group-hover:opacity-100">
                                analusis target : monitor or imported image
                            </div>
                        </div>
                    </div>
                }
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
                            onClick={() => setMenuPinned(v => !v)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${menuPinned ? "bg-blue-600" : "bg-slate-600"
                                }`}
                            aria-pressed={menuPinned}
                            title="keep menu open"
                        >
                            <span
                                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${menuPinned ? "translate-x-5" : "translate-x-1"
                                    }`}
                            />
                        </button>
                    </label>
                </div>
                { }
                <label className="flex items-center m-0 text-xs">
                    Pen
                </label>
                <div className="px-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            onClick={() => {
                                appState.setTool("measure");
                                closeMenuIfNeeded();
                            }}
                            className={`rounded-lg border px-3 py-1 text-sm shadow transition
                                ${uAppState.tool === "measure"
                                    ? "border-sky-400 bg-sky-700 text-white"
                                    : "border-slate-500 bg-slate-800 text-white hover:bg-slate-700"}`}
                        >
                            Measure
                        </button>

                        <button
                            onClick={() => {
                                appState.setTool("draw");
                                closeMenuIfNeeded();
                            }}
                            className={`rounded-lg border px-3 py-1 text-sm shadow transition
                                ${uAppState.tool === "draw"
                                    ? "border-sky-400 bg-sky-700 text-white"
                                    : "border-slate-500 bg-slate-800 text-white hover:bg-slate-700"}`}
                        >
                            Draw
                        </button>

                        <button
                            onClick={() => {
                                appState.setTool("capture");
                                closeMenuIfNeeded();
                            }}
                            className={`rounded-lg border px-3 py-1 text-sm shadow transition
                                ${uAppState.tool === "capture"
                                    ? "border-sky-400 bg-sky-700 text-white"
                                    : "border-slate-500 bg-slate-800 text-white hover:bg-slate-700"}`}
                        >
                            Caputure
                        </button>

                        <button
                            onClick={() => {
                                appState.setTool("color");
                                closeMenuIfNeeded();
                            }}
                            className={`rounded-lg border px-3 py-1 text-sm shadow transition
                                ${uAppState.tool === "color"
                                    ? "border-sky-400 bg-sky-700 text-white"
                                    : "border-slate-500 bg-slate-800 text-white hover:bg-slate-700"}`}
                        >
                            Color
                        </button>
                    </div>
                </div>

                <label className="flex items-center m-0 text-xs">
                    Grid
                </label>
                <div className="px-3">
                    <div className="toolbar-row">
                        <label className="flex items-center gap-1.5 text-xs">
                            color
                            <input
                                id="color"
                                type="color"
                                value="#00ff88"
                                onChange={() => {
                                    const color = document.getElementById("color") as HTMLInputElement;
                                    appState.getState().color = color.value;
                                    if (props.onChangeState) {
                                        props.onChangeState();
                                    }
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
                </div>

                <label className="flex items-center m-0 text-xs">
                    Import
                </label>
                <div className="px-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            onClick={handleImportImage}
                            className="rounded-lg border px-3 py-1 text-sm shadow transition border-slate-500 bg-slate-800 text-white hover:bg-slate-700"
                        >
                            Image
                        </button>

                        <button
                            onClick={handleClearImage}
                            className="rounded-lg border px-3 py-1 text-sm shadow transition border-slate-500 bg-slate-800 text-white hover:bg-slate-700"
                        >
                            Clear
                        </button>
                    </div>
                </div>

                <label className="flex items-center m-0 text-xs">
                    Snapshot
                </label>
                <div className="px-3">
                    <div></div>
                </div>

                <label className="flex items-center m-0 text-xs">
                    Color Check
                </label>
                <div className="px-3">
                    <button
                        onClick={() => {
                            props.appColorAnalysisRef?.current?.setVisible(false)
                            closeMenuIfNeeded();
                        }}
                        className={`rounded-lg border px-3 py-1 text-sm shadow transition
                                ${false
                                ? "border-sky-400 bg-sky-700 text-white"
                                : "border-slate-500 bg-slate-800 text-white hover:bg-slate-700"}`}
                    >
                        Clear
                    </button>
                </div>

                {
                    !isPwaDistributionLocation() && !isTauri()&& <>
                        <label className="flex items-center m-0 text-xs">
                            PWA
                        </label>
                        <div className="px-3">
                            <button
                                onClick={() => {
                                    window.open(PWA_URL, "_blank", "noopener,noreferrer");
                                }}
                                className={`rounded-lg border px-3 py-1 text-sm shadow transition
                                ${false
                                        ? "border-sky-400 bg-sky-700 text-white"
                                        : "border-slate-500 bg-slate-800 text-white hover:bg-slate-700"}`}
                            >
                                Open PWA Page
                            </button>
                        </div>
                    </>

                }

            </div>

            {!hasBackgroundImage && !isTauri() && (
                <div className="fixed inset-0 z-[99998] flex items-center justify-center pointer-events-none">
                    <div className="pointer-events-auto flex flex-col items-center gap-3 rounded-2xl border border-slate-700 bg-slate-900/85 px-6 py-5 text-white shadow-2xl backdrop-blur">
                        <div className="text-center">
                            <div className="text-base font-semibold">Import Image</div>
                            <div className="mt-1 text-sm text-slate-300">
                                Please import an image to start in browser mode
                            </div>
                        </div>

                        <button
                            onClick={handleImportImage}
                            className="rounded-xl border border-sky-400 bg-sky-700 px-5 py-2 text-sm font-medium text-white shadow transition hover:bg-sky-600"
                        >
                            Import Image
                        </button>
                    </div>
                </div>
            )}

        </>
    );
}