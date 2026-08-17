// push.js — 一键推送项目到 GitHub（在项目目录运行: node push.js）
// v2: 克隆/推送自动重试，HTTP/1.1 + postBuffer 规避网络重置
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const PF = __dirname;
const WORK = path.join(process.env.USERPROFILE || "C:\\Users\\Lenovo", "Desktop", "scheduler-push");
const REPO = "https://github.com/wzxlll33/scheduler.git";
// 规避 GitHub "RPC failed / connection reset"：加大缓冲区 + 强制 HTTP/1.1
const GITC = '-c http.postBuffer=524288000 -c http.version=HTTP/1.1';

function run(cmd, opts) {
  console.log(">>> " + cmd);
  execSync(cmd, Object.assign({ stdio: "inherit", shell: true }, opts || {}));
}
function runRetry(cmd, opts, tries) {
  let lastErr = null;
  for (let i = 1; i <= tries; i++) {
    try {
      console.log(">>> " + cmd + (tries > 1 ? "  (attempt " + i + "/" + tries + ")" : ""));
      execSync(cmd, Object.assign({ stdio: "inherit", shell: true }, opts || {}));
      return;
    } catch (e) {
      lastErr = e;
      console.log("    attempt " + i + " failed: " + (e.message || e).split("\n")[0]);
      if (i < tries) {
        console.log("    retrying in 3s ...");
        execSync("ping -n 4 127.0.0.1 >nul", { shell: true });
      }
    }
  }
  throw lastErr;
}

// 排除不应提交的目录
function keep(p) {
  const segs = p.split(/[\\/]/);
  return !segs.includes("node_modules") && !segs.includes(".gradle") && !segs.includes("build");
}

try {
  console.log("=== Push to GitHub (v2) ===");

  fs.rmSync(WORK, { recursive: true, force: true });
  runRetry('git ' + GITC + ' clone ' + REPO + ' "' + WORK + '"', null, 3);

  const files = [
    "日程管理.html", "main.js", "package.json", "package-lock.json", "gen-icon.js",
    "icon.png", "icon.ico", "sync-server.js", "README.md", ".gitignore",
    "使用说明.md", "GUIDE.md", "启动同步服务器.bat", "重建.bat", "推送GitHub.bat", "rebuild.js", "push.js",
    "build-web.js", "Daily-Schedule.apk"
  ];
  for (const f of files) {
    fs.copyFileSync(path.join(PF, f), path.join(WORK, f));
  }
  fs.cpSync(path.join(PF, "cloud-deploy"), path.join(WORK, "cloud-deploy"), { recursive: true, filter: keep });
  fs.cpSync(path.join(PF, "mobile"), path.join(WORK, "mobile"), { recursive: true, filter: keep });
  fs.cpSync(path.join(PF, "web"), path.join(WORK, "web"), { recursive: true, filter: keep });

  run("git add -A", { cwd: WORK });
  try {
    run('git -c user.name="wzxlll33" -c user.email="wzx20041108@gmail.com" commit -m "auto sync: poll every 5s, instant push, auto retry"', { cwd: WORK });
  } catch (e) {
    console.log("(commit skipped: nothing to commit or commit error)");
  }
  runRetry('git ' + GITC + ' push origin main', { cwd: WORK }, 3);

  fs.rmSync(WORK, { recursive: true, force: true });
  console.log("=== PUSH DONE ===");
} catch (e) {
  console.error("");
  console.error("!!! PUSH FAILED !!!");
  console.error("Error: " + (e.message || e).split("\n")[0]);
  console.error("如果仍是网络问题，请检查网络/代理后重试；或稍后再运行推送GitHub.bat");
  console.error("");
  process.exit(1);
}
