import {
  hexToRgbaParams,
  hslaToRgba,
  makeShadowColorFromGrid,
  rgbaToHsla,
} from "./deskel";

type ChainPoint = {
  x: number;
  y: number;
};

class ChainMeasure {
  private chains: ChainPoint[] = [];
  private readonly chainLengthMin: number;

  constructor(chainLengthMin = 20) {
    this.chainLengthMin = chainLengthMin;
  }

  clear() {
    this.chains = [];
  }

  getPoints(): ChainPoint[] {
    return this.chains.map((p) => ({ ...p }));
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

    const shadowColor = `rgba(${shadowRgbaParams.r}, ${shadowRgbaParams.g}, ${shadowRgbaParams.b}, ${shadowRgbaParams.a})`;
    const mainColor = `rgba(${rgbaParams.r}, ${rgbaParams.g}, ${rgbaParams.b}, ${rgbaParams.a})`;

    return {
      shadowColor,
      mainColor,
    };
  }

  private drawPolyline(
    ctx: CanvasRenderingContext2D,
    color: string,
    lineWidth: number,
  ) {
    if (this.chains.length < 2) return;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(this.chains[0].x, this.chains[0].y);

    for (let i = 1; i < this.chains.length; i++) {
      const p = this.chains[i];
      ctx.lineTo(p.x, p.y);
    }

    ctx.stroke();
    ctx.restore();
  }

  private drawPoints(
    ctx: CanvasRenderingContext2D,
    color: string,
    pointRadius: number,
  ) {
    if (this.chains.length === 0) return;

    ctx.save();
    ctx.fillStyle = color;

    for (const p of this.chains) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, pointRadius, 0, Math.PI * 2);
      ctx.fill();
    }

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

      const tickLength =
        i % majorEvery === 0 ? normalLength * majorScale : normalLength;

      const x1 = p.x - nx * tickLength * 0.5;
      const y1 = p.y - ny * tickLength * 0.5;
      const x2 = p.x + nx * tickLength * 0.5;
      const y2 = p.y + ny * tickLength * 0.5;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    ctx.restore();
  }

  private drawLengthLabel(
    ctx: CanvasRenderingContext2D,
    color: string,
    font = "12px sans-serif",
  ) {
    if (this.chains.length < 2) return;

    const last = this.chains[this.chains.length - 1];
    const length = this.getLength();

    ctx.save();
    ctx.fillStyle = color;
    ctx.font = font;
    ctx.fillText(`${length.toFixed(1)} px`, last.x + 8, last.y - 8);
    ctx.restore();
  }

  draw(
    ctx: CanvasRenderingContext2D,
    options?: {
      color?: string;
      lineWidth?: number;
      pointRadius?: number;
      showPoints?: boolean;
      showNormals?: boolean;
      showLength?: boolean;
      normalLength?: number;
      majorEvery?: number;
      majorScale?: number;
    },
  ) {
    const color = options?.color ?? "#00ff88";
    const lineWidth = options?.lineWidth ?? 1;
    const pointRadius = options?.pointRadius ?? 2;
    const showPoints = options?.showPoints ?? false;
    const showNormals = options?.showNormals ?? true;
    const showLength = options?.showLength ?? true;
    const normalLength = options?.normalLength ?? 8;
    const majorEvery = options?.majorEvery ?? 5;
    const majorScale = options?.majorScale ?? 1.8;

    if (this.chains.length === 0) return;

    const { shadowColor, mainColor } = this.getStrokeColors(color);

    ctx.save();

    // 影の折れ線
    this.drawPolyline(ctx, shadowColor, lineWidth + 1);

    // 本線
    this.drawPolyline(ctx, mainColor, lineWidth);

    // 点表示
    if (showPoints) {
      this.drawPoints(ctx, color, pointRadius);
    }

    // 法線目盛り
    if (showNormals) {
      this.drawNormals(ctx, {
        color: mainColor,
        lineWidth: 1,
        normalLength,
        majorEvery,
        majorScale,
      });
    }

    // 長さ表示
    if (showLength) {
      this.drawLengthLabel(ctx, color);
    }

    ctx.restore();
  }
}

export { ChainMeasure };
export type { ChainPoint };