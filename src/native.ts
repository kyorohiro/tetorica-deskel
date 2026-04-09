async function getAppWindow() {
  // PWA / 通常ブラウザでは Tauri API を触らない
  if (!("__TAURI_INTERNALS__" in window)) {
    return null;
  }

  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  return getCurrentWindow();
}

export {
    getAppWindow
}