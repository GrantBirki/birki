import * as THREE from "three";
import { AsciiEffect } from "three/addons/effects/AsciiEffect.js";

type ParticleSeed = {
  band: number;
  phase: number;
  u: number;
  v: number;
};

type FallSeed = {
  length: number;
  phase: number;
  x: number;
  y: number;
  z: number;
};

class OrganicAsciiStage {
  private static readonly targetFrameMs = 1000 / 16;
  private static readonly particleCount = 3400;
  private static readonly strandCount = 8;
  private static readonly strandSegments = 170;
  private static readonly fallCount = 44;

  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly effect: AsciiEffect;
  private readonly group = new THREE.Group();
  private readonly particleSeeds: ParticleSeed[] = [];
  private readonly fallSeeds: FallSeed[] = [];
  private readonly particlePositions = new Float32Array(OrganicAsciiStage.particleCount * 3);
  private readonly particleGeometry = new THREE.BufferGeometry();
  private readonly fallGeometry = new THREE.BufferGeometry();
  private readonly strandGeometries: THREE.BufferGeometry[] = [];
  private readonly startTime = performance.now();
  private readonly resizeObserver: ResizeObserver;
  private lastRenderTime = 0;
  private animationId = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly reducedMotion: boolean,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setClearColor(0xffffff, 1);

    this.effect = new AsciiEffect(this.renderer, "   ....::::xxxx001101", {
      alpha: false,
      block: false,
      color: false,
      invert: false,
      resolution: window.innerWidth < 680 ? 0.078 : 0.09,
      scale: 1,
      strResolution: "high",
    });
    this.effect.domElement.className = "ascii-effect";
    this.effect.domElement.setAttribute("aria-hidden", "true");
    this.canvas.after(this.effect.domElement);

    this.camera.position.set(0, 0, 5.75);
    this.scene.add(this.group);
    this.createParticleCloud();
    this.createStrands();
    this.createFallLines();
    this.resize();

