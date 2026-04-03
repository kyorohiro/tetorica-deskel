use std::collections::HashMap;
use xcap::image::RgbaImage;

use crate::color_analysis::{rgb_to_hsl_hsv, ColorCount};

#[derive(Debug, Clone)]
struct LocalColorCandidate {
    r: u8,
    g: u8,
    b: u8,
    count_in_cell: u32,
    ratio_in_cell: f32,
    cell_x: usize,
    cell_y: usize,
}

#[derive(Debug, Clone)]
struct MergedColorCluster {
    sum_r: f32,
    sum_g: f32,
    sum_b: f32,
    total_weight: f32,
    total_count: u32,
    cell_hits: u32,
    samples: Vec<LocalColorCandidate>,
}

/// 4x4分割 -> 各セル上位3色 -> 近い色をマージしてパレット化
pub fn build_palette_from_capture(
    capture: &crate::screen_capture::CaptureResult,
    quantize_step: u8,
    top_k_per_cell: usize,
    final_top_n: usize,
    merge_distance_threshold: f32,
    grid_size: usize,
) -> Result<Vec<ColorCount>, String> {
    let image = &capture.image;
    let width = capture.crop_width;
    let height = capture.crop_height;

    if width == 0 || height == 0 {
        return Ok(vec![]);
    }

    let grid_size = grid_size.max(1);
    let grid_cols = grid_size;
    let grid_rows = grid_size;
    let step = quantize_step.max(1);

    let mut candidates: Vec<LocalColorCandidate> = Vec::new();

    for gy in 0..grid_rows {
        for gx in 0..grid_cols {
            let x0 = (width as usize * gx) / grid_cols;
            let x1 = (width as usize * (gx + 1)) / grid_cols;
            let y0 = (height as usize * gy) / grid_rows;
            let y1 = (height as usize * (gy + 1)) / grid_rows;

            let local = extract_top_colors_from_cell(
                image,
                x0 as u32,
                y0 as u32,
                x1 as u32,
                y1 as u32,
                step,
                top_k_per_cell,
                gx,
                gy,
            );

            candidates.extend(local);
        }
    }

    if candidates.is_empty() {
        return Ok(vec![]);
    }

    let clusters = merge_local_candidates(&candidates, merge_distance_threshold);
    let total_weight: f32 = clusters.iter().map(cluster_score).sum();

    let mut colors: Vec<ColorCount> = clusters
        .into_iter()
        .map(|cluster| cluster_to_color_count(cluster, total_weight))
        .collect();

    colors.sort_by(|a, b| {
        b.count.cmp(&a.count).then_with(|| {
            b.ratio
                .partial_cmp(&a.ratio)
                .unwrap_or(std::cmp::Ordering::Equal)
        })
    });

    colors.truncate(final_top_n);

    Ok(colors)
}

/// セル単位で量子化し、上位色を取る
fn extract_top_colors_from_cell(
    image: &RgbaImage,
    x0: u32,
    y0: u32,
    x1: u32,
    y1: u32,
    quantize_step: u8,
    top_k: usize,
    cell_x: usize,
    cell_y: usize,
) -> Vec<LocalColorCandidate> {
    let mut counts: HashMap<(u8, u8, u8), u32> = HashMap::new();
    let mut total_pixels = 0u32;

    for y in y0..y1 {
        for x in x0..x1 {
            let pixel = image.get_pixel(x, y);
            let [r, g, b, a] = pixel.0;

            if a == 0 {
                continue;
            }

            total_pixels += 1;

            let qr = crate::color_analysis::quantize(r, quantize_step);
            let qg = crate::color_analysis::quantize(g, quantize_step);
            let qb = crate::color_analysis::quantize(b, quantize_step);

            *counts.entry((qr, qg, qb)).or_insert(0) += 1;
        }
    }

    if total_pixels == 0 {
        return vec![];
    }

    let mut items: Vec<((u8, u8, u8), u32)> = counts.into_iter().collect();
    items.sort_by(|a, b| b.1.cmp(&a.1));
    items.truncate(top_k);

    items
        .into_iter()
        .map(|((r, g, b), count)| LocalColorCandidate {
            r,
            g,
            b,
            count_in_cell: count,
            ratio_in_cell: count as f32 / total_pixels as f32,
            cell_x,
            cell_y,
        })
        .collect()
}

