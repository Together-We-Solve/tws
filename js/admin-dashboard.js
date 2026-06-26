(function () {
  'use strict';

  const esc = window.TWS.escapeHTML;
  const mode = window.TWS_DASHBOARD_MODE || 'Superadmin';
  let session = null;
  let problems = [];
  let members = [];
  let settings = {};
  let selectedProblemId = '';
  let selectedMemberId = '';

  const roleAccess = {
    Founder: ['user', 'evaluator', 'superadmin', 'supportingPartner'],
    'Co-Founder': ['user', 'evaluator', 'superadmin', 'supportingPartner'],
    Innovator: ['user', 'evaluator'],
    Evaluator: ['user', 'evaluator'],
    Steward: ['user'],
    Contributor: ['user'],
    Member: ['user']
  };

  function getSession() {
    return JSON.parse(sessionStorage.getItem('portal_session') || 'null');
  }

  function canEvaluate() {
    const dashboards = window.TWS.dashboardsForSession(session);
    return dashboards.includes('evaluator');
  }

  function canSuperadmin() {
    const dashboards = window.TWS.dashboardsForSession(session);
    return dashboards.includes('superadmin');
  }

  function contributorName(item) {
    return typeof item === 'string' ? item : (item.displayName || item.username || item.name || '');
  }

  async function load() {
    session = getSession();
    if (!session) {
      window.location.href = 'login.html';
      return false;
    }
    if (mode === 'Evaluator' && !canEvaluate()) {
      window.location.href = 'user-settings.html';
      return false;
    }
    if (mode !== 'Evaluator' && !canSuperadmin()) {
      window.location.href = canEvaluate() ? 'evaluator-dashboard.html' : 'user-settings.html';
      return false;
    }
    problems = await window.TWS.loadProblemsAsync([]);
    members = await window.TWS.loadMovementMembersAsync([]);
    settings = await window.TWS.loadSettings({
      baseFrictionXP: 50,
      baseSolutionXP: 150,
      minTitleLength: 8,
      minFrictionLength: 40,
      encouragementLevel: 'medium'
    });
    return true;
  }

  function renderShell() {
    document.querySelector('.profile-name')?.replaceChildren(document.createTextNode(session.displayName || session.username || 'Dashboard'));
    document.querySelector('.admin-avatar')?.replaceChildren(document.createTextNode(window.TWS.initialsFromName(session.displayName || session.email)));
    const title = document.getElementById('activeTabTitle');
    if (title) title.textContent = mode === 'Evaluator' ? 'Evaluator Dashboard' : 'Superadmin Dashboard';
    if (mode === 'Evaluator') document.querySelectorAll('.founder-only').forEach((el) => el.remove());
    document.querySelectorAll('.nav-tab-btn').forEach((button) => {
      button.addEventListener('click', () => {
        document.querySelectorAll('.nav-tab-btn').forEach((item) => item.classList.remove('active'));
        document.querySelectorAll('.console-tab-panel').forEach((item) => item.classList.remove('active'));
        button.classList.add('active');
        document.getElementById(`panel-${button.dataset.tab}`)?.classList.add('active');
        const title = document.getElementById('activeTabTitle');
        if (title) title.textContent = button.querySelector('.tab-label')?.textContent || 'Dashboard';
      });
    });
  }

  function renderStats() {
    const pending = problems.filter((item) => item.status === 'Pending Review').length;
    const evaluation = problems.filter((item) => item.status === 'Pending Evaluation' || item.status === 'Closed by Owner').length;
    const solved = problems.filter((item) => item.status === 'Solved').length;
    document.getElementById('statPendingReviews').textContent = pending;
    document.getElementById('statPendingVerifications').textContent = evaluation;
    document.getElementById('statTotalSolved').textContent = `${solved} Solved`;
    document.getElementById('statTotalSolvers').textContent = members.length;
    document.getElementById('statTotalXP').textContent = `${members.reduce((sum, member) => sum + Number(member.points || member.stats?.totalImpactPoints || 0), 0).toLocaleString()} pts`;
    document.getElementById('statResolutionRate').textContent = problems.length ? `${Math.round((solved / problems.length) * 100)}%` : '0%';
    document.getElementById('badgePendingCount').textContent = pending;
    document.getElementById('badgeVerificationCount').textContent = evaluation;
  }

  function renderReviewQueue() {
    const list = document.getElementById('reviewMasterList');
    const empty = document.getElementById('reviewQueueEmpty');
    if (!list) return;
    const search = document.getElementById('frictionListSearch')?.value.trim().toLowerCase() || '';
    const category = document.getElementById('frictionCategoryFilter')?.value || 'all';
    const queue = problems.filter((item) => item.status === 'Pending Review')
      .filter((item) => category === 'all' || item.category === category)
      .filter((item) => !search || `${item.title} ${item.ownerName} ${item.ownerUsername} ${item.friction}`.toLowerCase().includes(search));
    list.innerHTML = queue.map((problem) => `
      <div class="review-list-item" data-id="${esc(problem.id)}" style="padding:16px;border-bottom:1px solid var(--border-light)">
        <strong>${esc(problem.title)}</strong>
        <p>${esc(problem.friction || '').slice(0, 180)}</p>
        <small>${esc(problem.category)} by ${esc(problem.ownerName || problem.ownerUsername || 'member')}</small>
        <div style="display:flex;gap:10px;margin-top:12px">
          <button class="btn btn-outline btn-sm" data-select-review="${esc(problem.id)}">Edit</button>
          <button class="btn btn-primary btn-sm" data-open="${esc(problem.id)}">Publish</button>
          <button class="btn btn-outline btn-sm" data-reject="${esc(problem.id)}">Reject</button>
        </div>
      </div>
    `).join('');
    if (empty) empty.style.display = queue.length ? 'none' : 'flex';
    document.getElementById('masterQueueCount').textContent = `${queue.length} pending review`;
    list.querySelectorAll('[data-select-review]').forEach((button) => button.addEventListener('click', () => selectReviewProblem(button.dataset.selectReview)));
    list.querySelectorAll('[data-open]').forEach((button) => button.addEventListener('click', () => updateStatus(button.dataset.open, 'Open')));
    list.querySelectorAll('[data-reject]').forEach((button) => button.addEventListener('click', () => updateStatus(button.dataset.reject, 'Needs Revision')));
  }

  function selectReviewProblem(problemId) {
    selectedProblemId = problemId;
    const problem = problems.find((item) => item.id === problemId);
    if (!problem) return;
    document.getElementById('detailUnselectedState').style.display = 'none';
    document.getElementById('detailEditorForm').style.display = 'block';
    document.getElementById('detailAuthor').textContent = `Voiced by: ${problem.ownerName || problem.ownerUsername || 'member'}`;
    document.getElementById('detailDate').textContent = problem.date || '';
    document.getElementById('detailCategoryTag').textContent = problem.category || 'Community';
    document.getElementById('editTitle').value = problem.title || '';
    document.getElementById('editFriction').value = problem.friction || '';
    document.getElementById('editTried').value = problem.tried || '';
    document.getElementById('editRipple').value = problem.ripple || '';
    document.getElementById('editResolution').value = problem.resolution || problem.ownerReview || '';
  }

  async function saveSelectedProblem(status) {
    if (!selectedProblemId) return;
    const patch = {
      title: document.getElementById('editTitle').value.trim(),
      friction: document.getElementById('editFriction').value.trim(),
      tried: document.getElementById('editTried').value.trim(),
      ripple: document.getElementById('editRipple').value.trim(),
      resolution: document.getElementById('editResolution').value.trim(),
      status
    };
    await window.TWS.updateProblem(selectedProblemId, patch);
    window.TWS.logSystemActivity('AUDIT', `${status} set for edited friction "${patch.title || selectedProblemId}".`);
    selectedProblemId = '';
    document.getElementById('detailEditorForm').style.display = 'none';
    document.getElementById('detailUnselectedState').style.display = 'flex';
    await refresh();
  }

  function awardDefaults(problem) {
    const contributors = (problem.contributors || []).map(contributorName).filter(Boolean);
    const poster = problem.ownerUsername || window.TWS.toUsername(problem.ownerName || problem.solver);
    const names = Array.from(new Set([poster].concat(contributors).filter(Boolean)));
    return names.map((name, index) => ({
      name,
      points: index === 0 ? 50 : name === problem.solvedBy ? 150 : 75,
      keep: !(problem.suggestedRemovals || []).includes(name)
    }));
  }

  function renderVerificationQueue() {
    const grid = document.getElementById('verificationCardsGrid');
    const empty = document.getElementById('verificationQueueEmpty');
    if (!grid) return;
    const queue = problems.filter((item) => item.status === 'Pending Evaluation' || item.status === 'Closed by Owner');
    grid.innerHTML = queue.map((problem) => {
      const reviews = problem.contributorReviews || [];
      const awards = problem.evaluatorAwards?.length ? problem.evaluatorAwards : awardDefaults(problem);
      return `
        <article class="audit-card" style="padding:18px;border:1px solid var(--border-light);border-radius:8px;background:#fff">
          <h3>${esc(problem.title)}</h3>
          <p>${esc(problem.ownerReview || 'No owner review provided.')}</p>
          <div class="award-editor" data-id="${esc(problem.id)}">
            ${awards.map((award) => {
              const note = reviews.find((review) => review.name === award.name);
              return `
                <div style="display:grid;grid-template-columns:1fr 90px 90px;gap:10px;align-items:center;margin:12px 0">
                  <div><strong>${esc(award.name)}</strong><br><small>${esc(note?.comment || 'No note')}</small></div>
                  <input class="editor-input award-points" data-name="${esc(award.name)}" type="number" value="${Number(award.points) || 0}">
                  <label><input class="award-keep" data-name="${esc(award.name)}" type="checkbox" ${award.keep === false ? '' : 'checked'}> keep</label>
                </div>
              `;
            }).join('')}
          </div>
          <div style="display:flex;gap:10px;margin-top:14px">
            <button class="btn btn-primary btn-sm" data-finalize="${esc(problem.id)}">Finalize points and mark solved</button>
            <button class="btn btn-outline btn-sm" data-reopen="${esc(problem.id)}">Reopen</button>
          </div>
        </article>
      `;
    }).join('');
    if (empty) empty.style.display = queue.length ? 'none' : 'flex';
    grid.querySelectorAll('[data-finalize]').forEach((button) => button.addEventListener('click', () => finalizeProblem(button.dataset.finalize)));
    grid.querySelectorAll('[data-reopen]').forEach((button) => button.addEventListener('click', () => updateStatus(button.dataset.reopen, 'Open')));
  }

  async function updateStatus(problemId, status) {
    await window.TWS.updateProblem(problemId, { status });
    window.TWS.logSystemActivity('AUDIT', `${status} set for friction ${problemId}.`);
    await refresh();
  }

  async function finalizeProblem(problemId) {
    const editor = document.querySelector(`.award-editor[data-id="${CSS.escape(problemId)}"]`);
    const awards = Array.from(editor.querySelectorAll('.award-points')).map((input) => {
      const keep = editor.querySelector(`.award-keep[data-name="${CSS.escape(input.dataset.name)}"]`)?.checked;
      return { name: input.dataset.name, points: Number(input.value) || 0, keep };
    });
    const kept = awards.filter((award) => award.keep);
    const problem = problems.find((item) => item.id === problemId);
    await Promise.all(kept.map(async (award) => {
      const member = members.find((item) => item.username === award.name || item.displayName === award.name || item.name === award.name);
      if (!member) return;
      const id = member.uid || member.id || member.username;
      const current = Number(member.points || member.stats?.totalImpactPoints || 0);
      const solved = Number(member.solved || member.stats?.problemsSolved || 0) + 1;
      await window.TWS.saveUserProfile(id, {
        ...member,
        stats: { ...(member.stats || {}), totalImpactPoints: current + award.points, problemsSolved: solved }
      });
    }));
    await window.TWS.updateProblem(problemId, {
      status: 'Solved',
      contributors: kept.map((award) => award.name),
      evaluatorAwards: awards,
      solvedBy: kept[0]?.name || problem?.solvedBy || '',
      winnerXP: kept[0]?.points || 0,
      attemptXP: 0
    });
    window.TWS.logSystemActivity('AUDIT', `Finalized solved friction "${problem?.title || problemId}" with individual point awards.`);
    await refresh();
  }

  function renderMembersLedger() {
    const list = document.getElementById('solversCompactList');
    if (!list) return;
    const search = document.getElementById('solverListSearch')?.value.trim().toLowerCase() || '';
    const sort = document.getElementById('solverSortSelect')?.value || 'points-desc';
    const visible = members.filter((member) => !search || `${member.displayName} ${member.name} ${member.username} ${member.email}`.toLowerCase().includes(search))
      .sort((a, b) => {
        const ap = Number(a.points || a.stats?.totalImpactPoints || 0);
        const bp = Number(b.points || b.stats?.totalImpactPoints || 0);
        if (sort === 'points-asc') return ap - bp;
        if (sort === 'name-asc') return String(a.displayName || a.name).localeCompare(String(b.displayName || b.name));
        return bp - ap;
      });
    list.innerHTML = visible.map((member) => {
      const points = Number(member.points || member.stats?.totalImpactPoints || 0);
      const id = member.uid || member.id || member.username;
      return `
        <div class="solver-list-row" data-select-solver="${esc(id)}" style="padding:12px;border-bottom:1px solid var(--border-light)">
          <div class="row-avatar">${esc(member.initials || window.TWS.initialsFromName(member.displayName || member.name))}</div>
          <div class="row-info"><span class="row-name">${esc(member.displayName || member.name)}</span><span class="row-xp">${esc(window.TWS.memberPrefix(points))} ${esc(member.role || 'Member')}</span></div>
          <span class="row-solved-badge">${points.toLocaleString()} pts</span>
        </div>
      `;
    }).join('');
    list.querySelectorAll('[data-select-solver]').forEach((row) => row.addEventListener('click', () => selectMember(row.dataset.selectSolver)));
  }

  function selectMember(memberId) {
    selectedMemberId = memberId;
    const member = members.find((item) => [item.uid, item.id, item.username].includes(memberId));
    if (!member) return;
    const points = Number(member.points || member.stats?.totalImpactPoints || 0);
    document.getElementById('solverUnselectedState').style.display = 'none';
    document.getElementById('solverProfileForm').style.display = 'block';
    document.getElementById('profileName').textContent = member.displayName || member.name || member.username;
    document.getElementById('profileRole').textContent = `${window.TWS.memberPrefix(points)} ${member.role || 'Member'}`;
    document.getElementById('profileInitials').textContent = member.initials || window.TWS.initialsFromName(member.displayName || member.name);
    document.getElementById('editSolverPoints').value = points;
    document.getElementById('editSolverSolved').value = Number(member.solved || member.stats?.problemsSolved || 0);
    document.getElementById('editSolverSpecialty').value = member.specialty || '';
    document.querySelectorAll('input[name="badges"]').forEach((input) => {
      input.checked = (member.badges || []).includes(input.value);
    });
  }

  async function saveSelectedMember() {
    if (!selectedMemberId) return;
    const member = members.find((item) => [item.uid, item.id, item.username].includes(selectedMemberId));
    if (!member) return;
    const points = Number(document.getElementById('editSolverPoints').value) || 0;
    const solved = Number(document.getElementById('editSolverSolved').value) || 0;
    const badges = Array.from(document.querySelectorAll('input[name="badges"]:checked')).map((input) => input.value);
    await window.TWS.saveUserProfile(selectedMemberId, {
      ...member,
      specialty: document.getElementById('editSolverSpecialty').value.trim(),
      badges,
      points,
      solved,
      stats: { ...(member.stats || {}), totalImpactPoints: points, problemsSolved: solved }
    });
    window.TWS.logSystemActivity('LEDGER', `Updated solver ledger profile for ${member.displayName || member.username}.`);
    await refresh();
    selectMember(selectedMemberId);
  }

  async function recruitMember() {
    const displayName = prompt('Display name for the new member?');
    if (!displayName) return;
    const email = prompt('Email for this member?') || '';
    const username = window.TWS.toUsername(prompt('Username for this member?') || displayName);
    if (!(await window.TWS.usernameAvailable(username))) {
      alert('That username is already taken. Choose another one.');
      return;
    }
    const id = `manual_${Date.now()}`;
    await window.TWS.saveUserProfile(id, {
      id,
      email,
      displayName,
      username,
      role: 'Member',
      specialty: '',
      badges: [],
      stats: { totalImpactPoints: 0, problemsSolved: 0 }
    });
    window.TWS.logSystemActivity('SYSTEM', `Recruited member ${displayName}.`);
    await refresh();
  }

  async function deleteSelectedMember() {
    if (!selectedMemberId || !confirm('Remove this user from the community directory?')) return;
    await window.TWS.deleteUserProfile(selectedMemberId);
    window.TWS.logSystemActivity('SYSTEM', `Removed community member ${selectedMemberId}.`);
    selectedMemberId = '';
    document.getElementById('solverProfileForm').style.display = 'none';
    document.getElementById('solverUnselectedState').style.display = 'flex';
    await refresh();
  }

  function renderSettings() {
    document.getElementById('setBaseFrictionXP').value = Number(settings.baseFrictionXP || 50);
    document.getElementById('setBaseSolutionXP').value = Number(settings.baseSolutionXP || 150);
    document.getElementById('setMinTitleLen').value = Number(settings.minTitleLength || 8);
    document.getElementById('setMinFrictionLen').value = Number(settings.minFrictionLength || 40);
    document.getElementById('setEncouragementLevel').value = settings.encouragementLevel || 'medium';
  }

  function renderLogs() {
    const lines = document.getElementById('logConsoleLines');
    if (!lines) return;
    const logs = window.TWS.loadSystemLogs();
    lines.innerHTML = logs.length ? logs.map((log) => `
      <div class="log-line">
        <span class="log-timestamp">${esc(log.timestamp)}</span>
        <span class="log-tag ${esc(String(log.type || 'system').toLowerCase())}">${esc(log.type || 'SYSTEM')}</span>
        ${esc(log.message)}
      </div>
    `).join('') : '<div class="log-line">No activity logged yet.</div>';
  }

  function initRoleAssignment() {
    document.getElementById('btnAssignRole')?.addEventListener('click', async () => {
      const email = document.getElementById('roleAssignEmail').value.trim();
      const displayName = document.getElementById('roleAssignName').value.trim();
      const role = document.getElementById('roleAssignRole').value;
      const partner = confirm('Should this person also have Supporting Partner dashboard access?');
      const dashboardAccess = [...(roleAccess[role] || ['user'])];
      if (partner) dashboardAccess.push('supportingPartner');
      const result = await window.TWSAccess.setRoleAssignment({ email, displayName, role, isSupportingPartner: partner, dashboardAccess });
      const status = document.getElementById('roleAssignStatus');
      if (status) status.textContent = `${result.role} access saved for ${result.email}.`;
    });
  }

  function initControls() {
    document.getElementById('frictionListSearch')?.addEventListener('input', renderReviewQueue);
    document.getElementById('frictionCategoryFilter')?.addEventListener('change', renderReviewQueue);
    document.getElementById('btnPublishFriction')?.addEventListener('click', () => saveSelectedProblem('Open'));
    document.getElementById('btnFlagFriction')?.addEventListener('click', () => saveSelectedProblem('Needs Revision'));
    document.getElementById('btnDeleteFriction')?.addEventListener('click', async () => {
      if (!selectedProblemId || !confirm('Delete this friction permanently?')) return;
      await window.TWS.deleteProblem(selectedProblemId);
      window.TWS.logSystemActivity('AUDIT', `Deleted friction ${selectedProblemId}.`);
      selectedProblemId = '';
      await refresh();
    });
    document.getElementById('solverListSearch')?.addEventListener('input', renderMembersLedger);
    document.getElementById('solverSortSelect')?.addEventListener('change', renderMembersLedger);
    document.getElementById('btnRecruitSolver')?.addEventListener('click', recruitMember);
    document.getElementById('btnSaveSolver')?.addEventListener('click', saveSelectedMember);
    document.getElementById('btnDeleteSolver')?.addEventListener('click', deleteSelectedMember);
    document.getElementById('settingsForm')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      settings = {
        baseFrictionXP: Number(document.getElementById('setBaseFrictionXP').value) || 50,
        baseSolutionXP: Number(document.getElementById('setBaseSolutionXP').value) || 150,
        minTitleLength: Number(document.getElementById('setMinTitleLen').value) || 8,
        minFrictionLength: Number(document.getElementById('setMinFrictionLen').value) || 40,
        encouragementLevel: document.getElementById('setEncouragementLevel').value
      };
      await window.TWS.saveSettings(settings);
      window.TWS.logSystemActivity('SYSTEM', 'Updated global community parameters.');
      renderLogs();
      alert('System settings saved.');
    });
    document.getElementById('btnExportDB')?.addEventListener('click', () => {
      const data = localStorage.getItem('tws_local_data_v1') || '{}';
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `tws-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      window.TWS.logSystemActivity('DATABASE', 'Exported local database backup.');
      renderLogs();
    });
    document.getElementById('importDBFile')?.addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const text = await file.text();
      JSON.parse(text);
      localStorage.setItem('tws_local_data_v1', text);
      window.TWS.logSystemActivity('DATABASE', 'Imported local database backup.');
      await refresh();
    });
    document.getElementById('btnResetDB')?.addEventListener('click', async () => {
      if (!confirm('Reset local cached data for this browser?')) return;
      localStorage.removeItem('tws_local_data_v1');
      window.TWS.logSystemActivity('DATABASE', 'Reset local database cache.');
      await refresh();
    });
    document.getElementById('btnClearLogs')?.addEventListener('click', () => {
      if (!confirm('Clear activity logs?')) return;
      window.TWS.clearSystemLogs();
      renderLogs();
    });
  }

  function initSignOut() {
    document.getElementById('signOutBtn')?.addEventListener('click', () => {
      sessionStorage.removeItem('portal_session');
      window.location.href = 'login.html';
    });
  }

  async function refresh() {
    problems = await window.TWS.loadProblemsAsync([]);
    members = await window.TWS.loadMovementMembersAsync([]);
    settings = await window.TWS.loadSettings(settings);
    renderStats();
    renderReviewQueue();
    renderVerificationQueue();
    renderMembersLedger();
    renderSettings();
    renderLogs();
  }

  async function init() {
    if (!(await load())) return;
    renderShell();
    renderStats();
    renderReviewQueue();
    renderVerificationQueue();
    renderMembersLedger();
    renderSettings();
    renderLogs();
    initControls();
    initRoleAssignment();
    initSignOut();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
