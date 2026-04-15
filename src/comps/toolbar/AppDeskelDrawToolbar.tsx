import {
    Pencil,
    Eraser,
    Palette,
    Undo2,
    Trash2,
    PenLine
} from "lucide-react";
import { SubToolbar } from "../../parts/AppDeskelToolbarParts";
import { Tool } from "../app/AppSimpleDrawCanvas";
import { ToolMode } from "../../state";

//const BG_COLOR = "#00000000";//"#111827";
//const DEFAULT_COLOR = "#00ff88";

function AppDeskelDrawToolbar(props: {
    color: string,
    setColor: (color:string) => Promise<void>,
    tool: Tool,
    setTool: (tool: Tool)=>Promise<void>
    drawToolbarOpen: boolean,
    setDrawToolbarOpen:((drawToolbarOpen:boolean)=>Promise<void>)
    toolMode: ToolMode
    undo: ()=>void
    hasUndo: boolean,
    clearAll: ()=>void,

}) {

    return (
        <SubToolbar open={props.drawToolbarOpen} onToggle={() => { props.setDrawToolbarOpen(!props.drawToolbarOpen) }} hidden={props.toolMode !== "draw"}>

            <button
                className={`rounded-2xl border px-2 py-1 m-0.5 text-xs  ${props.tool === "pen"
                    ? "border-emerald-500 bg-emerald-950 text-emerald-300"
                    : "border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"
                    }`}
                onClick={() => props.setTool("pen")}
                title="ペン"
                aria-label="ペン"
            >
                <Pencil size={12} />
            </button>
            <button
                className={`rounded-2xl border px-2 py-1 m-0.5 text-xs  ${props.tool === "line"
                    ? "border-emerald-500 bg-emerald-950 text-emerald-300"
                    : "border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"
                    }`}
                onClick={() => props.setTool("line")}
                title="line"
                aria-label="line"
            >
                <PenLine size={12} />
            </button>
            <button
                className={`rounded-2xl border px-2 py-1 m-0.5 text-xs  ${props.tool === "eraser"
                    ? "border-emerald-500 bg-emerald-950 text-emerald-300"
                    : "border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"
                    }`}
                onClick={() => props.setTool("eraser")}
                title="消しゴム"
                aria-label="消しゴム"
            >
                <Eraser size={12} />
            </button>

            <label
                className="flex items-center justify-center rounded-2xl border border-slate-700 bg-slate-950 px-2 py-1 m-0.5 text-xs "
                title="色"
                aria-label="色"
            >
                <div className="relative flex items-center justify-center">
                    <Palette size={18} className="pointer-events-none" color={props.color} />
                    <input
                        type="color"
                        value={props.color}
                        onChange={(e) => props.setColor(e.target.value)}
                        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    //disabled={tool === "eraser"}
                    />
                </div>
            </label>

            <button
                className="rounded-2xl border border-slate-700 bg-slate-900 px-2 py-1 m-0.5 text-xs  text-slate-100 hover:bg-slate-800 disabled:opacity-40"
                onClick={props.undo}
                disabled={!props.hasUndo}
                title="1つ戻す"
                aria-label="1つ戻す"
            >
                <Undo2 size={12} />
            </button>

            <button
                className="rounded-2xl border border-slate-700 bg-slate-900 px-2 py-1 m-0.5 text-xs  text-slate-100 hover:bg-slate-800"
                onClick={props.clearAll}
                title="クリア"
                aria-label="クリア"
            >
                <Trash2 size={12} />
            </button>
        </SubToolbar>
    );
}



export {
    AppDeskelDrawToolbar
}