import { hexToRgbaParams, hslaToRgba, makeShadowColorFromGrid, rgbaToHsla } from "./deskelCommon";

type ChainPoint = {
    x: number;
    y: number;
};

type DrawOptions = {
    color?: string;
    lineWidth?: number;
    showNormals?: boolean;
    showLength?: boolean;
    normalLength?: number;
    majorEvery?: number;
    majorScale?: number;
    showMarkers?: boolean;
    markerRadius?: number;
    currentPoint?: ChainPoint;
};

class ChainMeasure {
    private chains: ChainPoint[] = [];
    private chainLengthMin: number;

    constructor(chainLengthMin = 20) {
        this.chainLengthMin = chainLengthMin;
    }

    setChainLengthMin(length: number) {
        this.chainLengthMin = length;
    }
    clear() {
        this.chains = [];
    }

    getPoints(): ChainPoint[] {
        return this.chains.map((p) => ({ ...p }));
    }

    update(currentPoint: ChainPoint) {
        if (this.chains.length === 0) {
            this.chains.push({ ...currentPoint });
            return;
        }

        let lastPoint = this.chains[this.chains.length - 1];
        let remaining = this.distance(lastPoint, currentPoint);

        while (remaining >= this.chainLengthMin) {
            const t = this.chainLengthMin / remaining;
            const nextPoint = this.lerpPoint(lastPoint, currentPoint, t);
            this.chains.push(nextPoint);

            lastPoint = nextPoint;
            remaining = this.distance(lastPoint, currentPoint);
        }
    }

    getLength(currentPoint?: ChainPoint): number {
        if (this.chains.length === 0) return 0;
        if (this.chains.length === 1) {
            return currentPoint ? this.distance(this.chains[0], currentPoint) : 0;
        }

        let length = (this.chains.length - 1) * this.chainLengthMin;

        if (currentPoint) {
            const last = this.chains[this.chains.length - 1];
            length += this.distance(last, currentPoint);
        }

        return length;
    }

    draw(ctx: CanvasRenderingContext2D, options?: DrawOptions) {
        if (this.chains.length === 0) return;

        const color = options?.color ?? "#00ff88";
        //const lineWidth = options?.lineWidth ?? 1;
        const showNormals = options?.showNormals ?? true;
        const showLength = options?.showLength ?? true;
        const normalLength = options?.normalLength ?? 8;
        const majorEvery = options?.majorEvery ?? 5;
        const majorScale = options?.majorScale ?? 1.8;
        const showMarkers = options?.showMarkers ?? true;
        const markerRadius = options?.markerRadius ?? 2;

        const { shadowColor, mainColor } = this.getStrokeColors(color);

        ctx.save();

        this.drawPolyline(ctx, shadowColor, 4, options?.currentPoint);
        this.drawPolyline(ctx, mainColor, 1, options?.currentPoint);

        if (showNormals) {
            this.drawNormals(ctx, {
                color: mainColor,
                lineWidth: 1,
                normalLength,
                majorEvery,
                majorScale,
            });
        }

        if (showMarkers) {
            this.drawMarkersAtRatios(ctx, [1 / 2, 1 / 3, 2 / 3], {
                color,
                radius: markerRadius,
                currentPoint:  options?.currentPoint,
            });
        }

        if (showLength) {
            this.drawLengthLabel(ctx, color, "12px sans-serif", options?.currentPoint?? undefined);
        }

        ctx.restore();
    }

    private distance(a: ChainPoint, b: ChainPoint): number {
        return Math.hypot(b.x - a.x, b.y - a.y);
    }

    private lerpPoint(a: ChainPoint, b: ChainPoint, t: number): ChainPoint {
        return {
            x: a.x + (b.x - a.x) * t,
            y: a.y + (b.y - a.y) * t,
        };
    }

