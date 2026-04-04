import { invoke } from "@tauri-apps/api/core";
//import { open } from '@tauri-apps/plugin-shell';

const hasPermission = async (): Promise<boolean> => {
    const hasPermission = await invoke<boolean>("check_screen_capture_permission");
    return hasPermission;
}

const openPrivacySettings = async () => {
  // 画面収録の設定画面を直接開くURLスキーム
  await await invoke("open_privacy_settings");
};


const canCaptureForeignWindow = async (): Promise<boolean> => {
  return await invoke<boolean>("can_capture_foreign_window");
};


type ProbeResult = {
  status: "granted" | "denied" | "indeterminate";
  checkedWindows: number;
};

async function probePermission(): Promise<ProbeResult> {
  return await invoke("probe_screen_capture_permission");
}
export {
    hasPermission,
    openPrivacySettings,
    canCaptureForeignWindow,
    probePermission
}