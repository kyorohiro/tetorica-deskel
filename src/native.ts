import type { Platform } from "@tauri-apps/plugin-os";
async function getAppWindow() {
    // PWA / 通常ブラウザでは Tauri API を触らない
    if (!("__TAURI_INTERNALS__" in window)) {
        return null;
    }

    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    return getCurrentWindow();
}

async function getTaurPlatformInfo(): Promise<Platform|null> {
    // PWA / 通常ブラウザでは Tauri API を触らない
    if (!("__TAURI_INTERNALS__" in window)) {
        return null;
    }
    const { platform } = await import("@tauri-apps/plugin-os");
    const p = await platform();
    return p;
}

export {
    getAppWindow,
    getTaurPlatformInfo
}