    private getStrokeColors(color: string) {
        const rgbaParams = hexToRgbaParams(color, 0.8);
        const hslaParams = rgbaToHsla(rgbaParams);
        const shadowHslaParams = makeShadowColorFromGrid(
            hslaParams.h,
            hslaParams.s,
            hslaParams.l,
            hslaParams.a,
        );
        const shadowRgbaParams = hslaToRgba(shadowHslaParams);

        return {
            shadowColor: `rgba(${shadowRgbaParams.r}, ${shadowRgbaParams.g}, ${shadowRgbaParams.b}, ${shadowRgbaParams.a})`,
            mainColor: `rgba(${rgbaParams.r}, ${rgbaParams.g}, ${rgbaParams.b}, ${rgbaParams.a})`,
        };
    }

    private drawPolyline(
        ctx: CanvasRenderingContext2D,
        color: string,
        lineWidth: number,
        currentPoint?: ChainPoint,
    ) {
        if (this.chains.length < 2) return;

        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.beginPath();
        ctx.moveTo(this.chains[0].x, this.chains[0].y);

        if(currentPoint) {
            this.chains.push(currentPoint);
        }
        for (let i = 1; i < this.chains.length; i++) {
            const p = this.chains[i];
            ctx.lineTo(p.x, p.y);
        }
        if(currentPoint) {
            this.chains.pop()
        }
        ctx.stroke();
        ctx.restore();
    }

    private drawNormals(
        ctx: CanvasRenderingContext2D,
        options?: {
            color?: string;
            lineWidth?: number;
            normalLength?: number;
            majorEvery?: number;
            majorScale?: number;
        },
    ) {
        const color = options?.color ?? "#00ff88";
        const lineWidth = options?.lineWidth ?? 1;
        const normalLength = options?.normalLength ?? 8;
        const majorEvery = options?.majorEvery ?? 5;
        const majorScale = options?.majorScale ?? 1.8;

        if (this.chains.length < 2) return;

        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;

        for (let i = 0; i < this.chains.length; i++) {
            const p = this.chains[i];

            let dx = 0;
            let dy = 0;

            if (i === 0) {
                dx = this.chains[1].x - this.chains[0].x;
                dy = this.chains[1].y - this.chains[0].y;
            } else if (i === this.chains.length - 1) {
                dx = this.chains[i].x - this.chains[i - 1].x;
                dy = this.chains[i].y - this.chains[i - 1].y;
            } else {
                dx = this.chains[i + 1].x - this.chains[i - 1].x;
                dy = this.chains[i + 1].y - this.chains[i - 1].y;
            }

            const tangentLen = Math.hypot(dx, dy);
            if (tangentLen < 0.0001) continue;

            const nx = -dy / tangentLen;
            const ny = dx / tangentLen;

            let tickLength =
                i % majorEvery === 0 ? normalLength * majorScale : normalLength;
            let lineWidth =
                i % majorEvery === 0 ? 3 : 1;

            tickLength =
                i % (majorEvery*2) === 0 ? tickLength*1.5 : tickLength;
            lineWidth =
                i % (majorEvery*2) === 0 ? lineWidth*2: lineWidth;

            const x1 = p.x - nx * tickLength * 0.5;
            const y1 = p.y - ny * tickLength * 0.5;
            const x2 = p.x + nx * tickLength * 0.5;
            const y2 = p.y + ny * tickLength * 0.5;

            ctx.beginPath();
            ctx.lineWidth = lineWidth;
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }

        ctx.restore();
    }

