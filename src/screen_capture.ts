import { getCurrentWindow } from "@tauri-apps/api/window"
import { downloadDir, join } from "@tauri-apps/api/path"
import { writeFile } from "@tauri-apps/plugin-fs"
// あなたの今の実装に合わせる
import { captureScreen } from "@tauri-apps/api/screen"

function blobToUint8Array(blob: Blob): Promise<Uint8Array> {
  return blob.arrayBuffer().then((buf) => new Uint8Array(buf))
}

function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = (e) => {
      URL.revokeObjectURL(url)
      reject(e)
    }
    img.src = url
  })
}

function canvasToBlob(canvas: HTMLCanvasElement, type = "image/png"): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error("canvas.toBlob failed"))
    }, type)
  })
}

export async function captureAndCropToDownloads() {
  const appWindow = getCurrentWindow()

  // 論理座標
  const pos = await appWindow.outerPosition()
  const size = await appWindow.outerSize()
  const scale = await appWindow.scaleFactor()

  // 物理ピクセル座標へ
  const x = Math.round(pos.x * scale)
  const y = Math.round(pos.y * scale)
  const width = Math.round(size.width * scale)
  const height = Math.round(size.height * scale)

  // 画面全体キャプチャ
  const captured = await captureScreen()

  // ここは captureScreen の返り値に合わせて調整
  const screenBlob =
    captured instanceof Blob
      ? captured
      : new Blob([captured], { type: "image/png" })

  const screenImg = await loadImageFromBlob(screenBlob)

  // crop
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("2d context not available")

  ctx.drawImage(
    screenImg,
    x, y, width, height,
    0, 0, width, height
  )

  // PNG化
  const croppedBlob = await canvasToBlob(canvas, "image/png")
  const bytes = await blobToUint8Array(croppedBlob)

  // Downloads に保存
  const dir = await downloadDir()
  const filename = `deskel-crop-${Date.now()}.png`
  const fullPath = await join(dir, filename)

  await writeFile(fullPath, bytes)

  return fullPath
}