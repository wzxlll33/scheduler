// rebuild.js — 一键重建 APK + 桌面版（在项目目录运行: node rebuild.js）
// v2: 增量式构建（工作区存在时只更新页面资源），完整错误提示，robocopy 兜底
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const PF = __dirname; // 脚本所在目录 = 项目目录
const BUILD = "C:\\androidbuild\\mobile";
const BUILD_ANDROID = path.join(BUILD, "android");
const ASSETS_SRC = path.join(PF, "mobile", "android", "app", "src", "main", "assets", "public");
const ASSETS_DST = path.join(BUILD_ANDROID, "app", "src", "main", "assets", "public");
const APK_SRC = path.join(BUILD_ANDROID, "app", "build", "outputs", "apk", "debug", "app-debug.apk");
const ANDROID_HOME = "C:\\Users\\Lenovo\\AppData\\Local\\Android\\Sdk";
const JAVA_HOME = "C:\\Program Files\\Android\\Android Studio\\jbr";
const STAGE = path.join(process.env.TEMP || "C:\\Temp", "ds_stage");
const ASAR = path.join(PF, "dist", "Daily Schedule-win32-x64", "resources", "app.asar");

function run(cmd, opts) {
  console.log(">>> " + cmd);
  execSync(cmd, Object.assign({ stdio: "inherit", shell: true }, opts || {}));
}
// robocopy 退出码 0-7 均视为成功（1=已复制文件），>=8 才是失败
function runRobocopy(cmd) {
  try {
    execSync(cmd, { stdio: "inherit", shell: true });
  } catch (e) {
    if (e.status == null || e.status >= 8) throw e;
  }
}

try {
  console.log("=== Daily Schedule rebuild (v2) ===");

  // [1/5] 同步页面到手机工程
  console.log("[1/5] copying page to mobile/www ...");
  fs.copyFileSync(path.join(PF, "日程管理.html"), path.join(PF, "mobile", "www", "index.html"));
  console.log("    OK");

  // [2/5] 确保 Capacitor 依赖存在 + 刷新安卓资源
  if (!fs.existsSync(path.join(PF, "mobile", "node_modules", "@capacitor", "cli"))) {
    console.log("    (installing Capacitor deps...)");
    run("npm install @capacitor/core @capacitor/cli @capacitor/android --no-audit --no-fund", { cwd: path.join(PF, "mobile") });
  }
  console.log("[2/5] npx cap sync android ...");
  run("npx cap sync android", { cwd: path.join(PF, "mobile") });
  console.log("    OK");

  // [3/5] 构建工作区：存在则只更新页面资源；不存在则整目录复制一次
  // 注：大目录复制统一用 robocopy（对符号链接/junction 和锁定文件更健壮）
  if (fs.existsSync(path.join(BUILD_ANDROID, "gradlew.bat"))) {
    console.log("[3/5] build workspace exists -> updating assets only ...");
    fs.rmSync(ASSETS_DST, { recursive: true, force: true });
    runRobocopy('robocopy "' + ASSETS_SRC + '" "' + ASSETS_DST + '" /E /R:2 /W:1 /NFL /NDL /NJH /NJS /NP');
    console.log("    OK");
  } else {
    console.log("[3/5] creating build workspace (first time) ...");
    fs.rmSync(BUILD, { recursive: true, force: true });
    runRobocopy('robocopy "' + path.join(PF, "mobile") + '" "' + BUILD + '" /E /R:2 /W:1 /NFL /NDL /NJH /NJS /NP');
    console.log("    OK");
  }

  // [4/5] Gradle 构建 APK
  console.log("[4/5] gradlew.bat assembleDebug ...");
  run("gradlew.bat assembleDebug", {
    cwd: BUILD_ANDROID,
    env: Object.assign({}, process.env, { ANDROID_HOME: ANDROID_HOME, JAVA_HOME: JAVA_HOME })
  });
  console.log("    OK");

  // [5/6] 复制 APK 回项目目录
  if (!fs.existsSync(APK_SRC)) throw new Error("APK not found: " + APK_SRC);
  fs.copyFileSync(APK_SRC, path.join(PF, "Daily-Schedule.apk"));
  console.log("[5/6] APK copied: " + path.join(PF, "Daily-Schedule.apk"));

  // [6/6] 重新打包桌面版
  console.log("[6/6] repacking app.asar ...");
  fs.rmSync(STAGE, { recursive: true, force: true });
  fs.mkdirSync(STAGE, { recursive: true });
  for (const f of ["main.js", "package.json", "日程管理.html", "icon.png", "icon.ico", "gen-icon.js"]) {
    fs.copyFileSync(path.join(PF, f), path.join(STAGE, f));
  }
  run('npx --yes @electron/asar pack "' + STAGE + '" "' + ASAR + '"', { cwd: PF });
  fs.rmSync(STAGE, { recursive: true, force: true });
  console.log("    OK");

  console.log("");
  console.log("=== ALL DONE ===");
  console.log("APK:     " + path.join(PF, "Daily-Schedule.apk"));
  console.log("Desktop: " + ASAR);
} catch (e) {
  console.error("");
  console.error("!!! REBUILD FAILED !!!");
  console.error("Error: " + (e.message || e));
  if (e.stack) console.error(e.stack.split("\n").slice(0, 4).join("\n"));
  console.error("");
  process.exit(1);
}
