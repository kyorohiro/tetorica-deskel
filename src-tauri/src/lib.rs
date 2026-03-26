use serde::Serialize;
use std::collections::HashMap;
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
    path: &str,
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

    let mut path = path.to_string();
    if path == "" {
        let _path = app
            .path()
            .download_dir()
            .map_err(|e| e.to_string())?
            .join(format!(
                "deskel-crop-{}.png",
                chrono::Local::now().timestamp_millis()
            ));
        path = _path.to_string_lossy().to_string();
        //path = _path.to_string_lossy().to_string().as_str();
    }

    println!(">> path {}", path);
    image.save(&path).map_err(|e| e.to_string())?;

    println!("capture req x={}, y={}, w={}, h={}", x, y, width, height);
    println!("monitor w={}, h={}", monitor_width, monitor_height);
    println!(
        "local_x={}, local_y={}, crop_w={}, crop_h={}",
        local_x, local_y, crop_width, crop_height
    );
    Ok(path.to_string())
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

// color analysis

#[derive(Debug, Serialize)]
struct ColorCount {
    r: u8,
    g: u8,
    b: u8,
    hex: String,
    count: u32,
    ratio: f32,
}

#[derive(Debug, Serialize)]
struct ColorAnalysisResult {
    width: u32,
    height: u32,
    total_pixels: u32,
    colors: Vec<ColorCount>,
}

fn quantize(v: u8, step: u8) -> u8 {
    if step <= 1 {
        return v;
    }
    (v / step) * step
}

fn analyze_region_colors_sync(
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    quantize_step: u8,
    top_n: usize,
) -> Result<ColorAnalysisResult, String> {
    let monitors = Monitor::all().map_err(|e| e.to_string())?;

    let monitor = monitors
        .into_iter()
        .find(|m| m.is_primary().unwrap_or(false))
        .ok_or("No primary monitor found".to_string())?;

    let monitor_width = monitor.width().map_err(|e| e.to_string())?;
    let monitor_height = monitor.height().map_err(|e| e.to_string())?;

    let local_x = if x < 0 { 0 } else { x as u32 };
    let local_y = if y < 0 { 0 } else { y as u32 };

    let crop_width = width.min(monitor_width.saturating_sub(local_x));
    let crop_height = height.min(monitor_height.saturating_sub(local_y));

    if crop_width == 0 || crop_height == 0 {
        return Err("Capture region is empty".to_string());
    }

    let image = monitor
        .capture_region(local_x, local_y, crop_width, crop_height)
        .map_err(|e| e.to_string())?;

    // let rgba = image.to_rgba8();

    let step = quantize_step; //.unwrap_or(32).max(1);
    let mut counts: HashMap<(u8, u8, u8), u32> = HashMap::new();
    for pixel in image.pixels() {
        let [r, g, b, _a] = pixel.0;
        let r = quantize(r, quantize_step);
        let g = quantize(g, quantize_step);
        let b = quantize(b, quantize_step);

        *counts.entry((r, g, b)).or_insert(0) += 1;

        if _a == 0 {
            continue;
        }

        let r = quantize(r, step);
        let g = quantize(g, step);
        let b = quantize(b, step);

        let [r, g, b, a] = pixel.0;

        if a == 0 {
            continue;
        }

        let r = quantize(r, quantize_step);
        let g = quantize(g, quantize_step);
        let b = quantize(b, quantize_step);

        *counts.entry((r, g, b)).or_insert(0) += 1;
    }

    let total_pixels: u32 = counts.values().copied().sum();

    let mut colors: Vec<ColorCount> = counts
        .into_iter()
        .map(|((r, g, b), count)| ColorCount {
            r,
            g,
            b,
            hex: format!("#{r:02x}{g:02x}{b:02x}"),
            count,
            ratio: if total_pixels == 0 {
                0.0
            } else {
                count as f32 / total_pixels as f32
            },
        })
        .collect();

    colors.sort_by(|a, b| b.count.cmp(&a.count));
    colors.truncate(top_n);

    Ok(ColorAnalysisResult {
        width: crop_width,
        height: crop_height,
        total_pixels,
        colors,
    })
}

#[tauri::command]
async fn analyze_region_colors(
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    quantize_step: Option<u8>,
    top_n: Option<usize>,
) -> Result<ColorAnalysisResult, String> {
    let quantize_step = quantize_step.unwrap_or(32);
    let top_n = top_n.unwrap_or(16);

    let result = tokio::task::spawn_blocking(move || {
        analyze_region_colors_sync(x, y, width, height, quantize_step, top_n)
    })
    .await
    .map_err(|e| format!("Background task failed: {e}"))??;

    Ok(result)
}
