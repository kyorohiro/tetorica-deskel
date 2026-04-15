import type { SaveDialogOptions } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import type { Platform } from "@tauri-apps/plugin-os";

function isTauri() {
    return ("__TAURI_INTERNALS__" in window);
}

async function getAppWindow() {
    // PWA / 通常ブラウザでは Tauri API を触らない
    if (!("__TAURI_INTERNALS__" in window)) {
        return null;
    }

    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    return getCurrentWindow();
}

async function getTaurPlatformInfo(): Promise<Platform | null> {
    // PWA / 通常ブラウザでは Tauri API を触らない
    if (!("__TAURI_INTERNALS__" in window)) {
        return null;
    }
    const { platform } = await import("@tauri-apps/plugin-os");
    const p = await platform();
    return p;
}

async function saveDialog(options?: SaveDialogOptions): Promise<string | null> {
    // PWA / 通常ブラウザでは Tauri API を触らない
    if (!("__TAURI_INTERNALS__" in window)) {
        return null;
    }
    const { save } = await import("@tauri-apps/plugin-dialog");
    return await save(options);
}

async function writeFileForNative(path: string | URL, data: Uint8Array | ReadableStream<Uint8Array>) {
    await writeFile(path,  data);
}

export {
    getAppWindow,
    getTaurPlatformInfo,
    isTauri,
    saveDialog,
    writeFileForNative
}