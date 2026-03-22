
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

export {
    state,
    saveSettings
}