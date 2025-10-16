import os
import sqlite3
import json
import secrets
from functools import wraps
from flask import Flask, render_template, request, jsonify, send_from_directory, session, redirect, url_for
from werkzeug.utils import secure_filename
from datetime import datetime, timedelta
from authlib.integrations.flask_client import OAuth

app = Flask(__name__)
oauth = OAuth(app)

# Load configuration
def load_config():
    """Load configuration from config.json"""
    config_path = 'config.json'
    default_config = {
        'server': {'debug': False, 'host': '0.0.0.0', 'port': 5000},
        'app': {'autoLoadDatabase': True, 'autoRestartOnSave': True, 'maxUploadSizeMB': 50, 'uploadDirectory': 'uploads'},
        'security': {
            'enabled': False,
            'authType': 'github',
            'secretKey': secrets.token_hex(32),
            'sessionLifetime': 86400,
            'apiTokens': [],
            'github': {
                'clientId': '',
                'clientSecret': '',
                'callbackUrl': 'http://localhost:5000/auth/callback',
                'allowedUsers': []
            }
        },
        'ui': {'defaultTheme': 'dark', 'showWelcomeMessage': True, 'enableAnimations': True},
        'backup': {'enabled': False, 'autoBackupOnUpload': True, 'maxBackups': 5, 'backupDirectory': 'backups'},
        'logging': {'level': 'INFO', 'logToFile': False, 'logDirectory': 'logs'}
    }
    
    if os.path.exists(config_path):
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f'Error loading config: {e}')
            return default_config
    return default_config

config = load_config()

# Apply configuration
app.config['UPLOAD_FOLDER'] = config['app']['uploadDirectory']
app.config['MAX_CONTENT_LENGTH'] = config['app']['maxUploadSizeMB'] * 1024 * 1024
app.config['DB_PATH'] = None
app.config['APP_CONFIG'] = config
app.config['SECRET_KEY'] = config['security']['secretKey']
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(seconds=config['security']['sessionLifetime'])

# Configure OAuth
if config['security']['enabled'] and config['security']['authType'] == 'github':
    github_config = config['security']['github']
    if github_config['clientId'] and github_config['clientSecret']:
        oauth.register(
            name='github',
            client_id=github_config['clientId'],
            client_secret=github_config['clientSecret'],
            access_token_url='https://github.com/login/oauth/access_token',
            access_token_params=None,
            authorize_url='https://github.com/login/oauth/authorize',
            authorize_params=None,
            api_base_url='https://api.github.com/',
            client_kwargs={'scope': 'user:email'}
        )

