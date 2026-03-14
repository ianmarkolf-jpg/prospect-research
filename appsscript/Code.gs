/**
 * Silver Tsunami + Fix & Flip — Prospect Research Backend
 * Ian Markolf | SE Wisconsin | 2026
 *
 * Deploy as: Extensions → Apps Script → Deploy → New deployment
 * Type: Web App | Execute as: Me | Who has access: Anyone with Google account
 *
 * After deploy, copy the Web App URL into config.js in the GitHub Pages app.
 */

// ── Config ────────────────────────────────────────────────────────────────────

const CONFIG = {
  ANTHROPIC_API_KEY: PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY'),
  SHEET_ID:          PropertiesService.getScriptProperties().getProperty('SHEET_ID'),
  COMPANY_SHEET:     'Company DB',
  FLIP_SHEET:        'Fix & Flip Prospects',
  DATA_START_ROW:    7,
  BATCH_SIZE:        20,
};

// Column mapping — Company DB
const COL = {
  company:     1,  city:        2,  county:      3,  state:       4,
  sector:      5,  founded:     6,  revenue:     7,  ebitda:      8,
  margin:      9,  certs:       10, thesis:      11, status:      12,
  owner:       13, owner_age:   14, score_age:   15, score_found: 16,
  score_fam:   17, score_pe:    18, score_mgmt:  19, total:       20,
  tier:        21, last_contact:22, next_action: 23, next_date:   24,
  notes:       25,
};

// Column mapping — Fix & Flip sheet
const FLIP_COL = {
  address:     1,  list_price:  2,  status:      3,  beds:        4,
  baths:       5,  sqft:        6,  year_built:  7,  dom:         8,
  arv_est:     9,  rehab_est:   10, all_in:      11, est_profit:  12,
  verdict:     13, owner:       14, tax_delinq:  15, neighborhood:16,
  next_action: 17, notes:       18, researched:  19,
};

// ── HTTP Handler ──────────────────────────────────────────────────────────────

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  };

  try {
    // Verify caller is authenticated Google user
    const userEmail = Session.getActiveUser().getEmail();
    if (!userEmail) {
      return respond({ error: 'Unauthorized' }, 401, headers);
    }

    const params = e.parameter || {};
    const action = params.action || (e.postData ? JSON.parse(e.postData.contents).action : null);

    switch (action) {
      case 'getRows':          return respond(getRows(params), 200, headers);
      case 'researchCompany':  return respond(researchCompany(params), 200, headers);
      case 'researchProperty': return respond(researchProperty(params), 200, headers);
      case 'saveCompany':      return respond(saveCompany(JSON.parse(e.postData.contents)), 200, headers);
      case 'saveProperty':     return respond(saveProperty(JSON.parse(e.postData.contents)), 200, headers);
      case 'batchResearch':    return respond(batchResearch(params), 200, headers);
      case 'getDashboard':     return respond(getDashboard(), 200, headers);
      case 'ping':             return respond({ ok: true, user: userEmail }, 200, headers);
      default:                 return respond({ error: 'Unknown action: ' + action }, 400, headers);
    }
  } catch (err) {
    console.error('Handler error:', err);
    return respond({ error: err.message }, 500, headers);
  }
}

function respond(data, code, headers) {
  const output = ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
  return output;
}

// ── Sheet helpers ─────────────────────────────────────────────────────────────