    private drawMarkersAtRatios(
        ctx: CanvasRenderingContext2D,
        ratios: number[],
        options?: {
            color?: string;
            radius?: number;
            currentPoint?: ChainPoint;
        },
    ) {
        if (this.chains.length < 2) return;

        const totalLength = this.getLength(options?.currentPoint);
        if (totalLength <= 0) return;

        const radius = options?.radius ?? 2;
        const { shadowColor, mainColor } = this.getStrokeColors(options?.color ?? "#00ff88");

        //
        if (this.chains.length > 0) {

            ctx.save();
            ctx.fillStyle = shadowColor;
            ctx.beginPath();
            ctx.arc(this.chains[0].x, this.chains[0].y, radius * 3.0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            ctx.save();
            ctx.fillStyle = shadowColor;
            ctx.beginPath();
            ctx.arc(this.chains[this.chains.length - 1].x, this.chains[this.chains.length - 1].y, radius * 3.0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            ctx.save();
            ctx.fillStyle = mainColor;
            ctx.beginPath();
            ctx.arc(this.chains[0].x, this.chains[0].y, radius * 1.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            ctx.save();
            ctx.fillStyle = mainColor;
            ctx.beginPath();
            ctx.arc(this.chains[this.chains.length - 1].x, this.chains[this.chains.length - 1].y, radius * 1.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();


        }
        for (const ratio of ratios) {
            const point = this.getPointAtLength(totalLength * ratio);
            if (!point) continue;

            ctx.save();
            ctx.fillStyle = shadowColor;
            ctx.beginPath();
            ctx.arc(point.x, point.y, ratios[0] == ratio ? radius * 3.0 : radius * 2.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            ctx.save();
            ctx.fillStyle = mainColor;
            ctx.beginPath();
            ctx.arc(point.x, point.y, ratios[0] == ratio ? radius * 2.5 : radius * 1.8, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    private getPointAtLength(
        targetLength: number,
        currentPoint?: ChainPoint,
    ): ChainPoint | null {
        if (this.chains.length === 0) return null;

        const totalLength = this.getLength(currentPoint);

        if (targetLength <= 0) {
            return { ...this.chains[0] };
        }

        if (targetLength >= totalLength) {
            return currentPoint
                ? { ...currentPoint }
                : { ...this.chains[this.chains.length - 1] };
        }

        if (this.chains.length >= 2) {
            let currentLength = 0;

            for (let i = 1; i < this.chains.length; i++) {
                const nextLength = currentLength + this.chainLengthMin;

                if (currentLength <= targetLength && targetLength <= nextLength) {
                    const ratio = (targetLength - currentLength) / this.chainLengthMin;
                    return this.lerpPoint(this.chains[i - 1], this.chains[i], ratio);
                }

                currentLength = nextLength;
            }

            if (currentPoint) {
                const last = this.chains[this.chains.length - 1];
                const tailLength = this.distance(last, currentPoint);

                if (tailLength > 0.0001) {
                    const nextLength = currentLength + tailLength;

                    if (currentLength <= targetLength && targetLength <= nextLength) {
                        const ratio = (targetLength - currentLength) / tailLength;
                        return this.lerpPoint(last, currentPoint, ratio);
                    }
                }
            }
        }

        return null;
    }

    private drawLengthLabel(
        ctx: CanvasRenderingContext2D,
        color: string,
        font = "12px sans-serif",
        currentPoint?: ChainPoint
    ) {
        if (this.chains.length < 2) return;

        const last = this.chains[this.chains.length - 1];
        const length = this.getLength(currentPoint);
        const { shadowColor, mainColor } = this.getStrokeColors(color ?? "#00ff88");



        const m1 = ctx.measureText(`${length.toFixed(1)} px`);

        const padX = 4
        const padY = 4
        const lineHeight = 22

        const w = Math.max(m1.width)*2 + padX * 2
        const top = last.y - lineHeight + 2

        ctx.fillStyle = shadowColor;
        ctx.beginPath();
        ctx.fillRect(last.x - padX, top - padY, w, lineHeight + padY * 2)
        ctx.restore();
        ctx.save();
        ctx.fillStyle = mainColor;
        ctx.font = font;
        ctx.fillText(`${length.toFixed(1)} px`, last.x + 8, last.y - 8);
        ctx.restore();
    }
}

export { ChainMeasure };
export type { ChainPoint, DrawOptions };