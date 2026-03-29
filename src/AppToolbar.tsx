import { useEffect, useState } from "react"
import { saveSettings, appState, useAppState } from "./state";
import { setAlwaysOnTop, setClickThrough } from "./window";
import { captureAndCropToDownloads } from "./screenshot";
import { save } from "@tauri-apps/plugin-dialog";
import { showToast } from "./toast";
import { useDialog } from "./useDialog";

export function AppToolbar(props: {
    onChangeState?: () => void
    onClickColorCheck?: () => void
    onClickClearColorCheck?: () => void
}) {
    //const [grid, setGrid] = useState(appState.getState().grid)
    //const [opacity, setOpacity] = useState(appState.getState().opacity)
    //const [rotation, setRotation] = useState(appState.getState().rotation)
    const [visible, setVisible] = useState(false)
    const uAppState = useAppState();

    //const [isCursor, setIsCursor] = useState(false);
    const dialog = useDialog();

    /*
    useEffect(() => {
        const onMove = (e: MouseEvent) => {
            const inHotArea = e.clientX < 180 && e.clientY < 120
            setVisible(inHotArea)
        }

        window.addEventListener("mousemove", onMove)
        return () => window.removeEventListener("mousemove", onMove)
    }, [])
    */
    const handleSnapshot = async () => {
        try {
            //await dialog.showConfirmDialog({
            //  title: "Save",
            //  body: "download folder"
            //})
            const filePath = await save({
                title: "画像を保存",
                defaultPath: "deskel-crop.png",
                filters: [
                    {
                        name: "PNG Image",
                        extensions: ["png"],
                    },
                ],
            })
            const path = await captureAndCropToDownloads({ path: filePath ?? undefined })
            showToast(`saved: ${path}`);
        } catch (e) {
            console.error(e)
            dialog.showConfirmDialog({
                title: "Error",
                body: `${String(e)}`
            })
        }
    }

    const handleColorCheck = async () => {
        try {
            if (props.onClickColorCheck) {
                props.onClickColorCheck();
            }
        } catch (e) {
            console.error(e)
            dialog.showConfirmDialog({
                title: "Error",
                body: `${String(e)}`
            })
        }
    }

    useEffect(() => {
        console.log(">> useEffect [grid, opacity]", [appState.getState()])
        saveSettings(appState.getState());
        if (props.onChangeState) {
            props.onChangeState();
        }
    }, [appState.getState()])
    return (
        <>
            <div className="absolute left-3 top-3 z-20 flex items-center gap-2">
                <button
                    onClick={() => setVisible(v => !v)}
                    className={`
                    rounded-lg bg-black/60 px-3 py-2 text-sm text-white
                    transition-opacity duration-200
                    ${!visible ? "opacity-100" : "opacity-0"}
                    `}
                >
                    menu
                </button>
                {
                    //menu shortcut
                }
                <div
                    onClick={() => setVisible(v => !v)}
                    className={`
                    rounded-lg bg-black/60 px-1 py-1 text-sm text-white
                    transition-opacity duration-200
                    flex items-center justify-center
                    ${!visible ? "opacity-80" : "opacity-0"}
                `}
                >
                    <label className="flex cursor-pointer flex-col items-center justify-center text-center">
                        <input
                            type="checkbox"
                            checked={uAppState.clickThrough}
                            className="peer sr-only"
                            onChange={async (e) => {
                                const next = e.target.checked
                                //appState.setAlwaysOnTop(next)
                                const info = await setClickThrough(next)
                                showToast(info);
                            }}
                        />
                        <div className="relative h-6 w-11 rounded-full bg-slate-600 transition-colors after:absolute after:start-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full" />
                        <span className="mt-0 text-sm text-white">
                            click through
                        </span>
                    </label>
                </div>
                <div
                    onClick={() => setVisible(v => !v)}
                    className={`
                    rounded-lg bg-black/60 px-1 py-1 text-sm text-white
                    transition-opacity duration-200
                    flex items-center justify-center
                    ${!visible ? "opacity-80" : "opacity-0"}
                `}
                >
                    <label className="flex cursor-pointer flex-col items-center justify-center text-center">
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
                        <span className="mt-0 text-sm text-white">
                            always on top
                        </span>
                    </label>
                </div>
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
            >
                <div className="flex flex-wrap items-center gap-[10px]">
                    <button
                        onClick={handleSnapshot}
                        className="rounded-lg border border-slate-500 bg-slate-800 px-3 py-2 text-sm text-white shadow hover:bg-slate-700 active:translate-y-px"
                    >capture</button>
                </div>
                <div>
                    <button
                        onClick={handleColorCheck}
                        className="rounded-lg border border-slate-500 bg-slate-800 px-3 py-2 text-sm text-white shadow hover:bg-slate-700 active:translate-y-px"
                    >color check</button>
                    <button
                        onClick={props.onClickClearColorCheck}
                        className="rounded-lg border border-slate-500 bg-slate-800 px-3 py-2 text-sm text-white shadow hover:bg-slate-700 active:translate-y-px"
                    >clear color check</button>

                </div>
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
        </>
    )
}