@echo off
REM massCode Cloud Sync Script (Windows Batch)
REM Supports custom dbPath from sync-config.json

chcp 65001 >nul
setlocal enabledelayedexpansion

set "SCRIPT_DIR=%~dp0"
if "!SCRIPT_DIR:~-1!"=="\" set "SCRIPT_DIR=!SCRIPT_DIR:~0,-1!"
set "CONFIG_FILE=!SCRIPT_DIR!\sync-config.json"

REM Default fallback
set "DEFAULT_DB_PATH=%APPDATA%\massCode\storage\massCode.db"
set "DB_PATH=!DEFAULT_DB_PATH!"
set "SERVER_URL="
set "API_TOKEN="

echo Script Directory: !SCRIPT_DIR!
echo Config File: !CONFIG_FILE!
echo.

REM Try to read serverUrl, apiToken, and dbPath from JSON
if exist "!CONFIG_FILE!" (
    echo Reading config file...
    for /f "usebackq delims=" %%a in (`powershell -Command "$ErrorActionPreference='Stop'; try { $raw = Get-Content -Raw -Path '!CONFIG_FILE!'; $json = $raw | ConvertFrom-Json; $url = $json.serverUrl; $token = $json.apiToken; $db = $json.dbPath; if ($url) { 'SERVER_URL='+$url }; if ($token) { 'API_TOKEN='+$token }; if ($db) { 'DB_PATH='+$db } } catch { }" 2^>nul`) do (
        set "%%a"
    )
)

REM Prompt for server URL if missing
if "!SERVER_URL!"=="" (
    echo [WARNING] 'serverUrl' not found in config.
    set /p "SERVER_URL=Enter cloud server URL (e.g., http://120.46.161.154:5000): "
)
if "!SERVER_URL!"=="" (
    echo [ERROR] Server URL is required.
    pause
    exit /b 1
)

REM Normalize URL
if "!SERVER_URL:~-1!"=="/" set "SERVER_URL=!SERVER_URL:~0,-1!"
set "UPLOAD_URL=!SERVER_URL!/api/upload"

echo ==========================================
echo massCode Cloud Sync
echo ==========================================
echo.
echo Database: !DB_PATH!
echo Server: !UPLOAD_URL!
echo.

REM Check database file
if not exist "!DB_PATH!" (
    echo [ERROR] Database file not found: !DB_PATH!
    echo Please check 'dbPath' in sync-config.json or massCode installation.
    pause
    exit /b 1
)

for %%A in ("!DB_PATH!") do set "FILE_SIZE=%%~zA"
echo File Size: !FILE_SIZE! bytes
echo.

set /p "CONFIRM=Confirm upload? (y/n): "
if /i not "!CONFIRM!"=="y" (
    echo Cancelled.
    pause
    exit /b 0
)

echo.
echo [Uploading...] Please wait
echo.

REM Upload with Authorization header if token is set
if "!API_TOKEN!"=="" (
    curl -X POST -F "file=@!DB_PATH!" "!UPLOAD_URL!" -w "HTTP Status: %%{http_code}\n"
) else (
    curl -X POST -H "Authorization: Bearer !API_TOKEN!" -F "file=@!DB_PATH!" "!UPLOAD_URL!" -w "HTTP Status: %%{http_code}\n"
)

if errorlevel 1 (
    echo.
    echo [FAILED] Upload failed.
    echo Check server, network, file path, and API token.
) else (
    echo.
    echo [SUCCESS] Sync completed!
)

echo.
pause
exit /b 0