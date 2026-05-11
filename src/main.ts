import earthMap from "./earth-map.js";

type EarthTexture = {
  width: number;
  height: number;
  mask: Uint8Array;
};

class AsciiGlobe {
  private static readonly targetFrameMs = 1000 / 15;
  private static readonly axialDriftRadians = degToRad(56);
  private static readonly rollRadians = degToRad(10);
  private static readonly earth = decodeTextureData(earthMap);

  private columns = 0;
  private rows = 0;
  private cellWidth = 6;
  private cellHeight = 8;
  private radius = 340;
  private animationId = 0;
  private lastFrame = 0;
  private readonly resizeObserver: ResizeObserver;

  constructor(
    private readonly element: HTMLPreElement,
    private readonly reducedMotion: boolean,
  ) {
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

      if (now - this.lastFrame < AsciiGlobe.targetFrameMs) {
        return;
      }

      this.lastFrame = now;
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
    const mobile = bounds.width < 680;
    const fontSize = clamp(
      Math.min(bounds.width, bounds.height) / (mobile ? 84 : 100),
      mobile ? 4.55 : 7,
      mobile ? 5.9 : 9.25,
    );
    const nextColumns = Math.ceil(bounds.width / (fontSize * 0.61)) + 2;
    const nextRows = Math.ceil(bounds.height / (fontSize * 0.82)) + 2;

    this.columns = nextColumns;
    this.rows = nextRows;
    this.cellWidth = fontSize * 0.61;
    this.cellHeight = fontSize * 0.82;
    this.radius = Math.max(bounds.width, bounds.height) * (mobile ? 0.36 : 0.47);
    this.element.style.setProperty("--ascii-font-size", `${fontSize.toFixed(2)}px`);
  }

  private render(time: number): void {
    const rotation = this.reducedMotion ? -1.35 : -1.35 + time * 0.3;
    const axialTilt = this.reducedMotion ? degToRad(-22) : Math.sin(time * 0.035 + 0.65) * AsciiGlobe.axialDriftRadians;
    const roll = this.reducedMotion ? 0 : Math.sin(time * 0.021) * AsciiGlobe.rollRadians;
    const centerX = (this.columns - 1) / 2;
    const centerY = (this.rows - 1) / 2;
    const output: string[] = [];

    for (let row = 0; row < this.rows; row++) {
      let line = "";

      for (let column = 0; column < this.columns; column++) {
        const x = ((column - centerX) * this.cellWidth) / this.radius;
        const y = ((centerY - row) * this.cellHeight) / this.radius;
        const radiusSquared = x * x + y * y;

        if (radiusSquared > 1) {
          line += " ";
          continue;
        }

        const z = Math.sqrt(1 - radiusSquared);
        const tilted = rotateX(x, y, z, axialTilt);
        const rolled = rotateZ(tilted[0], tilted[1], tilted[2], roll);
        const rotated = rotateY(rolled[0], rolled[1], rolled[2], rotation);
        const latitude = Math.asin(clamp(rotated[1], -1, 1));
        const longitude = Math.atan2(-rotated[2], rotated[0]);
        line += glyphForCell(latitude, longitude, radiusSquared, column, row, time, AsciiGlobe.earth);
      }

      output.push(line);
    }

    this.element.textContent = output.join("\n");
  }
}

function glyphForCell(
  latitude: number,
  longitude: number,
  radiusSquared: number,
  column: number,
  row: number,
  time: number,
  texture: EarthTexture,
): string {
  const land = sampleEarth(texture, latitude, longitude);
  const noise = pseudoNoise(latitude * 46 + time * 0.12, longitude * 29);
  const limb = radiusSquared > 0.9;
  const coast = land > 0.24 && land < 0.62;
  const latitudeLine = isNearInterval(radToDeg(latitude), 15, 0.42) && radiusSquared < 0.94;
  const longitudeLine = isNearInterval(radToDeg(longitude), 30, 0.46) && radiusSquared < 0.94;
  const oceanTrace = pseudoNoise(column * 1.7, row * 2.1 + Math.floor(time * 2)) > 0.91;

  if (land > 0.62) {
    return pick(land > 0.84 ? "111100110111101" : "001101101001", noise);
  }

  if (coast) {
    return pick("..::0011", noise);
  }

  if (limb) {
    return pick("..:001", noise);
  }

  if (latitudeLine || longitudeLine) {
    return noise > 0.54 ? "." : " ";
  }

  if (oceanTrace) {
    return pick(" ..001", noise);
  }

  return " ";
}

function decodeTextureData(data: string): EarthTexture {
  const raw = atob(data);
  const bin = new Uint8Array(raw.length);

  for (let i = 0; i < raw.length; i += 1) {
    bin[i] = raw.charCodeAt(i);
  }

  const width = (bin[0] << 8) | bin[1];
  const height = (bin[2] << 8) | bin[3];
  const mask = new Uint8Array(width * height);

  for (let i = 0; i < mask.length; i += 1) {
    const value = i & 1 ? bin[4 + (i >> 1)] & 0x0f : bin[4 + (i >> 1)] >> 4;
    mask[i] = value * 17;
  }

  return { width, height, mask };
}

function sampleEarth(texture: EarthTexture, latitude: number, longitude: number): number {
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

function pick(characters: string, value: number): string {
  return characters[Math.min(characters.length - 1, Math.floor(value * characters.length))] ?? characters[0] ?? " ";
}

function isNearInterval(value: number, interval: number, threshold: number): boolean {
  const remainder = Math.abs((((value + interval / 2) % interval) + interval) % interval - interval / 2);
  return remainder < threshold;
}

function pseudoNoise(a: number, b: number): number {
  const value = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function wrap(value: number, max: number): number {
  return ((value % max) + max) % max;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function degToRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

function radToDeg(radians: number): number {
  return radians * (180 / Math.PI);
}

const globe = document.querySelector<HTMLPreElement>("#ascii-globe-text");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (globe) {
  new AsciiGlobe(globe, prefersReducedMotion).start();
}
