# 📅 Daily Schedule 日程管理

一款简约的日程管理应用，支持 **Windows 桌面版** 与 **Android 手机版**，手机与电脑通过云端**随时随地自动同步**。

- 桌面版：Electron
- 手机版：Capacitor 8
- 同步：零依赖 Node 同步服务器（自建或免费云部署，地址自由配置）

---

## ✨ 功能特性

| 功能 | 说明 |
|---|---|
| 📋 紧凑视图 | 左侧日历 + 右侧当日日程，点击日期切换 |
| 📅 大日历（桌面版） | 整屏宽幅日历，点击日期跳转单日管理 |
| ⏰ 自绘时间选择器 | 暖色风格，时/分两列滚动选择 |
| ✅ 完成标记 / 删除 / 统计 | 进度条实时显示完成率 |
| ☁️ 云端同步 | 增删改自动推送、启动自动拉取，按天合并不丢数据 |
| 📱 手机版 | 紧凑视图 + 单日管理 + 同步，专为手机比例优化 |

---

## 🚀 快速开始

### Windows 桌面版
```bash
npm install
npm start
```
> 已打包版本位于 `dist/`（未纳入 Git，需自行打包，见[构建](#-构建)章节）。

### Android 手机版
- 直接下载 [`Daily-Schedule.apk`](./Daily-Schedule.apk) 安装到手机（首次需允许"安装未知来源应用"）
- 或按[构建](#-构建)章节自行编译

---

## ☁️ 云端同步（如何建立链接）

应用默认**不连接任何服务器**，需要在 ☁ 同步 设置里填写你自己的服务器地址（两端填**同一个地址**）后才会开始同步。

### 方式 A：电脑本地（同一 WiFi）
1. 双击 `启动同步服务器.bat`，或在命令行运行：
   ```bash
   node sync-server.js
   ```
2. 终端会显示局域网地址，例如 `http://192.168.1.5:3000`
3. 在应用里点右上角 **☁ 同步** → 填入该地址 → **保存并连接**

### 方式 B：免费云部署（随时随地）
1. 把 [`cloud-deploy/`](./cloud-deploy) 目录里的 `sync-server.js` 和 `package.json` 上传到 GitHub 仓库
2. 在 [Render](https://render.com)（免费，无需信用卡）创建 Web Service：
   - Runtime：`Node`
   - Build Command：留空
   - Start Command：`node sync-server.js`
   - Instance Type：`Free`
3. 部署完成后得到 `https://xxx.onrender.com` 地址
4. 电脑和手机在 **☁ 同步** 设置里填**同一个地址** → 保存并连接

### 建立链接的关键
> 💡 **两端必须填写同一个服务器地址**。填写后数据自动双向合并：
> 同一天的数据按"最后修改时间"保留较新版本；同一时间戳则按条目合并，不会互相覆盖丢失。
> 断开：设置面板点"断开同步"（需确认）。

---

## 🔧 构建

### 桌面版（Windows）
```bash
npm install
npm run start          # 开发运行
npx electron-packager . "Daily Schedule" --platform=win32 --arch=x64 --out=dist --overwrite
```

### Android APK
前置要求：Android SDK、JDK 21（可用 Android Studio 自带的 JBR）、Capacitor CLI。

> ⚠️ 安卓工程**路径不能包含中文**（Gradle 限制），需在纯英文路径下构建：

```bash
# 1. 同步最新页面到手机工程
copy 日程管理.html mobile\www\index.html

# 2. 刷新安卓资源
cd mobile
npx cap sync android

# 3. 复制到英文路径构建（例如 C:\androidbuild）
xcopy android C:\androidbuild\android /E /I

# 4. 构建 APK
cd C:\androidbuild\android
set ANDROID_HOME=C:\Users\xxx\AppData\Local\Android\Sdk
set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr
gradlew.bat assembleDebug
```
产物位于 `app\build\outputs\apk\debug\app-debug.apk`。

---

## 📁 目录结构

```
├── 日程管理.html        # 应用主体（单文件，桌面/手机共用）
├── main.js              # Electron 主进程
├── package.json         # 桌面版依赖
├── sync-server.js       # 同步服务器（零依赖）
├── cloud-deploy/        # 云端部署专用（sync-server.js + package.json）
├── mobile/              # Capacitor 移动工程
│   ├── www/             # 手机版页面（index.html 拷贝）
│   └── android/         # 安卓原生工程
├── Daily-Schedule.apk   # 安卓安装包（构建产物）
├── 启动同步服务器.bat    # 一键启动本地同步
└── 使用说明.md           # 详细使用说明
```

---

## 🛠 技术栈
- **Electron** 43 — 桌面端
- **Capacitor** 8 — 安卓端
- **原生 HTML/CSS/JS** — 界面与逻辑（无框架，单文件）
- **Node.js**（零依赖 `http`）— 同步服务器

## 📄 许可
MIT
