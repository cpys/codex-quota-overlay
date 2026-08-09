import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'build', 'resources', 'icon.png');
const trayOutput = path.join(root, 'build', 'resources', 'tray-template.png');
const size = 512;
const pixels = Buffer.alloc(size * size * 4);

for (let y = 0; y < size; y += 1) {
  for (let x = 0; x < size; x += 1) {
    const radius = 104;
    const dx = Math.max(0, radius - x, x - (size - radius - 1));
    const dy = Math.max(0, radius - y, y - (size - radius - 1));
    const inside = dx * dx + dy * dy <= radius * radius;
    setPixel(x, y, inside ? [33, 35, 42, 255] : [0, 0, 0, 0]);
  }
}

drawCircle(256, 256, 166, [77, 209, 141, 255]);
drawCircle(256, 256, 133, [33, 35, 42, 255]);
drawCircle(204, 201, 34, [245, 246, 248, 255]);
drawCircle(308, 311, 34, [245, 246, 248, 255]);
drawThickLine(190, 337, 322, 175, 30, [245, 246, 248, 255]);

fs.mkdirSync(path.dirname(output), {recursive: true});
writePng(output);

pixels.fill(0);
drawCircle(256, 256, 190, [255, 255, 255, 255]);
drawCircle(256, 256, 150, [0, 0, 0, 0]);
drawCircle(202, 198, 36, [255, 255, 255, 255]);
drawCircle(310, 314, 36, [255, 255, 255, 255]);
drawThickLine(184, 350, 328, 164, 34, [255, 255, 255, 255]);
writePng(trayOutput);
process.stdout.write(`${output}\n${trayOutput}\n`);

function writePng(filePath) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0;
    pixels.copy(raw, rowStart + 1, y * size * 4, (y + 1) * size * 4);
  }
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', Buffer.concat([u32(size), u32(size), Buffer.from([8, 6, 0, 0, 0])])),
    chunk('IDAT', zlib.deflateSync(raw, {level: 9})),
    chunk('IEND', Buffer.alloc(0))
  ]);
  fs.writeFileSync(filePath, png);
}

function setPixel(x, y, rgba) {
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  const index = (y * size + x) * 4;
  pixels[index] = rgba[0];
  pixels[index + 1] = rgba[1];
  pixels[index + 2] = rgba[2];
  pixels[index + 3] = rgba[3];
}

function drawCircle(cx, cy, radius, color) {
  const squared = radius * radius;
  for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y += 1) {
    for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x += 1) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= squared) setPixel(x, y, color);
    }
  }
}

function drawThickLine(x1, y1, x2, y2, thickness, color) {
  const lengthSquared = (x2 - x1) ** 2 + (y2 - y1) ** 2;
  for (let y = Math.min(y1, y2) - thickness; y <= Math.max(y1, y2) + thickness; y += 1) {
    for (let x = Math.min(x1, x2) - thickness; x <= Math.max(x1, x2) + thickness; x += 1) {
      const t = Math.max(0, Math.min(1, ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / lengthSquared));
      const px = x1 + t * (x2 - x1);
      const py = y1 + t * (y2 - y1);
      if ((x - px) ** 2 + (y - py) ** 2 <= (thickness / 2) ** 2) setPixel(x, y, color);
    }
  }
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const payload = Buffer.concat([typeBuffer, data]);
  return Buffer.concat([u32(data.length), payload, u32(crc32(payload))]);
}

function u32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32BE(value >>> 0);
  return buffer;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
