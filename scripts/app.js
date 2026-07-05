import { MODULE_ID } from "./constants.js";
import { getSetting } from "./settings.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const { expandObject } = foundry.utils;

const f = Math.sqrt(3) / 2;

const localeMap = {
    GRIDLESS: "SCENES.GridGridless",
    HEXEVENQ: "SCENES.GridHexEvenQ",
    HEXEVENR: "SCENES.GridHexEvenR",
    HEXODDQ: "SCENES.GridHexOddQ",
    HEXODDR: "SCENES.GridHexOddR",
    SQUARE: "SCENES.GridSquare",
};

export class QuickGridAlign extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor(scene, options = {}) {
        super(options);
        this.scene = scene ?? canvas?.scene;
        this.gridType = this.#getGridType();
        this.gridSize = getSetting("gridSize");
        this.measurements = [];
    }

    static APP_ID = "quick-grid-align-app";

    static DEFAULT_OPTIONS = {
        id: QuickGridAlign.APP_ID,
        tag: "form",
        window: {
            icon: "fa-duotone fa-grid",
            title: `${MODULE_ID}.${QuickGridAlign.APP_ID}.title`,
            minimizable: true,
            resizable: false,
        },
        position: {
            width: 400,
            height: "auto",
        },
        form: {
            handler: QuickGridAlign.#onSubmit,
            closeOnSubmit: false,
            submitOnChange: false,
        },
    };

    static PARTS = {
        form: {
            template: `modules/${MODULE_ID}/templates/${QuickGridAlign.APP_ID}.hbs`,
        },
    };

    get title() {
        return `${game.i18n.localize(`${MODULE_ID}.${this.constructor.APP_ID}.title`)} - ${this.scene.name}`;
    }

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        const dimensions = this.scene.dimensions ?? this.scene.getDimensions();
        const size = this.scene.grid?.size ?? this.scene.grid?.distance ?? this.gridSize;

        context.gridType = localeMap[this.gridType] ?? localeMap.SQUARE;
        context.horizontal = Math.round((this.scene.width ?? dimensions.sceneWidth ?? dimensions.width) / size);
        context.vertical = Math.round((this.scene.height ?? dimensions.sceneHeight ?? dimensions.height) / size);
        return context;
    }

    async _onRender(context, options) {
        await super._onRender(context, options);
        const canvasContainer = this.element.querySelector(".quick-grid-align-canvas-container");
        await this.createCanvasPreview(canvasContainer);
    }

    #getGridType() {
        const type = this.scene?.grid?.type;
        if (typeof type === "string") return type;
        return Object.entries(CONST.GRID_TYPES).find(([, value]) => value === type)?.[0] ?? "SQUARE";
    }

    #getBackgroundSource() {
        return this.scene.firstLevel?.background?.src
            ?? this.scene.background?.src
            ?? this.scene.img
            ?? this.scene.thumb;
    }

    async createCanvasPreview(canvasContainer) {
        if (!canvasContainer) return;

        const dotPositions = {
            start: { x: 0, y: 0 },
            end: { x: 0, y: 0 },
        };

        const src = this.#getBackgroundSource();
        if (!src) {
            canvasContainer.textContent = game.i18n.localize(`${MODULE_ID}.${QuickGridAlign.APP_ID}.missingBackground`);
            return;
        }

        const img = new Image();
        img.src = src;
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
        });

        const canvas = document.createElement("canvas");
        canvas.width = 300;
        canvas.height = 300;
        const ctx = canvas.getContext("2d");

        const redrawCanvas = () => {
            const sourceWidth = Math.min(canvas.width, img.width);
            const sourceHeight = Math.min(canvas.height, img.height);
            const randomX = Math.max(0, Math.random() * (img.width - sourceWidth));
            const randomY = Math.max(0, Math.random() * (img.height - sourceHeight));
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, randomX, randomY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
        };

        canvasContainer.replaceChildren(canvas);
        redrawCanvas();

        const dotSize = 30;
        const halfDotSize = dotSize / 2;
        const dotStart = this.#createDot("start", dotSize);
        const dotEnd = this.#createDot("end", dotSize);

        canvasContainer.append(dotStart, dotEnd);
        this.#addCrosshair(dotStart);
        this.#addCrosshair(dotEnd);

        let dot = dotStart;

        canvas.addEventListener("mousedown", () => {
            dot.style.display = "block";
            canvas.style.cursor = "none";
        });

        canvas.addEventListener("mousemove", (event) => {
            const { x, y } = this.#getPointerPosition(event, canvasContainer);
            dot.style.left = `${x - halfDotSize}px`;
            dot.style.top = `${y - halfDotSize}px`;
        });

        canvas.addEventListener("mouseup", (event) => {
            canvas.style.cursor = "default";
            const { x, y } = this.#getPointerPosition(event, canvasContainer);

            dot.style.left = `${x - halfDotSize}px`;
            dot.style.top = `${y - halfDotSize}px`;
            const isStart = dot === dotStart;
            dotPositions[isStart ? "start" : "end"] = { x, y };

            if (isStart) {
                dot = dotEnd;
                return;
            }

            const startEndDist = Math.hypot(dotPositions.start.x - dotPositions.end.x, dotPositions.start.y - dotPositions.end.y);
            this.measurements.push(startEndDist);
            const avg = Math.round(this.measurements.reduce((a, b) => a + b, 0) / this.measurements.length);
            redrawCanvas();
            this.element.querySelector("h3.form-header").innerHTML = `<i class="fa-duotone fa-ruler-triangle"></i> ${game.i18n.localize(`${MODULE_ID}.${QuickGridAlign.APP_ID}.dragAlign`)} | ${game.i18n.localize(`${MODULE_ID}.${QuickGridAlign.APP_ID}.measurementsTaken`)} - ${this.measurements.length}`;
            dotEnd.style.display = "none";
            dotStart.style.display = "none";
            dot = dotStart;
            this.setSquaresFromCellRadius(avg, img.width, img.height);
        });
    }

    #createDot(position, dotSize) {
        const dot = document.createElement("div");
        dot.classList.add("quick-grid-align-canvas-dot", position);
        dot.style.width = `${dotSize}px`;
        dot.style.height = `${dotSize}px`;
        dot.style.display = "none";
        return dot;
    }

    #addCrosshair(dotElement) {
        const horizontal = document.createElement("div");
        horizontal.classList.add("quick-grid-align-canvas-crosshair");
        horizontal.style.width = "100%";
        horizontal.style.height = "1px";
        horizontal.style.left = "0px";
        horizontal.style.top = "50%";
        dotElement.appendChild(horizontal);

        const vertical = document.createElement("div");
        vertical.classList.add("quick-grid-align-canvas-crosshair");
        vertical.style.width = "1px";
        vertical.style.height = "100%";
        vertical.style.left = "50%";
        vertical.style.top = "0px";
        dotElement.appendChild(vertical);
    }

    #getPointerPosition(event, canvasContainer) {
        const rect = canvasContainer.getBoundingClientRect();
        return {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
        };
    }

    setSquaresFromCellRadius(cellSide, imgWidth, imgHeight) {
        const isHex = this.gridType.includes("HEX");
        const cellCount = { x: 1, y: 1 };
        if (isHex) {
            const R = cellSide;
            const S = R;
            const ALPHA = S * f;
            const overlap = S * 0.5;
            const ALPHA_2 = ALPHA * 2;

            const isRow = this.gridType.includes("R");
            if (isRow) {
                cellCount.x = imgWidth / ALPHA_2;
                cellCount.y = (imgHeight + overlap) / (S * 2 - overlap);
            } else {
                cellCount.x = (imgWidth - overlap) / (S * 2 - overlap);
                cellCount.y = imgHeight / ALPHA_2;
            }
        } else {
            const squareSide = cellSide;
            cellCount.x = Math.round(imgWidth / squareSide);
            cellCount.y = Math.round(imgHeight / squareSide);
        }

        cellCount.x = Math.round(cellCount.x * 2) / 2;
        cellCount.y = Math.round(cellCount.y * 2) / 2;

        this.element.querySelector(`input[name="squareCount.x"]`).value = cellCount.x;
        this.element.querySelector(`input[name="squareCount.y"]`).value = cellCount.y;
        this.submit();
    }

    static async #onSubmit(event, form, formData) {
        const data = expandObject(formData.object);
        const updateData = this[`_get${this.gridType}`](data.squareCount.x, data.squareCount.y);
        updateData.width = Math.round(updateData.width);
        updateData.height = Math.round(updateData.height);
        await this.scene.update(updateData);
    }

    _getGRIDLESS(x, y) {
        return { width: x * this.gridSize, height: y * this.gridSize, grid: { size: this.gridSize } };
    }

    _getSQUARE(x, y) {
        return { width: x * this.gridSize, height: y * this.gridSize, grid: { size: this.gridSize } };
    }

    _getHEXEVENQ(x, y) {
        return { width: this.gridSize * (f * x + 2 - 2 * f), height: y * this.gridSize, grid: { size: this.gridSize } };
    }

    _getHEXEVENR(x, y) {
        return { width: x * this.gridSize, height: this.gridSize * (f * y + 2 - 2 * f), grid: { size: this.gridSize } };
    }

    _getHEXODDQ(x, y) {
        return { width: this.gridSize * (f * x + 2 - 2 * f), height: y * this.gridSize, grid: { size: this.gridSize } };
    }

    _getHEXODDR(x, y) {
        return { width: x * this.gridSize, height: this.gridSize * (f * y + 2 - 2 * f), grid: { size: this.gridSize } };
    }
}
