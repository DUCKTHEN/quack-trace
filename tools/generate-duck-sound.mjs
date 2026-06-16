import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputPath = join(__dirname, "..", "assets", "sounds", "duck-quack.wav");
const sampleRate = 44100;
const durationSeconds = 0.42;
const samples = Math.floor(sampleRate * durationSeconds);
const data = new Int16Array(samples);

function envelope(t) {
  const attack = Math.min(1, t / 0.035);
  const release = Math.max(0, 1 - Math.max(0, t - 0.08) / 0.34);
  return attack * release;
}

for (let i = 0; i < samples; i += 1) {
  const t = i / sampleRate;
  const wobble = Math.sin(t * Math.PI * 18) * 42;
  const sweep = 430 - t * 245 + wobble;
  const fundamental = Math.sin(2 * Math.PI * sweep * t);
  const reed = Math.sign(Math.sin(2 * Math.PI * (sweep * 0.52) * t));
  const buzz = Math.sin(2 * Math.PI * (sweep * 1.8) * t) * 0.22;
  const noise = (Math.random() * 2 - 1) * 0.12;
  const wave = (fundamental * 0.52 + reed * 0.34 + buzz + noise) * envelope(t);
  data[i] = Math.max(-1, Math.min(1, wave * 0.62)) * 32767;
}

function writeString(view, offset, value) {
  for (let i = 0; i < value.length; i += 1) {
    view.setUint8(offset + i, value.charCodeAt(i));
  }
}

const bytesPerSample = 2;
const buffer = new ArrayBuffer(44 + data.length * bytesPerSample);
const view = new DataView(buffer);
writeString(view, 0, "RIFF");
view.setUint32(4, 36 + data.length * bytesPerSample, true);
writeString(view, 8, "WAVE");
writeString(view, 12, "fmt ");
view.setUint32(16, 16, true);
view.setUint16(20, 1, true);
view.setUint16(22, 1, true);
view.setUint32(24, sampleRate, true);
view.setUint32(28, sampleRate * bytesPerSample, true);
view.setUint16(32, bytesPerSample, true);
view.setUint16(34, 16, true);
writeString(view, 36, "data");
view.setUint32(40, data.length * bytesPerSample, true);

for (let i = 0; i < data.length; i += 1) {
  view.setInt16(44 + i * bytesPerSample, data[i], true);
}

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, Buffer.from(buffer));
console.log(outputPath);