function getSheet(name) {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  let sheet = ss.getSheetByName(name);
  if (!sheet && name === CONFIG.FLIP_SHEET) {
    sheet = ss.insertSheet(name);
    // Write headers
    const headers = ['Address','List Price','Status','Beds','Baths','Sqft','Year Built',
      'Days on Market','ARV Est.','Rehab Est.','All-In Cost','Est. Profit',
      'Verdict','Owner','Tax Delinquent','Neighborhood','Next Action','Notes','Date Researched'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getRows(params) {
  const sheet = getSheet(CONFIG.COMPANY_SHEET);
  const lastRow = sheet.getLastRow();
  if (lastRow < CONFIG.DATA_START_ROW) return { rows: [], total: 0 };

  const range = sheet.getRange(CONFIG.DATA_START_ROW, 1, lastRow - CONFIG.DATA_START_ROW + 1, 25);
  const values = range.getValues();

  const statusFilter = params.status || null;
  const tierFilter   = params.tier   || null;
  const limit        = parseInt(params.limit) || 200;

  const rows = values
    .map((row, i) => ({
      rowNum:      CONFIG.DATA_START_ROW + i,
      company:     row[COL.company - 1],
      city:        row[COL.city - 1],
      county:      row[COL.county - 1],
      state:       row[COL.state - 1],
      sector:      row[COL.sector - 1],
      founded:     row[COL.founded - 1],
      revenue:     row[COL.revenue - 1],
      ebitda:      row[COL.ebitda - 1],
      certs:       row[COL.certs - 1],
      status:      row[COL.status - 1],
      owner:       row[COL.owner - 1],
      owner_age:   row[COL.owner_age - 1],
      score_age:   row[COL.score_age - 1],
      score_found: row[COL.score_found - 1],
      score_fam:   row[COL.score_fam - 1],
      score_pe:    row[COL.score_pe - 1],
      score_mgmt:  row[COL.score_mgmt - 1],
      total:       row[COL.total - 1],
      tier:        row[COL.tier - 1],
      last_contact:row[COL.last_contact - 1],
      next_action: row[COL.next_action - 1],
      notes:       row[COL.notes - 1],
    }))
    .filter(r => r.company && typeof r.company === 'string' && r.company.length > 2)
    .filter(r => !statusFilter || r.status === statusFilter)
    .filter(r => !tierFilter   || (r.tier && r.tier.includes(tierFilter)))
    .slice(0, limit);

  return { rows, total: rows.length };
}

// ── Claude API caller ─────────────────────────────────────────────────────────

function callClaude(prompt) {
  if (!CONFIG.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not set in Script Properties');
  }

  const payload = {
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    tools: [{ type: 'web_search_20250305', name: 'web_search' }],
    messages: [{ role: 'user', content: prompt }],
  };

  const response = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': CONFIG.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  const code = response.getResponseCode();
  const body = JSON.parse(response.getContentText());

  if (code !== 200) {
    throw new Error(`Claude API error ${code}: ${body.error?.message}`);
  }

  // Extract text content
  let text = '';
  for (const block of body.content) {
    if (block.type === 'text') text += block.text;
  }

  // Parse JSON from response
  let jsonText = text.trim();
  const fenceMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) jsonText = fenceMatch[1];
  const objMatch = jsonText.match(/\{[\s\S]*\}/);
  if (!objMatch) throw new Error('No JSON in Claude response');

  return JSON.parse(objMatch[0]);
}

// ── Research: Company ─────────────────────────────────────────────────────────

function researchCompany(params) {
  const prompt = buildTsunamiPrompt(
    params.company, params.city, params.state,
    params.founded, params.revenue, params.certs
  );
  return callClaude(prompt);
}

function buildTsunamiPrompt(company, city, state, founded, revenue, certs) {
  return `You are a lower-middle-market business acquisition researcher for Ian Markolf, a Milwaukee-based investor targeting founder-owned industrial businesses in SE Wisconsin ($2.5M–$6M purchase, SBA 7(a) financing).

TARGET PROFILE: Revenue $1M–$25M, founded pre-2000, no PE backing, owner aged 58–72 approaching retirement, certification moat (AS9100, ISO 9001, ITAR, NADCAP, ISO 13485, Mil-Spec).

COMPANY: ${company} | ${city || 'Unknown'}, ${state || 'WI'} | Founded: ${founded || 'Unknown'} | Revenue: ${revenue || 'Unknown'} | Certs: ${certs || 'Unknown'}

Search the web and return ONLY valid JSON (no markdown, no preamble):
{
  "owner_name": "string or Unknown",
  "owner_age_est": "range like 58-65 or Unknown",
  "score_age": 1-5,
  "pe_flag": true/false,
  "pe_detail": "string or null",
  "score_pe": 1-5,
  "family_in_leadership": "description or Unknown",
  "score_family": 1-5,
  "certs_confirmed": "string",
  "revenue_est": number or null,
  "employee_count": "string or null",
  "score_founding": 1-5,
  "score_mgmt": 1-5,
  "total_score": number,
  "priority_tier": "Tier 1 — Immediate | Tier 2 — Active Watch | Low Priority | Remove / Monitor Only",
  "disqualified": true/false,
  "disqualify_reason": "string or null",
  "pipeline_status": "Cold or Dead/Disqualified",
  "next_action": "string",
  "succession_signals": ["signal1"],
  "red_flags": ["flag1"],
  "research_notes": "2-3 sentences. Prefix unconfirmed facts with Unconfirmed:",
  "wis_sos_url": "string or null",
  "linkedin_url": "string or null"
}

Scoring — Age: 68+=5,63-67=4,55-62=3,50-54=2,<50=1,unknown=3
PE: confirmed clean=5,unknown=4,partial inst.=3,majority PE=2,confirmed PE=1
Family: no family=5,non-op family=4,one op member=3,two members=2,full succession=1
Mgmt: full team=5,GM exists=4,ops mgr=3,founder+1=2,founder only=1
Founding: pre-1990=5,1990-95=4,1995-2000=3,2000-05=2,post-2005=1
Total = sum of all 5`;
}

// ── Research: Property ────────────────────────────────────────────────────────

function researchProperty(params) {
  const prompt = buildFlipPrompt(
    params.address, params.list_price, params.prop_type,
    params.beds, params.sqft, params.rehab_est
  );
  return callClaude(prompt);
}

function buildFlipPrompt(address, listPrice, propType, beds, sqft, rehabEst) {
  return `You are a fix & flip investment analyst for Ian Markolf, a Milwaukee-based real estate investor. Target: purchase + rehab under $250K total, ARV $275K–$400K, minimum $40K net profit. SE Wisconsin market.

PROPERTY: ${address} | List: ${listPrice || 'Unknown'} | Type: ${propType || 'SFR'} | Beds: ${beds || 'Unknown'} | Sqft: ${sqft || 'Unknown'} | Ian's rehab est.: ${rehabEst || 'Unknown'}

Search Zillow, Redfin, county records and return ONLY valid JSON:
{
  "address_confirmed": "string",
  "list_price": number or null,
  "beds": number or null,
  "baths": number or null,
  "sqft": number or null,
  "year_built": number or null,
  "days_on_market": number or null,
  "price_reductions": number,
  "current_owner": "string or Unknown",
  "years_owned": number or null,
  "tax_delinquent": true/false,
  "lien_signals": "string or None found",
  "arv_estimate": number,
  "arv_confidence": "High | Medium | Low",
  "comps": [{"address":"string","sold_price":number,"sold_date":"string","sqft":number,"beds":number}],
  "rehab_estimate_ian": number,
  "rehab_notes": "string",
  "max_offer_70pct": number,
  "all_in_cost": number,
  "estimated_profit": number,
  "profit_margin_pct": number,
  "deal_verdict": "Strong Deal | Marginal | Pass",
  "deal_verdict_reason": "string",
  "distress_signals": ["string"],
  "red_flags": ["string"],
  "neighborhood_score": "A|B|C|D",
  "neighborhood_notes": "string",
  "next_action": "string",
  "research_notes": "2-3 sentences"
}`;
}

// ── Save results back to sheet ────────────────────────────────────────────────

function saveCompany(data) {
  const result  = data.result;
  const rowNum  = data.rowNum;
  const sheet   = getSheet(CONFIG.COMPANY_SHEET);

  if (!rowNum || !result) return { ok: false, error: 'Missing rowNum or result' };

  const today = new Date().toISOString().split('T')[0];

  // Only write non-null, non-Unknown values
  const safeSet = (col, val) => {
    if (val !== null && val !== undefined && val !== '' && val !== 'Unknown') {
      sheet.getRange(rowNum, col).setValue(val);
    }
  };

  safeSet(COL.owner,       result.owner_name);
  safeSet(COL.owner_age,   result.owner_age_est);
  safeSet(COL.score_age,   result.score_age);
  safeSet(COL.score_fam,   result.score_family);
  safeSet(COL.score_pe,    result.score_pe);
  safeSet(COL.score_mgmt,  result.score_mgmt);
  safeSet(COL.certs,       result.certs_confirmed);
  if (result.revenue_est)  safeSet(COL.revenue, result.revenue_est);
  if (result.revenue_est)  safeSet(COL.ebitda,  Math.round(result.revenue_est * 0.14));

  // Recalculate total from sheet values
  const sf   = sheet.getRange(rowNum, COL.score_found).getValue() || 2;
  const sa   = result.score_age   || 3;
  const sfam = result.score_family || 2;
  const spe  = result.score_pe    || 4;
  const smg  = result.score_mgmt  || 3;
  const total = sa + sf + sfam + spe + smg;

  sheet.getRange(rowNum, COL.total).setValue(total);
  sheet.getRange(rowNum, COL.tier).setValue(tierLabel(total));
  sheet.getRange(rowNum, COL.status).setValue(result.pipeline_status || 'Cold');
  safeSet(COL.next_action,  result.next_action);
  safeSet(COL.notes,        result.research_notes);
  sheet.getRange(rowNum, COL.last_contact).setValue(today);

  return { ok: true, rowNum, total, tier: tierLabel(total) };
}

function saveProperty(data) {
  const result  = data.result;
  const address = data.address;
  const sheet   = getSheet(CONFIG.FLIP_SHEET);

  // Find existing row or append
  const values = sheet.getDataRange().getValues();
  let rowNum = -1;
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === address) { rowNum = i + 1; break; }
  }
  if (rowNum === -1) {
    rowNum = sheet.getLastRow() + 1;
    sheet.getRange(rowNum, FLIP_COL.address).setValue(address);
  }

  sheet.getRange(rowNum, FLIP_COL.list_price).setValue(result.list_price || '');
  sheet.getRange(rowNum, FLIP_COL.status).setValue(result.deal_verdict || '');
  sheet.getRange(rowNum, FLIP_COL.beds).setValue(result.beds || '');
  sheet.getRange(rowNum, FLIP_COL.baths).setValue(result.baths || '');
  sheet.getRange(rowNum, FLIP_COL.sqft).setValue(result.sqft || '');
  sheet.getRange(rowNum, FLIP_COL.year_built).setValue(result.year_built || '');
  sheet.getRange(rowNum, FLIP_COL.dom).setValue(result.days_on_market || '');
  sheet.getRange(rowNum, FLIP_COL.arv_est).setValue(result.arv_estimate || '');
  sheet.getRange(rowNum, FLIP_COL.rehab_est).setValue(result.rehab_estimate_ian || '');
  sheet.getRange(rowNum, FLIP_COL.all_in).setValue(result.all_in_cost || '');
  sheet.getRange(rowNum, FLIP_COL.est_profit).setValue(result.estimated_profit || '');
  sheet.getRange(rowNum, FLIP_COL.verdict).setValue(result.deal_verdict || '');
  sheet.getRange(rowNum, FLIP_COL.owner).setValue(result.current_owner || '');
  sheet.getRange(rowNum, FLIP_COL.tax_delinq).setValue(result.tax_delinquent ? 'YES' : 'No');
  sheet.getRange(rowNum, FLIP_COL.neighborhood).setValue(result.neighborhood_score || '');
  sheet.getRange(rowNum, FLIP_COL.next_action).setValue(result.next_action || '');
  sheet.getRange(rowNum, FLIP_COL.notes).setValue(result.research_notes || '');
  sheet.getRange(rowNum, FLIP_COL.researched).setValue(new Date().toISOString().split('T')[0]);

  return { ok: true, rowNum, verdict: result.deal_verdict };
}

