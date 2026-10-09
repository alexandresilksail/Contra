@echo off
REM =====================================================================
REM  IRON STORM - Windows 一键启动脚本
REM  功能：检查 Node.js -> 安装依赖(如需) -> 启动开发服务器 -> 打开浏览器
REM  不设置/修改任何环境变量，离开脚本后无残留污染。
REM =====================================================================

REM 切到脚本所在目录（兼容从桌面快捷方式 / 资源管理器启动）
cd /d "%~dp0"

REM ---- 1. 检查 Node.js ----
where node >nul 2>nul
if errorlevel 1 (
    echo.
    echo [错误] 未检测到 Node.js。请先安装 Node.js 18 或更高版本后再运行本脚本。
    echo        下载地址: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node -v') do set NODE_VER=%%v
echo [信息] 已检测到 Node.js %NODE_VER%

REM ---- 2. 安装依赖（仅当 node_modules 不存在时） ----
if not exist "node_modules\" (
    echo [信息] 首次运行，正在安装依赖 (npm install) ...
    call npm install
    if errorlevel 1 (
        echo.
        echo [错误] 依赖安装失败，请检查网络连接或 npm 镜像配置。
        echo.
        pause
        exit /b 1
    )
    echo [信息] 依赖安装完成。
) else (
    echo [信息] 依赖已存在，跳过 npm install。
)

REM ---- 3. 启动开发服务器（在独立窗口运行，关闭该窗口即停止服务器） ----
echo [信息] 正在启动 IRON STORM 开发服务器 ...
start "IRON STORM Dev Server" cmd /c "npm run dev"

REM ---- 4. 稍候服务器就绪后打开浏览器 ----
timeout /t 3 /nobreak >nul
echo [信息] 正在打开浏览器 http://localhost:5173/ ...
start "" "http://localhost:5173/"

echo.
echo [完成] 开发服务器已在后台窗口运行。关闭 "IRON STORM Dev Server" 窗口即可停止。
echo.
pause