/// ローカル候補色を近い色ごとにまとめる
fn merge_local_candidates(
    candidates: &[LocalColorCandidate],
    threshold: f32,
) -> Vec<MergedColorCluster> {
    let mut clusters: Vec<MergedColorCluster> = Vec::new();

    for candidate in candidates {
        let mut merged = false;

        for cluster in &mut clusters {
            let center = cluster_center(cluster);
            let dist = color_distance_rgb(
                candidate.r as f32,
                candidate.g as f32,
                candidate.b as f32,
                center.0,
                center.1,
                center.2,
            );

            if dist <= threshold {
                let weight = candidate_weight(candidate);

                cluster.sum_r += candidate.r as f32 * weight;
                cluster.sum_g += candidate.g as f32 * weight;
                cluster.sum_b += candidate.b as f32 * weight;
                cluster.total_weight += weight;
                cluster.total_count += candidate.count_in_cell;
                cluster.cell_hits += 1;
                cluster.samples.push(candidate.clone());

                merged = true;
                break;
            }
        }

        if !merged {
            let weight = candidate_weight(candidate);
            clusters.push(MergedColorCluster {
                sum_r: candidate.r as f32 * weight,
                sum_g: candidate.g as f32 * weight,
                sum_b: candidate.b as f32 * weight,
                total_weight: weight,
                total_count: candidate.count_in_cell,
                cell_hits: 1,
                samples: vec![candidate.clone()],
            });
        }
    }

    clusters
}

/// candidate の重み
/// セル内での比率を重視しつつ、少し count も効かせる
fn candidate_weight(candidate: &LocalColorCandidate) -> f32 {
    candidate.ratio_in_cell * 100.0 + (candidate.count_in_cell as f32).sqrt()
}

/// クラスタ中心
fn cluster_center(cluster: &MergedColorCluster) -> (f32, f32, f32) {
    if cluster.total_weight <= 0.0 {
        return (0.0, 0.0, 0.0);
    }

    (
        cluster.sum_r / cluster.total_weight,
        cluster.sum_g / cluster.total_weight,
        cluster.sum_b / cluster.total_weight,
    )
}

/// RGB距離
fn color_distance_rgb(r1: f32, g1: f32, b1: f32, r2: f32, g2: f32, b2: f32) -> f32 {
    let dr = r1 - r2;
    let dg = g1 - g2;
    let db = b1 - b2;
    (dr * dr + dg * dg + db * db).sqrt()
}

/// クラスタのスコア
/// total_weight と cell_hits の両方を効かせる
fn cluster_score(cluster: &MergedColorCluster) -> f32 {
    cluster.total_weight + cluster.cell_hits as f32 * 8.0
}

/// クラスタから ColorCount を作る
fn cluster_to_color_count(cluster: MergedColorCluster, total_weight_all: f32) -> ColorCount {
    let center = cluster_center(&cluster);

    // クラスタ中心に最も近い実在サンプル色を代表色にする
    let mut best = cluster.samples[0].clone();
    let mut best_dist = f32::MAX;

    for sample in &cluster.samples {
        let dist = color_distance_rgb(
            sample.r as f32,
            sample.g as f32,
            sample.b as f32,
            center.0,
            center.1,
            center.2,
        );

        if dist < best_dist {
            best = sample.clone();
            best_dist = dist;
        }
    }

    let (hue, hsl_saturation, lightness, hsv_saturation, value) =
        rgb_to_hsl_hsv(best.r, best.g, best.b);

    let score = cluster_score(&cluster);
    let ratio = if total_weight_all <= 0.0 {
        0.0
    } else {
        score / total_weight_all
    };

    ColorCount {
        r: best.r,
        g: best.g,
        b: best.b,
        hex: format!("#{:02x}{:02x}{:02x}", best.r, best.g, best.b),
        count: cluster.total_count,
        ratio,
        hue,
        hue_angle: hue,
        hsl_saturation,
        lightness,
        hsv_saturation,
        value,
    }
}
