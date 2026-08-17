// build-web.js — 生成网页版静态站点（web/ 目录），零依赖纯 Node
// 用法: 在项目目录运行  node build-web.js
// 产出: web/index.html（应用 + PWA 注入）、manifest.json、sw.js、icons/icon-180/192/512.png
// 部署: 把 web/ 目录部署到任意静态托管（Render 静态站 / Vercel / Cloudflare Pages 等）
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const PF = __dirname;
const OUT = path.join(PF, "web");
const APP = path.join(PF, "日程管理.html");
const ICON_SRC = path.join(PF, "icon.png");

/* ---------- PNG 解码 ---------- */
function decodePng(buf) {
  let off = 8, width = 0, height = 0, bitDepth = 0, colorType = 0;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString("ascii", off + 4, off + 8);
    const data = buf.slice(off + 8, off + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9];
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    off += 12 + len;
  }
  if (bitDepth !== 8) throw new Error("unsupported bit depth: " + bitDepth);
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 4 ? 2 : 1;
  const bpp = Math.max(1, channels);
  const stride = width * channels;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(height * stride);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1);
    const filter = raw[rowStart];
    const cur = Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0;
      const b = prev[x];
      const c = x >= bpp ? prev[x - bpp] : 0;
      let v = raw[rowStart + 1 + x];
      if (filter === 1) v = (v + a) & 0xff;
      else if (filter === 2) v = (v + b) & 0xff;
      else if (filter === 3) v = (v + ((a + b) >> 1)) & 0xff;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v = (v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 0xff;
      } else if (filter !== 0) throw new Error("bad filter " + filter);
      cur[x] = v;
    }
    cur.copy(out, y * stride);
    prev = cur;
  }
  if (colorType === 6) return { width, height, rgba: out };
  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    if (colorType === 2) { rgba[i * 4] = out[i * 3]; rgba[i * 4 + 1] = out[i * 3 + 1]; rgba[i * 4 + 2] = out[i * 3 + 2]; rgba[i * 4 + 3] = 255; }
    else if (colorType === 4) { rgba[i * 4] = out[i * 2]; rgba[i * 4 + 1] = out[i * 2]; rgba[i * 4 + 2] = out[i * 2]; rgba[i * 4 + 3] = out[i * 2 + 1]; }
    else { rgba[i * 4] = out[i]; rgba[i * 4 + 1] = out[i]; rgba[i * 4 + 2] = out[i]; rgba[i * 4 + 3] = 255; }
  }
  return { width, height, rgba };
}

/* ---------- 双线性缩放 ---------- */
function scaleRgba(src, sw, sh, dw, dh) {
  const out = Buffer.alloc(dw * dh * 4);
  const sx = sw / dw, sy = sh / dh;
  for (let y = 0; y < dh; y++) {
    for (let x = 0; x < dw; x++) {
      const gx = (x + 0.5) * sx - 0.5, gy = (y + 0.5) * sy - 0.5;
      const x0 = Math.max(0, Math.floor(gx)), y0 = Math.max(0, Math.floor(gy));
      const x1 = Math.min(sw - 1, x0 + 1), y1 = Math.min(sh - 1, y0 + 1);
      const fx = gx - x0, fy = gy - y0;
      for (let c = 0; c < 4; c++) {
        const p00 = src[(y0 * sw + x0) * 4 + c];
        const p10 = src[(y0 * sw + x1) * 4 + c];
        const p01 = src[(y1 * sw + x0) * 4 + c];
        const p11 = src[(y1 * sw + x1) * 4 + c];
        const top = p00 + (p10 - p00) * fx;
        const bot = p01 + (p11 - p01) * fx;
        out[(y * dw + x) * 4 + c] = Math.round(top + (bot - top) * fy);
      }
    }
  }
  return out;
}

/* ---------- PNG 编码 ---------- */
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
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePng(rgba, w, h) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))
  ]);
}

/* ---------- 站点内容 ---------- */
const MANIFEST = {
  name: "Daily Schedule 日程管理",
  short_name: "日程管理",
  description: "温暖简约的日程管理，手机与电脑自动同步",
  start_url: ".",
  display: "standalone",
  background_color: "#fdf6ee",
  theme_color: "#e8835a",
  icons: [
    { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
    { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" }
  ]
};
const SW = [
  'const CACHE = "daily-schedule-v1";',
  'self.addEventListener("install", function (e) {',
  '  self.skipWaiting();',
  '  e.waitUntil(caches.open(CACHE).then(function (c) {',
  '    return c.addAll(["./", "./manifest.json", "./icons/icon-192.png", "./icons/icon-512.png"]);',
  '  }));',
  '});',
  'self.addEventListener("activate", function (e) {',
  '  e.waitUntil(caches.keys().then(function (ks) {',
  '    return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));',
  '  }).then(function () { return self.clients.claim(); }));',
  '});',
  'self.addEventListener("fetch", function (e) {',
  '  if (e.request.method !== "GET") return;',
  '  var url = new URL(e.request.url);',
  '  if (url.origin !== self.location.origin) return; // 跨域请求（如同步服务器 /data）不缓存，直连网络',
  '  e.respondWith(',
  '    caches.match(e.request).then(function (hit) {',
  '      return hit || fetch(e.request).then(function (res) {',
  '        var copy = res.clone();',
  '        caches.open(CACHE).then(function (c) { c.put(e.request, copy); });',
  '        return res;',
  '      }).catch(function () { return caches.match("./"); });',
  '    })',
  '  );',
  '});'
].join("\n");

try {
  if (!fs.existsSync(APP)) throw new Error("not found: " + APP);
  if (!fs.existsSync(ICON_SRC)) throw new Error("not found: " + ICON_SRC);

  // 1. 生成 PWA 图标（从 icon.png 缩放）
  const icon = decodePng(fs.readFileSync(ICON_SRC));
  const icons = {};
  for (const s of [180, 192, 512]) {
    const rgba = scaleRgba(icon.rgba, icon.width, icon.height, s, s);
    icons[s] = encodePng(rgba, s, s);
  }

  // 2. index.html：注入 PWA 支持
  let html = fs.readFileSync(APP, "utf8");
  html = html.replace("<head>",
    '<head>\n<meta name="theme-color" content="#e8835a">\n' +
    '<link rel="manifest" href="manifest.json">\n' +
    '<link rel="apple-touch-icon" href="icons/icon-180.png">');
  if (html.indexOf("serviceWorker") === -1) {
    html = html.replace("</body>",
      '<script>if ("serviceWorker" in navigator) { window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); }); }</script>\n</body>');
  }

  // 3. 写出 web/
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(path.join(OUT, "icons"), { recursive: true });
  fs.writeFileSync(path.join(OUT, "index.html"), html, "utf8");
  fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(MANIFEST, null, 2), "utf8");
  fs.writeFileSync(path.join(OUT, "sw.js"), SW, "utf8");
  fs.writeFileSync(path.join(OUT, "icons", "icon-180.png"), icons[180]);
  fs.writeFileSync(path.join(OUT, "icons", "icon-192.png"), icons[192]);
  fs.writeFileSync(path.join(OUT, "icons", "icon-512.png"), icons[512]);

  console.log("=== web/ generated ===");
  console.log("output: " + OUT);
  console.log("files: index.html, manifest.json, sw.js, icons/icon-180/192/512.png");
  console.log("deploy the web/ folder to any static host (Render static / Vercel / Cloudflare Pages).");
} catch (e) {
  console.error("!!! BUILD-WEB FAILED !!!");
  console.error("Error: " + (e.message || e));
  process.exit(1);
}
