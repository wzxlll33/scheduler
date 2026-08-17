@echo off
cd /d "%~dp0"
echo 正在启动日程同步服务器 (端口 3000)...
echo 手机请连接与电脑相同的 WiFi，并在同步设置里填写下方"局域网地址"
node sync-server.js 3000
pause
