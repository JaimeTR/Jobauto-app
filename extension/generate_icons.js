import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import zlib from 'zlib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function hexToRgb(hex) {
  const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [0, 0, 0];
}
function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v) { return Math.max(0, Math.min(255, Math.floor(v))); }
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) { c ^= buf[i]; for (let j = 0; j < 8; j++) c = (c >>> 1) ^ (c & 1 ? 0xEDB88320 : 0); }
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}

function createPNG(size) {
  const w = size;
  const margin = size >= 48 ? 4 : (size >= 32 ? 2 : 1);
  const rd = size >= 48 ? 14 : (size >= 32 ? 7 : 3);
  const bgS = hexToRgb('#6366f1'), bgE = hexToRgb('#8b5cf6');
  const acc = hexToRgb('#a78bfa');

  const raw = new Uint8Array((w * w + w) * 4);
  for (let y = 0; y < w; y++) {
    const rowOff = (y * (w * 4 + 1)) + 1;
    raw[rowOff - 1] = 0;
    for (let x = 0; x < w; x++) {
      const px = rowOff + x * 4;
      const inRect = x >= margin && x < w - margin && y >= margin && y < w - margin;
      let inRounded = false;
      if (inRect) {
        const cx = x < margin + rd && y < margin + rd;
        const cx2 = x >= w - margin - rd && y < margin + rd;
        const cx3 = x < margin + rd && y >= w - margin - rd;
        const cx4 = x >= w - margin - rd && y >= w - margin - rd;
        if (cx) {
          const dx = x - (margin + rd), dy = y - (margin + rd);
          inRounded = dx * dx + dy * dy < rd * rd;
        } else if (cx2) {
          const dx = x - (w - margin - rd - 1), dy = y - (margin + rd);
          inRounded = dx * dx + dy * dy < rd * rd;
        } else if (cx3) {
          const dx = x - (margin + rd), dy = y - (w - margin - rd - 1);
          inRounded = dx * dx + dy * dy < rd * rd;
        } else if (cx4) {
          const dx = x - (w - margin - rd - 1), dy = y - (w - margin - rd - 1);
          inRounded = dx * dx + dy * dy < rd * rd;
        } else {
          inRounded = true;
        }
      }
      if (inRounded) {
        const t = y / (w - 1);
        raw[px] = clamp(lerp(bgS[0], bgE[0], t));
        raw[px + 1] = clamp(lerp(bgS[1], bgE[1], t));
        raw[px + 2] = clamp(lerp(bgS[2], bgE[2], t));
        raw[px + 3] = 255;
      }
    }
  }

  // Draw "JA" on sizes >= 32
  if (size >= 32) {
    const sc = Math.max(1, Math.floor(size / 28));
    const cw = 5 * sc, ch = 7 * sc, gap = sc;
    const totalW = cw + gap + cw;
    const sx = Math.floor((w - totalW) / 2);
    const sy = Math.floor((w - ch) / 2);
    const J = '..##. ...## ...## ...## ...## ##.## .###.'.split(' ');
    const A = '.###. ##.## ##.## ##### ##.## ##.## ##.##'.split(' ');
    for (let fy = 0; fy < 7; fy++) {
      for (let fx = 0; fx < 5; fx++) {
        for (let sy2 = 0; sy2 < sc; sy2++) {
          for (let sx2 = 0; sx2 < sc; sx2++) {
            const dx1 = sx + fx * sc + sx2;
            const dx2 = sx + fx * sc + sx2 + cw + gap;
            const dy = sy + fy * sc + sy2;
            if (dy < 0 || dy >= w) continue;
            const set = (ox) => {
              if (ox >= 0 && ox < w) {
                const i = (dy * (w * 4 + 1)) + 1 + ox * 4;
                raw[i] = 255; raw[i+1] = 255; raw[i+2] = 255; raw[i+3] = 255;
              }
            };
            if (J[fy][fx] === '#') set(dx1);
            if (A[fy][fx] === '#') set(dx2);
          }
        }
      }
    }
  }

  // Inner glow border (sizes >= 48)
  if (size >= 48) {
    for (let y = 1; y < w - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const px = (y * (w * 4 + 1)) + 1 + x * 4;
        if (raw[px + 3] === 0) continue;
        let edge = 0;
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            const ni = ((y + dy) * (w * 4 + 1)) + 1 + (x + dx) * 4;
            if (raw[ni + 3] === 0) { edge = 1; break; }
          }
          if (edge) break;
        }
        if (edge) {
          raw[px] = clamp(raw[px] * 0.7 + acc[0] * 0.3);
          raw[px+1] = clamp(raw[px+1] * 0.7 + acc[1] * 0.3);
          raw[px+2] = clamp(raw[px+2] * 0.7 + acc[2] * 0.3);
        }
      }
    }
  }

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(w, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(Buffer.from(raw))), chunk('IEND', Buffer.alloc(0))]);
}

function faviconSVG() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#6366f1"/><stop offset="100%" stop-color="#8b5cf6"/></linearGradient></defs>
<rect x="4" y="4" width="56" height="56" rx="14" fill="url(#g)" stroke="#a78bfa" stroke-width="1.5"/>
<text x="32" y="42" font-size="26" font-weight="bold" font-family="Arial,sans-serif" fill="#ffffff" text-anchor="middle">JA</text>
</svg>`;
}

const iconsDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });

for (const s of [16, 48, 128]) {
  fs.writeFileSync(path.join(iconsDir, `icon${s}.png`), createPNG(s));
  console.log(`  icon${s}.png (${s}x${s})`);
}

// Copy favicon to dashboard/public
const dashPub = path.join(__dirname, '..', 'dashboard', 'public');
if (fs.existsSync(dashPub)) {
  fs.writeFileSync(path.join(dashPub, 'favicon.svg'), faviconSVG());
  console.log('  dashboard/public/favicon.svg');
}

// Copy favicon to server/public
const srvPub = path.join(__dirname, '..', 'server', 'public');
if (fs.existsSync(srvPub)) {
  fs.writeFileSync(path.join(srvPub, 'favicon.svg'), faviconSVG());
  console.log('  server/public/favicon.svg');
}

console.log('\nListo!');
