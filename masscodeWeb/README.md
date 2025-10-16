# massCode Web Viewer

**massCode Web Viewer: Access your code snippets anywhere, anytime using `massCode.db`**

![image-20251016155814214](https://obsidian-note-1304818111.cos.ap-guangzhou.myqcloud.com/others/image-20251016155814214.png)

![image-20251016155345023](https://obsidian-note-1304818111.cos.ap-guangzhou.myqcloud.com/others/image-20251016155345023.png)



## Features

- Browse and search code snippets from massCode database
- GitHub OAuth authentication (optional)
- API token support for upload `massCode.db`
- Automatic database backup
- Dark/Light theme support
- Responsive design

## Usage

1. Clone this repository:
```bash
git clone <repository-url>
cd masscodeWeb
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Configure the application:
```bash
cp config.example.json config.json
# Edit config.json with your settings
```

Or you can use the web setup interface, the application will restart automatically.



4. Run the application:

```bash
python app.py
```

![image-20251016160122493](https://obsidian-note-1304818111.cos.ap-guangzhou.myqcloud.com/others/image-20251016160122493.png)

## Upload massCode.db

1. Go to the settings interface to generate a token 
2. Copy `sync-config.example.json` to `sync-config.json`  
3. Fill in `serverUrl`, `apiToken`, and `dbPath`  
4. Execute the script



> Note
>
> - `serverUrl`：Server address and port
> - `apiToken`：API access token for authentication ...
> - `dbPath`：
>   - **Windows**: `"C:/Users/Username/Desktop/massCode.db"`
>   - **macOS**: `"/Users/Username/Documents/massCode.db"`
>   - **Linux**: `"/home/username/massCode.db"`

## Configuration

Key configuration options in `config.json`:

```json
{
  "server": {
    "host": "0.0.0.0",  // Server binding address - 0.0.0.0 means listen on all network interfaces
    "port": 5000,       // Server port number
    "debug": false      // Debug mode - set to false in production for security
  },
  "security": {
    "enabled": true,    // Enable/disable security features
    "authType": "github", // Authentication method - currently supports GitHub OAuth
    "secretKey": "your-secret-key-here-must-be-at-least-32-characters-long", // Secret key for session encryption - must be at least 32 characters
    "sessionLifetime": 86400, // Session duration in seconds (86400 = 24 hours)
    "github": {
      "clientId": "your-github-oauth-client-id",        // GitHub OAuth App Client ID
      "clientSecret": "your-github-oauth-client-secret", // GitHub OAuth App Client Secret
      "callbackUrl": "http://your-domain.com:5000/auth/callback", // OAuth callback URL
      "allowedUsers": [  // List of GitHub usernames allowed to access the application
        "github-username1",
        "github-username2",
        "github-username3"
      ]
    },
    "apiTokens": [  // API access tokens configuration
      {
        "id": "example-token-id",        // Unique token identifier
        "token": "your-api-token-here",  // API token value
        "name": "example-token-name",    // Descriptive name for the token
        "createdAt": "2025-01-01T00:00:00.000000", // Token creation timestamp
        "expiresAt": "2026-01-01T00:00:00.000000", // Token expiration timestamp
        "lastUsed": null  // Last usage timestamp - null means never used
      }
    ]
  },
  "app": {
    "autoLoadDatabase": true,    // Automatically load database on startup
    "autoRestartOnSave": true,   // Auto-restart application when files are saved
    "maxUploadSizeMB": 100,      // Maximum file upload size in megabytes
    "uploadDirectory": "uploads" // Directory for storing uploaded files
  },
  "ui": {
    "defaultTheme": "dark",      // Default UI theme (dark/light)
    "showWelcomeMessage": true,  // Display welcome message for new users
    "enableAnimations": true     // Enable UI animations and transitions
  },
  "backup": {
    "enabled": false,            // Enable/disable automatic backup system
    "autoBackupOnUpload": true,  // Create backup automatically when files are uploaded
    "maxBackups": 5,             // Maximum number of backup files to keep
    "backupDirectory": "backups" // Directory for storing backup files
  },
  "logging": {
    "level": "INFO",      // Logging level (DEBUG/INFO/WARNING/ERROR)
    "logToFile": false,   // Write logs to file in addition to console
    "logDirectory": "logs" // Directory for log file storage
  }
}
```

## Requirements

- Python 3.7+
- Flask 3.0.0+
- See `requirements.txt` for complete list

## License

This project is not affiliated with massCode. It's an independent web viewer for massCode databases.