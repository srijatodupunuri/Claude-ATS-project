# ⚡ ATS Scout — Recruitment Intelligence Platform

## Quick Setup (5 minutes)

### Step 1 — Install Python
Download Python 3.10+ from https://python.org/downloads
✅ Check "Add Python to PATH" during install

### Step 2 — Open Terminal / VS Code Terminal
```
cd ats_scout
```

### Step 3 — Install dependencies
```
pip install -r requirements.txt
```

### Step 4 — Run the app
```
python app.py
```

### Step 5 — Open browser
Go to: http://localhost:5000

---

## Features
- Upload PDF, DOCX, DOC, TXT resume files
- AI-powered ATS scoring (0-100)
- Keyword analysis with impact scores
- Separate Accepted & Rejected reports with reasons
- Role classification: Testing / Development / Integration
- Consolidated HR summary report
- Export reports as HTML files

## Getting Your API Key
1. Go to https://console.anthropic.com
2. Sign up / Log in
3. Click "API Keys" → "Create Key"
4. Copy the key (starts with sk-ant-...)
5. Paste it in the app when prompted

## Sharing With Your Team
Since this runs on Flask, you can share it by:
1. Running on a shared server/cloud VM
2. All teammates access: http://YOUR_SERVER_IP:5000
3. Any updates you make → restart server → everyone sees changes instantly

## Project Structure
```
ats_scout/
├── app.py              ← Flask backend (main server)
├── requirements.txt    ← Python dependencies
├── templates/
│   └── index.html      ← Main HTML page
├── static/
│   ├── css/style.css   ← All styling
│   └── js/app.js       ← All frontend logic
└── uploads/            ← Temporary file storage (auto-cleaned)
```

## Updating Features
- Edit app.py for backend/AI prompt changes
- Edit static/js/app.js for frontend logic
- Edit static/css/style.css for styling
- Edit templates/index.html for layout
- Restart server: Ctrl+C then python app.py
- All users see changes immediately on next page refresh
