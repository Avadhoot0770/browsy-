import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple CRC32 implementation
function crc32(buf) {
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ (-1)) >>> 0;
}

const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c;
}

function createChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);

  const toCrc = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(toCrc), 0);

  return Buffer.concat([lenBuf, toCrc, crcBuf]);
}

/**
 * Generate a PNG of given size with Browsy branding:
 * Dark rounded circle background (#161412) with amber star (✦, #E05A2B).
 */
function createBrowsyPng(size) {
  const width = size;
  const height = size;

  // Scanlines with filter byte 0 (None)
  const rawData = Buffer.alloc((width * 4 + 1) * height);
  const cx = width / 2;
  const cy = height / 2;
  const r = width * 0.46;

  let offset = 0;
  for (let y = 0; y < height; y++) {
    rawData[offset++] = 0; // Filter: None
    for (let x = 0; x < width; x++) {
      const dx = x - cx + 0.5;
      const dy = y - cy + 0.5;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Distance from center for star shape (4-point sparkle)
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      const starDist = Math.pow(absX / (r * 0.7), 0.5) + Math.pow(absY / (r * 0.7), 0.5);

      if (dist <= r) {
        if (starDist <= 0.95) {
          // Amber Sparkle #E05A2B
          rawData[offset++] = 0xe0; // R
          rawData[offset++] = 0x5a; // G
          rawData[offset++] = 0x2b; // B
          rawData[offset++] = 0xff; // A
        } else {
          // Dark circle #161412
          rawData[offset++] = 0x16; // R
          rawData[offset++] = 0x14; // G
          rawData[offset++] = 0x12; // B
          rawData[offset++] = 0xff; // A
        }
      } else {
        // Transparent
        rawData[offset++] = 0;
        rawData[offset++] = 0;
        rawData[offset++] = 0;
        rawData[offset++] = 0;
      }
    }
  }

  // Compress IDAT
  const compressed = zlib.deflateSync(rawData);

  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const ihdrChunk = createChunk('IHDR', ihdr);
  const idatChunk = createChunk('IDAT', compressed);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

const outDir = path.resolve(__dirname, '../public/icons');
fs.mkdirSync(outDir, { recursive: true });

for (const size of [16, 32, 48, 128]) {
  const buf = createBrowsyPng(size);
  const outPath = path.join(outDir, `icon${size}.png`);
  fs.writeFileSync(outPath, buf);
  console.log(`Generated icon: ${outPath} (${buf.length} bytes)`);
}
