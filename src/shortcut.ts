import { showToast } from "./toast";
import { toggleClickCursorThrough } from "./window";
import {
  register,
  unregisterAll,
} from "@tauri-apps/plugin-global-shortcut";

const TOGGLE_CLICK_SHORTCUT = "CommandOrControl+Shift+J";

async function setupShortcuts(): Promise<void> {
  console.log("> setupShortcuts")
  await unregisterAll();
  await register(TOGGLE_CLICK_SHORTCUT, async (event) => {
    if (event.state === "Pressed") {
      await toggleClickCursorThrough();
      await showToast(`click-through: ${TOGGLE_CLICK_SHORTCUT}`);
    }
  });
}

export {
    TOGGLE_CLICK_SHORTCUT,
    setupShortcuts
}