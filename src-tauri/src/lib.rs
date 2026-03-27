mod screen_capture;
mod color_analysis;

use serde::Serialize;
use std::collections::HashMap;
use xcap::Monitor;

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
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            greet,
            capture_and_crop_to_downloads,
            analyze_region_colors
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
    return crate::color_analysis::analyze_region_colors(x, y, width, height, quantize_step, top_n).await;
}
