use serde::Serialize;
use std::collections::HashMap;
use xcap::Monitor;


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
pub struct ColorAnalysisResult {
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

pub async fn analyze_region_colors(
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
