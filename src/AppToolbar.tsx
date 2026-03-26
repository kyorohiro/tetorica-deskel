import { useEffect, useState } from "react"
import { saveSettings, state } from "./state";
import { toggleAlwaysOnTop, toggleClickCursorThrough } from "./window";
import { captureAndCropToAnaluze, captureAndCropToDownloads } from "./screenshot";
import { save } from "@tauri-apps/plugin-dialog";
import { useDialog } from "./useDialog";

export function AppToolbar(props: {
    onChangeState?: () => void
}) {
    const [grid, setGrid] = useState(state.grid)
    const [opacity, setOpacity] = useState(state.opacity)
    const [rotation, setRotation] = useState(state.rotation)
    const [captureStatus, setCaptureStatus] = useState("")
    const dialog = useDialog();

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
            await dialog.showConfirmDialog({
              title: "....",
              body: "now developping"
            })
            setCaptureStatus("capturing...")
            //const path = await testMonitorScreenshot();
            const r = await captureAndCropToAnaluze({})
            console.log(r);
            setCaptureStatus(`captured:`)
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
        if(props.onChangeState) {
            props.onChangeState();
        }
    }, [grid, opacity, rotation])
    return (
        <div id="toolbar">
            <div className="toolbar-row">
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
            <div>
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
            </div>
            <div><div>{captureStatus}</div></div>
            <div className="toolbar-row">
                <label>
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
            <label>
                grid
                <input
                    type="range"
                    min="20"
                    max="300"
                    value={grid}
                    onChange={(e) => setGrid(Number(e.target.value))}
                />
            </label>

            <label>
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

            <label>
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
    )
}