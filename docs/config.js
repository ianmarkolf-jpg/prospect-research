/**
 * config.js — Set these values after deploying Apps Script
 *
 * HOW TO GET THESE VALUES:
 *
 * APPS_SCRIPT_URL:
 *   1. Open your Google Sheet → Extensions → Apps Script
 *   2. Paste Code.gs content, save
 *   3. Deploy → New Deployment → Web App
 *   4. Execute as: Me | Who has access: Anyone with Google account
 *   5. Copy the Web App URL here
 *
 * GOOGLE_CLIENT_ID:
 *   1. Go to console.cloud.google.com
 *   2. Create project → Enable Google Sheets API + Google Identity Services
 *   3. APIs & Services → Credentials → Create OAuth 2.0 Client ID
 *   4. Application type: Web application
 *   5. Authorized JS origins: https://YOUR-USERNAME.github.io
 *   6. Authorized redirect URIs: https://YOUR-USERNAME.github.io/prospect-research/
 *   7. Copy Client ID here
 *
 * SHEET_ID:
 *   From your Google Sheet URL:
 *   https://docs.google.com/spreadsheets/d/SHEET_ID_IS_HERE/edit
 */

window.APP_CONFIG = {
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec',
  GOOGLE_CLIENT_ID: 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com',
  SHEET_ID: 'YOUR_GOOGLE_SHEET_ID',
  ANTHROPIC_API_KEY: '', // Optional: set here OR enter in UI each session
};
