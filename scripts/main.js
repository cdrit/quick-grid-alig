import {initConfig} from "./config.js";
import {registerSettings} from "./settings.js";

Hooks.on("init", () => {
    initConfig();
    registerSettings();
});
