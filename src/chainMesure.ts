import { hexToRgbaParams, hslaToRgba, makeShadowColorFromGrid, rgbaToHsla } from "./deskel";

type ChainPoint = {
    x: number;
    y: number;
};

class ChainMesure {
    private chains: ChainPoint[] = [];
    private readonly chainLengthMin: number;

    constructor(chainLengthMin = 20) {
        this.chainLengthMin = chainLengthMin;
    }

    clear() {
        this.chains = [];
    }

    getPoints(): ChainPoint[] {
        return this.chains;
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

    getLength(): number {
        let length = 0;
        for (let i = 1; i < this.chains.length; i++) {
            length += this.distance(this.chains[i - 1], this.chains[i]);
        }
        return length;
    }

    draw(
        ctx: CanvasRenderingContext2D,
        options?: {
            color?: string;
            lineWidth?: number;
            pointRadius?: number;
            showPoints?: boolean;
            showLength?: boolean;
        },
    ) {
        const color = options?.color ?? "#00ff88";
        const rgbaParams = hexToRgbaParams(color, 0.8);
        const hslaParams = rgbaToHsla(rgbaParams);
        const shadowHslaParams = makeShadowColorFromGrid(
            hslaParams.h,
            hslaParams.s,
            hslaParams.l,
            hslaParams.a,
        );
        const shadowRgbaParams = hslaToRgba(shadowHslaParams);
        const shadowColor = `rgba(${shadowRgbaParams.r}, ${shadowRgbaParams.g}, ${shadowRgbaParams.b}, ${shadowRgbaParams.a})`;
        const mainColor = `rgba(${rgbaParams.r}, ${rgbaParams.g}, ${rgbaParams.b}, ${rgbaParams.a})`;

        const lineWidth = options?.lineWidth ?? 2;
        const pointRadius = options?.pointRadius ?? 2;
        const showPoints = options?.showPoints ?? true;
        const showLength = options?.showLength ?? true;

        if (this.chains.length === 0) return;

        ctx.save();

        // 線を描く
        {
            ctx.strokeStyle = shadowColor;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(this.chains[0].x, this.chains[0].y);

            for (let i = 1; i < this.chains.length; i++) {
                const p = this.chains[i];
                ctx.lineTo(p.x, p.y);
            }
            ctx.stroke();

            // 点を描く
            if (showPoints) {
                ctx.fillStyle = color;
                for (const p of this.chains) {
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, pointRadius, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }/*
        {
            ctx.strokeStyle = mainColor;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(this.chains[0].x, this.chains[0].y);

            for (let i = 1; i < this.chains.length; i++) {
                const p = this.chains[i];
                ctx.lineTo(p.x, p.y);
            }
            ctx.stroke();

            // 点を描く
            if (showPoints) {
                ctx.fillStyle = color;
                for (const p of this.chains) {
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, pointRadius, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }*/
        // 長さ表示
        {
            if (showLength && this.chains.length >= 2) {
                const last = this.chains[this.chains.length - 1];
                const length = this.getLength();

                ctx.fillStyle = color;
                ctx.font = "12px sans-serif";
                ctx.fillText(`${length.toFixed(1)} px`, last.x + 8, last.y - 8);
            }
        }

        ctx.restore();
    }
}
export {
    ChainMesure
}
export type {
    ChainPoint
}