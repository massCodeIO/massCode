#!/bin/bash
# massCode Cloud Sync Script (Shell)
# Supports custom dbPath from sync-config.json

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/sync-config.json"

# Default values
DEFAULT_DB_PATH="$HOME/.config/massCode/storage/massCode.db"
DB_PATH="$DEFAULT_DB_PATH"
SERVER_URL=""
API_TOKEN=""

echo "Script Directory: $SCRIPT_DIR"
echo "Config File: $CONFIG_FILE"
echo ""

# Read configuration file
if [ -f "$CONFIG_FILE" ]; then
    echo "Reading config file..."
    
    # Check if jq is installed
    if command -v jq >/dev/null 2>&1; then
        SERVER_URL=$(jq -r '.serverUrl // empty' "$CONFIG_FILE")
        API_TOKEN=$(jq -r '.apiToken // empty' "$CONFIG_FILE")
        CONFIG_DB_PATH=$(jq -r '.dbPath // empty' "$CONFIG_FILE")
        
        if [ -n "$CONFIG_DB_PATH" ]; then
            DB_PATH="$CONFIG_DB_PATH"
        fi
    else
        echo "Warning: jq not installed, cannot parse JSON config"
    fi
fi

# Prompt for server URL if missing
if [ -z "$SERVER_URL" ]; then
    echo "[WARNING] 'serverUrl' not found in config."
    read -p "Enter cloud server URL (e.g., http://120.46.161.154:5000): " SERVER_URL
fi

if [ -z "$SERVER_URL" ]; then
    echo "[ERROR] Server URL is required."
    read -p "Press Enter to exit"
    exit 1
fi

# Normalize URL
SERVER_URL="${SERVER_URL%/}"
UPLOAD_URL="$SERVER_URL/api/upload"

echo "=========================================="
echo "massCode Cloud Sync"
echo "=========================================="
echo ""
echo "Database: $DB_PATH"
echo "Server: $UPLOAD_URL"
echo ""

# Check database file existence
if [ ! -f "$DB_PATH" ]; then
    echo "[ERROR] Database file not found: $DB_PATH"
    echo "Please check 'dbPath' in sync-config.json or massCode installation."
    read -p "Press Enter to exit"
    exit 1
fi

FILE_SIZE=$(stat -f%z "$DB_PATH" 2>/dev/null || stat -c%s "$DB_PATH" 2>/dev/null || echo "unknown")
echo "File Size: $FILE_SIZE bytes"
echo ""

read -p "Confirm upload? (y/n): " CONFIRM
if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
    echo "Cancelled."
    read -p "Press Enter to exit"
    exit 0
fi

echo ""
echo "[Uploading...] Please wait"
echo ""

# Execute upload
if [ -z "$API_TOKEN" ]; then
    RESPONSE=$(curl -X POST -F "file=@$DB_PATH" "$UPLOAD_URL" -w "HTTP Status: %{http_code}" 2>/dev/null)
else
    RESPONSE=$(curl -X POST -H "Authorization: Bearer $API_TOKEN" -F "file=@$DB_PATH" "$UPLOAD_URL" -w "HTTP Status: %{http_code}" 2>/dev/null)
fi

EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
    echo ""
    echo "[FAILED] Upload failed."
    echo "Check server, network, file path, and API token."
    echo "cURL exit code: $EXIT_CODE"
else
    echo ""
    echo "[SUCCESS] Sync completed!"
fi

echo ""
read -p "Press Enter to exit"