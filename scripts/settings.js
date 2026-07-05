import { MODULE_ID } from "./constants.js";

export function registerSettings() {
    const settings = {
        "gridSize": {
            name: `${MODULE_ID}.settings.gridSize.name`,
            hint: `${MODULE_ID}.settings.gridSize.hint`,
            scope: "world",
            config: true,
            default: 100,
            type: Number,
        }
    };

    registerSettingsArray(settings);
}

export function getSetting(key) {
    return game.settings.get(MODULE_ID, key);
}

export async function setSetting(key, value) {
    return await game.settings.set(MODULE_ID, key, value);
}

function registerSettingsArray(settings) {
    for(const [key, value] of Object.entries(settings)) {
        game.settings.register(MODULE_ID, key, value);
    }
}
