declare module "three" {
  export const AdditiveBlending: number;
  export const DoubleSide: number;

  export class Vector3 {
    constructor(x?: number, y?: number, z?: number);
    x: number;
    y: number;
    z: number;
    set(x: number, y: number, z: number): this;
    setScalar(scale: number): this;
  }

  export class Euler {
    x: number;
    y: number;
    z: number;
  }

  export class Object3D {
    position: Vector3;
    rotation: Euler;
    scale: Vector3;
    frustumCulled: boolean;
    add(...objects: Object3D[]): this;
  }

  export class Scene extends Object3D {}

  export class PerspectiveCamera extends Object3D {
    constructor(fov: number, aspect: number, near: number, far: number);
    aspect: number;
    updateProjectionMatrix(): void;
  }

  export class WebGLRenderer {
    constructor(parameters?: {
      canvas?: HTMLCanvasElement;
      antialias?: boolean;
      alpha?: boolean;
      powerPreference?: WebGLPowerPreference;
    });
    domElement: HTMLCanvasElement;
    setClearColor(color: number | string, alpha?: number): void;
    setPixelRatio(value: number): void;
    setSize(width: number, height: number, updateStyle?: boolean): void;
    render(scene: Scene, camera: PerspectiveCamera): void;
  }

  export class Group extends Object3D {}

  export class BufferAttribute {
    constructor(array: Float32Array, itemSize: number);
    needsUpdate: boolean;
    setXYZ(index: number, x: number, y: number, z: number): this;
  }

  export class BufferGeometry {
    setAttribute(name: string, attribute: BufferAttribute): this;
    getAttribute(name: string): BufferAttribute;
  }

  export class LineBasicMaterial {
    constructor(parameters?: {
      color?: number;
      transparent?: boolean;
      opacity?: number;
      blending?: number;
    });
  }

  export class MeshBasicMaterial {
    constructor(parameters?: {
      color?: number;
      transparent?: boolean;
      opacity?: number;
      side?: number;
      depthWrite?: boolean;
      blending?: number;
    });
  }

  export class PointsMaterial {
    constructor(parameters?: {
      color?: number;
      size?: number;
      transparent?: boolean;
      opacity?: number;
      blending?: number;
    });
  }

  export class LineSegments extends Object3D {
    constructor(geometry?: BufferGeometry, material?: LineBasicMaterial);
  }

  export class Mesh extends Object3D {
    constructor(geometry?: BufferGeometry, material?: MeshBasicMaterial);
  }

  export class Points extends Object3D {
    constructor(geometry?: BufferGeometry, material?: PointsMaterial);
  }
}

declare module "three/addons/effects/AsciiEffect.js" {
  import type { PerspectiveCamera, Scene, WebGLRenderer } from "three";

  export class AsciiEffect {
    constructor(
      renderer: WebGLRenderer,
      charSet?: string,
      options?: {
        alpha?: boolean;
        block?: boolean;
        color?: boolean;
        invert?: boolean;
        resolution?: number;
        scale?: number;
        strResolution?: "low" | "medium" | "high";
      },
    );
    domElement: HTMLDivElement;
    render(scene: Scene, camera: PerspectiveCamera): void;
    setSize(width: number, height: number): void;
  }
}