// ── Batch research (triggered automatically) ──────────────────────────────────

function batchResearch(params) {
  const sheet   = getSheet(CONFIG.COMPANY_SHEET);
  const lastRow = sheet.getLastRow();
  const batchSize = parseInt(params.batchSize) || CONFIG.BATCH_SIZE;

  const values = sheet.getRange(CONFIG.DATA_START_ROW, 1, lastRow - CONFIG.DATA_START_ROW + 1, 25).getValues();

  // Collect unresearched rows, sorted by founding score desc
  const queue = values
    .map((row, i) => ({
      rowNum:      CONFIG.DATA_START_ROW + i,
      company:     row[COL.company - 1],
      city:        row[COL.city - 1],
      state:       row[COL.state - 1],
      founded:     row[COL.founded - 1],
      revenue:     row[COL.revenue - 1],
      certs:       row[COL.certs - 1],
      status:      row[COL.status - 1],
      owner:       row[COL.owner - 1],
      score_found: row[COL.score_found - 1] || 2,
    }))
    .filter(r => r.company && typeof r.company === 'string')
    .filter(r => r.status === 'Researched')
    .filter(r => !r.owner || r.owner === '' || r.owner === 'Unknown')
    .sort((a, b) => b.score_found - a.score_found)
    .slice(0, batchSize);

  const results = { processed: 0, tier1: 0, disqualified: 0, errors: 0, log: [] };

  for (const rec of queue) {
    try {
      const result = researchCompany({
        company: rec.company, city: rec.city, state: rec.state,
        founded: rec.founded, revenue: rec.revenue, certs: rec.certs,
      });

      saveCompany({ result, rowNum: rec.rowNum });

      const tier = result.priority_tier || '';
      results.processed++;
      if (tier.includes('Tier 1')) results.tier1++;
      if (result.disqualified)     results.disqualified++;
      results.log.push(`✓ ${rec.company} → ${tier}`);

      Utilities.sleep(1500); // rate limit buffer

    } catch (err) {
      results.errors++;
      results.log.push(`✗ ${rec.company}: ${err.message}`);
    }
  }

  return results;
}

