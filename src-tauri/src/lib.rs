// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn capture_and_crop_to_downloads(x: i32, y: i32, width: u32, height: u32) -> Result<String, String> {
    println!("capture request: x={x}, y={y}, width={width}, height={height}");
    Ok("dummy-path".to_string())
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