ALLOWED_EXTENSIONS = {'db'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_db():
    if app.config['DB_PATH'] and os.path.exists(app.config['DB_PATH']):
        return sqlite3.connect(app.config['DB_PATH'])
    return None

# Authentication decorator
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        config = app.config['APP_CONFIG']
        if config['security']['enabled']:
            if 'user' not in session:
                return jsonify({'error': 'Authentication required', 'redirect': '/login'}), 401
        return f(*args, **kwargs)
    return decorated_function

# API Token or Session authentication decorator
def token_or_session_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        config = app.config['APP_CONFIG']
        if not config['security']['enabled']:
            # Security disabled, allow access
            return f(*args, **kwargs)
        
        # Check API Token first
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
            api_tokens = config['security'].get('apiTokens', [])
            
            # Find matching token
            for token_obj in api_tokens:
                if token_obj.get('token') == token:
                    # Token found, check if expired
                    if 'expiresAt' in token_obj:
                        expires_at = datetime.fromisoformat(token_obj['expiresAt'])
                        if datetime.now() > expires_at:
                            return jsonify({'error': 'Token expired'}), 401
                    # Token valid
                    request.token_info = token_obj
                    return f(*args, **kwargs)
            
            return jsonify({'error': 'Invalid token'}), 401
        
        # Check session authentication
        if 'user' in session:
            return f(*args, **kwargs)
        
        return jsonify({'error': 'Authentication required. Provide API token or login.'}), 401
    return decorated_function

def save_config(new_config):
    """Save configuration to config.json"""
    config_path = 'config.json'
    try:
        with open(config_path, 'w', encoding='utf-8') as f:
            json.dump(new_config, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        print(f'Error saving config: {e}')
        return False

@app.route('/')
def index():
    config = app.config['APP_CONFIG']
    if config['security']['enabled'] and 'user' not in session:
        return redirect(url_for('login'))
    return render_template('index.html')

@app.route('/login')
def login():
    config = app.config['APP_CONFIG']
    if not config['security']['enabled']:
        return redirect(url_for('index'))
    if 'user' in session:
        return redirect(url_for('index'))
    return render_template('login.html')

@app.route('/auth/login')
def auth_login():
    config = app.config['APP_CONFIG']
    if not config['security']['enabled']:
        return jsonify({'error': 'Authentication is disabled'}), 400
    
    github_config = config['security']['github']
    redirect_uri = github_config['callbackUrl']
    return oauth.github.authorize_redirect(redirect_uri)

@app.route('/auth/callback')
def auth_callback():
    config = app.config['APP_CONFIG']
    if not config['security']['enabled']:
        return jsonify({'error': 'Authentication is disabled'}), 400
    
    try:
        token = oauth.github.authorize_access_token()
        resp = oauth.github.get('user', token=token)
        user_info = resp.json()
        
        github_config = config['security']['github']
        allowed_users = github_config['allowedUsers']
        
        if allowed_users and user_info['login'] not in allowed_users:
            return render_template('login.html', error='Access denied. You are not authorized to access this application.')
        
        session['user'] = {
            'username': user_info['login'],
            'avatar': user_info.get('avatar_url'),
            'name': user_info.get('name')
        }
        session.permanent = True
        
        return redirect(url_for('index'))
    except Exception as e:
        print(f'OAuth error: {e}')
        return render_template('login.html', error='Authentication failed. Please try again.')

@app.route('/auth/logout')
def auth_logout():
    session.pop('user', None)
    return redirect(url_for('login'))

@app.route('/api/user')
def get_user():
    if 'user' in session:
        return jsonify(session['user'])
    return jsonify(None)

@app.route('/settings')
@login_required
def settings():
    return render_template('settings.html')

@app.route('/api/upload', methods=['POST'])
@token_or_session_required
def upload_file():
    config = app.config['APP_CONFIG']
    
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], 'massCode.db')
        
        # Backup existing database if enabled
        if config['backup']['enabled'] and config['backup']['autoBackupOnUpload']:
            if os.path.exists(filepath):
                backup_database(filepath, config)
        
        file.save(filepath)
        app.config['DB_PATH'] = filepath
        return jsonify({'message': 'File uploaded successfully', 'filename': filename})
    
    return jsonify({'error': 'Invalid file type. Only .db files are allowed'}), 400

def backup_database(db_path, config):
    """Backup the database file"""
    try:
        backup_dir = config['backup']['backupDirectory']
        os.makedirs(backup_dir, exist_ok=True)
        
        # Create backup with timestamp
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_name = f'massCode_backup_{timestamp}.db'
        backup_path = os.path.join(backup_dir, backup_name)
        
        # Copy file
        import shutil
        shutil.copy2(db_path, backup_path)
        
        # Clean old backups
        cleanup_old_backups(backup_dir, config['backup']['maxBackups'])
        
        print(f'Database backed up to: {backup_path}')
    except Exception as e:
        print(f'Backup failed: {e}')

def cleanup_old_backups(backup_dir, max_backups):
    """Remove old backups, keeping only the latest max_backups"""
    try:
        backups = [f for f in os.listdir(backup_dir) if f.startswith('massCode_backup_')]
        backups.sort(reverse=True)
        
        # Remove old backups
        for old_backup in backups[max_backups:]:
            os.remove(os.path.join(backup_dir, old_backup))
            print(f'Removed old backup: {old_backup}')
    except Exception as e:
        print(f'Cleanup failed: {e}')

@app.route('/api/check-db', methods=['GET'])
@login_required
def check_db():
    """Check if there's an uploaded database file on the server"""
    db_path = os.path.join(app.config['UPLOAD_FOLDER'], 'massCode.db')
    exists = os.path.exists(db_path)
    
    info = None
    if exists:
        file_stat = os.stat(db_path)
        info = {
            'exists': True,
            'path': db_path,
            'size': file_stat.st_size,
            'modified': datetime.fromtimestamp(file_stat.st_mtime).isoformat(),
            'loaded': app.config['DB_PATH'] == db_path
        }
    else:
        info = {'exists': False, 'loaded': False}
    
    return jsonify(info)

@app.route('/api/load-db', methods=['POST'])
@login_required
def load_db():
    """Load the uploaded database file"""
    db_path = os.path.join(app.config['UPLOAD_FOLDER'], 'massCode.db')
    
    if not os.path.exists(db_path):
        return jsonify({'error': 'No database file found on server'}), 404
    
    # Test if it's a valid SQLite database
    try:
        test_conn = sqlite3.connect(db_path)
        cursor = test_conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [row[0] for row in cursor.fetchall()]
        test_conn.close()
        
        if 'snippets' not in tables:
            return jsonify({'error': 'Invalid massCode database (missing snippets table)'}), 400
        
        app.config['DB_PATH'] = db_path
        return jsonify({
            'message': 'Database loaded successfully',
            'path': db_path,
            'tables': len(tables)
        })
    except sqlite3.Error as e:
        return jsonify({'error': f'Invalid database file: {str(e)}'}), 400

