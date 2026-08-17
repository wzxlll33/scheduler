// gen-icon.js — 生成多尺寸暖色日历图标 icon.ico（16/32/48/64/128/256，4x 超采样抗锯齿）
const zlib = require("zlib");
const fs = require("fs");
const path = require("path");

const S = 4;                       // 超采样倍数
const SIZES = [16, 32, 48, 64, 128, 256];
const DESIGN = 256;                // 设计坐标系尺寸

const HEADER = [217, 111, 71];
const CHECK = [224, 122, 81];
const SHEET = [255, 253, 249];

function inRoundedRect(x, y, rx, ry, rw, rh, r) {
  const nx = Math.max(rx + r, Math.min(x, rx + rw - r));
  const ny = Math.max(ry + r, Math.min(y, ry + rh - r));
  const dx = x - nx, dy = y - ny;
  return dx * dx + dy * dy <= r * r;
}
function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
function segDist(px, py, ax, ay, bx, by) {
  const abx = bx - ax, aby = by - ay;
  const len2 = abx * abx + aby * aby;
  const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / len2)) : 0;
  return dist(px, py, ax + abx * t, ay + aby * t);
}

// u,v ∈ [0, DESIGN) 设计坐标
function sample(u, v) {
  if (!inRoundedRect(u, v, 8, 8, 240, 240, 60)) return [0, 0, 0, 0];
  // 白色装订环
  if (dist(u, v, 109, 39) <= 13 || dist(u, v, 147, 39) <= 13) return [255, 255, 255, 255];
  const t = (u - 8 + v - 8) / 480;
  const br = Math.round(232 + (244 - 232) * t);
  const bg = Math.round(131 + (162 - 131) * t);
  const bb = Math.round(90 + (97 - 90) * t);
  // 白色日历纸
  if (inRoundedRect(u, v, 40, 58, 176, 170, 24)) {
    if (v <= 112) {
      const inHead = inRoundedRect(u, v, 40, 58, 176, 54, 24) || (v >= 86 && u >= 40 && u <= 216);
      if (inHead) return [HEADER[0], HEADER[1], HEADER[2], 255];
    }
    // 对勾
    if (segDist(u, v, 96, 142, 128, 172) <= 10 || segDist(u, v, 128, 172, 172, 120) <= 10) {
      return [CHECK[0], CHECK[1], CHECK[2], 255];
    }
    return [SHEET[0], SHEET[1], SHEET[2], 255];
  }
  return [br, bg, bb, 255];
}

// ---- PNG 编码 ----
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(b) {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = crcTable[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePng(rgba, w, h) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---- 渲染某个尺寸（超采样） ----
function render(size) {
  const dim = size * S;
  const scale = DESIGN / dim;   // 缓冲坐标 -> 设计坐标
  const out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let ar = 0, ag = 0, ab = 0, aa = 0;
      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < S; sx++) {
          const u = (x * S + sx + 0.5) * scale;
          const v = (y * S + sy + 0.5) * scale;
          const c = sample(u, v);
          ar += c[0] * c[3]; ag += c[1] * c[3]; ab += c[2] * c[3]; aa += c[3];
        }
      }
      const i = (y * size + x) * 4;
      if (aa > 0) {
        out[i] = Math.round(ar / aa);
        out[i + 1] = Math.round(ag / aa);
        out[i + 2] = Math.round(ab / aa);
        out[i + 3] = Math.round(aa / (S * S));
      }
    }
  }
  return encodePng(out, size, size);
}

const pngs = SIZES.map(render);
fs.writeFileSync(path.join(__dirname, "icon.png"), pngs[pngs.length - 1]);
console.log("icon.png written:", pngs[pngs.length - 1].length, "bytes");

// ---- 多尺寸 ICO 封装 ----
const header = Buffer.alloc(6);
header[2] = 1;                            // type: icon
header.writeUInt16LE(pngs.length, 4);     // count
const entries = [];
let offset = 6 + 16 * pngs.length;
for (let i = 0; i < pngs.length; i++) {
  const e = Buffer.alloc(16);
  const size = SIZES[i];
  e[0] = size === 256 ? 0 : size;
  e[1] = size === 256 ? 0 : size;
  e[2] = 0; e[3] = 0;
  e.writeUInt16LE(1, 4);                  // planes
  e.writeUInt16LE(32, 6);                 // bpp
  e.writeUInt32LE(pngs[i].length, 8);     // size
  e.writeUInt32LE(offset, 12);            // offset
  offset += pngs[i].length;
  entries.push(e);
}
const ico = Buffer.concat([header, ...entries, ...pngs]);
fs.writeFileSync(path.join(__dirname, "icon.ico"), ico);
console.log("icon.ico written:", ico.length, "bytes | sizes:", SIZES.join("/"));
