export type EarthTexture = {
  width: number;
  height: number;
  mask: Uint8Array;
};

export type GlobeBounds = {
  width: number;
  height: number;
};

export type GlobeGrid = {
  cellHeight: number;
  cellWidth: number;
  columns: number;
  fontSize: number;
  radius: number;
  rows: number;
};

export type GlobeOrientation = {
  axialTilt: number;
  roll: number;
  rotation: number;
};

export type GlobeFrame = {
  grid: GlobeGrid;
  text: string;
};

const maxMaskCells = 5_000_000;

export class AsciiGlobe {
  private static readonly targetFrameMs = 1000 / 30;

  private animationId = 0;
  private grid = configureGlobeGrid({ height: 720, width: 1280 });
  private lastFrame = 0;
  private readonly element: HTMLPreElement;
  private readonly reducedMotion: boolean;
  private readonly texture: EarthTexture;
  private readonly resizeObserver: ResizeObserver;

  constructor(
    element: HTMLPreElement,
    reducedMotion: boolean,
    texture: EarthTexture,
  ) {
    this.element = element;
    this.reducedMotion = reducedMotion;
    this.texture = texture;
    this.resizeObserver = new ResizeObserver(() => {
      this.configureGrid();
      this.render(performance.now() / 1000);
    });
    this.resizeObserver.observe(this.element.parentElement ?? this.element);
    window.addEventListener("resize", () => {
      this.configureGrid();
      this.render(performance.now() / 1000);
    }, { passive: true });
    this.configureGrid();
  }

  start(): void {
    this.render(0);

    if (this.reducedMotion) {
      return;
    }

    const tick = (now: number) => {
      this.animationId = window.requestAnimationFrame(tick);

      const elapsed = now - this.lastFrame;

      if (elapsed < AsciiGlobe.targetFrameMs) {
        return;
      }

      this.lastFrame = now - (elapsed % AsciiGlobe.targetFrameMs);
      this.render(now / 1000);
    };

    this.animationId = window.requestAnimationFrame(tick);
  }

  stop(): void {
    window.cancelAnimationFrame(this.animationId);
    this.resizeObserver.disconnect();
  }

  private configureGrid(): void {
    const bounds = (this.element.parentElement ?? this.element).getBoundingClientRect();
    this.grid = configureGlobeGrid(bounds);
    this.element.style.setProperty("--ascii-font-size", `${this.grid.fontSize.toFixed(2)}px`);
  }

  private render(time: number): void {
    this.element.textContent = renderAsciiGlobe({
      grid: this.grid,
      reducedMotion: this.reducedMotion,
      texture: this.texture,
      time,
    }).text;
  }
}

export function configureGlobeGrid(bounds: GlobeBounds): GlobeGrid {
  const mobile = bounds.width < 680;
  const fontSize = clamp(
    Math.min(bounds.width, bounds.height) / (mobile ? 84 : 100),
    mobile ? 4.55 : 7,
    mobile ? 5.9 : 9.25,
  );
  const cellWidth = fontSize * 0.61;
  const cellHeight = fontSize * 0.82;

  return {
    cellHeight,
    cellWidth,
    columns: Math.ceil(bounds.width / cellWidth) + 2,
    fontSize,
    radius: Math.min(bounds.width, bounds.height) * (mobile ? 0.46 : 0.465),
    rows: Math.ceil(bounds.height / cellHeight) + 2,
  };
}

export function renderAsciiGlobe(options: {
  grid: GlobeGrid;
  reducedMotion: boolean;
  texture: EarthTexture;
  time: number;
}): GlobeFrame {
  const { grid, reducedMotion, texture, time } = options;
  const orientation = calculateOrientation(time, reducedMotion);
  const centerX = (grid.columns - 1) / 2;
  const centerY = (grid.rows - 1) / 2;
  const output: string[] = [];

  for (let row = 0; row < grid.rows; row += 1) {
    let line = "";

    for (let column = 0; column < grid.columns; column += 1) {
      const x = ((column - centerX) * grid.cellWidth) / grid.radius;
      const y = ((centerY - row) * grid.cellHeight) / grid.radius;
      const radiusSquared = x * x + y * y;

      if (radiusSquared > 1) {
        line += " ";
        continue;
      }

      const z = Math.sqrt(1 - radiusSquared);
      const tilted = rotateX(x, y, z, orientation.axialTilt);
      const rolled = rotateZ(tilted[0], tilted[1], tilted[2], orientation.roll);
      const rotated = rotateY(rolled[0], rolled[1], rolled[2], orientation.rotation);
      const latitude = Math.asin(clamp(rotated[1], -1, 1));
      const longitude = Math.atan2(-rotated[2], rotated[0]);
      line += glyphForCell(latitude, longitude, radiusSquared, column, row, texture);
    }

    output.push(line);
  }

  return {
    grid,
    text: output.join("\n"),
  };
}

