import { getCurrentWindow } from "@tauri-apps/api/window";
import { state } from "./state";
import { TOGGLE_CLICK_SHORTCUT } from "./shortcut";
import { showToolbar, hideToolbarSoon } from "./toolbar";

const win = getCurrentWindow();
function updateWindowTitle(): void {
  console.log("> updateWindowTitle", state.clickThrough);
  const title = state.clickThrough
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
  state.alwaysOnTop = value;
  await win.setAlwaysOnTop(value);

  const btn = document.getElementById("togglePin") as HTMLButtonElement | null;
  if (btn) {
    btn.textContent = `pin: ${value ? "on" : "off"}`;
  }
}

async function toggleAlwaysOnTop(): Promise<void> {
  console.log("> toggleAlwaysOnTop", state.alwaysOnTop);
  await setAlwaysOnTop(!state.alwaysOnTop);
}

async function setClickThrough(value: boolean): Promise<void> {
  console.log(">  setClickThrough ", value)
  state.clickThrough = value;
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
  console.log("> toggleClickCursorThrough ", state.clickThrough)
  await setClickThrough(!state.clickThrough);
}
export {
    updateWindowTitle,
    toggleAlwaysOnTop,
    setClickThrough,
    toggleClickCursorThrough
}
