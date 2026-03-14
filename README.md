# Prospect Research App
## Markolf Capital — Silver Tsunami + Fix & Flip

---

## What This Is

A private web app hosted on GitHub Pages that:
- Researches acquisition targets (Silver Tsunami) and fix & flip properties
- Calls Claude API with web search for each prospect
- Reads your pipeline from Google Sheets
- Writes research results back to your sheet with one click
- Runs automated batch research every Sunday via Apps Script

---

## Setup: Step by Step

### Step 1 — Create the GitHub repo

```bash
# On GitHub.com: New repository → Name: prospect-research → Private → Create

git clone https://github.com/YOUR-USERNAME/prospect-research.git
cd prospect-research

# Copy these files into the repo:
# .github/workflows/deploy.yml
# docs/index.html
# docs/config.js
# appsscript/Code.gs   (for reference — paste into Apps Script editor)

git add .
git commit -m "Initial deploy"
git push origin main
```

### Step 2 — Enable GitHub Pages

1. Go to your repo → Settings → Pages
2. Source: **GitHub Actions**
3. Push to main triggers auto-deploy
4. Your app URL: `https://YOUR-USERNAME.github.io/prospect-research/`

### Step 3 — Set up Google Cloud Project

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project: **"Markolf Research"**
3. Enable these APIs:
   - **Google Sheets API**
   - No other APIs needed (Identity Services is built-in)
4. Go to **APIs & Services → Credentials**
5. Click **Create Credentials → OAuth 2.0 Client ID**
   - Application type: **Web application**
   - Name: Prospect Research App
   - Authorized JavaScript origins:
     ```
     https://YOUR-USERNAME.github.io
     http://localhost:8080
     ```
   - Authorized redirect URIs:
     ```
     https://YOUR-USERNAME.github.io/prospect-research/
     http://localhost:8080/
     ```
6. Copy the **Client ID** — you'll need it in Step 5

### Step 4 — Import tracker to Google Sheets

1. Go to [sheets.google.com](https://sheets.google.com) → Import
2. Upload `acquisition_tracker_fixed.xlsx`
3. Import type: Replace spreadsheet
4. Copy the Sheet ID from the URL:
   `https://docs.google.com/spreadsheets/d/`**`THIS_PART`**`/edit`

### Step 5 — Deploy Apps Script

1. Open your Google Sheet → **Extensions → Apps Script**
2. Delete the default `myFunction()` code
3. Paste the entire contents of `appsscript/Code.gs`
4. Save (Ctrl+S)
5. Set your Anthropic API key as a script property:
   - **Project Settings** (gear icon) → **Script Properties**
   - Add property: `ANTHROPIC_API_KEY` = `sk-ant-your-key`
   - Add property: `SHEET_ID` = your Sheet ID from Step 4
6. **Deploy → New Deployment**
   - Type: **Web App**
   - Execute as: **Me**
   - Who has access: **Anyone with Google Account**
7. Click **Deploy** → Copy the **Web App URL**
8. (Optional) Set up weekly trigger:
   - In Apps Script, run the function `setupWeeklyTrigger` once
   - This schedules automatic Sunday 7am research batches

### Step 6 — Update config.js

Edit `docs/config.js`:

```javascript
window.APP_CONFIG = {
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/YOUR_DEPLOY_ID/exec',
  GOOGLE_CLIENT_ID: 'YOUR_CLIENT_ID.apps.googleusercontent.com',
  SHEET_ID: 'YOUR_SHEET_ID',
  ANTHROPIC_API_KEY: '', // Or paste key here to skip UI entry
};
```

Commit and push — GitHub Actions auto-deploys in ~60 seconds.

### Step 7 — Test

1. Open `https://YOUR-USERNAME.github.io/prospect-research/`
2. Sign in with Google
3. Your pipeline should load in the Pipeline tab
4. Try researching a company — results appear in the right panel
5. Click "Save to Sheet" — verify the row updated in Google Sheets

---

## Local Development

```bash
cd docs
python3 -m http.server 8080
# Open: http://localhost:8080
```

---

## How the Automation Works

```
Every Sunday 7am
      ↓
Apps Script trigger fires runWeeklyBatch()
      ↓
Reads all "Researched" rows from Google Sheet
      ↓
Calls Claude API (web search) for each company
      ↓
Writes owner name, age, PE flag, certs, scores back
      ↓
Updates Pipeline Status → Cold or Dead/Disqualified
      ↓
Emails you a summary report
```

**Cost:** ~$0.15–0.25 per company researched. A 20-company Sunday batch = ~$3–5.

---

## File Structure

```
prospect-research/
├── .github/
│   └── workflows/
│       └── deploy.yml          ← Auto-deploy to GitHub Pages
├── docs/                       ← Everything in here is the website
│   ├── index.html              ← The app
│   └── config.js               ← Your keys and URLs (update this)
└── appsscript/
    └── Code.gs                 ← Paste into Apps Script editor
```

---

## Security Notes

- The repo should be **Private** on GitHub
- `config.js` contains your Google Client ID (safe to commit — it's public by design)
- **Never commit your Anthropic API key** to config.js — enter it in the UI or use Apps Script properties
- Access to the app requires Google OAuth — only accounts you authorize can use it
- Your Google Sheet stays private — the app accesses it via your OAuth token

---

## Troubleshooting

**CORS error on research:**
The Anthropic API requires `anthropic-dangerous-direct-browser-calls: true` header for browser calls. If you see CORS errors locally, run from a local server (`python3 -m http.server 8080`) not by opening the HTML file directly.

**"Apps Script URL not found":**
Make sure you deployed as "Web App" not "API Executable". Re-deploy if needed.

**Google login not working:**
Double-check your authorized JavaScript origins include your exact GitHub Pages URL (no trailing slash on the origin).

**Sheet not updating:**
The Apps Script must be deployed with "Execute as: Me" and "Anyone with Google Account" access. Re-deploy after any code changes.