export function calculateOrientation(time: number, reducedMotion: boolean): GlobeOrientation {
  const rotation = reducedMotion
    ? globeMotion.initialRotationRadians
    : globeMotion.initialRotationRadians + time * globeMotion.spinRadiansPerSecond;
  const axialTilt = reducedMotion
    ? degToRad(-36)
    : Math.sin(
      time * globeMotion.axialDriftRadiansPerSecond + globeMotion.initialAxialDriftPhaseRadians,
    ) * globeMotion.axialDriftRadians;
  const roll = reducedMotion
    ? 0
    : Math.sin(time * globeMotion.rollRadiansPerSecond) * globeMotion.rollRadians;

  return { axialTilt, roll, rotation };
}

export function glyphForCell(
  latitude: number,
  longitude: number,
  radiusSquared: number,
  _column: number,
  _row: number,
  texture: EarthTexture,
): string {
  const land = sampleEarth(texture, latitude, longitude);
  const limb = radiusSquared > 0.9;
  const latitudeLine = isNearInterval(radToDeg(latitude), 15, 0.24) && radiusSquared < 0.9;
  const longitudeLine = isNearInterval(radToDeg(longitude), 30, 0.24) && radiusSquared < 0.9;

  if (land >= 0.56) {
    return land >= 0.78 ? "1" : "0";
  }

  if (limb) {
    return ".";
  }

  if ((latitudeLine || longitudeLine) && land < 0.08) {
    return ".";
  }

  return " ";
}

export function decodeTextureData(data: string): EarthTexture {
  const raw = atob(data);
  const bin = new Uint8Array(raw.length);

  if (bin.length < 4) {
    throw new Error("Earth texture data is too short.");
  }

  for (let i = 0; i < raw.length; i += 1) {
    bin[i] = raw.charCodeAt(i);
  }

  const width = (bin[0] << 8) | bin[1];
  const height = (bin[2] << 8) | bin[3];
  const maskLength = width * height;
  const expectedBytes = 4 + Math.ceil(maskLength / 2);

  if (width <= 0 || height <= 0 || maskLength > maxMaskCells) {
    throw new Error("Earth texture dimensions are invalid.");
  }

  if (bin.length < expectedBytes) {
    throw new Error("Earth texture data is truncated.");
  }

  const mask = new Uint8Array(maskLength);

  for (let i = 0; i < mask.length; i += 1) {
    const value = i & 1 ? bin[4 + (i >> 1)] & 0x0f : bin[4 + (i >> 1)] >> 4;
    mask[i] = value * 17;
  }

  return { width, height, mask };
}

export function sampleEarth(texture: EarthTexture, latitude: number, longitude: number): number {
  const normalizedLongitude = ((longitude / Math.PI) * 0.5 + 0.5) * texture.width;
  const normalizedLatitude = (0.5 - latitude / Math.PI) * texture.height;
  let x0 = Math.floor(normalizedLongitude);
  let y0 = Math.floor(normalizedLatitude);
  const xFraction = normalizedLongitude - x0;
  const yFraction = normalizedLatitude - y0;
  let x1 = x0 + 1;
  let y1 = y0 + 1;

  x0 = wrap(x0, texture.width);
  x1 = wrap(x1, texture.width);
  y0 = clamp(Math.trunc(y0), 0, texture.height - 1);
  y1 = clamp(Math.trunc(y1), 0, texture.height - 1);

  const topLeft = texture.mask[y0 * texture.width + x0] ?? 0;
  const topRight = texture.mask[y0 * texture.width + x1] ?? 0;
  const bottomLeft = texture.mask[y1 * texture.width + x0] ?? 0;
  const bottomRight = texture.mask[y1 * texture.width + x1] ?? 0;
  const top = topLeft + (topRight - topLeft) * xFraction;
  const bottom = bottomLeft + (bottomRight - bottomLeft) * xFraction;

  return (top + (bottom - top) * yFraction) / 255;
}

export function degToRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

export function radToDeg(radians: number): number {
  return radians * (180 / Math.PI);
}

export const globeMotion = {
  axialDriftRadians: degToRad(44),
  axialDriftRadiansPerSecond: 0.028,
  initialAxialDriftPhaseRadians: -0.95,
  initialRotationRadians: degToRad(32),
  rollRadians: degToRad(10),
  rollRadiansPerSecond: 0.021,
  spinRadiansPerSecond: 0.28,
} as const;

function rotateX(x: number, y: number, z: number, angle: number): [number, number, number] {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [x, y * cos - z * sin, y * sin + z * cos];
}

function rotateY(x: number, y: number, z: number, angle: number): [number, number, number] {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [x * cos + z * sin, y, -x * sin + z * cos];
}

function rotateZ(x: number, y: number, z: number, angle: number): [number, number, number] {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [x * cos - y * sin, x * sin + y * cos, z];
}

function isNearInterval(value: number, interval: number, threshold: number): boolean {
  const remainder = Math.abs((((value + interval / 2) % interval) + interval) % interval - interval / 2);
  return remainder < threshold;
}

function wrap(value: number, max: number): number {
  return ((value % max) + max) % max;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
