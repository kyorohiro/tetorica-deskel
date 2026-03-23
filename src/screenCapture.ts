import { getCurrentWindow, monitorFromPoint } from "@tauri-apps/api/window"
import { downloadDir, join } from "@tauri-apps/api/path"
import { readFile, writeFile } from "@tauri-apps/plugin-fs"
import { getMonitorScreenshot } from "tauri-plugin-screenshots-api"

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

function canvasToBlob(
    canvas: HTMLCanvasElement,
    type = "image/png",
): Promise<Blob> {
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) resolve(blob)
            else reject(new Error("canvas.toBlob failed"))
        }, type)
    })
}

async function blobToUint8Array(blob: Blob): Promise<Uint8Array> {
    return new Uint8Array(await blob.arrayBuffer())
}

export async function captureAndCropToDownloads() {
    const appWindow = getCurrentWindow()

    const pos = await appWindow.outerPosition()
    const size = await appWindow.innerSize();// outerSize()
    //const scale = await appWindow.scaleFactor()
    //const monitor = await appWindow.currentMonitor()
    const centerX = pos.x + size.width / 2
    const centerY = pos.y + size.height / 2

    const monitor = await monitorFromPoint(centerX, centerY)
    if (!monitor) {
        throw new Error("current monitor not found")
    }

    // ウィンドウ座標を物理ピクセルへ
    const winX = Math.round(pos.x)
    const winY = Math.round(pos.y)
    const width = Math.round(size.width)
    const height = Math.round(size.height)

    // monitor screenshot は「そのモニターだけ」の画像なので、
    // crop 座標は monitor 左上基準に直す
    const monitorX = Math.round(monitor.position.x)
    const monitorY = Math.round(monitor.position.y)

    const cropX = winX - monitorX
    const cropY = winY - monitorY

    // ここは plugin の実際の型に合わせて調整
    // monitor.id を受ける実装なら monitor.id
    // monitor index を受ける実装なら 0 / 1 など
    const screenshotPath = await getMonitorScreenshot((monitor as any).id)

    // plugin が保存した PNG を読む
    const screenshotBytes = await readFile(screenshotPath)
    const screenBlob = new Blob([screenshotBytes], { type: "image/png" })
    const screenImg = await loadImageFromBlob(screenBlob)

    // crop
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height

    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("2d context not available")

    ctx.drawImage(
        screenImg,
        cropX,
        cropY,
        width,
        height,
        0,
        0,
        width,
        height,
    )

    // crop 後を Downloads に保存
    const croppedBlob = await canvasToBlob(canvas, "image/png")
    const bytes = await blobToUint8Array(croppedBlob)

    const dir = await downloadDir()
    const filename = `deskel-crop-${Date.now()}.png`
    const fullPath = await join(dir, filename)

    await writeFile(fullPath, bytes)

    return fullPath
}