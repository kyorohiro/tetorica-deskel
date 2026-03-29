import { useEffect, useState } from "react"
import { saveSettings, state } from "./state";
import { toggleAlwaysOnTop, toggleClickCursorThrough } from "./window";
import { captureAndCropToDownloads } from "./screenshot";
import { save } from "@tauri-apps/plugin-dialog";
//import { useDialog } from "./useDialog";

export function AppToolbar(props: {
    onChangeState?: () => void
    onClickColorCheck?: () => void
    onClickClearColorCheck?: () => void
}) {
    const [grid, setGrid] = useState(state.grid)
    const [opacity, setOpacity] = useState(state.opacity)
    const [rotation, setRotation] = useState(state.rotation)
    const [captureStatus, setCaptureStatus] = useState("")
    const [visible, setVisible] = useState(false)
    //const dialog = useDialog();

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
            setCaptureStatus("capturing...")
            //const path = await testMonitorScreenshot();
            const path = await captureAndCropToDownloads({ path: filePath ?? undefined })
            setCaptureStatus(`saved: ${path}`)
        } catch (e) {
            console.error(e)
            setCaptureStatus(`error: ${String(e)}`)
        }
    }

    const handleColorCheck = async () => {
        try {
            //await dialog.showConfirmDialog({
            //    title: "....",
            //    body: "now developping"
            //})
            setCaptureStatus("capturing...")
            //const path = await testMonitorScreenshot();

            //console.log(r);

            setCaptureStatus(`color checked:`)
            if (props.onClickColorCheck) {
                props.onClickColorCheck();
            }
        } catch (e) {
            console.error(e)
            setCaptureStatus(`error: ${String(e)}`)
        }
    }

    useEffect(() => {
        console.log(">> useEffect [grid, opacity]", [grid, opacity])
        state.grid = grid;
        state.opacity = opacity;
        state.rotation = rotation
        saveSettings();
        if (props.onChangeState) {
            props.onChangeState();
        }
    }, [grid, opacity, rotation])
    return (
        <>
            <button
                onClick={() => setVisible(v => !v)}
                className={`
                    absolute left-3 top-3 z-20 rounded-lg bg-black/60 px-3 py-2 text-sm text-white
                    ${!visible ? "opacity-100" : "opacity-0"}`}
            >
                menu
            </button>

            <div
                id="toolbar"
                className={`
                    absolute left-3 top-[22px] z-10
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
                        id="toggleClickCursor"
                        onClick={toggleClickCursorThrough}
                        className="rounded-lg border border-slate-500 bg-slate-800 px-3 py-2 text-sm text-white shadow hover:bg-slate-700 active:translate-y-px"
                    >cursor: off</button>
                    <button
                        id="togglePin"
                        onClick={toggleAlwaysOnTop}
                        className="rounded-lg border border-slate-500 bg-slate-800 px-3 py-2 text-sm text-white shadow hover:bg-slate-700 active:translate-y-px"
                    >pin: off</button>

                </div>
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
                <div><div>{captureStatus}</div></div>
                <div className="toolbar-row">
                    <label className="flex items-center gap-1.5 text-xs">
                        color
                        <input id="color" type="color" value="#00ff88" onChange={() => {
                            const color = document.getElementById("color") as HTMLInputElement;
                            state.color = color.value;
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
                        value={grid}
                        onChange={(e) => setGrid(Number(e.target.value))}
                    />
                </label>

                <label className="flex items-center gap-1.5 text-xs">
                    opacity
                    <input
                        type="range"
                        min="0.05"
                        max="1"
                        step="0.05"
                        value={opacity}
                        onChange={(e) => setOpacity(Number(e.target.value))}
                    />
                </label>

                <label className="flex items-center gap-1.5 text-xs">
                    rotation
                    <input
                        type="range"
                        min="-180"
                        max="180"
                        value={rotation}
                        onChange={(e) => setRotation(Number(e.target.value))}
                    />
                </label>
            </div>
        </>
    )
}