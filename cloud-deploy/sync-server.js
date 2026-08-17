// sync-server.js — Daily Schedule 同步服务器（零依赖，Node >= 16）
// 用法: node sync-server.js [端口]       默认端口 3000
// 存储: 同目录下 sync-data.json
// 接口:
//   GET  /data   读取全部数据 { days: { "YYYY-MM-DD": { u: 时间戳, items: [...] } } }
//   PUT  /data   上传数据（按天合并，保留较新的 u，相同 u 按 id 合并）
//   GET  /info   健康检查
//   GET  /       状态页
const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");

const PORT = parseInt(process.argv[2] || process.env.PORT || "3000", 10);
const DATA_FILE = path.join(__dirname, "sync-data.json");

function load() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); }
  catch (e) { return { days: {} }; }
}
function save(data) {
  const tmp = DATA_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data));
  fs.renameSync(tmp, DATA_FILE);
}

// 按天合并：incoming 的 u 更新则整体替换；相同 u 则按 id 取并集
function mergeDays(base, incoming) {
  const out = Object.assign({}, base);
  for (const k of Object.keys(incoming || {})) {
    const inc = incoming[k];
    const cur = out[k];
    if (!cur) { out[k] = inc; continue; }
    const iu = inc && inc.u ? inc.u : 0;
    const cu = cur && cur.u ? cur.u : 0;
    if (iu > cu) { out[k] = inc; continue; }
    if (iu === cu) {
      const map = {};
      (cur.items || []).forEach(function (it) { if (it) map[it.id] = it; });
      (inc.items || []).forEach(function (it) { if (it && !map[it.id]) map[it.id] = it; });
      out[k] = { u: cu, items: Object.values(map) };
    }
  }
  return out;
}

const server = http.createServer(function (req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, PUT, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  const url = req.url.split("?")[0];

  if (req.method === "GET" && url === "/info") {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: true, name: "Daily Schedule Sync", time: Date.now() }));
    return;
  }
  if (req.method === "GET" && url === "/data") {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(load()));
    return;
  }
  if (req.method === "PUT" && url === "/data") {
    let body = "";
    req.on("data", function (c) { body += c; if (body.length > 8e6) req.destroy(); });
    req.on("end", function () {
      try {
        const incoming = JSON.parse(body);
        const data = load();
        data.days = mergeDays(data.days || {}, incoming.days || {});
        save(data);
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify(data));
      } catch (e) {
        res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ error: "bad json" }));
      }
    });
    return;
  }
  if (req.method === "GET" && url === "/") {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end("<!doctype html><meta charset='utf-8'><title>日程同步服务</title><body style='font-family:sans-serif;padding:40px;background:#fdf6ee'><h2 style='color:#d96f47'>✅ 日程同步服务运行中</h2><p>GET /data 读取 · PUT /data 写入 · <a href='/data'>查看当前数据</a></p></body>");
    return;
  }
  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("not found");
});

server.listen(PORT, "0.0.0.0", function () {
  console.log("日程同步服务已启动: http://0.0.0.0:" + PORT);
  console.log("数据文件: " + DATA_FILE);
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const n of nets[name]) {
      if (n.family === "IPv4" && !n.internal) console.log("局域网地址(手机同WiFi可用): http://" + n.address + ":" + PORT);
    }
  }
});