// ── Dashboard stats ───────────────────────────────────────────────────────────

function getDashboard() {
  const sheet   = getSheet(CONFIG.COMPANY_SHEET);
  const lastRow = sheet.getLastRow();
  if (lastRow < CONFIG.DATA_START_ROW) return { counts: {}, total: 0 };

  const statusCol = sheet.getRange(CONFIG.DATA_START_ROW, COL.status, lastRow - CONFIG.DATA_START_ROW + 1, 1).getValues();
  const tierCol   = sheet.getRange(CONFIG.DATA_START_ROW, COL.tier,   lastRow - CONFIG.DATA_START_ROW + 1, 1).getValues();
  const scoreCol  = sheet.getRange(CONFIG.DATA_START_ROW, COL.total,  lastRow - CONFIG.DATA_START_ROW + 1, 1).getValues();
  const compCol   = sheet.getRange(CONFIG.DATA_START_ROW, COL.company,lastRow - CONFIG.DATA_START_ROW + 1, 1).getValues();

  const counts = {};
  let total = 0;
  let scoreSum = 0; let scoreCt = 0;

  for (let i = 0; i < statusCol.length; i++) {
    if (!compCol[i][0]) continue;
    total++;
    const s = statusCol[i][0] || 'Unknown';
    counts[s] = (counts[s] || 0) + 1;
    if (scoreCol[i][0]) { scoreSum += scoreCol[i][0]; scoreCt++; }
  }

  const tierCounts = {};
  for (const row of tierCol) {
    if (!row[0]) continue;
    tierCounts[row[0]] = (tierCounts[row[0]] || 0) + 1;
  }

  return {
    total,
    counts,
    tierCounts,
    avgScore: scoreCt ? (scoreSum / scoreCt).toFixed(1) : null,
    targetResearched: 500,
    targetContacted: 200,
  };
}