@app.route('/api/config', methods=['GET'])
def get_config():
    """Get client-side configuration"""
    config = app.config['APP_CONFIG']
    
    # Return only client-relevant settings
    client_config = {
        'autoLoadDatabase': config['app']['autoLoadDatabase'],
        'defaultTheme': config['ui']['defaultTheme'],
        'showWelcomeMessage': config['ui']['showWelcomeMessage'],
        'enableAnimations': config['ui']['enableAnimations']
    }
    
    return jsonify(client_config)

@app.route('/api/folders', methods=['GET'])
@login_required
def get_folders():
    db = get_db()
    if not db:
        return jsonify({'error': 'No database loaded'}), 400
    
    cursor = db.cursor()
    cursor.execute('''
        SELECT id, name, parentId, icon, orderIndex
        FROM folders
        ORDER BY orderIndex
    ''')
    
    folders = []
    for row in cursor.fetchall():
        folders.append({
            'id': row[0],
            'name': row[1],
            'parentId': row[2],
            'icon': row[3],
            'orderIndex': row[4]
        })
    
    db.close()
    return jsonify(folders)

@app.route('/api/snippets', methods=['GET'])
@login_required
def get_snippets():
    db = get_db()
    if not db:
        return jsonify({'error': 'No database loaded'}), 400
    
    folder_id = request.args.get('folderId')
    tag_id = request.args.get('tagId')
    search = request.args.get('search')
    is_favorites = request.args.get('isFavorites')
    
    query = '''
        SELECT DISTINCT s.id, s.name, s.description, s.folderId, s.isFavorites, 
               s.createdAt, s.updatedAt, f.name as folderName
        FROM snippets s
        LEFT JOIN folders f ON s.folderId = f.id
        LEFT JOIN snippet_tags st ON s.id = st.snippetId
        WHERE s.isDeleted = 0
    '''
    params = []
    
    if folder_id:
        query += ' AND s.folderId = ?'
        params.append(folder_id)
    
    if tag_id:
        query += ' AND st.tagId = ?'
        params.append(tag_id)
    
    if search:
        query += ''' AND (
            LOWER(s.name) LIKE LOWER(?) OR 
            LOWER(s.description) LIKE LOWER(?) OR
            EXISTS (
                SELECT 1 FROM snippet_contents sc 
                WHERE sc.snippetId = s.id AND LOWER(sc.value) LIKE LOWER(?)
            )
        )'''
        search_param = f'%{search}%'
        params.extend([search_param, search_param, search_param])
    
    if is_favorites:
        query += ' AND s.isFavorites = 1'
    
    query += ' ORDER BY s.createdAt DESC'
    
    cursor = db.cursor()
    cursor.execute(query, params)
    
    snippets = []
    for row in cursor.fetchall():
        snippet_id = row[0]
        
        cursor.execute('''
            SELECT id, label, value, language
            FROM snippet_contents
            WHERE snippetId = ?
        ''', (snippet_id,))
        
        contents = []
        for content_row in cursor.fetchall():
            contents.append({
                'id': content_row[0],
                'label': content_row[1],
                'value': content_row[2],
                'language': content_row[3]
            })
        
        cursor.execute('''
            SELECT t.id, t.name
            FROM tags t
            JOIN snippet_tags st ON t.id = st.tagId
            WHERE st.snippetId = ?
        ''', (snippet_id,))
        
        tags = []
        for tag_row in cursor.fetchall():
            tags.append({
                'id': tag_row[0],
                'name': tag_row[1]
            })
        
        snippets.append({
            'id': row[0],
            'name': row[1],
            'description': row[2],
            'folderId': row[3],
            'isFavorites': row[4],
            'createdAt': row[5],
            'updatedAt': row[6],
            'folderName': row[7],
            'contents': contents,
            'tags': tags
        })
    
    db.close()
    return jsonify(snippets)

@app.route('/api/tags', methods=['GET'])
@login_required
def get_tags():
    db = get_db()
    if not db:
        return jsonify({'error': 'No database loaded'}), 400
    
    cursor = db.cursor()
    cursor.execute('''
        SELECT id, name, createdAt, updatedAt
        FROM tags
        ORDER BY name
    ''')
    
    tags = []
    for row in cursor.fetchall():
        tags.append({
            'id': row[0],
            'name': row[1],
            'createdAt': row[2],
            'updatedAt': row[3]
        })
    
    db.close()
    return jsonify(tags)

