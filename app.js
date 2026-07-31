/* ═══════════════════════════════════════════════════
   ATS Scout — app.js
   Complete Frontend Logic
═══════════════════════════════════════════════════ */

/* ── STATE ── */
let resumes  = [];   // [{id, name, text, fileType}]
let results  = [];   // evaluated result objects
let apiKey   = localStorage.getItem('ats_scout_key') || '';

const COLORS = [
  '#6366F1','#10B981','#F59E0B','#F43F5E','#3B82F6',
  '#8B5CF6','#06B6D4','#EC4899','#F97316','#14B8A6'
];

/* ── STARTUP ── */
window.onload = () => {
  if (!apiKey) showApiModal();
  else document.getElementById('apiModal').style.display = 'none';
  checkReady();
};

/* ════════════════════════════════════════
   API KEY
════════════════════════════════════════ */
function saveApiKey() {
  const k = document.getElementById('apiKeyInput').value.trim();
  document.getElementById('keyErr').textContent = '';
  if (!k) { document.getElementById('keyErr').textContent = 'Please enter your API key.'; return; }
  if (!k.startsWith('sk-ant')) { document.getElementById('keyErr').textContent = 'Invalid key — must start with sk-ant'; return; }
  apiKey = k;
  localStorage.setItem('ats_scout_key', k);
  document.getElementById('apiModal').style.display = 'none';
  toast('API key saved ✓', 'success');
  checkReady();
}
function showApiModal() { document.getElementById('apiModal').style.display = 'flex'; }
function toggleKeyVisibility() {
  const inp = document.getElementById('apiKeyInput');
  const btn = document.getElementById('keyToggle');
  if (inp.type === 'password') { inp.type = 'text'; btn.textContent = '🙈'; }
  else { inp.type = 'password'; btn.textContent = '👁'; }
}
document.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    if (document.getElementById('apiKeyInput') === document.activeElement) saveApiKey();
  }
});

/* ════════════════════════════════════════
   FILE HANDLING
════════════════════════════════════════ */
function onDragOver(e)  { e.preventDefault(); document.getElementById('dropZone').classList.add('drag-over'); }
function onDragLeave()  { document.getElementById('dropZone').classList.remove('drag-over'); }
function onDrop(e) {
  e.preventDefault();
  onDragLeave();
  const files = Array.from(e.dataTransfer.files);
  processFiles(files);
}
function onFilesSelected(e) {
  processFiles(Array.from(e.target.files));
  e.target.value = '';
}

async function processFiles(files) {
  const supported   = files.filter(f => /\.(pdf|docx|doc|txt)$/i.test(f.name));
  const unsupported = files.filter(f => !/\.(pdf|docx|doc|txt)$/i.test(f.name));
  if (unsupported.length) toast(`Skipped ${unsupported.length} unsupported file(s)`, 'error');
  if (!supported.length) return;

  for (const file of supported) {
    showParseProgress(`Parsing ${file.name}…`);
    try {
      const parsed = await uploadAndParse(file);
      if (resumes.find(r => r.name === parsed.name)) {
        // Auto-rename duplicate
        parsed.name = parsed.name + ' (' + (resumes.filter(r => r.name.startsWith(parsed.name)).length + 1) + ')';
      }
      resumes.push({ id: uid(), name: parsed.name, text: parsed.text, fileType: parsed.fileType });
      toast(`✓ ${parsed.name} (${parsed.fileType}) added`, 'success');
    } catch (err) {
      toast(`Failed: ${file.name} — ${err.message}`, 'error');
    }
    hideParseProgress();
    renderResumeList();
    checkReady();
  }
}

async function uploadAndParse(file) {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch('/api/parse-file', { method: 'POST', body: fd });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Parse failed');
  return data;
}

function showParseProgress(msg) {
  const el = document.getElementById('parseProgress');
  document.getElementById('parseProgressText').textContent = msg;
  el.style.display = 'flex';
}
function hideParseProgress() {
  document.getElementById('parseProgress').style.display = 'none';
}

/* ── Manual paste ── */
function addManual() {
  const text = document.getElementById('manualResumeText').value.trim();
  const name = document.getElementById('manualCandidateName').value.trim() || ('Candidate ' + (resumes.length + 1));
  if (!text)        { toast('Paste resume text first', 'error'); return; }
  if (text.length < 50) { toast('Resume text too short — add more content', 'error'); return; }
  resumes.push({ id: uid(), name, text, fileType: 'TEXT' });
  document.getElementById('manualResumeText').value    = '';
  document.getElementById('manualCandidateName').value = '';
  renderResumeList();
  checkReady();
  toast(`${name} added ✓`, 'success');
}

function clearAll() {
  resumes = []; results = [];
  renderResumeList();
  checkReady();
  setExportBtns(false);
  document.getElementById('rightPanel').innerHTML = `
    <div class="empty-state">
      <div style="font-size:48px;margin-bottom:16px;opacity:.4">🎯</div>
      <div class="empty-title">Ready to Screen Candidates</div>
      <div class="empty-sub">Upload PDF, DOCX, DOC, or TXT resume files and click Analyze.</div>
    </div>`;
}

function removeResume(idx) {
  resumes.splice(idx, 1);
  results.splice(idx, 1);
  renderResumeList();
  checkReady();
}

