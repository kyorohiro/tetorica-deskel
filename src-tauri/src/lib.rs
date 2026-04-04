mod color_analysis;
mod color_pallet;
mod screen_capture;

#[cfg(target_os = "macos")]
use core_graphics::display::kCGNullWindowID;
#[cfg(target_os = "macos")]
use core_graphics::display::kCGWindowListOptionOnScreenOnly;
#[cfg(target_os = "macos")]
use core_graphics::display::CGWindowListCopyWindowInfo;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn capture_and_crop_to_downloads(
    app: tauri::AppHandle,
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    path: &str,
) -> Result<String, String> {
    return crate::screen_capture::capture_and_crop_to_downloads(app, x, y, width, height, path);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            greet,
            capture_and_crop_to_downloads,
            analyze_region_colors,
            check_screen_capture_permission,
            open_privacy_settings
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
async fn analyze_region_colors(
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    quantize_step: Option<u8>,
    top_n: Option<usize>,
) -> Result<crate::color_analysis::ColorAnalysisResult, String> {
    return crate::color_analysis::analyze_region_colors(x, y, width, height, quantize_step, top_n)
        .await;
}

#[tauri::command]
fn check_screen_capture_permission() -> bool {
    #[cfg(target_os = "macos")]
    {
        // 実際にウィンドウリストを取得しようとしてみる
        // 権限がない場合、ウィンドウ名などの詳細情報が取得できない仕様を利用します
        let window_list =
            unsafe { CGWindowListCopyWindowInfo(kCGWindowListOptionOnScreenOnly, kCGNullWindowID) };

        if window_list.is_null() {
            return false;
        }

        let count = unsafe { core_foundation::array::CFArrayGetCount(window_list) };

        // 権限がある場合、少なくとも1つ以上のウィンドウの詳細（名前など）が取れるはず
        // 権限がないと、自分のアプリ以外の情報は制限されます
        count > 0
    }

    #[cfg(not(target_os = "macos"))]
    true // Windowsなどはとりあえずtrue
}

#[tauri::command]
fn open_privacy_settings() {
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        // OSのコマンドを直接叩くので、TauriのURL制限を受けません
        let _ = Command::new("open")
            .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture")
            .spawn();
    }
}