@app.route('/api/stats', methods=['GET'])
@login_required
def get_stats():
    db = get_db()
    if not db:
        return jsonify({'error': 'No database loaded'}), 400
    
    cursor = db.cursor()
    
    cursor.execute('SELECT COUNT(*) FROM snippets WHERE isDeleted = 0')
    total_snippets = cursor.fetchone()[0]
    
    cursor.execute('SELECT COUNT(*) FROM folders')
    total_folders = cursor.fetchone()[0]
    
    cursor.execute('SELECT COUNT(*) FROM tags')
    total_tags = cursor.fetchone()[0]
    
    cursor.execute('SELECT COUNT(*) FROM snippets WHERE isFavorites = 1 AND isDeleted = 0')
    favorites_count = cursor.fetchone()[0]
    
    db.close()
    
    return jsonify({
        'totalSnippets': total_snippets,
        'totalFolders': total_folders,
        'totalTags': total_tags,
        'favoritesCount': favorites_count
    })

@app.route('/api/settings/config', methods=['GET'])
@login_required
def get_full_config():
    """Get full configuration for settings page"""
    config = app.config['APP_CONFIG']
    # Don't expose secret key and client secret in full
    safe_config = json.loads(json.dumps(config))
    if 'security' in safe_config:
        safe_config['security']['secretKey'] = '***hidden***'
        if 'github' in safe_config['security']:
            safe_config['security']['github']['clientSecret'] = '***hidden***' if safe_config['security']['github']['clientSecret'] else ''
    return jsonify(safe_config)

@app.route('/api/settings/config', methods=['POST'])
@login_required
def update_full_config():
    """Update configuration"""
    try:
        new_config = request.get_json()
        
        # Validate required structure
        required_keys = ['server', 'app', 'security', 'ui', 'backup', 'logging']
        for key in required_keys:
            if key not in new_config:
                return jsonify({'error': f'Missing required config section: {key}'}), 400
        
        # Load current config to preserve hidden values
        current_config = app.config['APP_CONFIG']
        
        # Preserve secret key if not changed
        if new_config['security']['secretKey'] == '***hidden***':
            new_config['security']['secretKey'] = current_config['security']['secretKey']
        
        # Preserve client secret if not changed
        if 'github' in new_config['security'] and new_config['security']['github']['clientSecret'] == '***hidden***':
            new_config['security']['github']['clientSecret'] = current_config['security']['github']['clientSecret']
        
        # Save to file
        if save_config(new_config):
            # Update runtime config
            app.config['APP_CONFIG'] = new_config
            app.config['SECRET_KEY'] = new_config['security']['secretKey']
            app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(seconds=new_config['security']['sessionLifetime'])
            
            # 检查是否启用自动重启
            auto_restart = new_config.get('app', {}).get('autoRestartOnSave', False)
            
            if auto_restart:
                return jsonify({
                    'message': 'Configuration updated successfully. Application will restart automatically in 2 seconds...',
                    'autoRestart': True
                })
            else:
                return jsonify({
                    'message': 'Configuration updated successfully. Please restart the server for all changes to take effect.',
                    'autoRestart': False
                })
        else:
            return jsonify({'error': 'Failed to save configuration'}), 500
    except Exception as e:
        return jsonify({'error': f'Invalid configuration: {str(e)}'}), 400

@app.route('/api/settings/generate-secret-key', methods=['POST'])
@login_required
def generate_secret_key():
    """Generate a new secret key"""
    new_key = secrets.token_hex(32)
    return jsonify({'secretKey': new_key})

@app.route('/api/restart', methods=['POST'])
@login_required
def restart_app():
    """Restart the application"""
    import sys
    import subprocess
    
    try:
        # 检测是否在 Docker 容器中运行
        is_docker = os.path.exists('/.dockerenv') or os.path.exists('/run/.containerenv')
        
        # 返回响应后重启
        def do_restart():
            import time
            time.sleep(1)  # 等待响应发送完成
            
            if is_docker:
                # Docker 环境：直接退出，让容器重启策略处理
                print('[INFO] Running in Docker, exiting to trigger container restart...')
                os._exit(0)
            else:
                # 非 Docker 环境：启动新进程后退出旧进程
                python = sys.executable
                script = os.path.abspath(__file__)
                
                print(f'[INFO] Starting new process: {python} {script}')
                subprocess.Popen([python, script], 
                               stdout=open('/tmp/masscode.log', 'w'),
                               stderr=subprocess.STDOUT)
                
                # 退出当前进程
                os._exit(0)
        
        # 在后台线程中执行重启
        import threading
        threading.Thread(target=do_restart, daemon=True).start()
        
        environment = 'Docker container' if is_docker else 'Host machine'
        return jsonify({
            'message': f'Application is restarting... (Environment: {environment})',
            'status': 'restarting',
            'environment': environment
        })
    except Exception as e:
        return jsonify({'error': f'Restart failed: {str(e)}'}), 500