// ── Scheduled trigger (set up once) ──────────────────────────────────────────

function setupWeeklyTrigger() {
  // Delete existing triggers
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));

  // Run every Sunday at 7am
  ScriptApp.newTrigger('runWeeklyBatch')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.SUNDAY)
    .atHour(7)
    .create();

  return { ok: true, message: 'Weekly trigger set for Sundays at 7am' };
}

function runWeeklyBatch() {
  const results = batchResearch({ batchSize: CONFIG.BATCH_SIZE });
  console.log('Weekly batch complete:', JSON.stringify(results));

  // Email summary
  const email = Session.getActiveUser().getEmail();
  if (email) {
    MailApp.sendEmail({
      to: email,
      subject: `Silver Tsunami — Weekly Research Batch (${new Date().toLocaleDateString()})`,
      body: `Batch complete.\n\nProcessed: ${results.processed}\nTier 1 found: ${results.tier1}\nDisqualified: ${results.disqualified}\nErrors: ${results.errors}\n\nLog:\n${results.log.join('\n')}`,
    });
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function tierLabel(score) {
  if (score >= 20) return 'Tier 1 — Immediate';
  if (score >= 14) return 'Tier 2 — Active Watch';
  if (score >= 8)  return 'Low Priority';
  return 'Remove / Monitor Only';
}
