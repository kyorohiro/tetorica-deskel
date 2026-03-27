use tauri::Manager;
use xcap::{image::RgbaImage, Monitor};

pub struct CaptureResult {
    pub image: RgbaImage,
    pub crop_width: u32,
    pub crop_height: u32,
}
pub fn capture_and_crop(x: i32, y: i32, width: u32, height: u32) -> Result<CaptureResult, String> {
    let monitors = Monitor::all().map_err(|e| e.to_string())?;

    let monitor = monitors
        .into_iter()
        .find(|m| m.is_primary().unwrap_or(false))
        .ok_or("No primary monitor found".to_string())?;

    let monitor_width = monitor.width().map_err(|e| e.to_string())?;
    let monitor_height = monitor.height().map_err(|e| e.to_string())?;

    let local_x = if x < 0 { 0 } else { x as u32 };
    let local_y = if y < 0 { 0 } else { y as u32 };

    let max_width = monitor_width.saturating_sub(local_x);
    let max_height = monitor_height.saturating_sub(local_y);

    let crop_width = width.min(max_width);
    let crop_height = height.min(max_height);

    if crop_width == 0 || crop_height == 0 {
        return Err("capture area is outside the monitor".to_string());
    }

    let image = monitor
        .capture_region(local_x, local_y, crop_width, crop_height)
        .map_err(|e| e.to_string())?;

    println!("capture req x={}, y={}, w={}, h={}", x, y, width, height);
    //println!("monitor w={}, h={}", monitor_width, monitor_height);
    println!(
        "local_x={}, local_y={}, crop_w={}, crop_h={}",
        local_x, local_y, crop_width, crop_height
    );
    return Ok(CaptureResult {
        image,
        crop_width,
        crop_height,
    })
}

pub fn capture_and_crop_to_downloads(
    app: tauri::AppHandle,
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    path: &str,
) -> Result<String, String> {
    let capture_result = capture_and_crop(x, y, width, height)?;

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
    capture_result.image.save(&path).map_err(|e| e.to_string())?;
    Ok(path.to_string())
}
