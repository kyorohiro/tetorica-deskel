import "./style.css";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  register,
  unregisterAll,
} from "@tauri-apps/plugin-global-shortcut";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) {
  throw new Error("#app not found");
}

app.innerHTML = `
  <div id="root">
    <div id="toolbar" data-tauri-drag-region>
      <button id="toggleClickCursor">cursor: off</button>
      <button id="togglePin">pin: off</button>
      <label>
        grid
        <input id="grid" type="range" min="20" max="300" value="80" />
      </label><br>
      <label>
        opacity
        <input id="opacity" type="range" min="0.05" max="1" step="0.05" value="0.7" />
      </label>

      <label>
        line
        <input id="lineWidth" type="range" min="1" max="6" step="1" value="1" />
      </label>

      <label>
        color
        <input id="color" type="color" value="#00ff88" />
      </label>
    </div>

    <canvas id="canvas"></canvas>
  </div>
`;

const win = getCurrentWindow();
const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const ctx = canvas.getContext("2d");
if (!ctx) {
  throw new Error("2D context not available");
}

const state = {
  grid: 80,
  opacity: 0.7,
  lineWidth: 1,
  color: "#00ff88",
  clickThrough: false,
  alwaysOnTop: false,
};

function hexToRgba(hex: string, alpha: number): string {
  const value = hex.replace("#", "");
  const n = Number.parseInt(value, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function resizeCanvas(): void {
  if (!ctx) {
    return;
  }
  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth;
  const h = window.innerHeight;

  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  draw();
}

function drawGrid(w: number, h: number): void {
  if (!ctx) {
    return;
  }
  ctx.strokeStyle = hexToRgba(state.color, state.opacity);
  ctx.lineWidth = state.lineWidth;

  for (let x = 0; x <= w; x += state.grid) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }

  for (let y = 0; y <= h; y += state.grid) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
}

function drawCross(w: number, h: number): void {
  if (!ctx) {
    return;
  }
  ctx.strokeStyle = hexToRgba(state.color, Math.min(1, state.opacity + 0.15));
  ctx.lineWidth = Math.max(2, state.lineWidth + 1);

  ctx.beginPath();
  ctx.moveTo(w / 2, 0);
  ctx.lineTo(w / 2, h);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(0, h / 2);
  ctx.lineTo(w, h / 2);
  ctx.stroke();
}

function draw(): void {
  if (!ctx) {
    return;
  }
  const w = window.innerWidth;
  const h = window.innerHeight;

  ctx.clearRect(0, 0, w, h);
  drawGrid(w, h);
  drawCross(w, h);
}

function bindUI(): void {
  const grid = document.getElementById("grid") as HTMLInputElement;
  const opacity = document.getElementById("opacity") as HTMLInputElement;
  const lineWidth = document.getElementById("lineWidth") as HTMLInputElement;
  const color = document.getElementById("color") as HTMLInputElement;
  const toggleClickCursor = document.getElementById("toggleClickCursor") as HTMLButtonElement;
  const togglePin = document.getElementById("togglePin") as HTMLButtonElement;

  grid.addEventListener("input", () => {
    state.grid = Number(grid.value);
    draw();
  });

  opacity.addEventListener("input", () => {
    state.opacity = Number(opacity.value);
    draw();
  });

  lineWidth.addEventListener("input", () => {
    state.lineWidth = Number(lineWidth.value);
    draw();
  });

  color.addEventListener("input", () => {
    state.color = color.value;
    draw();
  });

  toggleClickCursor.addEventListener("click", async () => {
    await toggleClickCursorThrough();
  });
  togglePin.addEventListener("click", async () => {
    await toggleAlwaysOnTop();
  });
  
}

//
// shortcut
//
async function setClickThrough(value: boolean): Promise<void> {
  console.log(">  setClickThrough ", value)
  state.clickThrough = value;
  await win.setIgnoreCursorEvents(value);
  if(value) {
    await setAlwaysOnTop(value);
  }

  const btn = document.getElementById("toggleClickCursor") as HTMLButtonElement | null;
  if (btn) {
    btn.textContent = `click: ${value ? "on" : "off"}`;
  }
}

async function setAlwaysOnTop(value: boolean): Promise<void> {
  console.log(">  setAlwaysOnTop ", value);
  state.alwaysOnTop = value;
  await win.setAlwaysOnTop(value);

  const btn = document.getElementById("togglePin") as HTMLButtonElement | null;
  if (btn) {
    btn.textContent = `pin: ${value ? "on" : "off"}`;
  }
}

async function toggleAlwaysOnTop(): Promise<void> {
  await setAlwaysOnTop(!state.alwaysOnTop);
}

async function toggleClickCursorThrough(): Promise<void> {
  console.log("> toggleClickCursorThrough ", state.clickThrough)
  await setClickThrough(!state.clickThrough);
}

async function setupShortcuts(): Promise<void> {
  await unregisterAll();

  await register("CommandOrControl+Shift+X", async (event) => {
    if (event.state === "Pressed") {
      await toggleClickCursorThrough();
    }
  });
}

//
async function init(): Promise<void> {
  bindUI();
  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();
  setupShortcuts();
}


void init();

//
// toolbar
//
const toolbar = document.getElementById('toolbar') as HTMLDivElement;

let hideTimer: number | undefined;

function showToolbar() {
  toolbar.classList.add('visible');

  if (hideTimer) {
    clearTimeout(hideTimer);
  }

  hideTimer = window.setTimeout(() => {
    if (!toolbar.matches(':hover')) {
      toolbar.classList.remove('visible');
    }
  }, 1500);
}

function hideToolbarSoon() {
  if (hideTimer) {
    clearTimeout(hideTimer);
  }

  hideTimer = window.setTimeout(() => {
    if (!toolbar.matches(':hover')) {
      toolbar.classList.remove('visible');
    }
  }, 800);
}

// 起動時に表示
showToolbar();

// 上端にカーソルが来たら表示
window.addEventListener('mousemove', (e) => {
  if (e.clientY <= 24) {
    showToolbar();
  }
});

// ツールバーに乗っている間は表示維持
toolbar.addEventListener('mouseenter', () => {
  if (hideTimer) {
    clearTimeout(hideTimer);
  }
  toolbar.classList.add('visible');
});

toolbar.addEventListener('mouseleave', () => {
  hideToolbarSoon();
});