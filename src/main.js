import earthMap from "./earth-map.js";
import { AsciiGlobe, decodeTextureData } from "./globe.js";

const globe = document.querySelector("#ascii-globe-text");

if (globe) {
  new AsciiGlobe(globe, decodeTextureData(earthMap)).start();
}
