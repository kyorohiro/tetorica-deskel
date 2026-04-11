
import { ColorCount } from "./nativeScreenshot";
import { showToast } from "./toast";
import { createSwatchesFile } from "procreate-swatches";
import { saveDialog, writeFileForNative } from "./native";

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace("#", "").trim();
  const value =
    normalized.length === 3
      ? normalized.split("").map((c) => c + c).join("")
      : normalized;

  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);

  return [r, g, b];
}


async function exportProcreateSwatches(
  paletteName: string,
  colors: ColorCount[]
) {
  const limited = colors.slice(0, 30);

  const swatchColors = limited.map((color) => {
    const rgb = hexToRgb(color.hex);
    return [rgb, "rgb"] as const;
  });

  const data = await createSwatchesFile(
    paletteName,
    swatchColors,
    "uint8array"
  ) as Uint8Array;

  if ("__TAURI_INTERNALS__" in window) {
    const path = await saveDialog({
      title: "Save Procreate Palette",
      defaultPath: `${paletteName}.swatches`,
      filters: [{ name: "Procreate Swatches", extensions: ["swatches"] }],
    });

    if (!path) return;

    console.log("> data", data);
    await writeFileForNative(path, data);
    showToast(`> saved Procreate palette: ${path}`);
  } else {
    // Web / PWA fallback
    const blob = new Blob([data as any], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    try {
      const a = document.createElement("a");
      a.href = url;
      a.download = `${paletteName}.swatches`;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      a.remove();

      console.log("> downloaded png:", `${paletteName}.swatches`);
      showToast(`downloaded png: ${paletteName}.swatches`);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

async function exportPalettePng(colors: ColorCount[]) {
  const size = 1024;
  const padding = 32;
  const cols = Math.ceil(Math.sqrt(colors.length));
  //const rows = Math.ceil(colors.length / cols);
  const cell = Math.floor((size - padding * 2) / cols);

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get canvas context");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);

  colors.forEach((color, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = padding + col * cell;
    const y = padding + row * cell;

    ctx.fillStyle = color.hex;
    ctx.fillRect(x, y, cell, cell);
  });

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error("Failed to create PNG blob"));
    }, "image/png");
  });

  if ("__TAURI_INTERNALS__" in window) {
    const path = await saveDialog({
      title: "Save Palette PNG",
      defaultPath: "palette.png",
      filters: [{ name: "PNG Image", extensions: ["png"] }],
    });

    if (!path) return;

    const bytes = new Uint8Array(await blob.arrayBuffer());
    await writeFileForNative(path, bytes);

    console.log("> saved png:", path);
    showToast(`> saved png: ${path}`);
  } else {
    // Web / PWA fallback
    const url = URL.createObjectURL(blob);
    try {
      const a = document.createElement("a");
      a.href = url;
      a.download = "palette.png";
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      a.remove();

      console.log("> downloaded png:", "palette.png");
      showToast(`downloaded png: ${"palette.png"}`);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

async function exportPaletteCsv(colors: ColorCount[]) {
  const lines = [
    ["index", "hex", "ratio", "hue_angle", "hsv_saturation"].join(","),
    ...colors.map((color, index) =>
      [
        index + 1,
        color.hex,
        color.ratio,
        color.hue_angle,
        color.hsv_saturation,
      ].join(",")
    ),
  ];

  const csvText = lines.join("\n");
  if ("__TAURI_INTERNALS__" in window) {
    const path = await saveDialog({
      title: "Save Palette CSV",
      defaultPath: "palette.csv",
      filters: [{ name: "CSV", extensions: ["csv"] }],
    });

    if (!path) return;

    const bytes = new TextEncoder().encode(csvText);
    await writeFileForNative(path, bytes);

    console.log("> saved csv:", path);
    showToast(`> saved csv: ${path}`);
  } else {
    // Web / PWA fallback
    const blob = new Blob([csvText as any], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    try {
      const a = document.createElement("a");
      a.href = url;
      a.download = `palette.csv`;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      a.remove();

      console.log("> downloaded png:", `palette.csv`);
      showToast(`downloaded csv: palette.csv`);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

export {
    exportPaletteCsv, createSwatchesFile, exportPalettePng,exportProcreateSwatches, hexToRgb
}