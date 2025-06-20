# app.py - DEFINITIVE VERSION (Multi-Login & Patched)
import os
import json
import uuid
import threading
from datetime import datetime, timedelta, date
from flask import Flask, jsonify, request, send_file, send_from_directory
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename

app = Flask(__name__)

DB_FOLDER = "database"
STATIC_FOLDER = "static"
UPLOAD_FOLDER = os.path.join(STATIC_FOLDER, 'profile_pictures')
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}
TOKEN_EXPIRATION = timedelta(days=7) # Increased for better multi-device experience
file_lock = threading.Lock()

def read_json_file(path, default=None):
    try:
        with open(path, 'r') as f: return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return default if default is not None else {}

def write_json_file(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w') as f: json.dump(data, f, indent=4)

def get_user_folder(username):
    return os.path.join(DB_FOLDER, username)

def get_user_metadata_path(username):
    return os.path.join(get_user_folder(username), "metadata.json")

def get_user_tasks_path(username):
    return os.path.join(get_user_folder(username), "tasks.json")

# MODIFIED: To support multiple tokens
def find_user_by_token(token):
    if not token or not os.path.exists(DB_FOLDER): return None
    for username in os.listdir(DB_FOLDER):
        user_folder = get_user_folder(username)
        if os.path.isdir(user_folder):
            metadata = read_json_file(get_user_metadata_path(username))
            session_tokens = metadata.get("session_tokens", {})
            
            if token in session_tokens:
                token_data = session_tokens[token]
                token_time_str = token_data.get("creation_time")
                if token_time_str:
                    try:
                        token_time = datetime.fromisoformat(token_time_str)
                        if datetime.utcnow() - token_time < TOKEN_EXPIRATION:
                            return username
                    except ValueError: continue
    return None

def get_user_from_auth_header():
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return None, None, jsonify({"error": "Authorization header missing"}), 401
    token = auth_header.split(" ")[1]
    username = find_user_by_token(token)
    if not username:
        return None, None, jsonify({"error": "Invalid or expired session token"}), 401
    return username, token, None, None # Return token for logout purposes

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/')
def home():
    return send_file("src/index.html")

@app.route('/static/<path:filename>')
def serve_static(filename):
    return send_from_directory(STATIC_FOLDER, filename)

# MODIFIED: To use the new session_tokens dictionary
@app.route('/add_user', methods=["POST"])
def add_user():
    data = request.get_json()
    if not data or 'username' not in data or 'password' not in data:
        return jsonify({"error": "Username and password are required"}), 400
    username = data['username']
    with file_lock:
        if os.path.exists(get_user_folder(username)):
            return jsonify({"error": "Username already exists"}), 409
        session_token = uuid.uuid4().hex
        hashed_password = generate_password_hash(data['password'])
        metadata = {
            "password_hash": hashed_password, 
            "points": 0, 
            "profile_photo": "default_dp.png",
            "session_tokens": {
                session_token: {"creation_time": datetime.utcnow().isoformat()}
            }
        }
        write_json_file(get_user_metadata_path(username), metadata)
        write_json_file(get_user_tasks_path(username), [])
    return jsonify({"message": f"User '{username}' created", "session_token": session_token}), 201

# MODIFIED: To add a new token without deleting others
@app.route('/login', methods=["POST"])
def login():
    data = request.get_json()
    if not data or 'username' not in data or 'password' not in data:
        return jsonify({"error": "Username and password are required"}), 400
    username = data['username']
    with file_lock:
        metadata_path = get_user_metadata_path(username)
        metadata = read_json_file(metadata_path)
        if not metadata:
            return jsonify({"error": "User not found. Proceed with signup."}), 404
        if not check_password_hash(metadata.get("password_hash", ""), data['password']):
            return jsonify({"error": "Incorrect password."}), 401
        
        # Clean up expired tokens before adding a new one
        now = datetime.utcnow()
        session_tokens = metadata.get("session_tokens", {})
        active_tokens = {
            token: data for token, data in session_tokens.items()
            if now - datetime.fromisoformat(data.get("creation_time", "1970-01-01")) < TOKEN_EXPIRATION
        }
        
        # Generate and add the new token
        new_session_token = uuid.uuid4().hex
        active_tokens[new_session_token] = {"creation_time": now.isoformat()}
        metadata["session_tokens"] = active_tokens
        
        write_json_file(metadata_path, metadata)
    return jsonify({"message": "Login successful", "session_token": new_session_token, "profile_photo": metadata.get('profile_photo')})

# MODIFIED: To only remove the current session's token
@app.route('/logout', methods=['POST'])
def logout():
    username, token, err, code = get_user_from_auth_header()
    if err: return err, code
    with file_lock:
        metadata_path = get_user_metadata_path(username)
        metadata = read_json_file(metadata_path)
        if "session_tokens" in metadata and token in metadata["session_tokens"]:
            metadata["session_tokens"].pop(token)
            write_json_file(metadata_path, metadata)
    return jsonify({"message": "Logout successful"})

# FIXED & SECURED: Now requires password to prevent accidental renaming
@app.route('/update_username', methods=['POST'])
def update_username():
    username, _, err, code = get_user_from_auth_header()
    if err: return err, code
    data = request.get_json()
    new_username = data.get('new_username')
    current_password = data.get('current_password')

    if not new_username or not current_password:
        return jsonify({"error": "New username and your current password are required"}), 400
    if new_username == username: 
        return jsonify({"error": "New username cannot be the same as the old one."}), 400

    with file_lock:
        metadata_path = get_user_metadata_path(username)
        metadata = read_json_file(metadata_path)

        if not check_password_hash(metadata.get("password_hash", ""), current_password):
            return jsonify({"error": "Incorrect password."}), 401

        if os.path.exists(get_user_folder(new_username)):
            return jsonify({"error": "This username is already taken."}), 409

        old_path = get_user_folder(username)
        new_path = get_user_folder(new_username)
        os.rename(old_path, new_path)
        
        # Log out all other sessions for security and issue a new token
        new_metadata_path = get_user_metadata_path(new_username)
        new_metadata = read_json_file(new_metadata_path) # Read from new location
        session_token = uuid.uuid4().hex
        new_metadata['session_tokens'] = {
            session_token: {"creation_time": datetime.utcnow().isoformat()}
        }
        write_json_file(new_metadata_path, new_metadata)

    return jsonify({"message": "Username updated. You have been logged out of other devices.", "new_token": session_token, "new_username": new_username})

# SECURED: Logs out other sessions upon password change
@app.route('/update_password', methods=['POST'])
def update_password():
    username, _, err, code = get_user_from_auth_header()
    if err: return err, code
    data = request.get_json()
    if not data or 'new_password' not in data: 
        return jsonify({"error": "New password is required"}), 400
        
    with file_lock:
        metadata_path = get_user_metadata_path(username)
        metadata = read_json_file(metadata_path)
        metadata['password_hash'] = generate_password_hash(data['new_password'])
        
        # Log out all other sessions and issue one new token for this device
        session_token = uuid.uuid4().hex
        metadata['session_tokens'] = {
            session_token: {"creation_time": datetime.utcnow().isoformat()}
        }
        write_json_file(metadata_path, metadata)
        
    return jsonify({"message": "Password updated successfully. You have been logged out of other devices.", "new_token": session_token})

# Note: The rest of the functions from your original file are compatible with these
# changes and do not need modification. I am including them for completeness.

@app.route('/upload_profile_picture', methods=['POST'])
def upload_profile_picture():
    username, _, err, code = get_user_from_auth_header()
    if err: return err, code
    if 'profile_pic' not in request.files: return jsonify({"error": "No file part"}), 400
    file = request.files['profile_pic']
    if file.filename == '': return jsonify({"error": "No selected file"}), 400
    if file and allowed_file(file.filename):
        ext = file.filename.rsplit('.', 1)[1].lower()
        unique_filename = f"{username}_{uuid.uuid4().hex}.{ext}"
        save_path = os.path.join(UPLOAD_FOLDER, unique_filename)
        
        with file_lock:
            metadata_path = get_user_metadata_path(username)
            metadata = read_json_file(metadata_path)
            old_photo_path = metadata.get('profile_photo')

            if old_photo_path and old_photo_path != 'default_dp.png':
                full_old_path = os.path.join(STATIC_FOLDER, old_photo_path)
                if os.path.exists(full_old_path):
                    try:
                        os.remove(full_old_path)
                    except OSError as e:
                        print(f"Error deleting old profile picture {full_old_path}: {e}")
            
            file.save(save_path)
            relative_path = os.path.join('profile_pictures', unique_filename).replace("\\", "/")
            metadata['profile_photo'] = relative_path
            write_json_file(metadata_path, metadata)
            
        return jsonify({"message": "Profile picture updated", "filePath": relative_path})
    return jsonify({"error": "File type not allowed"}), 400
    
@app.route('/add_task', methods=['POST'])
def add_task():
    username, _, err, code = get_user_from_auth_header()
    if err: return err, code
    data = request.get_json()
    if not data or 'task_text' not in data: return jsonify({"error": "task_text is required"}), 400
    with file_lock:
        tasks_path = get_user_tasks_path(username)
        tasks = read_json_file(tasks_path, default=[])
        today_str = date.today().isoformat()
        todays_tasks = [t for t in tasks if t['date_added'].startswith(today_str)]
        if len(todays_tasks) >= 6: return jsonify({"error": "Maximum of 6 tasks per day reached."}), 403
        new_task = {"id": uuid.uuid4().hex, "text": data['task_text'], "completed": False, "date_added": datetime.now().isoformat()}
        tasks.append(new_task)
        write_json_file(tasks_path, tasks)
    return jsonify({"message": "Task added", "task": new_task}), 201

@app.route('/get_my_tasks', methods=['GET'])
def get_my_tasks():
    username, _, err, code = get_user_from_auth_header()
    if err: return err, code
    with file_lock:
        tasks_path = get_user_tasks_path(username)
        all_tasks = read_json_file(tasks_path, default=[])
        today_str = date.today().isoformat()
        todays_tasks = [t for t in all_tasks if t.get('date_added', '').startswith(today_str)]
    return jsonify(todays_tasks)

@app.route('/get_task_history', methods=['GET'])
def get_task_history():
    username, _, err, code = get_user_from_auth_header()
    if err: return err, code
    history = {}
    with file_lock:
        tasks_path = get_user_tasks_path(username)
        all_tasks = read_json_file(tasks_path, default=[])
        for task in all_tasks:
            if task.get('completed'):
                task_date_str = datetime.fromisoformat(task['date_added']).strftime('%Y-%m-%d')
                history[task_date_str] = history.get(task_date_str, 0) + 1
    last_7_days_data = {}
    for i in range(7):
        day = date.today() - timedelta(days=i)
        day_str = day.isoformat()
        last_7_days_data[day_str] = history.get(day_str, 0)
    return jsonify(last_7_days_data)

@app.route('/update_task', methods=["POST", 'DELETE'])
def update_task():
    username, _, err, code = get_user_from_auth_header()
    if err: return err, code
    data = request.get_json()
    if not data or 'task_id' not in data: return jsonify({"error": "task_id is required"}), 400
    task_id = data['task_id']
    with file_lock:
        tasks_path = get_user_tasks_path(username)
        tasks = read_json_file(tasks_path, default=[])
        task_to_update = next((t for t in tasks if t['id'] == task_id), None)
        if not task_to_update: return jsonify({"error": "Task not found"}), 404
        if request.method == 'DELETE':
            if task_to_update.get('completed'):
                 metadata_path = get_user_metadata_path(username)
                 metadata = read_json_file(metadata_path)
                 metadata['points'] = max(0, metadata.get('points', 0) - 3)
                 write_json_file(metadata_path, metadata)
            tasks.remove(task_to_update)
            write_json_file(tasks_path, tasks)
            return jsonify({"message": f"Task deleted"})
        if request.method == 'POST':
            is_completed = data.get('completed', False)
            if task_to_update.get('completed') != is_completed:
                task_to_update['completed'] = is_completed
                metadata_path = get_user_metadata_path(username)
                metadata = read_json_file(metadata_path)
                points_change = 3 if is_completed else -3
                metadata['points'] = max(0, metadata.get('points', 0) + points_change)
                write_json_file(metadata_path, metadata)
                write_json_file(tasks_path, tasks)
                return jsonify({"message": f"Task updated! Total points: {metadata['points']}"})
            return jsonify({"message": "Task status unchanged."})

@app.route('/add_comment', methods=['POST'])
def add_comment():
    username, _, err, code = get_user_from_auth_header()
    if err: return err, code
    data = request.get_json()
    if not data or 'text' not in data: return jsonify({"error": "text is required"}), 400
    with file_lock:
        comments_path = os.path.join(DB_FOLDER, "comments.json")
        comments = read_json_file(comments_path, default=[])
        new_comment = {"id": uuid.uuid4().hex, "username": username, "text": data['text'], "timestamp": datetime.utcnow().isoformat()}
        comments.append(new_comment)
        write_json_file(comments_path, comments)
    return jsonify({"message": "Comment added", "comment": new_comment}), 201

@app.route('/get_points', methods=["GET"])
def get_points():
    leaderboard = []
    if not os.path.exists(DB_FOLDER): return jsonify([])
    for username in os.listdir(DB_FOLDER):
        user_folder = get_user_folder(username)
        if os.path.isdir(user_folder):
            metadata = read_json_file(get_user_metadata_path(username))
            if metadata:
                leaderboard.append({
                    "username": username,
                    "points": metadata.get('points', 0),
                    "profile_photo": metadata.get('profile_photo', 'default_dp.png')
                })
    leaderboard.sort(key=lambda x: x['points'], reverse=True)
    return jsonify(leaderboard)

@app.route('/get_my_points', methods=["GET"])
def get_my_points():
    leaderboard = []
    if not os.path.exists(DB_FOLDER): return jsonify([])
    for username in os.listdir(DB_FOLDER):
        user_folder = get_user_folder(username)
        if os.path.isdir(user_folder):
            metadata = read_json_file(get_user_metadata_path(username))
            if metadata:
                leaderboard.append({
                    "points": metadata.get('points', 0)
                })
    leaderboard.sort(key=lambda x: x['points'], reverse=True)
    return jsonify(leaderboard)

@app.route('/get_comments', methods=['GET'])
def get_comments():
    comments_path = os.path.join(DB_FOLDER, "comments.json")
    with file_lock:
        all_comments = read_json_file(comments_path, default=[])
        twelve_hours_ago = datetime.utcnow() - timedelta(hours=12)
        valid_comments = [c for c in all_comments if datetime.fromisoformat(c.get("timestamp", "1970-01-01")) > twelve_hours_ago]

        enriched_comments = []
        user_photos = {}
        for comment in valid_comments:
            commenter_username = comment.get('username')
            if commenter_username not in user_photos:
                commenter_meta = read_json_file(get_user_metadata_path(commenter_username), {})
                user_photos[commenter_username] = commenter_meta.get('profile_photo', 'default_dp.png')
            
            comment['profile_photo'] = user_photos[commenter_username]
            enriched_comments.append(comment)

        if len(valid_comments) < len(all_comments):
            write_json_file(comments_path, valid_comments)
            
    return jsonify(enriched_comments)

if __name__ == '__main__':
    os.makedirs(DB_FOLDER, exist_ok=True)
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    app.run(host='0.0.0.0', port=5000, debug=True)