/* ════════════════════════════════════════
   RENDER RESUME LIST
════════════════════════════════════════ */
function renderResumeList() {
  const list = document.getElementById('resumeList');
  const wrap = document.getElementById('queueWrap');
  document.getElementById('queueCount').textContent = resumes.length;
  if (!resumes.length) { wrap.style.display = 'none'; return; }
  wrap.style.display = 'block';

  const fileIcon = { PDF:'🔴', DOCX:'🔵', DOC:'🔵', TXT:'⚫', TEXT:'⚫' };

  list.innerHTML = resumes.map((r, i) => {
    const res   = results.find(x => x.id === r.id);
    const score = res ? `<span class="r-score ${scoreClass(res.atsScore)}">${res.atsScore}</span>` : '';
    return `<div class="resume-card" onclick="viewResult(${i})">
      <div class="r-avatar" style="background:${COLORS[i % COLORS.length]}20;color:${COLORS[i % COLORS.length]}">${r.name[0].toUpperCase()}</div>
      <div class="r-info">
        <div class="r-name">${esc(r.name)}</div>
        <div class="r-meta">${fileIcon[r.fileType] || '📄'} ${r.fileType} &nbsp;·&nbsp; ${res ? res.roleMatch : 'Pending'}</div>
      </div>
      ${score}
      <button onclick="event.stopPropagation();removeResume(${i})"
        style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:15px;padding:4px;line-height:1;flex-shrink:0"
        title="Remove">✕</button>
    </div>`;
  }).join('');
}

function checkReady() {
  const jd  = document.getElementById('jdText').value.trim();
  const ok  = !!(jd && resumes.length && apiKey);
  document.getElementById('analyzeBtn').disabled = !ok;
}
document.getElementById('jdText').addEventListener('input', checkReady);

/* ════════════════════════════════════════
   ANALYZE
════════════════════════════════════════ */
async function analyzeAll() {
  if (!apiKey) { showApiModal(); return; }
  const jd = document.getElementById('jdText').value.trim();
  if (!jd || !resumes.length) return;

  results = [];
  document.getElementById('analyzeBtn').disabled = true;
  document.getElementById('progressWrap').style.display = 'block';
  setExportBtns(false);

  document.getElementById('rightPanel').innerHTML = `
    <div class="panel"><div class="panel-body">
      <div class="loading-wrap">
        <div class="spinner"></div>
        <div class="loading-text" style="font-size:14px;font-weight:600;color:var(--text)">Analyzing ${resumes.length} candidate(s)…</div>
        <div style="font-size:12px;color:var(--text2);margin-top:4px">Claude AI is evaluating each resume against the job description</div>
        <div class="loading-steps" id="loadingSteps"></div>
      </div>
    </div></div>`;

  for (let i = 0; i < resumes.length; i++) {
    const r = resumes[i];
    const pct = Math.round((i / resumes.length) * 100);
    document.getElementById('progBar').style.width   = pct + '%';
    document.getElementById('progText').textContent  = `Analyzing ${r.name} (${i+1}/${resumes.length})…`;

    const stEl = document.getElementById('loadingSteps');
    if (stEl) stEl.innerHTML = resumes.map((x, j) =>
      `<div class="loading-step ${j < i ? 'done' : j === i ? 'active' : ''}">
        <span>${j < i ? '✓' : j === i ? '⟳' : '○'}</span> ${esc(x.name)}
      </div>`).join('');

    try {
      const res = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, jdText: jd, candidateName: r.name, resumeText: r.text })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Evaluation failed');
      const result = data.result;
      result.id = r.id;
      results.push(result);
    } catch (err) {
      results.push({
        id: r.id, name: r.name, atsScore: 0, error: err.message,
        roleMatch: 'Error', mandatory: 'Fail', matchedSkills: [],
        missingSkills: [], rejectionRisks: [err.message],
        acceptanceReasons: [], rejectionReasons: [err.message],
        recommendation: 'Reject', scoringBreakdown: {},
        matchedKeywords: [], strengths: [], weaknesses: [],
        projects: [], feedback: { positive: [], negative: [], suggestions: [] },
        interviewReadiness: 'Low', hrNotes: 'Analysis failed.',
        yearsExperience: 'Unknown', education: 'Unknown'
      });
    }
    renderResumeList();
  }

  document.getElementById('progBar').style.width  = '100%';
  document.getElementById('progText').textContent = '✓ Analysis complete!';
  document.getElementById('analyzeBtn').disabled  = false;
  setExportBtns(true);
  setTimeout(() => { document.getElementById('progressWrap').style.display = 'none'; }, 2500);

  viewResult(0);
  toast(`✓ ${resumes.length} candidate(s) analyzed`, 'success');
}

