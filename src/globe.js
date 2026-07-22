const maxMaskCells = 5_000_000;

export class AsciiGlobe {
  static targetFrameMs = 1000 / 24;

  animationId = 0;
  grid = configureGlobeGrid({ height: 720, width: 1280 });
  lastFrame = 0;

  constructor(
    element,
    reducedMotion,
    texture,
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

  start() {
    this.render(0);

    if (this.reducedMotion) {
      return;
    }

    const tick = (now) => {
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

  stop() {
    window.cancelAnimationFrame(this.animationId);
    this.resizeObserver.disconnect();
  }

  configureGrid() {
    const bounds = (this.element.parentElement ?? this.element).getBoundingClientRect();
    this.grid = configureGlobeGrid(bounds);
    this.element.style.setProperty("--ascii-font-size", `${this.grid.fontSize.toFixed(2)}px`);
  }

  render(time) {
    this.element.textContent = renderAsciiGlobe({
      grid: this.grid,
      reducedMotion: this.reducedMotion,
      texture: this.texture,
      time,
    }).text;
  }
}

export function configureGlobeGrid(bounds) {
  const mobile = bounds.width < 680;
  const fontSize = clamp(
    Math.min(bounds.width, bounds.height) / (mobile ? 78 : 92),
    mobile ? 4.8 : 7.4,
    mobile ? 6.25 : 10.5,
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

export function renderAsciiGlobe(options) {
  const { grid, reducedMotion, texture, time } = options;
  const orientation = calculateOrientation(time, reducedMotion);
  const centerX = (grid.columns - 1) / 2;
  const centerY = (grid.rows - 1) / 2;
  const output = [];
  const tiltCos = Math.cos(orientation.axialTilt);
  const tiltSin = Math.sin(orientation.axialTilt);
  const rollCos = Math.cos(orientation.roll);
  const rollSin = Math.sin(orientation.roll);
  const rotationCos = Math.cos(orientation.rotation);
  const rotationSin = Math.sin(orientation.rotation);

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
      const tiltedY = y * tiltCos - z * tiltSin;
      const tiltedZ = y * tiltSin + z * tiltCos;
      const rolledX = x * rollCos - tiltedY * rollSin;
      const rolledY = x * rollSin + tiltedY * rollCos;
      const rotatedX = rolledX * rotationCos + tiltedZ * rotationSin;
      const rotatedZ = -rolledX * rotationSin + tiltedZ * rotationCos;
      const latitude = Math.asin(rolledY < -1 ? -1 : rolledY > 1 ? 1 : rolledY);
      const longitude = Math.atan2(-rotatedZ, rotatedX);
      line += glyphForCell(latitude, longitude, radiusSquared, column, row, texture);
    }

    output.push(line);
  }

  return {
    grid,
    text: output.join("\n"),
  };
}

export function calculateOrientation(time, reducedMotion) {
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
  latitude,
  longitude,
  radiusSquared,
  column,
  row,
  texture,
) {
  const land = sampleEarth(texture, latitude, longitude);
  const limb = radiusSquared > 0.9;

  if (land >= 0.68) {
    const geographicHash = hashCoordinate(
      Math.round(latitude * 115),
      Math.round(longitude * 115),
      0,
    );
    return "10+*x=%"[geographicHash * 7 | 0] ?? "%";
  }

  if (land >= 0.48) {
    const geographicHash = hashCoordinate(
      Math.round(latitude * 115),
      Math.round(longitude * 115),
      0,
    );

    if (geographicHash < 0.14) {
      return ".";
    }

    return "10+x*="[geographicHash * 6 | 0] ?? "=";
  }

  if (land >= 0.28) {
    const geographicHash = hashCoordinate(
      Math.round(latitude * 115),
      Math.round(longitude * 115),
      0,
    );

    if (geographicHash > 0.94) {
      return "10+x"[geographicHash * 4 | 0] ?? "x";
    }

    return geographicHash < land * 0.9 ? ".:+"[geographicHash * 3 | 0] ?? "+" : " ";
  }

  if (land >= 0.12) {
    const geographicHash = hashCoordinate(
      Math.round(latitude * 115),
      Math.round(longitude * 115),
      0,
    );
    return geographicHash < land * 0.65 ? "." : " ";
  }

  if (limb) {
    const screenHash = hashCoordinate(column, row, 37);
    return screenHash > 0.28 ? "." : " ";
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
  let x = Math.floor(((longitude / Math.PI) * 0.5 + 0.5) * texture.width);
  let y = Math.floor((0.5 - latitude / Math.PI) * texture.height);

  if (x >= texture.width) {
    x -= texture.width;
  } else if (x < 0) {
    x += texture.width;
  }

  if (y < 0) {
    y = 0;
  } else if (y >= texture.height) {
    y = texture.height - 1;
  }

  return (texture.mask[y * texture.width + x] ?? 0) / 255;
}

export function degToRad(degrees) {
  return degrees * (Math.PI / 180);
}

export const globeMotion = {
  axialDriftRadians: degToRad(44),
  axialDriftRadiansPerSecond: 0.028,
  initialAxialDriftPhaseRadians: -0.95,
  initialRotationRadians: degToRad(32),
  rollRadians: degToRad(10),
  rollRadiansPerSecond: 0.021,
  spinRadiansPerSecond: 0.28,
};

function hashCoordinate(first, second, salt) {
  const value = Math.sin(first * 127.1 + second * 311.7 + salt * 74.7) * 43758.5453;
  return value - Math.floor(value);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
