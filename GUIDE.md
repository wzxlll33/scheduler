# 📘 Daily Schedule — 完整使用与开发指南

> 本指南面向**所有使用者**（人类或 AI 代理/agent）。每个章节都给出精确的文件路径、命令和事实，按步骤即可完成构建、部署、修改与排查。
> 项目 GitHub: https://github.com/wzxlll33/scheduler

---

## 1. 这是什么

一个**单文件 HTML 日程管理应用**，同一套源码可产出三个版本：

| 版本 | 形态 | 运行方式 |
|---|---|---|
| 桌面版 | Electron 应用 | Windows 双击 `Daily Schedule.exe` |
| 安卓版 | APK 安装包 | 手机安装 `Daily-Schedule.apk` |
| 网页版 | 静态网站（PWA） | 手机/电脑浏览器打开网址，iPhone 可"添加到主屏幕" |

核心能力：**日程增删改 + 完成勾选 + 云端同步**（手机与电脑、不同用户间数据自动双向合并）。

---

## 2. 目录结构与文件职责（关键事实）

```
C:\Program Files (x86)\Daily scheduler\日程\   ← Windows 上的项目根目录（仓库根）
├── 日程管理.html        ★ 应用本体（唯一源码，三端共用）。改功能就改它
├── main.js              Electron 主进程（创建窗口、加载 日程管理.html）
├── package.json         桌面版依赖（electron / electron-packager）
├── package-lock.json    npm 锁文件
├── gen-icon.js          用纯 Node 生成 icon.png / icon.ico（暖色日历图标）
├── icon.png / icon.ico  应用图标
├── sync-server.js       ★ 同步服务器（零依赖 Node HTTP 服务，存储 sync-data.json）
├── cloud-deploy/        云端部署用：sync-server.js + package.json 的副本
├── mobile/              Capacitor 安卓工程
│   ├── www/index.html   手机版页面（由 日程管理.html 拷贝而来）
│   └── android/         安卓原生工程（构建在纯英文路径 C:\androidbuild 进行）
├── build-web.js         ★ 网页版生成脚本（零依赖，见第 5 节）
├── web/                 网页版产物（由 build-web.js 生成，部署此目录）
├── Daily-Schedule.apk   安卓安装包（构建产物）
├── 使用说明.md          面向最终用户的说明书
├── GUIDE.md             ★ 本文件
├── 启动同步服务器.bat    本地一键启动同步服务器
├── 重建.bat / rebuild.js  一键重建 APK + 桌面版
├── 推送GitHub.bat / push.js  一键推送 GitHub（含网络重试）
└── dist/                （桌面打包产物，体积大，不入 Git）
```

> ⚠️ 关键路径事实：**安卓 Gradle 构建不能在含中文的路径下运行**，必须用英文路径 `C:\androidbuild`（这是项目里多个脚本存在的原因）。

---

## 3. 数据存储与同步协议（agent 必读）

### 3.1 本地存储（浏览器 localStorage / Electron localStorage）
- 事件 key：`dailyScheduleEvents_v1`
- 值格式：
```json
{
  "2026-08-17": { "u": 1755000000000, "items": [ { "id": 123, "text": "开会", "time": "14:00", "done": false } ] },
  "2026-08-18": { "u": 0, "items": [] }
}
```
- `u` = 该天最后修改时间戳（用于合并）；`items` = 事件数组；`time` 为空串表示全天。
- 兼容旧格式：旧数据 `"2026-08-17": [items]`（数组）加载时自动迁移为 `{u:0, items:[...]}`。
- 同步配置 key：`dailyScheduleSync_v1` = `{ "url": "...", "lastSync": 0, "enabled": true }`。
- 界面模式 key：`dailyScheduleMode` = `"compact" | "big"`。

### 3.2 同步服务器协议（sync-server.js）
- 启动：`node sync-server.js [端口]`（默认 3000；自动读取环境变量 `PORT`）。
- 接口（CORS 全开 `*`）：
  | 方法 | 路径 | 说明 |
  |---|---|---|
  | GET | `/info` | 健康检查 `{"ok":true,...}` |
  | GET | `/data` | 返回 `{"days":{...}}` |
  | PUT | `/data` | 请求体 `{"days":{...}}`；**按天合并**后返回合并结果 |
  | GET | `/` | 状态页 |
- 合并规则：同一天，`u` 大者胜；`u` 相同则按 `items[].id` 取并集。删除 = 该天 `u` 更新且 `items:[]`。
- 存储文件：服务器同目录 `sync-data.json`。
- **无用户隔离**：同一服务器地址 = 同一份数据。多用户各自部署自己的服务器即可隔离（推荐）。

### 3.3 应用内同步行为（日程管理.html 内置）
- 改动事件（增/勾/删）→ `schedulePush()`（600ms 防抖）→ `syncNow()` = 先 GET 合并再 PUT 推送。
- **每 5 秒轮询** `syncPoll()`：GET `/data`，有变化则合并 + 重渲染；`document.hidden` 时暂停，回前台立即补拉。
- 失败自动重试：10s/20s/30s 共 3 次；☁ 按钮变红提示。
- 手动同步：右上角 **☁ 同步** 按钮 → 设置面板 → "立即同步" / "保存并连接"。
- 未配置地址（`syncUrl()` 为空）时完全不联网。

---

## 4. 构建三个版本

### 4.1 桌面版
```bash
npm install
npm start                          # 开发运行
# 打包 asar（更新 dist 里的桌面版）：
npx --yes @electron/asar pack <staging文件夹> "dist\Daily Schedule-win32-x64\resources\app.asar"
# staging 文件夹需包含: main.js package.json 日程管理.html icon.png icon.ico gen-icon.js
```
完整 Electron 打包：`npx electron-packager . "Daily Schedule" --platform=win32 --arch=x64 --out=dist --overwrite`