# API Token Management
@app.route('/api/tokens', methods=['GET'])
@login_required
def list_tokens():
    """List all API tokens"""
    config = app.config['APP_CONFIG']
    tokens = config['security'].get('apiTokens', [])
    
    # Return all tokens including token values (user requested they can always copy)
    return jsonify(tokens)

@app.route('/api/tokens', methods=['POST'])
@login_required
def create_token():
    """Generate a new API token"""
    try:
        data = request.get_json() or {}
        token_name = data.get('name', 'Unnamed Token')
        expires_days = data.get('expiresDays', 365)  # Default 1 year
        
        # Generate token
        token_value = secrets.token_urlsafe(32)
        token_id = secrets.token_hex(8)
        
        created_at = datetime.now().isoformat()
        expires_at = (datetime.now() + timedelta(days=expires_days)).isoformat() if expires_days else None
        
        token_obj = {
            'id': token_id,
            'token': token_value,
            'name': token_name,
            'createdAt': created_at,
            'expiresAt': expires_at,
            'lastUsed': None
        }
        
        # Save to config
        config = app.config['APP_CONFIG']
        if 'apiTokens' not in config['security']:
            config['security']['apiTokens'] = []
        
        config['security']['apiTokens'].append(token_obj)
        
        if save_config(config):
            app.config['APP_CONFIG'] = config
            # Return token value only once during creation
            return jsonify({
                'id': token_id,
                'token': token_value,  # Only shown once!
                'name': token_name,
                'createdAt': created_at,
                'expiresAt': expires_at,
                'message': 'Token created successfully. Save it now, it will not be shown again!'
            })
        else:
            return jsonify({'error': 'Failed to save token'}), 500
    except Exception as e:
        return jsonify({'error': f'Failed to create token: {str(e)}'}), 500

@app.route('/api/tokens/<token_id>', methods=['DELETE'])
@login_required
def delete_token(token_id):
    """Delete an API token"""
    try:
        config = app.config['APP_CONFIG']
        tokens = config['security'].get('apiTokens', [])
        
        # Find and remove token
        new_tokens = [t for t in tokens if t.get('id') != token_id]
        
        if len(new_tokens) == len(tokens):
            return jsonify({'error': 'Token not found'}), 404
        
        config['security']['apiTokens'] = new_tokens
        
        if save_config(config):
            app.config['APP_CONFIG'] = config
            return jsonify({'message': 'Token deleted successfully'})
        else:
            return jsonify({'error': 'Failed to save configuration'}), 500
    except Exception as e:
        return jsonify({'error': f'Failed to delete token: {str(e)}'}), 500

if __name__ == '__main__':
    config = app.config['APP_CONFIG']
    
    # Create required directories
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    if config['backup']['enabled']:
        os.makedirs(config['backup']['backupDirectory'], exist_ok=True)
    if config['logging']['logToFile']:
        os.makedirs(config['logging']['logDirectory'], exist_ok=True)
    
    # Auto-load database if exists
    db_path = os.path.join(app.config['UPLOAD_FOLDER'], 'massCode.db')
    if os.path.exists(db_path):
        app.config['DB_PATH'] = db_path
        print(f'Auto-loaded existing database: {db_path}')
    
    # Configure logging
    if config['logging']['logToFile']:
        import logging
        logging.basicConfig(
            level=getattr(logging, config['logging']['level']),
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(os.path.join(config['logging']['logDirectory'], 'app.log')),
                logging.StreamHandler()
            ]
        )
    
    # Start server
    print(f"\n{'='*50}")
    print(f"massCode Web Viewer")
    print(f"{'='*50}")
    print(f"Server: http://{config['server']['host']}:{config['server']['port']}")
    print(f"Debug mode: {config['server']['debug']}")
    print(f"Auto-load database: {config['app']['autoLoadDatabase']}")
    print(f"Backup enabled: {config['backup']['enabled']}")
    print(f"{'='*50}\n")
    
    app.run(
        host=config['server']['host'],
        port=config['server']['port'],
        debug=config['server']['debug']
    )
