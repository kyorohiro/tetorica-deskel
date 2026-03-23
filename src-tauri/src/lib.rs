use tauri::Manager;
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
) -> Result<String, String> {
    let monitors = Monitor::all().map_err(|e| e.to_string())?;

    let monitor = monitors
        .into_iter()
        .find(|m| m.is_primary().unwrap_or(false))
        .ok_or("No primary monitor found".to_string())?;

    // 単一モニター前提:
    // Tauri 側の座標をそのまま monitor 内座標として使う
    let monitor_width = monitor.width().map_err(|e| e.to_string())?;
    let monitor_height = monitor.height().map_err(|e| e.to_string())?;
    let local_x = if x < 0 { 0 } else { x as u32 };
    let local_y = if y < 0 { 0 } else { y as u32 };
    let max_width = monitor_width.saturating_sub(local_x);
    let max_height = monitor_height.saturating_sub(local_y);

    let crop_width = width.min(max_width);
    let crop_height = height.min(max_height);
    let image = monitor
        .capture_region(local_x, local_y, crop_width, crop_height)
        .map_err(|e| e.to_string())?;

    let path = app
        .path()
        .download_dir()
        .map_err(|e| e.to_string())?
        .join(format!(
            "deskel-crop-{}.png",
            chrono::Local::now().timestamp_millis()
        ));

    image.save(&path).map_err(|e| e.to_string())?;

    println!("capture req x={}, y={}, w={}, h={}", x, y, width, height);
    println!("monitor w={}, h={}", monitor_width, monitor_height);
    println!(
        "local_x={}, local_y={}, crop_w={}, crop_h={}",
        local_x, local_y, crop_width, crop_height
    );
    Ok(path.to_string_lossy().to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .invoke_handler(tauri::generate_handler![greet])
        .invoke_handler(tauri::generate_handler![capture_and_crop_to_downloads])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
