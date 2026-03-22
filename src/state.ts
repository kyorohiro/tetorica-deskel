
type Settings = {
    grid: number;
    opacity: number;
    lineWidth: number;
    color: string;
    rotation: number,
};

const DEFAULT_SETTINGS: Settings = {
    grid: 80,
    opacity: 0.7,
    lineWidth: 1,
    color: "#00ff88",
    rotation: 0,
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
    rotation: saved.rotation,
};

function loadSettings(): Settings {
    console.log("> loadSettings");
    try {
        const raw = localStorage.getItem(SETTINGS_KEY);
        if (!raw) {
            return DEFAULT_SETTINGS;
        }

        const parsed = JSON.parse(raw) as Partial<Settings>;
        console.log(">> ", parsed)

        return {
            grid: typeof parsed.grid === "number" ? parsed.grid : DEFAULT_SETTINGS.grid,
            opacity: typeof parsed.opacity === "number" ? parsed.opacity : DEFAULT_SETTINGS.opacity,
            lineWidth:
                typeof parsed.lineWidth === "number"
                    ? parsed.lineWidth
                    : DEFAULT_SETTINGS.lineWidth,
            color: typeof parsed.color === "string" ? parsed.color : DEFAULT_SETTINGS.color,
            rotation: typeof parsed.rotation === "number" ? parsed.rotation : DEFAULT_SETTINGS.rotation,
        };
    } catch (error) {
        console.error("failed to load settings", error);
        return DEFAULT_SETTINGS;
    }
}

function saveSettings(): void {
    console.log("> saveSettings");
    const settings: Settings = {
        grid: state.grid,
        opacity: state.opacity,
        lineWidth: state.lineWidth,
        color: state.color,
        rotation: state.rotation,
    };
    try {
        console.log(">> ", settings);
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (error) {
        console.error("failed to save settings", error);
    }
}

export {
    state,
    saveSettings
}