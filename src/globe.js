const maxMaskCells = 5_000_000;

export class AsciiGlobe {
  static targetFrameMs = 1000 / 24;

  animationId = 0;
  currentTime = 0;
  grid = configureGlobeGrid({ height: 720, width: 1280 });
  lastFrame = 0;
  resizeAnimationId = 0;
  startTime = 0;

  constructor(element, texture) {
    this.element = element;
    this.texture = texture;
    this.textNode = element.ownerDocument.createTextNode("");
    this.element.replaceChildren(this.textNode);
    this.resizeObserver = new ResizeObserver(() => this.scheduleResize());
    this.resizeObserver.observe(this.element.parentElement ?? this.element);
    this.configureGrid();
  }

  start() {
    this.startTime = performance.now();
    this.lastFrame = this.startTime;
    this.render(0);

    const tick = (now) => {
      this.animationId = window.requestAnimationFrame(tick);
      const elapsed = now - this.lastFrame;

      if (elapsed < AsciiGlobe.targetFrameMs) {
        return;
      }

      this.lastFrame = now - (elapsed % AsciiGlobe.targetFrameMs);
      this.currentTime = (now - this.startTime) / 1000;
      this.render(this.currentTime);
    };

    this.animationId = window.requestAnimationFrame(tick);
  }

  stop() {
    window.cancelAnimationFrame(this.animationId);
    window.cancelAnimationFrame(this.resizeAnimationId);
    this.resizeObserver.disconnect();
  }

  configureGrid() {
    const bounds = (this.element.parentElement ?? this.element).getBoundingClientRect();
    this.grid = configureGlobeGrid(bounds);
    this.element.style.setProperty("--ascii-font-size", `${this.grid.fontSize.toFixed(2)}px`);
  }

  scheduleResize() {
    if (this.resizeAnimationId !== 0) {
      return;
    }

    this.resizeAnimationId = window.requestAnimationFrame(() => {
      this.resizeAnimationId = 0;
      this.configureGrid();
      this.render(this.currentTime);
    });
  }

  render(time) {
    this.textNode.data = renderAsciiGlobe({
      grid: this.grid,
      texture: this.texture,
      time,
    }).text;
  }
}

export function configureGlobeGrid(bounds) {
  const mobile = bounds.width < 680;
  const minimumDimension = Math.min(bounds.width, bounds.height);
  const fontSize = mobile
    ? clamp(minimumDimension / 92, 4.4, 6)
    : clamp(minimumDimension / 104, 7, 9.25);
  const cellWidth = fontSize * 0.61;
  const cellHeight = fontSize * 0.82;
  const radius = minimumDimension * (mobile ? 0.46 : 0.465);
  const columns = makeOdd(Math.ceil((radius * 2) / cellWidth) + 1);
  const rows = makeOdd(Math.ceil((radius * 2) / cellHeight) + 1);
  const grid = { cellHeight, cellWidth, columns, fontSize, radius, rows };

  return {
    ...grid,
    rowSpans: createRowSpans(grid),
  };
}

export function createRowSpans(grid) {
  const centerX = (grid.columns - 1) / 2;
  const centerY = (grid.rows - 1) / 2;
  const rowSpans = [];

  for (let row = 0; row < grid.rows; row += 1) {
    const y = ((centerY - row) * grid.cellHeight) / grid.radius;

    if (Math.abs(y) > 1) {
      rowSpans.push({
        endColumn: 0,
        radiusSquared: new Float32Array(0),
        row,
        startColumn: 0,
        x: new Float32Array(0),
        y,
        z: new Float32Array(0),
      });
      continue;
    }

    const maximumX = Math.sqrt(Math.max(0, 1 - y * y));
    const horizontalRadius = (maximumX * grid.radius) / grid.cellWidth;
    const startColumn = clamp(Math.ceil(centerX - horizontalRadius), 0, grid.columns);
    const endColumn = clamp(Math.floor(centerX + horizontalRadius) + 1, 0, grid.columns);
    const cellCount = Math.max(0, endColumn - startColumn);
    const radiusSquared = new Float32Array(cellCount);
    const x = new Float32Array(cellCount);
    const z = new Float32Array(cellCount);

    for (let offset = 0; offset < cellCount; offset += 1) {
      const column = startColumn + offset;
      const normalizedX = ((column - centerX) * grid.cellWidth) / grid.radius;
      const normalizedRadiusSquared = normalizedX * normalizedX + y * y;
      x[offset] = normalizedX;
      radiusSquared[offset] = normalizedRadiusSquared;
      z[offset] = Math.sqrt(Math.max(0, 1 - normalizedRadiusSquared));
    }

    rowSpans.push({ endColumn, radiusSquared, row, startColumn, x, y, z });
  }

  return rowSpans;
}