/* ════════════════════════════════════════
   VIEW RESULT
════════════════════════════════════════ */
function viewResult(idx) {
  if (!results.length) return;
  const r = results[idx];
  if (!r) return;

  if (r.error) {
    document.getElementById('rightPanel').innerHTML = `
      <div class="panel"><div class="panel-body">
        <div class="empty-state">
          <div style="font-size:40px;margin-bottom:12px">⚠️</div>
          <div class="empty-title">Analysis Failed — ${esc(r.name)}</div>
          <div class="empty-sub" style="color:var(--red)">${esc(r.error)}</div>
          <div style="margin-top:16px;font-size:12px;color:var(--text2);max-width:360px;line-height:1.7;text-align:left;background:var(--surface2);padding:14px;border-radius:8px;border:1px solid var(--border)">
            <strong>Common fixes:</strong><br>
            • Verify API key at console.anthropic.com<br>
            • Ensure your account has API credits<br>
            • Check internet connection<br>
            • Resume file may be empty — try pasting text manually
          </div>
        </div>
      </div></div>`;
    return;
  }

  const sc   = r.atsScore || 0;
  const sc_c = getScoreColor(sc);
  const circ = 2 * Math.PI * 44;
  const dash = (sc / 100) * circ;

  document.getElementById('rightPanel').innerHTML = `
  <div class="results-wrap">

    <!-- SCORE HERO -->
    <div class="score-hero">
      <div class="score-hero-inner">
        <div class="score-ring">
          <svg viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="44" fill="none" stroke="var(--surface2)" stroke-width="8"/>
            <circle cx="50" cy="50" r="44" fill="none" stroke="${sc_c}" stroke-width="8"
              stroke-dasharray="${dash.toFixed(1)} ${circ.toFixed(1)}"
              stroke-linecap="round" style="transition:stroke-dasharray 1.2s ease"/>
          </svg>
          <div class="ring-center">
            <div class="ring-num" style="color:${sc_c}">${sc}</div>
            <div class="ring-lbl">/ 100</div>
          </div>
        </div>
        <div class="score-info">
          <div class="c-name">${esc(r.name)}</div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px">
            <span class="status-badge ${statusBg(r.recommendation)}">${statusEmoji(r.recommendation)} ${r.recommendation}</span>
            ${roleTag(r.roleMatch)}
          </div>
          <div class="meta-row">
            <div class="meta-item">🎓 <strong>${r.education || 'Unknown'}</strong></div>
            <div class="meta-item">⏱ <strong>${r.yearsExperience || '?'} yrs exp</strong></div>
            <div class="meta-item">🎯 Readiness: <strong>${r.interviewReadiness || '-'}</strong></div>
            <span class="m-badge ${r.mandatory === 'Pass' ? 'm-pass' : 'm-fail'}">${r.mandatory === 'Pass' ? '✓' : '✗'} Mandatory ${r.mandatory}</span>
          </div>
          ${r.hrNotes ? `<div class="hr-notes">${esc(r.hrNotes)}</div>` : ''}
        </div>
      </div>
    </div>

    <!-- MANDATORY -->
    <div class="panel">
      <div class="panel-hdr"><div class="panel-title"><span class="dot"></span>Mandatory Screening Criteria</div></div>
      <div class="panel-body">
        <div class="mandatory-row">
          ${mBadge('Education (B.Tech/BE)', r.mandatoryDetails?.education)}
          ${mBadge('Embedded C', r.mandatoryDetails?.embeddedC)}
          ${mBadge('Basic C', r.mandatoryDetails?.basicC)}
          ${mBadge('Debugging', r.mandatoryDetails?.debugging)}
        </div>
        <div style="margin-top:10px;padding:10px 12px;border-radius:8px;font-size:12px;${
          r.mandatory === 'Pass'
            ? 'background:var(--green-bg);border:1px solid var(--green-border);color:var(--green)'
            : 'background:var(--red-bg);border:1px solid var(--red-border);color:var(--red)'}">
          ${r.mandatory === 'Pass'
            ? '✓ All mandatory criteria passed — Candidate eligible for full evaluation.'
            : '⚠️ HIGH REJECTION RISK — One or more mandatory criteria not met.'}
        </div>
      </div>
    </div>

    <!-- SCORE BREAKDOWN -->
    <div class="panel">
      <div class="panel-hdr">
        <div class="panel-title"><span class="dot"></span>ATS Scoring Breakdown</div>
        <span style="font-size:12px;font-family:var(--mono);color:var(--accent2)">${sc}/100</span>
      </div>
      <div class="panel-body">
        <div class="score-bars">
          ${sbar('Education Match',        r.scoringBreakdown?.educationMatch,    10)}
          ${sbar('Embedded C + Basic C',   r.scoringBreakdown?.embeddedCBasicC,   25)}
          ${sbar('Role-Specific Skills',   r.scoringBreakdown?.roleSpecificSkills,25)}
          ${sbar('Relevant Projects',      r.scoringBreakdown?.relevantProjects,  10)}
          ${sbar('Relevant Experience',    r.scoringBreakdown?.relevantExperience,15)}
          ${sbar('Debugging / RCA',        r.scoringBreakdown?.debuggingExperience,10)}
          ${sbar('Resume Quality',         r.scoringBreakdown?.resumeQuality,      5)}
        </div>
      </div>
    </div>

    <!-- ACCEPTED / REJECTED REASONS PANEL -->
    <div class="panel">
      <div class="panel-hdr"><div class="panel-title"><span class="dot"></span>Acceptance & Rejection Analysis</div></div>
      <div class="panel-body">
        <div class="grid2">
          <div>
            <div class="accepted-header">
              <span style="font-size:20px">✅</span>
              <div>
                <div class="report-section-title" style="color:var(--green)">Acceptance Reasons</div>
                <div style="font-size:11px;color:var(--text2)">Why this candidate should be selected</div>
              </div>
            </div>
            <div class="reason-list">
              ${(r.acceptanceReasons || []).length
                ? (r.acceptanceReasons || []).map(reason =>
                    `<div class="reason-item">
                      <span class="reason-bullet" style="color:var(--green)">✓</span>
                      <span>${esc(reason)}</span>
                    </div>`).join('')
                : `<div class="reason-item"><span style="color:var(--text3)">No strong acceptance reasons identified.</span></div>`}
            </div>
          </div>
          <div>
            <div class="rejected-header">
              <span style="font-size:20px">❌</span>
              <div>
                <div class="report-section-title" style="color:var(--red)">Rejection Reasons</div>
                <div style="font-size:11px;color:var(--text2)">Why this candidate may be rejected</div>
              </div>
            </div>
            <div class="reason-list">
              ${(r.rejectionReasons || []).length
                ? (r.rejectionReasons || []).map(reason =>
                    `<div class="reason-item">
                      <span class="reason-bullet" style="color:var(--red)">✗</span>
                      <span>${esc(reason)}</span>
                    </div>`).join('')
                : `<div class="reason-item"><span style="color:var(--text3)">No significant rejection reasons identified.</span></div>`}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- DETAILED ANALYSIS TABS -->
    <div class="panel">
      <div class="panel-hdr"><div class="panel-title"><span class="dot"></span>Detailed Analysis</div></div>
      <div class="panel-body">
        <div class="tabs">
          <button class="tab active" onclick="switchTab(event,'t-kw')">🔑 Keywords</button>
          <button class="tab" onclick="switchTab(event,'t-sk')">💪 Skills</button>
          <button class="tab" onclick="switchTab(event,'t-pr')">🗂 Projects</button>
          <button class="tab" onclick="switchTab(event,'t-fb')">💬 Feedback</button>
          <button class="tab" onclick="switchTab(event,'t-rk')">⚠️ Risks</button>
        </div>

        <!-- KEYWORDS TAB -->
        <div class="tab-content active" id="t-kw">
          <div class="sec-hdr">Keyword impact analysis</div>
          <div style="overflow-x:auto;margin-bottom:16px">
            <table class="kw-table">
              <thead><tr>
                <th>Keyword</th>
                <th>Importance</th>
                <th>Found?</th>
                <th>Impact on Score</th>
              </tr></thead>
              <tbody>
                ${(r.matchedKeywords || []).map(k => `<tr>
                  <td style="font-weight:500">${esc(k.keyword)}</td>
                  <td><span class="imp-badge imp-${(k.importance||'').toLowerCase()}">${k.importance}</span></td>
                  <td class="${k.found ? 'found-yes' : 'found-no'}">${k.found ? '✓ Yes' : '✗ No'}</td>
                  <td class="${(k.impact||'').startsWith('+') ? 'impact-pos' : 'impact-neg'}">${k.impact}</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
          <div class="kw-section">
            <div class="kw-label">Matched keywords</div>
            <div class="kw-tags">
              ${(r.matchedSkills || []).length
                ? r.matchedSkills.map(s => `<span class="kw-tag kw-found">${esc(s)}</span>`).join('')
                : '<span style="font-size:12px;color:var(--text3)">None found</span>'}
            </div>
          </div>
          <div class="kw-section" style="margin-top:12px">
            <div class="kw-label">Missing keywords</div>
            <div class="kw-tags">
              ${(r.missingSkills || []).length
                ? r.missingSkills.map(s => `<span class="kw-tag kw-missing">${esc(s)}</span>`).join('')
                : '<span style="font-size:12px;color:var(--green)">None — great coverage!</span>'}
            </div>
          </div>
        </div>

        <!-- SKILLS TAB -->
        <div class="tab-content" id="t-sk">
          <div class="grid2">
            <div>
              <div class="sec-hdr">Strengths</div>
              <div class="feedback-list">
                ${(r.strengths || []).length
                  ? r.strengths.map(s => `<div class="fb-item positive"><div class="fb-icon">✓</div><div class="fb-text">${esc(s)}</div></div>`).join('')
                  : `<div class="fb-item warning"><div class="fb-icon">—</div><div class="fb-text">No strengths noted</div></div>`}
              </div>
            </div>
            <div>
              <div class="sec-hdr">Skill Gaps</div>
              <div class="feedback-list">
                ${(r.weaknesses || []).length
                  ? r.weaknesses.map(s => `<div class="fb-item negative"><div class="fb-icon">✗</div><div class="fb-text">${esc(s)}</div></div>`).join('')
                  : `<div class="fb-item positive"><div class="fb-icon">✓</div><div class="fb-text">No significant gaps found</div></div>`}
              </div>
            </div>
          </div>
        </div>

        <!-- PROJECTS TAB -->
        <div class="tab-content" id="t-pr">
          <div class="sec-hdr">Project evaluation</div>
          ${(r.projects || []).length === 0
            ? `<div class="fb-item warning"><div class="fb-icon">⚠️</div><div class="fb-text">No projects identified in this resume.</div></div>`
            : (r.projects || []).map(p => `
              <div class="proj-card">
                <div class="proj-hdr">
                  <div class="proj-name">${esc(p.name)}</div>
                  <span class="proj-rel ${(p.relevance||'average').toLowerCase()}">${p.relevance}</span>
                </div>
                <div class="proj-desc">${esc(p.description)}</div>
              </div>`).join('')}
        </div>

        <!-- FEEDBACK TAB -->
        <div class="tab-content" id="t-fb">
          <div class="sec-hdr">HR feedback</div>
          <div class="feedback-list">
            ${(r.feedback?.positive || []).map(s => `<div class="fb-item positive"><div class="fb-icon">✓</div><div class="fb-text"><strong>Positive</strong>${esc(s)}</div></div>`).join('')}
            ${(r.feedback?.negative || []).map(s => `<div class="fb-item negative"><div class="fb-icon">✗</div><div class="fb-text"><strong>Concern</strong>${esc(s)}</div></div>`).join('')}
            ${(r.feedback?.suggestions || []).map(s => `<div class="fb-item info"><div class="fb-icon">💡</div><div class="fb-text"><strong>Suggestion</strong>${esc(s)}</div></div>`).join('')}
          </div>
        </div>

        <!-- RISKS TAB -->
        <div class="tab-content" id="t-rk">
          <div class="sec-hdr">Rejection risk analysis</div>
          ${(r.rejectionRisks || []).length === 0
            ? `<div class="fb-item positive"><div class="fb-icon">✓</div><div class="fb-text">No significant rejection risks identified.</div></div>`
            : (r.rejectionRisks || []).map(risk => `<div class="fb-item negative"><div class="fb-icon">⚠️</div><div class="fb-text">${esc(risk)}</div></div>`).join('')}
        </div>
      </div>
    </div>

    ${results.length > 1 ? renderRankingTable() : ''}
    ${results.length > 1 && results.length === resumes.length ? renderConsolidated() : ''}
  </div>`;
}

/* ════════════════════════════════════════
   TABS
════════════════════════════════════════ */
function switchTab(e, id) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  e.target.classList.add('active');
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

/* ════════════════════════════════════════
   RANKING TABLE
════════════════════════════════════════ */
function renderRankingTable() {
  const sorted = [...results].sort((a, b) => (b.atsScore || 0) - (a.atsScore || 0));
  const rankCls = i => i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
  return `
  <div class="panel">
    <div class="panel-hdr"><div class="panel-title"><span class="dot"></span>All Candidate Rankings</div></div>
    <div style="overflow-x:auto">
      <table class="rank-table">
        <thead><tr>
          <th>Rank</th><th>Candidate</th><th>ATS Score</th>
          <th>Role Match</th><th>Interview Ready</th><th>Recommendation</th>
        </tr></thead>
        <tbody>
          ${sorted.map((r, i) => `
            <tr onclick="viewResult(${results.indexOf(r)})">
              <td><span class="rank-num ${rankCls(i)}">#${i + 1}</span></td>
              <td style="font-weight:500">${esc(r.name)}</td>
              <td><span class="rank-score" style="color:${getScoreColor(r.atsScore || 0)}">${r.atsScore || 0}</span></td>
              <td>${roleTag(r.roleMatch)}</td>
              <td style="font-weight:500;color:${r.interviewReadiness==='High'?'var(--green)':r.interviewReadiness==='Medium'?'var(--yellow)':'var(--red)'}">${r.interviewReadiness || '-'}</td>
              <td>${statusEmoji(r.recommendation)} ${r.recommendation}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>`;
}

/* ════════════════════════════════════════
   CONSOLIDATED REPORT
════════════════════════════════════════ */
function renderConsolidated() {
  const total     = results.length;
  const strong    = results.filter(r => (r.atsScore||0) >= 85).length;
  const rec       = results.filter(r => (r.atsScore||0) >= 70 && (r.atsScore||0) < 85).length;
  const consider  = results.filter(r => (r.atsScore||0) >= 55 && (r.atsScore||0) < 70).length;
  const reject    = results.filter(r => (r.atsScore||0) < 55).length;
  const avg       = Math.round(results.reduce((s, r) => s + (r.atsScore||0), 0) / total);
  const sorted    = [...results].sort((a, b) => (b.atsScore||0) - (a.atsScore||0));

  const gapFreq = {};
  results.flatMap(r => r.missingSkills || []).forEach(s => gapFreq[s] = (gapFreq[s]||0)+1);
  const topGaps = Object.entries(gapFreq).sort((a,b) => b[1]-a[1]).slice(0,6);

  const rFreq = {};
  results.flatMap(r => r.rejectionReasons || []).forEach(s => {
    const k = s.length > 65 ? s.slice(0,65)+'…' : s;
    rFreq[k] = (rFreq[k]||0)+1;
  });
  const topRej = Object.entries(rFreq).sort((a,b) => b[1]-a[1]).slice(0,5);

  const accepted = results.filter(r => (r.atsScore||0) >= 70);
  const rejected = results.filter(r => (r.atsScore||0) < 55);

  return `
  <div class="panel">
    <div class="panel-hdr">
      <div class="panel-title"><span class="dot"></span>Consolidated HR Report</div>
      <span class="badge badge-accent">Final Summary</span>
    </div>
    <div class="panel-body">
      <div class="rep-stats">
        <div class="rep-stat"><div class="rep-num">${total}</div><div class="rep-lbl">Total Screened</div></div>
        <div class="rep-stat"><div class="rep-num" style="color:var(--green)">${strong+rec}</div><div class="rep-lbl">Shortlisted (≥70)</div></div>
        <div class="rep-stat"><div class="rep-num" style="color:var(--red)">${reject}</div><div class="rep-lbl">Rejected (&lt;55)</div></div>
        <div class="rep-stat"><div class="rep-num" style="color:var(--accent2)">${avg}</div><div class="rep-lbl">Avg ATS Score</div></div>
        <div class="rep-stat"><div class="rep-num" style="color:var(--green)">${strong}</div><div class="rep-lbl">Strongly Rec.</div></div>
        <div class="rep-stat"><div class="rep-num" style="color:var(--yellow)">${consider}</div><div class="rep-lbl">Manual Review</div></div>
      </div>

      <!-- ACCEPTED CANDIDATES -->
      <div class="hr-block" style="border-color:var(--green-border)">
        <div class="hr-block-title" style="color:var(--green)">✅ Accepted Candidates (${accepted.length})</div>
        ${accepted.length ? accepted.map(r => `
          <div class="hr-row">
            <span style="font-weight:500">${esc(r.name)}</span>
            <div style="display:flex;align-items:center;gap:8px">
              <span class="r-score ${scoreClass(r.atsScore)}">${r.atsScore}/100</span>
              <span style="font-size:11px;color:var(--green)">${r.recommendation}</span>
            </div>
          </div>`).join('')
          : '<div style="font-size:12px;color:var(--text3)">No candidates scored ≥70</div>'}
      </div>

      <!-- REJECTED CANDIDATES -->
      <div class="hr-block" style="border-color:var(--red-border)">
        <div class="hr-block-title" style="color:var(--red)">❌ Rejected Candidates (${rejected.length})</div>
        ${rejected.length ? rejected.map(r => `
          <div class="hr-row">
            <span style="font-weight:500">${esc(r.name)}</span>
            <div style="display:flex;align-items:center;gap:8px">
              <span class="r-score ${scoreClass(r.atsScore)}">${r.atsScore}/100</span>
              <span style="font-size:11px;color:var(--red);max-width:200px;text-overflow:ellipsis;overflow:hidden;white-space:nowrap" title="${esc((r.rejectionReasons||[''])[0])}">${esc((r.rejectionReasons||['No reason'])[0])}</span>
            </div>
          </div>`).join('')
          : '<div style="font-size:12px;color:var(--text3)">No candidates rejected</div>'}
      </div>

      <div class="grid2">
        <div class="hr-block">
          <div class="hr-block-title">📉 Common Skill Gaps</div>
          ${topGaps.map(([s,c]) => `
            <div class="gap-item">
              <div class="gap-dot" style="background:var(--red)"></div>
              <span style="flex:1">${esc(s)}</span>
              <span style="font-size:10px;color:var(--text2);font-family:var(--mono)">${c}/${total}</span>
            </div>`).join('') || '<div style="font-size:12px;color:var(--text2)">None identified</div>'}
        </div>
        <div class="hr-block">
          <div class="hr-block-title">⚠️ Top Rejection Reasons</div>
          ${topRej.map(([s]) => `
            <div class="gap-item">
              <div class="gap-dot" style="background:var(--yellow)"></div>
              <span style="font-size:11px;flex:1">${esc(s)}</span>
            </div>`).join('') || '<div style="font-size:12px;color:var(--text2)">None identified</div>'}
        </div>
      </div>

      ${consider > 0 ? `
      <div class="hr-block" style="border-color:var(--yellow-border)">
        <div class="hr-block-title" style="color:var(--yellow)">🤔 Borderline — Manual Review Required (${consider})</div>
        ${results.filter(r => (r.atsScore||0) >= 55 && (r.atsScore||0) < 70).map(r => `
          <div class="hr-row">
            <span>${esc(r.name)}</span>
            <span class="r-score s-consider">${r.atsScore}/100</span>
          </div>`).join('')}
      </div>` : ''}

      <!-- TOP 5 -->
      <div class="hr-block">
        <div class="hr-block-title">🏆 Top 5 Candidates for Interview</div>
        ${sorted.slice(0,5).map((r,i) => `
          <div class="hr-row">
            <span><strong style="color:var(--text2);font-family:var(--mono)">#${i+1}</strong> &nbsp;${esc(r.name)}</span>
            <div style="display:flex;gap:8px;align-items:center">
              <span class="r-score ${scoreClass(r.atsScore)}">${r.atsScore}/100</span>
              ${roleTag(r.roleMatch)}
            </div>
          </div>`).join('')}
      </div>
    </div>
  </div>`;
}

/* ════════════════════════════════════════
   EXPORT FUNCTIONS
════════════════════════════════════════ */
function setExportBtns(enabled) {
  ['exportAccBtn','exportRejBtn','exportAllBtn'].forEach(id => {
    document.getElementById(id).disabled = !enabled;
  });
}

function exportAccepted() {
  const accepted = results.filter(r => (r.atsScore||0) >= 70);
  if (!accepted.length) { toast('No accepted candidates to export', 'error'); return; }
  const role = document.getElementById('roleTitle').value || 'Embedded Systems Engineer';
  downloadReport(buildAcceptedReport(accepted, role), `ATS_Accepted_${safeFilename(role)}.html`);
  toast(`Exported ${accepted.length} accepted candidates ✓`, 'success');
}

function exportRejected() {
  const rejected = results.filter(r => (r.atsScore||0) < 55);
  if (!rejected.length) { toast('No rejected candidates to export', 'error'); return; }
  const role = document.getElementById('roleTitle').value || 'Embedded Systems Engineer';
  downloadReport(buildRejectedReport(rejected, role), `ATS_Rejected_${safeFilename(role)}.html`);
  toast(`Exported ${rejected.length} rejected candidates ✓`, 'success');
}

function exportAll() {
  if (!results.length) { toast('No results to export', 'error'); return; }
  const role = document.getElementById('roleTitle').value || 'Embedded Systems Engineer';
  downloadReport(buildFullReport(results, role), `ATS_FullReport_${safeFilename(role)}.html`);
  toast(`Full report exported ✓`, 'success');
}

function buildAcceptedReport(candidates, role) {
  const sorted = [...candidates].sort((a,b) => (b.atsScore||0) - (a.atsScore||0));
  return reportShell(`ATS Scout — Accepted Candidates: ${role}`, `
    <h1 style="color:#10B981">✅ Accepted Candidates Report</h1>
    <p><strong>Role:</strong> ${esc(role)} &nbsp;|&nbsp; <strong>Date:</strong> ${new Date().toLocaleDateString()} &nbsp;|&nbsp; <strong>Candidates:</strong> ${candidates.length}</p>
    <p style="background:#d1fae5;padding:10px 14px;border-radius:8px;color:#065f46;font-weight:500">These ${candidates.length} candidate(s) met the ATS threshold (score ≥70) and are recommended for interview consideration.</p>
    ${sorted.map((r,i) => candidateCardHtml(r, i+1, 'accepted')).join('')}
  `);
}

function buildRejectedReport(candidates, role) {
  const sorted = [...candidates].sort((a,b) => (b.atsScore||0) - (a.atsScore||0));
  return reportShell(`ATS Scout — Rejected Candidates: ${role}`, `
    <h1 style="color:#F43F5E">❌ Rejected Candidates Report</h1>
    <p><strong>Role:</strong> ${esc(role)} &nbsp;|&nbsp; <strong>Date:</strong> ${new Date().toLocaleDateString()} &nbsp;|&nbsp; <strong>Candidates:</strong> ${candidates.length}</p>
    <p style="background:#fee2e2;padding:10px 14px;border-radius:8px;color:#991b1b;font-weight:500">These ${candidates.length} candidate(s) scored below the ATS threshold (&lt;55) and are not recommended for this role.</p>
    ${sorted.map((r,i) => candidateCardHtml(r, i+1, 'rejected')).join('')}
  `);
}

function buildFullReport(allResults, role) {
  const sorted   = [...allResults].sort((a,b) => (b.atsScore||0) - (a.atsScore||0));
  const accepted = allResults.filter(r => (r.atsScore||0) >= 70);
  const rejected = allResults.filter(r => (r.atsScore||0) < 55);
  const consider = allResults.filter(r => (r.atsScore||0) >= 55 && (r.atsScore||0) < 70);
  const avg      = Math.round(allResults.reduce((s,r) => s+(r.atsScore||0), 0) / allResults.length);

  return reportShell(`ATS Scout — Full Recruitment Report: ${role}`, `
    <h1>⚡ ATS Scout — Full Recruitment Report</h1>
    <p><strong>Role:</strong> ${esc(role)} &nbsp;|&nbsp; <strong>Date:</strong> ${new Date().toLocaleDateString()} &nbsp;|&nbsp; <strong>Total:</strong> ${allResults.length} candidates</p>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:20px 0">
      <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:14px;text-align:center"><div style="font-size:28px;font-weight:900;color:#16a34a">${accepted.length}</div><div style="font-size:12px;color:#15803d">Accepted (≥70)</div></div>
      <div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:14px;text-align:center"><div style="font-size:28px;font-weight:900;color:#dc2626">${rejected.length}</div><div style="font-size:12px;color:#b91c1c">Rejected (&lt;55)</div></div>
      <div style="background:#fefce8;border:1px solid #fde047;border-radius:8px;padding:14px;text-align:center"><div style="font-size:28px;font-weight:900;color:#ca8a04">${consider.length}</div><div style="font-size:12px;color:#a16207">Manual Review</div></div>
      <div style="background:#eff6ff;border:1px solid #93c5fd;border-radius:8px;padding:14px;text-align:center"><div style="font-size:28px;font-weight:900;color:#2563eb">${avg}</div><div style="font-size:12px;color:#1d4ed8">Avg Score</div></div>
    </div>
    <h2>Rankings</h2>
    <table><thead><tr><th>#</th><th>Candidate</th><th>Score</th><th>Role</th><th>Mandatory</th><th>Readiness</th><th>Status</th></tr></thead>
    <tbody>${sorted.map((r,i) => `<tr>
      <td><strong>#${i+1}</strong></td>
      <td>${esc(r.name)}</td>
      <td style="font-weight:700;color:${getScoreColor(r.atsScore||0)}">${r.atsScore||0}/100</td>
      <td>${r.roleMatch||'-'}</td>
      <td style="font-weight:700;color:${r.mandatory==='Pass'?'#16a34a':'#dc2626'}">${r.mandatory}</td>
      <td>${r.interviewReadiness||'-'}</td>
      <td>${r.recommendation}</td>
    </tr>`).join('')}</tbody></table>
    <h2 style="color:#16a34a;margin-top:32px">✅ Accepted Profiles</h2>
    ${accepted.length ? sorted.filter(r=>(r.atsScore||0)>=70).map((r,i) => candidateCardHtml(r,i+1,'accepted')).join('') : '<p style="color:#6b7280">None</p>'}
    <h2 style="color:#dc2626;margin-top:32px">❌ Rejected Profiles</h2>
    ${rejected.length ? sorted.filter(r=>(r.atsScore||0)<55).map((r,i) => candidateCardHtml(r,i+1,'rejected')).join('') : '<p style="color:#6b7280">None</p>'}
    ${consider.length ? `<h2 style="color:#ca8a04;margin-top:32px">🤔 Manual Review Required</h2>${sorted.filter(r=>(r.atsScore||0)>=55&&(r.atsScore||0)<70).map((r,i) => candidateCardHtml(r,i+1,'consider')).join('')}` : ''}
  `);
}

function candidateCardHtml(r, rank, type) {
  const borderColor = type==='accepted' ? '#86efac' : type==='rejected' ? '#fca5a5' : '#fde047';
  const sc = r.atsScore || 0;
  return `
  <div style="background:#fff;border:1px solid ${borderColor};border-radius:10px;padding:20px;margin:16px 0;page-break-inside:avoid;box-shadow:0 1px 3px rgba(0,0,0,.06)">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px">
      <div>
        <div style="font-size:18px;font-weight:700;color:#111">#${rank} — ${esc(r.name)}</div>
        <div style="font-size:12px;color:#6b7280;margin-top:4px">${r.roleMatch} &nbsp;·&nbsp; ${r.education||'Unknown'} &nbsp;·&nbsp; ${r.yearsExperience||'?'} yrs exp &nbsp;·&nbsp; Interview readiness: ${r.interviewReadiness}</div>
      </div>
      <div style="font-size:38px;font-weight:900;color:${getScoreColor(sc)}">${sc}/100</div>
    </div>
    <div style="margin:10px 0;font-size:13px;font-style:italic;color:#374151">${esc(r.hrNotes||'')}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:14px">
      <div>
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#6b7280;margin-bottom:6px">${type==='accepted'?'✅ Acceptance Reasons':'❌ Rejection Reasons'}</div>
        ${(type==='accepted' ? (r.acceptanceReasons||[]) : (r.rejectionReasons||[])).map(s =>
          `<div style="font-size:12px;color:#374151;padding:3px 0;border-bottom:1px solid #f3f4f6;display:flex;gap:6px">
            <span style="color:${type==='accepted'?'#16a34a':'#dc2626'};flex-shrink:0">${type==='accepted'?'✓':'✗'}</span>${esc(s)}
          </div>`).join('') || '<div style="font-size:12px;color:#9ca3af">None noted</div>'}
      </div>
      <div>
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#6b7280;margin-bottom:6px">Matched Skills</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px">${(r.matchedSkills||[]).map(s=>`<span style="background:#d1fae5;color:#065f46;padding:2px 7px;border-radius:20px;font-size:11px;font-weight:600">✓ ${esc(s)}</span>`).join('')||'<span style="font-size:12px;color:#9ca3af">None</span>'}</div>
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#6b7280;margin:8px 0 6px">Missing Skills</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px">${(r.missingSkills||[]).map(s=>`<span style="background:#fee2e2;color:#991b1b;padding:2px 7px;border-radius:20px;font-size:11px;font-weight:600">✗ ${esc(s)}</span>`).join('')||'<span style="font-size:12px;color:#9ca3af">None</span>'}</div>
      </div>
    </div>
  </div>`;
}

function reportShell(title, body) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${esc(title)}</title>
  <style>
    body{font-family:Arial,sans-serif;background:#f9fafb;color:#111;padding:24px;max-width:1100px;margin:0 auto;font-size:14px}
    h1{font-size:22px;border-bottom:3px solid #6366F1;padding-bottom:10px;margin-bottom:18px}
    h2{font-size:16px;color:#374151;margin:24px 0 10px}
    table{width:100%;border-collapse:collapse;margin:10px 0;font-size:13px}
    th{background:#6366F1;color:#fff;padding:9px 12px;text-align:left}
    td{padding:8px 12px;border-bottom:1px solid #e5e7eb}
    tr:nth-child(even) td{background:#f9fafb}
    p{margin:6px 0;font-size:13px;color:#374151}
    @media print{body{padding:0}.no-print{display:none}}
  </style>
  </head><body>${body}
  <div style="margin-top:32px;text-align:center;font-size:11px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:16px">
    Generated by ATS Scout — Recruitment Intelligence Platform | ${new Date().toLocaleString()}
  </div>
  </body></html>`;
}

function downloadReport(html, filename) {
  const blob = new Blob([html], { type: 'text/html' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

/* ════════════════════════════════════════
   RENDER HELPERS
════════════════════════════════════════ */
function sbar(name, val, max) {
  const v   = Math.min(val || 0, max);
  const pct = max > 0 ? (v / max) * 100 : 0;
  const col = pct > 70 ? 'var(--green)' : pct > 40 ? 'var(--yellow)' : 'var(--red)';
  return `<div class="sbar-item">
    <div class="sbar-hdr">
      <div class="sbar-name">${name}</div>
      <div class="sbar-val">${v}/${max}</div>
    </div>
    <div class="sbar-track"><div class="sbar-fill" style="width:${pct}%;background:${col}"></div></div>
  </div>`;
}

function mBadge(label, status) {
  const pass = status === 'Pass';
  return `<span class="m-badge ${pass ? 'm-pass' : 'm-fail'}">${pass ? '✓' : '✗'} ${label}</span>`;
}

function roleTag(role) {
  if (!role || role === 'None' || role === 'Error') return '';
  return role.split(',').map(r => {
    r = r.trim();
    const cls = { Testing:'rt-testing', Development:'rt-development', Integration:'rt-integration', Mixed:'rt-mixed' }[r] || 'rt-mixed';
    return `<span class="role-tag ${cls}">${r}</span>`;
  }).join('');
}

function getScoreColor(s) {
  return s >= 85 ? '#10B981' : s >= 70 ? '#818CF8' : s >= 55 ? '#F59E0B' : '#F43F5E';
}
function scoreClass(s) {
  return s >= 85 ? 's-strong' : s >= 70 ? 's-rec' : s >= 55 ? 's-consider' : 's-reject';
}
function statusBg(r) {
  const m = {
    'Strongly Recommended': 's-strong',
    'Recommended':          's-rec',
    'Consider':             's-consider',
    'Reject':               's-reject'
  };
  return 'status-badge ' + (m[r] || 's-reject');
}
function statusEmoji(r) {
  return { 'Strongly Recommended':'🌟', 'Recommended':'✅', 'Consider':'🤔', 'Reject':'❌' }[r] || '❌';
}

/* ════════════════════════════════════════
   UTILITIES
════════════════════════════════════════ */
function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
function safeFilename(s) { return s.replace(/[^a-zA-Z0-9_]/g,'_').slice(0,40); }

function toast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className   = `toast ${type} show`;
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 3200);
}
