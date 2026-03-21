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

const TOGGLE_CLICK_SHORTCUT = "CommandOrControl+Shift+J";

app.innerHTML = `
  <div id="root">
    <div id="toolbar" data-tauri-drag-region>
      <div class="toolbar-row">
        <button id="toggleClickCursor">cursor: off</button>
        <button id="togglePin">pin: off</button>
      </div>
      <div class="toolbar-row">
        <label>
          grid
          <input id="grid" type="range" min="20" max="300" value="80" />
        </label>

        <label>
          opacity
          <input id="opacity" type="range" min="0.05" max="1" step="0.05" value="0.7" />
        </label>
      </div>

      <div class="toolbar-row" id="morePanel" hidden>
        <label>
          line
          <input id="lineWidth" type="range" min="1" max="6" step="1" value="1" />
        </label>

        <label>
          color
          <input id="color" type="color" value="#00ff88" />
        </label>
      </div>
      <!--div class="toolbar-row">
        <button id="changeShortcut">shortcut</button>
      </div-->
    </div>

    <canvas id="canvas"></canvas>
  </div>
`;

const win = getCurrentWindow();
function updateWindowTitle(): void {
  console.log("> updateWindowTitle", state.clickThrough);
  const title = state.clickThrough
    ? `Back to normal: ${TOGGLE_CLICK_SHORTCUT}`
    : "Tetorica Deskel";
  console.log(title);
  void win.setTitle(title);
}

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const ctx = canvas.getContext("2d");
if (!ctx) {
  throw new Error("2D context not available");
}

type Settings = {
  grid: number;
  opacity: number;
  lineWidth: number;
  color: string;
};

const DEFAULT_SETTINGS: Settings = {
  grid: 80,
  opacity: 0.7,
  lineWidth: 1,
  color: "#00ff88",
};

const SETTINGS_KEY = "tetorica-deskel-settings";


const saved = loadSettings();
console.log("saved ", saved);

const state = {
  grid: saved.grid,
  opacity: saved.opacity,
  lineWidth: saved.lineWidth,
  color: saved.color,
  clickThrough: false,
  alwaysOnTop: false,
};

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      return DEFAULT_SETTINGS;
    }

    const parsed = JSON.parse(raw) as Partial<Settings>;

    return {
      grid: typeof parsed.grid === "number" ? parsed.grid : DEFAULT_SETTINGS.grid,
      opacity: typeof parsed.opacity === "number" ? parsed.opacity : DEFAULT_SETTINGS.opacity,
      lineWidth:
        typeof parsed.lineWidth === "number"
          ? parsed.lineWidth
          : DEFAULT_SETTINGS.lineWidth,
      color: typeof parsed.color === "string" ? parsed.color : DEFAULT_SETTINGS.color,
    };
  } catch (error) {
    console.error("failed to load settings", error);
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(): void {
  const settings: Settings = {
    grid: state.grid,
    opacity: state.opacity,
    lineWidth: state.lineWidth,
    color: state.color,
  };

  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error("failed to save settings", error);
  }
}

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
    saveSettings();
  });

  opacity.addEventListener("input", () => {
    state.opacity = Number(opacity.value);
    draw();
    saveSettings();
  });

  lineWidth.addEventListener("input", () => {
    state.lineWidth = Number(lineWidth.value);
    draw();
    saveSettings();
  });

  color.addEventListener("input", () => {
    state.color = color.value;
    draw();
    saveSettings();
  });

  toggleClickCursor.addEventListener("click", async () => {
    await toggleClickCursorThrough();
    await showToast(`click-through: ${TOGGLE_CLICK_SHORTCUT}`);
    saveSettings();
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
  if(value) {
    hideToolbarSoon();
  } else {
    showToolbar();
  }
  updateWindowTitle();
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

function showToast(message: string): void {
  let toast = document.getElementById("toast");

  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast";
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.classList.add("show");

  window.setTimeout(() => {
    toast?.classList.remove("show");
  }, 1500);
}


async function setupShortcuts(): Promise<void> {
  await unregisterAll();
  await register(TOGGLE_CLICK_SHORTCUT, async (event) => {
    if (event.state === "Pressed") {
      await toggleClickCursorThrough();
      await showToast(`click-through: ${TOGGLE_CLICK_SHORTCUT}`);
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
  }, 2500);
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