export function renderAsciiGlobe({ grid, texture, time }) {
  const orientation = calculateOrientation(time);
  const output = [];
  const tiltCos = Math.cos(orientation.axialTilt);
  const tiltSin = Math.sin(orientation.axialTilt);
  const rollCos = Math.cos(orientation.roll);
  const rollSin = Math.sin(orientation.roll);
  const rotationCos = Math.cos(orientation.rotation);
  const rotationSin = Math.sin(orientation.rotation);

  for (const span of grid.rowSpans) {
    let line = " ".repeat(span.startColumn);

    for (let offset = 0; offset < span.x.length; offset += 1) {
      const x = span.x[offset];
      const z = span.z[offset];
      const tiltedY = span.y * tiltCos - z * tiltSin;
      const tiltedZ = span.y * tiltSin + z * tiltCos;
      const rolledX = x * rollCos - tiltedY * rollSin;
      const rolledY = x * rollSin + tiltedY * rollCos;
      const rotatedX = rolledX * rotationCos + tiltedZ * rotationSin;
      const rotatedZ = -rolledX * rotationSin + tiltedZ * rotationCos;
      const latitude = Math.asin(clamp(rolledY, -1, 1));
      const longitude = Math.atan2(-rotatedZ, rotatedX);
      line += glyphForCell(
        latitude,
        longitude,
        span.radiusSquared[offset],
        span.startColumn + offset,
        span.row,
        texture,
      );
    }

    line += " ".repeat(grid.columns - span.endColumn);
    output.push(line);
  }

  return {
    grid,
    text: output.join("\n"),
  };
}

export function calculateOrientation(time) {
  const rotation = globeMotion.initialRotationRadians + time * globeMotion.spinRadiansPerSecond;
  const axialTilt = globeMotion.baseAxialTiltRadians + Math.sin(
    time * globeMotion.axialDriftRadiansPerSecond + globeMotion.initialAxialDriftPhaseRadians,
  ) * globeMotion.axialDriftRadians;
  const roll = Math.sin(time * globeMotion.rollRadiansPerSecond) * globeMotion.rollRadians;

  return { axialTilt, roll, rotation };
}

export function glyphForCell(
  latitude,
  longitude,
  radiusSquared,
  column,
  row,
  texture,
) {
  const land = sampleEarth(texture, latitude, longitude);
  const limb = radiusSquared > 0.9;
  const geographicHash = hashCoordinate(
    Math.round(latitude * 115),
    Math.round(longitude * 115),
    0,
  );

  if (land >= 0.68) {
    return "10+*x=%"[geographicHash * 7 | 0] ?? "%";
  }

  if (land >= 0.48) {
    if (geographicHash < 0.14) {
      return ".";
    }

    return "10+x*="[geographicHash * 6 | 0] ?? "=";
  }

  if (land >= 0.28) {
    if (geographicHash > 0.94) {
      return "10+x"[geographicHash * 4 | 0] ?? "x";
    }

    return geographicHash < land * 0.9 ? ".:+"[geographicHash * 3 | 0] ?? "+" : " ";
  }

  if (land >= 0.12) {
    return geographicHash < land * 0.65 ? "." : " ";
  }

  if (limb) {
    return hashCoordinate(column, row, 37) > 0.28 ? "." : " ";
  }

  return " ";
}

export function decodeTextureData(data) {
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

export function sampleEarth(texture, latitude, longitude) {
  const wrappedX = positiveModulo(
    ((longitude / Math.PI) * 0.5 + 0.5) * texture.width,
    texture.width,
  );
  const clampedY = clamp(
    (0.5 - latitude / Math.PI) * (texture.height - 1),
    0,
    texture.height - 1,
  );
  const x0 = Math.floor(wrappedX);
  const x1 = (x0 + 1) % texture.width;
  const y0 = Math.floor(clampedY);
  const y1 = Math.min(y0 + 1, texture.height - 1);
  const xWeight = wrappedX - x0;
  const yWeight = clampedY - y0;
  const northWest = texture.mask[y0 * texture.width + x0] ?? 0;
  const northEast = texture.mask[y0 * texture.width + x1] ?? 0;
  const southWest = texture.mask[y1 * texture.width + x0] ?? 0;
  const southEast = texture.mask[y1 * texture.width + x1] ?? 0;
  const north = northWest + (northEast - northWest) * xWeight;
  const south = southWest + (southEast - southWest) * xWeight;

  return (north + (south - north) * yWeight) / 255;
}

export function hashCoordinate(first, second, salt) {
  let value = Math.imul(first ^ salt, 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value ^= Math.imul(second, 0x27d4eb2d);
  value = Math.imul(value ^ (value >>> 15), 0x85ebca6b);
  return (value >>> 0) / 0x1_0000_0000;
}

export function degToRad(degrees) {
  return degrees * (Math.PI / 180);
}

export const globeMotion = {
  axialDriftRadians: degToRad(4),
  axialDriftRadiansPerSecond: 0.018,
  baseAxialTiltRadians: degToRad(-23.4),
  framesPerSecond: 24,
  initialAxialDriftPhaseRadians: -Math.PI / 2,
  initialRotationRadians: degToRad(32),
  rollRadians: degToRad(2),
  rollRadiansPerSecond: 0.014,
  spinRadiansPerSecond: 0.20,
};

function positiveModulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function makeOdd(value) {
  return value % 2 === 0 ? value + 1 : value;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
