import { getCurrentWindow } from "@tauri-apps/api/window";
import { appState } from "./state";
import { TOGGLE_CLICK_SHORTCUT } from "./shortcut";
import { showToolbar, hideToolbarSoon } from "./toolbar";

const win = getCurrentWindow();
function updateWindowTitle(): void {
  console.log("> updateWindowTitle", appState.getState().clickThrough);
  const title = appState.getState().clickThrough
    ? `Back to normal: ${TOGGLE_CLICK_SHORTCUT}`
    : "Tetorica Deskel";
  console.log(title);
  win.setTitle(title);
  const customTitleBar = document.getElementById("custom-title-bar-value")
  if (customTitleBar != null) {
    customTitleBar.textContent = title;
  }
}

async function setAlwaysOnTop(value: boolean): Promise<void> {
  console.log(">  setAlwaysOnTop ", value);
  appState.setAlwaysOnTop(value);
  await win.setAlwaysOnTop(value);

  const btn = document.getElementById("togglePin") as HTMLButtonElement | null;
  if (btn) {
    btn.textContent = `pin: ${value ? "on" : "off"}`;
  }
}

async function toggleAlwaysOnTop(): Promise<void> {
  console.log("> toggleAlwaysOnTop", appState.getState().alwaysOnTop);
  await setAlwaysOnTop(!appState.getState().alwaysOnTop);
}

async function setClickThrough(value: boolean): Promise<void> {
  console.log(">  setClickThrough ", value)
  appState.getState().clickThrough = value;
  await win.setIgnoreCursorEvents(value);
  if(value) {
    await setAlwaysOnTop(value);
  }

  const btn = document.getElementById("toggleClickCursor") as HTMLButtonElement | null;
  if (btn) {
    btn.textContent = `click: ${value ? "on" : "off"}`;
  }
  if(value) {
    hideToolbarSoon();
  } else {
    showToolbar();
  }
  updateWindowTitle();
}

async function toggleClickCursorThrough(): Promise<void> {
  console.log("> toggleClickCursorThrough ", appState.getState().clickThrough)
  await setClickThrough(!appState.getState().clickThrough);
}
export {
    updateWindowTitle,
    toggleAlwaysOnTop,
    setClickThrough,
    toggleClickCursorThrough,
    setAlwaysOnTop    
}
