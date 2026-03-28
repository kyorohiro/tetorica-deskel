use serde::Serialize;
use std::collections::HashMap;

use crate::color_pallet::build_palette_from_capture;

pub fn rgb_to_hsl_hsv(r: u8, g: u8, b: u8) -> (f32, f32, f32, f32, f32) {
    let r = r as f32 / 255.0;
    let g = g as f32 / 255.0;
    let b = b as f32 / 255.0;

    let max = r.max(g).max(b);
    let min = r.min(g).min(b);
    let delta = max - min;

    let lightness = (max + min) / 2.0;
    let value = max;

    let hue = if delta == 0.0 {
        0.0
    } else if max == r {
        60.0 * (((g - b) / delta).rem_euclid(6.0))
    } else if max == g {
        60.0 * (((b - r) / delta) + 2.0)
    } else {
        60.0 * (((r - g) / delta) + 4.0)
    };

    let hsl_saturation = if delta == 0.0 {
        0.0
    } else {
        delta / (1.0 - (2.0 * lightness - 1.0).abs())
    };

    let hsv_saturation = if max == 0.0 { 0.0 } else { delta / max };

    let hue_angle = hue;

    (hue, hsl_saturation, lightness, hsv_saturation, value)
}

#[derive(Debug, Serialize)]
pub struct ColorCount {
    pub r: u8,
    pub g: u8,
    pub b: u8,
    pub hex: String,
    pub count: u32,
    pub ratio: f32,
    pub hue: f32,            // 0..360
    pub hue_angle: f32,      // 色相環用
    pub hsl_saturation: f32, // 0..1
    pub lightness: f32,      // 0..1
    pub hsv_saturation: f32, // 0..1
    pub value: f32,          // 0..1
}

#[derive(Debug, Serialize)]
pub struct ColorAnalysisResult {
    width: u32,
    height: u32,
    total_pixels: u32,
    colors: Vec<ColorCount>,
    colors01: Vec<ColorCount>,
}

pub fn quantize(v: u8, step: u8) -> u8 {
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
    println!("> analyze_region_colors_sync");

    let capture_result = crate::screen_capture::capture_and_crop(x, y, width, height)?;
    let image = &capture_result.image;

    let step = quantize_step.max(1);

    // 量子化後のグループ -> その中に含まれる元色の出現回数
    let mut groups: HashMap<(u8, u8, u8), HashMap<(u8, u8, u8), u32>> = HashMap::new();

    for pixel in image.pixels() {
        let [r, g, b, a] = pixel.0;

        if a == 0 {
            continue;
        }

        let q = (quantize(r, step), quantize(g, step), quantize(b, step));

        let original = (r, g, b);

        let entry = groups.entry(q).or_insert_with(HashMap::new);
        *entry.entry(original).or_insert(0) += 1;
    }

    // 各グループから代表色を1つ選ぶ
    let mut palette_items: Vec<((u8, u8, u8), u32)> = Vec::new();

    for (_quantized_key, original_counts) in groups {
        let mut total_count = 0u32;
        let mut representative_color = (0u8, 0u8, 0u8);
        let mut representative_count = 0u32;

        for (original_color, count) in original_counts {
            total_count += count;

            // 最頻出の元色を代表色にする
            if count > representative_count {
                representative_color = original_color;
                representative_count = count;
            }
        }

        palette_items.push((representative_color, total_count));
    }

    // グループ全体の出現数で多い順に並べる
    palette_items.sort_by(|a, b| b.1.cmp(&a.1));
    palette_items.truncate(top_n);

    let total_pixels: u32 = palette_items.iter().map(|(_, count)| *count).sum();

    let colors: Vec<ColorCount> = palette_items
        .into_iter()
        .map(|((r, g, b), count)| {
            let (hue, hsl_saturation, lightness, hsv_saturation, value) = rgb_to_hsl_hsv(r, g, b);

            ColorCount {
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
                hue,
                hue_angle: hue,
                hsl_saturation,
                lightness,
                hsv_saturation,
                value,
            }
        })
        .collect();
    //
    let palette = build_palette_from_capture(
        &capture_result,
        16,   // quantize_step
        3,    // 各セル上位3色
        20,   // 最終パレット10色
        22.0, // RGB距離のマージ閾値
        8
    )?;

    Ok(ColorAnalysisResult {
        width: capture_result.crop_width,
        height: capture_result.crop_height,
        total_pixels,
        colors,
        colors01: palette,
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
    println!(
        "> analyze_region_colors {} {} {} {} {:?} {:?}",
        x, y, width, height, quantize_step, top_n
    );
    let quantize_step = quantize_step.unwrap_or(32);
    let top_n = top_n.unwrap_or(16);

    let result = tokio::task::spawn_blocking(move || {
        analyze_region_colors_sync(x, y, width, height, quantize_step, top_n)
    })
    .await
    .map_err(|e| format!("Background task failed: {e}"))??;

    Ok(result)
}