### 4.2 安卓 APK
```bash
# 一键（推荐）：Windows 上双击 重建.bat 或运行
node rebuild.js
```
`rebuild.js` 自动完成：拷贝 `日程管理.html → mobile/www/index.html` → `npx cap sync android` → 整目录复制 mobile 到英文路径 `C:\androidbuild\mobile` → `gradlew.bat assembleDebug`（自动设 `ANDROID_HOME`、`JAVA_HOME`）→ 复制 APK 回项目 → 重打包桌面 asar。
产物：`Daily-Schedule.apk`。

### 4.3 网页版
```bash
node build-web.js
```
零依赖纯 Node。自动：从 `icon.png` 解码→缩放→编码生成 `icons/icon-180/192/512.png`；读取 `日程管理.html` 并向 `<head>` 注入 `<link rel="manifest">`、`apple-touch-icon`、`theme-color`，向 `</body>` 前注入 service worker 注册脚本；写出完整静态站：
```
web/
├── index.html      （= 应用 + PWA 注入）
├── manifest.json   （PWA 清单：名称/图标/standalone）
├── sw.js           （离线缓存 service worker）
└── icons/icon-180.png, icon-192.png, icon-512.png
```
**部署 `web/` 目录**到任意静态托管（Render 静态站 Root Directory 填 `web`；Vercel/Cloudflare Pages 同理）。

---

## 5. 部署（其他用户照此操作）

### 5.1 部署自己的同步服务器（每人一个，数据独立）
1. 把 `cloud-deploy/`（或根目录的 `sync-server.js` + `package.json`）放进自己的 GitHub 仓库
2. Render（免费，无需信用卡）：New → Web Service → 选仓库
   - Runtime: `Node`；Build Command: 留空；Start Command: `node sync-server.js`；Instance: Free
3. 得到 `https://你的实例.onrender.com` —— 这就是同步服务器地址

### 5.2 部署网页版
1. 运行 `node build-web.js` 生成 `web/`
2. Render：New → **Static Site** → 选仓库 → Root Directory 填 `web` → Create
3. 得到 `https://网站.onrender.com`
4. 手机 Safari 打开网址 → 分享 → **添加到主屏幕**（全屏像 App）

### 5.3 在应用里配置同步
- 打开应用 → 右上角 **☁ 同步** → 输入**你自己的**服务器地址 → **保存并连接**
- 同一用户的多台设备填**同一个地址**即互通；不同用户各填各的地址即隔离

---

## 6. 修改应用后的标准流程（agent 决策树）

1. **改功能** → 编辑 `日程管理.html`
2. **要不要同步到三端？**
   - 桌面版：重打包 asar（见 4.1）
   - 安卓：`node rebuild.js`（含 asar）
   - 网页：`node build-web.js`
3. **推 GitHub**：`node push.js`（或双击 推送GitHub.bat）
   - push.js 自动：克隆仓库 → 复制全部源文件 + `web/` + `mobile/`（排除 node_modules/.gradle/build）→ 提交 → 推送（HTTP/1.1 + postBuffer 500MB + 3 次重试，规避国内网络问题）
4. **验证**：改动是否出现在 日程管理.html、web/index.html、APK 内嵌页面（`assets/public/index.html`，用 zip 解包检查）

---

## 7. 常见问题排查（FAQ）

| 现象 | 原因与解决 |
|---|---|
| Gradle 构建报"non-ASCII characters" | 路径含中文 → 用 `C:\androidbuild`（rebuild.js 已自动处理） |
| 手机/电脑不同步 | ①两端地址必须相同 ②确认服务器在线（浏览器打开 /info） ③等 5 秒轮询或点 ☁ 立即同步 |
| 网页版 iOS 数据被清 | Safari 长期不用会清 localStorage → 添加到主屏幕 + 常用；数据在同步服务器有备份，会自动拉回 |
| GitHub push 报 curl 28 / connection reset | 网络不稳 → 重试（push.js 已内置 3 次重试）；或换网络/代理 |
| 修改后网页没更新 | 重跑 `node build-web.js` 并重新部署（service worker 缓存，强制刷新一次） |
| 同步按钮变红 | 自动同步失败，正在自动重试；也可手动点 ☁ → 立即同步 |

---

## 8. 面向 AI Agent 的速查要点

- **唯一源码**：`日程管理.html`（三端共用；修改只改这一个文件）。
- **构建命令**：桌面 asar 用 `npx --yes @electron/asar pack`；安卓用 `node rebuild.js`（内部 Gradle，需英文路径 `C:\androidbuild`，需环境变量 ANDROID_HOME/JAVA_HOME）；网页用 `node build-web.js`（零依赖，产出 `web/`）。
- **推送**：`node push.js`（内置重试与网络参数；也可手动 `git clone https://github.com/wzxlll33/scheduler.git` → 复制 → commit → push）。
- **同步协议**：GET/PUT `/data`，体 `{"days":{"YYYY-MM-DD":{"u":ts,"items":[...]}}}`；按天 u 合并、同 u 按 id 并集；5 秒轮询 + 600ms 防抖推送 + 失败自动重试。
- **存储格式**：localStorage `dailyScheduleEvents_v1`（`{日期:{u,items}}`），旧数组格式自动迁移。
- **无用户隔离**：一人一服务器 = 一人一份数据（设计如此，勿加复杂隔离）。
- **不要提交**：`dist/`、`node_modules/`、`.gradle/`、`build/`、`sync-data.json`（.gitignore 已配置）。
- **验证点**：改动后检查 ①源码 ②web/index.html ③APK 内 `assets/public/index.html` 三处一致。
