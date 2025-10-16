#!/usr/bin/env pwsh
# massCode Cloud Sync Script (PowerShell)
# Supports custom dbPath from sync-config.json

param()

$ErrorActionPreference = "Stop"

# Get script directory
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$CONFIG_FILE = Join-Path $SCRIPT_DIR "sync-config.json"

# Default values
$DEFAULT_DB_PATH = Join-Path $env:APPDATA "massCode\storage\massCode.db"
$DB_PATH = $DEFAULT_DB_PATH
$SERVER_URL = ""
$API_TOKEN = ""

Write-Host "Script Directory: $SCRIPT_DIR"
Write-Host "Config File: $CONFIG_FILE"
Write-Host ""

# Read configuration file
if (Test-Path $CONFIG_FILE) {
    Write-Host "Reading config file..."
    try {
        $config = Get-Content $CONFIG_FILE -Raw | ConvertFrom-Json
        
        if ($config.serverUrl) { $SERVER_URL = $config.serverUrl }
        if ($config.apiToken) { $API_TOKEN = $config.apiToken }
        if ($config.dbPath) { $DB_PATH = $config.dbPath }
    }
    catch {
        Write-Warning "Failed to parse config file: $_"
    }
}

# Prompt for server URL if missing
if ([string]::IsNullOrEmpty($SERVER_URL)) {
    Write-Warning "'serverUrl' not found in config."
    $SERVER_URL = Read-Host "Enter cloud server URL (e.g., http://120.46.161.154:5000)"
}

if ([string]::IsNullOrEmpty($SERVER_URL)) {
    Write-Error "Server URL is required."
    Read-Host "Press Enter to exit"
    exit 1
}

# Normalize URL
if ($SERVER_URL.EndsWith("/")) {
    $SERVER_URL = $SERVER_URL.Substring(0, $SERVER_URL.Length - 1)
}
$UPLOAD_URL = "$SERVER_URL/api/upload"

Write-Host "=========================================="
Write-Host "massCode Cloud Sync"
Write-Host "=========================================="
Write-Host ""
Write-Host "Database: $DB_PATH"
Write-Host "Server: $UPLOAD_URL"
Write-Host ""

# Check database file existence
if (-not (Test-Path $DB_PATH)) {
    Write-Error "Database file not found: $DB_PATH"
    Write-Host "Please check 'dbPath' in sync-config.json or massCode installation."
    Read-Host "Press Enter to exit"
    exit 1
}

$fileInfo = Get-Item $DB_PATH
$FILE_SIZE = $fileInfo.Length
Write-Host "File Size: $FILE_SIZE bytes"
Write-Host ""

$confirm = Read-Host "Confirm upload? (y/n)"
if ($confirm -ne "y" -and $confirm -ne "Y") {
    Write-Host "Cancelled."
    Read-Host "Press Enter to exit"
    exit 0
}

Write-Host ""
Write-Host "[Uploading...] Please wait"
Write-Host ""

try {
    # Prepare upload parameters
    $form = @{
        file = Get-Item $DB_PATH
    }
    
    $headers = @{}
    if (-not [string]::IsNullOrEmpty($API_TOKEN)) {
        $headers["Authorization"] = "Bearer $API_TOKEN"
    }
    
    # Execute upload
    $response = Invoke-RestMethod -Uri $UPLOAD_URL -Method POST -Headers $headers -Form $form
    
    Write-Host ""
    Write-Host "[SUCCESS] Sync completed!"
    Write-Host "Response: $($response | ConvertTo-Json -Compress)"
}
catch {
    Write-Host ""
    Write-Error "[FAILED] Upload failed: $($_.Exception.Message)"
    Write-Host "Check server, network, file path, and API token."
}

Write-Host ""
Read-Host "Press Enter to exit"