    window.addEventListener("resize", () => this.resize(), { passive: true });
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.canvas.parentElement ?? this.canvas);
  }

  start(): void {
    this.renderFrame(0);

    if (!this.reducedMotion) {
      const animate = () => {
        this.animationId = window.requestAnimationFrame(animate);
        const now = performance.now();

        if (now - this.lastRenderTime >= OrganicAsciiStage.targetFrameMs) {
          this.lastRenderTime = now;
          this.renderFrame((now - this.startTime) / 1000);
        }
      };
      animate();
    }
  }

  private createParticleCloud(): void {
    for (let i = 0; i < OrganicAsciiStage.particleCount; i += 1) {
      this.particleSeeds.push({
        band: Math.floor(Math.random() * 4),
        phase: Math.random() * Math.PI * 2,
        u: Math.random(),
        v: randomRange(-1, 1),
      });
    }

    this.particleGeometry.setAttribute("position", new THREE.BufferAttribute(this.particlePositions, 3));

    const points = new THREE.Points(
      this.particleGeometry,
      new THREE.PointsMaterial({
        color: 0x141414,
        size: 0.086,
        transparent: true,
        opacity: 1,
      }),
    );
    points.frustumCulled = false;
    this.group.add(points);
  }

  private createStrands(): void {
    for (let strand = 0; strand < OrganicAsciiStage.strandCount; strand += 1) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(new Float32Array(OrganicAsciiStage.strandSegments * 3), 3),
      );

      const line = new THREE.LineSegments(
        geometry,
        new THREE.LineBasicMaterial({
          color: 0x1f1f1f,
          transparent: true,
          opacity: 0.62,
        }),
      );
      line.frustumCulled = false;
      this.strandGeometries.push(geometry);
      this.group.add(line);
    }
  }

  private createFallLines(): void {
    for (let i = 0; i < OrganicAsciiStage.fallCount; i += 1) {
      const sideBias = Math.random() > 0.5 ? 1 : -1;

      this.fallSeeds.push({
        length: randomRange(0.6, 2.1),
        phase: Math.random() * Math.PI * 2,
        x: randomRange(-2.55, 2.55) + sideBias * randomRange(0, 0.28),
        y: randomRange(-1.35, 1.45),
        z: randomRange(-0.65, 0.35),
      });
    }

    this.fallGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(OrganicAsciiStage.fallCount * 2 * 3), 3),
    );

    const lines = new THREE.LineSegments(
      this.fallGeometry,
      new THREE.LineBasicMaterial({
        color: 0x202020,
        transparent: true,
        opacity: 0.34,
      }),
    );
    lines.frustumCulled = false;
    this.scene.add(lines);
  }

  private resize(): void {
    const bounds = (this.canvas.parentElement ?? this.canvas).getBoundingClientRect();
    const width = Math.max(320, Math.floor(bounds.width));
    const height = Math.max(280, Math.floor(bounds.height));
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(1);
    this.effect.setSize(width, height);
  }

  private renderFrame(time: number): void {
    this.group.rotation.x = this.reducedMotion ? -0.1 : -0.1 + Math.sin(time * 0.22) * 0.05;
    this.group.rotation.y = this.reducedMotion ? -0.28 : -0.28 + Math.sin(time * 0.18) * 0.14;
    this.group.rotation.z = this.reducedMotion ? 0.06 : 0.06 + Math.sin(time * 0.14) * 0.05;

    this.updateParticles(time);
    this.updateStrands(time);
    this.updateFallLines(time);
    this.effect.render(this.scene, this.camera);
  }

  private updateParticles(time: number): void {
    const position = this.particleGeometry.getAttribute("position") as THREE.BufferAttribute;

    this.particleSeeds.forEach((seed, index) => {
      const point = organicPoint(seed.u, seed.v, seed.band, seed.phase, time);
      position.setXYZ(index, point.x, point.y, point.z);
    });

    position.needsUpdate = true;
  }

  private updateStrands(time: number): void {
    this.strandGeometries.forEach((geometry, strand) => {
      const position = geometry.getAttribute("position") as THREE.BufferAttribute;
      const band = strand % 4;
      const lane = (strand - (OrganicAsciiStage.strandCount - 1) / 2) / OrganicAsciiStage.strandCount;
      let cursor = 0;

      for (let i = 0; i < OrganicAsciiStage.strandSegments; i += 2) {
        const uA = i / OrganicAsciiStage.strandSegments;
        const uB = (i + 1) / OrganicAsciiStage.strandSegments;
        const phase = strand * 0.72;
        const vA = lane + Math.sin(uA * Math.PI * 6 + time * 0.42 + phase) * 0.08;
        const vB = lane + Math.sin(uB * Math.PI * 6 + time * 0.42 + phase) * 0.08;
        const a = organicPoint(uA, vA, band, phase, time);
        const b = organicPoint(uB, vB, band, phase, time);
        position.setXYZ(cursor++, a.x, a.y, a.z);
        position.setXYZ(cursor++, b.x, b.y, b.z);
      }

      position.needsUpdate = true;
    });
  }

  private updateFallLines(time: number): void {
    const position = this.fallGeometry.getAttribute("position") as THREE.BufferAttribute;

    this.fallSeeds.forEach((seed, index) => {
      const shimmer = Math.sin(time * 0.42 + seed.phase) * 0.055;
      const drift = Math.sin(time * 0.18 + seed.phase * 0.7) * 0.12;
      const x = seed.x + shimmer;
      const y = seed.y + drift;
      const top = y + seed.length * 0.5;
      const bottom = y - seed.length * 0.5;
      const cursor = index * 2;

      position.setXYZ(cursor, x, top, seed.z);
      position.setXYZ(cursor + 1, x, bottom, seed.z);
    });

    position.needsUpdate = true;
  }
}

function organicPoint(u: number, v: number, band: number, phase: number, time: number): THREE.Vector3 {
  const theta = u * Math.PI * 2;
  const drift = time * 0.24;
  const petal =
    1 +
    Math.sin(theta * 3 + drift + phase) * 0.18 +
    Math.sin(theta * 5 - drift * 0.7 + band) * 0.1;
  const width = v * (0.36 + Math.sin(theta * 2 + phase + drift) * 0.09);
  const curl = Math.sin(theta * 1.5 + phase + drift) * 0.34;
  const bandOffset = (band - 1.5) * 0.08;

  const x =
    Math.cos(theta) * petal * 1.82 +
    Math.cos(theta + Math.PI / 2) * width * 1.36 +
    Math.sin(theta * 2.1 + drift) * 0.18;
  const y =
    Math.sin(theta) * petal * 1.04 +
    Math.sin(theta + Math.PI / 2) * width * 0.9 +
    Math.sin(theta * 2.6 - drift + phase) * 0.16;
  const z = width * 0.78 + curl + bandOffset;

  return new THREE.Vector3(x, y, z);
}

function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

const canvas = document.querySelector<HTMLCanvasElement>("#ascii-canvas");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (canvas) {
  new OrganicAsciiStage(canvas, prefersReducedMotion).start();
}
