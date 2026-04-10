import { RefObject, useEffect, useState } from "react"
import { saveSettings, appState, useAppState } from "./state";
import { setAlwaysOnTop, setClickThrough } from "./window";
import { showToast } from "./toast";
import { Menu, MousePointerClick, Pin, Image,  Monitor} from "lucide-react";
import { isTauri } from "./native";
import { useDialog } from "./useDialog";
import { AppBackgroundImageCanvasHandle } from "./AppBackgroundImageCanvas";

export function AppToolbar(props: {
    onChangeState?: () => void
    appBackgroundImageCanvasRef: RefObject<AppBackgroundImageCanvasHandle | null>;
}) {
    const [visible, setVisible] = useState(false)
    const uAppState = useAppState();
    const dialog = useDialog();

    useEffect(() => {
        console.log(">> useEffect [grid, opacity]", [appState.getState()])
        saveSettings(appState.getState());
        if (props.onChangeState) {
            props.onChangeState();
        }
    }, [appState.getState()])
    return (
        <>
            <div className="absolute left-3 top-1 z-20 flex items-center gap-2" style={{ zIndex: 99999 }}>
                <button
                    onClick={() => setVisible(v => !v)}
                    className={`
                    rounded-lg bg-black/60 px-3 py-2 text-sm text-white
                    transition-opacity duration-200
                    opacity-80"
                    `}
                >
                    <Menu size={12} />
                </button>
                {
                    // ${!visible ? "opacity-100" : "opacity-0"}
                    //menu shortcut
                }
                {
                    // click through -
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

                            <div
                                className="
                                pointer-events-none absolute left-1/2 top-full z-50 mt-2
                                -translate-x-1/2 whitespace-nowrap rounded bg-slate-900
                                px-2 py-1 text-xs text-white opacity-0 shadow-md
                                transition-opacity group-hover:opacity-100
                            "
                            >
                                click through
                            </div>
                        </div>
                    </div>
                }
                {
                    // -click through
                }
                {
                    // always on top -
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
                                        const next = e.target.checked
                                        //appState.setAlwaysOnTop(next)
                                        await setAlwaysOnTop(next);
                                    }}
                                />

                                <span className="inline-flex">
                                    <Pin size={12} />
                                </span>

                                <div className="relative h-6 w-11 rounded-full bg-slate-600 transition-colors after:absolute after:start-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full" />
                            </label>

                            <div
                                className="
                                pointer-events-none absolute left-1/2 top-full z-50 mt-2
                                -translate-x-1/2 whitespace-nowrap rounded bg-slate-900
                                px-2 py-1 text-xs text-white opacity-0 shadow-md
                                transition-opacity group-hover:opacity-100
                            "
                            >
                                always on top
                            </div>
                        </div>
                    </div>
                }
                {
                    // -always on top
                }
                {
                    // target image or screen-
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
                                    checked={uAppState.alwaysOnTop}
                                    className="peer sr-only"
                                    onChange={async (e) => {
                                        const next = e.target.checked
                                        //appState.setAlwaysOnTop(next)
                                        await setAlwaysOnTop(next);
                                    }}
                                />
                                <div className="relative h-6 w-11 rounded-full bg-slate-600 transition-colors after:absolute after:start-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full" />

                                <span className="inline-flex">
                                    <Monitor size={12} />
                                </span>

                            </label>

                            <div
                                className="
                                pointer-events-none absolute left-1/2 top-full z-50 mt-2
                                -translate-x-1/2 whitespace-nowrap rounded bg-slate-900
                                px-2 py-1 text-xs text-white opacity-0 shadow-md
                                transition-opacity group-hover:opacity-100
                            "
                            >
                                analusis target : monitor or imported image
                            </div>
                        </div>
                    </div>
                }
                {
                    // -target image or screen
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
                <label className="flex items-center m-0 text-xs">
                    Pen
                </label>
                <div className="px-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            onClick={() => {
                                appState.setTool("measure")
                                setVisible(false);
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
                                appState.setTool("draw")
                                setVisible(false);
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
                                appState.setTool("capture")
                                setVisible(false);
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
                                appState.setTool("color")
                                setVisible(false);
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
                            <input id="color" type="color" value="#00ff88" onChange={() => {
                                const color = document.getElementById("color") as HTMLInputElement;
                                appState.getState().color = color.value;
                                if (props.onChangeState) {
                                    props.onChangeState();
                                }
                            }} />
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
                {
                    //
                }
                <label className="flex items-center m-0 text-xs">
                    Import
                </label>
                <div className="px-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            onClick={async () => {
                                console.log(">> showFileDlalog")
                                const ret = await dialog.showFileDialog({})
                                console.log(">> props.appBackgroundImageCanvasHandle", props.appBackgroundImageCanvasRef)
                                if (props.appBackgroundImageCanvasRef?.current) {
                                    console.log(">> ret?.files.length", ret?.files)
                                    if (ret?.files && ret?.files.length > 0) {
                                        props.appBackgroundImageCanvasRef.current.addImage(ret?.files[0]);
                                    }
                                }
                                console.log(ret);
                            }}
                            className={`rounded-lg border px-3 py-1 text-sm shadow transition
                                        ${uAppState.tool === "measure"
                                    ? "border-sky-400 bg-sky-700 text-white"
                                    : "border-slate-500 bg-slate-800 text-white hover:bg-slate-700"}`}
                        >
                            Image
                        </button>
                        <button
                            onClick={async () => {
                                console.log(">> Clear")
                                if (props.appBackgroundImageCanvasRef?.current) {
                                    props.appBackgroundImageCanvasRef.current.clear();

                                }
                            }}
                            className={`rounded-lg border px-3 py-1 text-sm shadow transition
                                        ${uAppState.tool === "measure"
                                    ? "border-sky-400 bg-sky-700 text-white"
                                    : "border-slate-500 bg-slate-800 text-white hover:bg-slate-700"}`}
                        >
                            Clear
                        </button>
                    </div>
                </div>
                <div className="px-3">
                    <div>
                    </div>
                </div>
                {
                    //
                }
                <label className="flex items-center m-0 text-xs">
                    Snapshot
                </label>
                <div className="px-3">
                    <div>
                    </div>
                </div>
                {
                    //
                }
                <label className="flex items-center m-0 text-xs">
                    Color Check
                </label>
                <div className="px-3">
                    <div>
                    </div>
                </div>
            </div>
        </>
    )
}