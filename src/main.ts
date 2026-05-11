import earthMap from "./earth-map.js";
import { AsciiGlobe, decodeTextureData } from "./globe.js";

const globe = document.querySelector<HTMLPreElement>("#ascii-globe-text");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (globe) {
  new AsciiGlobe(globe, prefersReducedMotion, decodeTextureData(earthMap)).start();
}
