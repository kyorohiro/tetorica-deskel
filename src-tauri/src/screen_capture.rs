use tauri::Manager;
use xcap::{image::RgbaImage, Monitor};

pub struct CaptureResult {
    pub image: RgbaImage,
    pub crop_width: u32,
    pub crop_height: u32,
}
pub fn capture_and_crop(x: i32, y: i32, width: u32, height: u32) -> Result<CaptureResult, String> {
    let monitors = Monitor::all().map_err(|e| e.to_string())?;

    let req_left = x;
    let req_top = y;
    let req_right = x + width as i32;
    let req_bottom = y + height as i32;

    for monitor in monitors {
        let mx = monitor.x().map_err(|e| e.to_string())?;
        let my = monitor.y().map_err(|e| e.to_string())?;
        let mw = monitor.width().map_err(|e| e.to_string())? as i32;
        let mh = monitor.height().map_err(|e| e.to_string())? as i32;

        let m_left = mx;
        let m_top = my;
        let m_right = mx + mw;
        let m_bottom = my + mh;
        //

        // 要求矩形がこのモニターに完全に含まれているか
        let contains = req_left >= m_left
            && req_top >= m_top
            && req_right <= m_right
            && req_bottom <= m_bottom;

        if contains {
            let local_x = (req_left - m_left) as u32;
            let local_y = (req_top - m_top) as u32;

            let image = monitor
                .capture_region(local_x, local_y, width, height)
                .map_err(|e| e.to_string())?;

            println!("capture req x={}, y={}, w={}, h={}", x, y, width, height);
            println!(
                "monitor origin=({}, {}), local_x={}, local_y={}, crop_w={}, crop_h={}",
                mx, my, local_x, local_y, width, height
            );

            return Ok(CaptureResult {
                image,
                crop_width: width,
                crop_height: height,
            });
        }
    }

    Err("capture area is not fully contained in any monitor".to_string())
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
    capture_result
        .image
        .save(&path)
        .map_err(|e| e.to_string())?;
    Ok(path.to_string())
}
