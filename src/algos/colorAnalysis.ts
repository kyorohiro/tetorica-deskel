export type ColorCount = {
  r: number;
  g: number;
  b: number;
  hex: string;
  count: number;
  ratio: number;
  hue: number;
  hue_angle: number;
  hsl_saturation: number;
  lightness: number;
  hsv_saturation: number;
  value: number;
};

export type ColorAnalysisResult = {
  width: number;
  height: number;
  total_pixels: number;
  colors: ColorCount[];
  colors01: ColorCount[];
};

function rgbToHslHsv(r8: number, g8: number, b8: number): [number, number, number, number, number] {
  const r = r8 / 255;
  const g = g8 / 255;
  const b = b8 / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  const lightness = (max + min) / 2;
  const value = max;

  let hue = 0;
  if (delta === 0) {
    hue = 0;
  } else if (max === r) {
    hue = 60 * ((((g - b) / delta) % 6 + 6) % 6);
  } else if (max === g) {
    hue = 60 * (((b - r) / delta) + 2);
  } else {
    hue = 60 * (((r - g) / delta) + 4);
  }

  const hslSaturation =
    delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));

  const hsvSaturation = max === 0 ? 0 : delta / max;

  return [hue, hslSaturation, lightness, hsvSaturation, value];
}

function quantize(v: number, step: number): number {
  if (step <= 1) return v;
  return Math.floor(v / step) * step;
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

export function analyzeImageData(
  imageData: ImageData,
  quantizeStep = 32,
  topN = 16
): ColorAnalysisResult {
  const { data, width, height } = imageData;
  const step = Math.max(1, quantizeStep);

  // quantized rgb -> original rgb -> count
  const groups = new Map<string, Map<string, number>>();

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    const a = data[i + 3]!;

    if (a === 0) continue;

    const qr = quantize(r, step);
    const qg = quantize(g, step);
    const qb = quantize(b, step);

    const qKey = `${qr},${qg},${qb}`;
    const oKey = `${r},${g},${b}`;

    let originalCounts = groups.get(qKey);
    if (!originalCounts) {
      originalCounts = new Map<string, number>();
      groups.set(qKey, originalCounts);
    }

    originalCounts.set(oKey, (originalCounts.get(oKey) ?? 0) + 1);
  }

  const paletteItems: Array<{ r: number; g: number; b: number; count: number }> = [];

  for (const [, originalCounts] of groups) {
    let totalCount = 0;
    let representative = { r: 0, g: 0, b: 0 };
    let representativeCount = 0;

    for (const [oKey, count] of originalCounts) {
      totalCount += count;

      if (count > representativeCount) {
        representativeCount = count;
        const [r, g, b] = oKey.split(",").map((v) => Number(v));
        representative = { r, g, b };
      }
    }

    paletteItems.push({
      ...representative,
      count: totalCount,
    });
  }

  paletteItems.sort((a, b) => b.count - a.count);
  const truncated = paletteItems.slice(0, topN);
  const totalPixels = truncated.reduce((sum, item) => sum + item.count, 0);

  const colors: ColorCount[] = truncated.map((item) => {
    const [hue, hsl_saturation, lightness, hsv_saturation, value] = rgbToHslHsv(
      item.r,
      item.g,
      item.b
    );

    return {
      r: item.r,
      g: item.g,
      b: item.b,
      hex: rgbToHex(item.r, item.g, item.b),
      count: item.count,
      ratio: totalPixels === 0 ? 0 : item.count / totalPixels,
      hue,
      hue_angle: hue,
      hsl_saturation,
      lightness,
      hsv_saturation,
      value,
    };
  });

  return {
    width,
    height,
    total_pixels: totalPixels,
    colors,
    colors01: [], // 後で build_palette_from_capture 相当を移植
  };
}

export async function analyzeImageBlob(
  blob: Blob,
  quantizeStep = 32,
  topN = 16
): Promise<ColorAnalysisResult> {
  const bitmap = await createImageBitmap(blob);

  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to create 2D context");
  }

  ctx.drawImage(bitmap, 0, 0);
  const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);

  bitmap.close?.();

  return analyzeImageData(imageData, quantizeStep, topN);
}
