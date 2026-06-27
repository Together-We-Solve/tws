(function () {
  'use strict';

  const esc = window.TWS.escapeHTML;
  const mode = window.TWS_DASHBOARD_MODE || 'Superadmin';
  let session = null;
  let problems = [];
  let members = [];
  let partners = [];
  let tasks = [];
  let taskSubmissions = [];
  let taskCategories = [];
  let settings = {};
  let selectedProblemId = '';
  let selectedMemberId = '';
  let selectedPartnerId = '';
  let selectedTaskId = '';

  const roleAccess = {
    Founder: ['user', 'evaluator', 'superadmin', 'supportingPartner'],
    'Co-Founder': ['user', 'evaluator', 'superadmin', 'supportingPartner'],
    Innovator: ['user', 'evaluator'],
    Evaluator: ['user', 'evaluator'],
    Steward: ['user'],
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

  function fieldValue(id, fallback = '') {
    const el = document.getElementById(id);
    return el ? el.value : fallback;
  }

  function setFieldValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value;
  }

  function canManageSystemSession() {
    const privileges = Array.isArray(session?.privileges) ? session.privileges : [];
    const dashboards = Array.isArray(session?.dashboardAccess) ? session.dashboardAccess : [];
    return privileges.includes('manage_system') || dashboards.includes('superadmin') || ['Founder', 'Co-Founder'].includes(session?.role);
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
    partners = await window.TWS.loadPartnersAsync([]);
    tasks = await window.TWS.loadCommunityTasksAsync([]);
    taskSubmissions = await window.TWS.loadTaskSubmissionsAsync([]);
    taskCategories = await window.TWS.loadTaskCategoriesAsync();
    settings = await window.TWS.loadSettings({
      baseFrictionXP: 50,
      baseSolutionXP: 150,
      impactRewards: window.TWS.defaultImpactRewards,
      experienceRewards: window.TWS.defaultExperienceRewards,
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
    const taskEvaluation = taskSubmissions.filter((item) => ['Pending Verification', 'Information Requested', 'Flagged'].includes(item.status)).length;
    const solved = problems.filter((item) => item.status === 'Solved').length;
    document.getElementById('statPendingReviews').textContent = pending;
    document.getElementById('statPendingVerifications').textContent = evaluation + taskEvaluation;
    document.getElementById('statTotalSolved').textContent = `${solved} Solved`;
    document.getElementById('statTotalSolvers').textContent = members.length;
    document.getElementById('statTotalXP').textContent = `${members.reduce((sum, member) => sum + window.TWS.impactPointsFromStats(member), 0).toLocaleString()} IP`;
    document.getElementById('statResolutionRate').textContent = problems.length ? `${Math.round((solved / problems.length) * 100)}%` : '0%';
    document.getElementById('badgePendingCount').textContent = pending;
    document.getElementById('badgeVerificationCount').textContent = evaluation + taskEvaluation;
  }

  function populateProgressionControls() {
    const rankSelect = document.getElementById('editProgressionRank');
    const levelSelect = document.getElementById('editProgressionLevel');
    if (rankSelect && !rankSelect.options.length) {
      rankSelect.innerHTML = window.TWS.progressionRanks.map((rank) => `<option value="${esc(rank)}">${esc(rank)}</option>`).join('');
    }
    if (levelSelect && !levelSelect.options.length) {
      levelSelect.innerHTML = Array.from({ length: 10 }, (_, index) => `<option value="${index + 1}">Level ${index + 1}</option>`).join('');
    }
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
    const rewards = { ...window.TWS.defaultImpactRewards, ...(settings.impactRewards || {}) };
    const experienceRewards = {
      ...window.TWS.defaultExperienceRewards,
      voicedFriction: Number(settings.baseFrictionXP || window.TWS.defaultExperienceRewards.voicedFriction),
      verifiedSolution: Number(settings.baseSolutionXP || window.TWS.defaultExperienceRewards.verifiedSolution),
      ...(settings.experienceRewards || {})
    };
    const contributors = (problem.contributors || []).map(contributorName).filter(Boolean);
    const poster = problem.ownerUsername || window.TWS.toUsername(problem.ownerName || problem.solver);
    const names = Array.from(new Set([poster].concat(contributors).filter(Boolean)));
    return names.map((name, index) => ({
      name,
      points: index === 0 ? rewards.verifiedProblem : name === problem.solvedBy ? rewards.verifiedSolution : rewards.partialSolution,
      experience: index === 0 ? experienceRewards.verifiedProblem : name === problem.solvedBy ? experienceRewards.verifiedSolution : experienceRewards.partialSolution,
      keep: !(problem.suggestedRemovals || []).includes(name)
    }));
  }

  function renderVerificationQueue() {
    const grid = document.getElementById('verificationCardsGrid');
    const empty = document.getElementById('verificationQueueEmpty');
    if (!grid) return;
    const queue = problems.filter((item) => item.status === 'Pending Evaluation' || item.status === 'Closed by Owner');
    const taskQueue = taskSubmissions.filter((item) => ['Pending Verification', 'Information Requested', 'Flagged'].includes(item.status));
    const problemCards = queue.map((problem) => {
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
                <div style="display:grid;grid-template-columns:1fr 90px 90px 90px;gap:10px;align-items:center;margin:12px 0">
                  <div><strong>${esc(award.name)}</strong><br><small>${esc(note?.comment || 'No note')}</small></div>
                  <input class="editor-input award-points" data-name="${esc(award.name)}" type="number" min="0" title="Impact Points" value="${Number(award.points) || 0}">
                  <input class="editor-input award-experience" data-name="${esc(award.name)}" type="number" min="0" title="Experience" value="${Number(award.experience) || 0}">
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
    const taskCards = taskQueue.map((submission) => taskVerificationCard(submission)).join('');
    grid.innerHTML = problemCards + taskCards;
    if (empty) empty.style.display = queue.length || taskQueue.length ? 'none' : 'flex';
    grid.querySelectorAll('[data-finalize]').forEach((button) => button.addEventListener('click', () => finalizeProblem(button.dataset.finalize)));
    grid.querySelectorAll('[data-reopen]').forEach((button) => button.addEventListener('click', () => updateStatus(button.dataset.reopen, 'Open')));
    grid.querySelectorAll('[data-task-action]').forEach((button) => button.addEventListener('click', () => reviewTask(button.dataset.submission, button.dataset.taskAction)));
  }

  function taskVerificationCard(submission) {
    const member = members.find((item) => (
      item.uid === submission.memberUid ||
      item.id === submission.memberUid ||
      String(item.email || '').toLowerCase() === String(submission.memberEmail || '').toLowerCase()
    ));
    const completed = taskSubmissions.filter((item) => item.memberUid === submission.memberUid && item.status === 'Approved').length;
    const attachments = (submission.attachments || []).map((item) => `<a href="${esc(item.url || '#')}" target="_blank" rel="noopener">${esc(item.name || item.type || 'Attachment')}</a>`).join('');
    const links = (submission.links || []).map((link) => `<a href="${esc(window.TWS.safeExternalUrl(link))}" target="_blank" rel="noopener">${esc(link)}</a>`).join('');
    return `
      <article class="audit-card" style="padding:18px;border:1px solid var(--border-light);border-radius:8px;background:#fff">
        <div class="audit-card-header">
          <div>
            <span class="audit-category">${esc(submission.category || 'Community Task')}</span>
            <h3 class="audit-title">${esc(submission.taskTitle || 'Task submission')}</h3>
          </div>
          <span class="audit-date">${esc(submission.status)}</span>
        </div>
        <div class="audit-meta-row">
          <span>${esc(submission.memberName || 'Member')}</span>
          <span>${Number(submission.expReward || 0).toLocaleString()} EXP</span>
          <span>${Number(submission.impactPointReward || 0).toLocaleString()} IP</span>
        </div>
        <p class="audit-summary">${esc(submission.description || 'No description submitted.')}</p>
        ${submission.reflection ? `<div class="verification-card-resolution">${esc(submission.reflection)}</div>` : ''}
        <div class="verification-card-detail-box">
          <strong>Member context</strong><br>
          Profile: <a href="${esc(window.TWS.profileUrl(submission.memberUsername || submission.memberName))}" target="_blank" rel="noopener">${esc(submission.memberName || 'Open profile')}</a><br>
          Completed tasks: ${completed}<br>
          Current EXP: ${Number(window.TWS.experienceFromStats(member || {})).toLocaleString()}<br>
          Current IP: ${Number(window.TWS.impactPointsFromStats(member || {})).toLocaleString()}
        </div>
        <div class="attachment-list" style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0">${attachments || links ? attachments + links : '<span style="opacity:.65">No attachments or links submitted.</span>'}</div>
        <textarea class="editor-textarea small" data-task-comment="${esc(submission.id)}" placeholder="Optional evaluator comment"></textarea>
        <div class="audit-action-footer">
          <button class="btn btn-primary btn-sm" data-submission="${esc(submission.id)}" data-task-action="approve">Approve</button>
          <button class="btn btn-outline btn-sm" data-submission="${esc(submission.id)}" data-task-action="request_info">Request Info</button>
          <button class="btn btn-outline btn-sm" data-submission="${esc(submission.id)}" data-task-action="reject">Reject</button>
          <button class="btn btn-outline btn-sm" data-submission="${esc(submission.id)}" data-task-action="flag">Flag</button>
        </div>
      </article>
    `;
  }

  async function reviewTask(submissionId, action) {
    const comment = document.querySelector(`[data-task-comment="${CSS.escape(submissionId)}"]`)?.value || '';
    await window.TWS.reviewTaskSubmission(submissionId, action, comment);
    window.TWS.logSystemActivity('TASK', `${action} set for task submission ${submissionId}.`);
    await refresh();
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
      const experienceInput = editor.querySelector(`.award-experience[data-name="${CSS.escape(input.dataset.name)}"]`);
      return {
        name: input.dataset.name,
        points: Number(input.value) || 0,
        experience: Number(experienceInput?.value) || 0,
        keep
      };
    });
    const kept = awards.filter((award) => award.keep);
    const problem = problems.find((item) => item.id === problemId);
    await window.TWS.updateProblem(problemId, {
      status: 'Solved',
      contributors: kept.map((award) => award.name),
      evaluatorAwards: awards,
      solvedBy: kept[0]?.name || problem?.solvedBy || '',
      winnerXP: kept[0]?.points || 0,
      attemptXP: 0,
      winnerEXP: kept[0]?.experience || 0,
      attemptEXP: 0
    });
    await Promise.all(kept.map(async (award) => {
      const member = members.find((item) => item.username === award.name || item.displayName === award.name || item.name === award.name);
      if (!member) return;
      const id = member.uid || member.id || member.username;
      const current = window.TWS.impactPointsFromStats(member);
      const currentExperience = window.TWS.experienceFromStats(member);
      const solved = Number(member.solved || member.stats?.problemsSolved || 0) + 1;
      const history = Array.isArray(member.awardHistory) ? member.awardHistory : [];
      const points = Number(award.points) || 0;
      const experience = Number(award.experience) || 0;
      await window.TWS.saveUserProfile(id, {
        ...member,
        awardHistory: history.includes(problemId) ? history : history.concat(problemId),
        lastContributionAward: {
          problemId,
          points,
          experience,
          awardedBy: session?.uid || session?.email || '',
          awardedAt: new Date().toISOString()
        },
        stats: {
          ...(member.stats || {}),
          experience: currentExperience + experience,
          impactPoints: current + points,
          totalImpactPoints: current + points,
          problemsSolved: solved
        }
      });
    }));
    window.TWS.logSystemActivity('AUDIT', `Finalized solved friction "${problem?.title || problemId}" with individual IP and EXP awards.`);
    await refresh();
  }

  function renderMembersLedger() {
    const list = document.getElementById('solversCompactList');
    if (!list) return;
    const search = document.getElementById('solverListSearch')?.value.trim().toLowerCase() || '';
    const sort = document.getElementById('solverSortSelect')?.value || 'points-desc';
    const visible = members.filter((member) => !search || `${member.displayName} ${member.name} ${member.username} ${member.email}`.toLowerCase().includes(search))
      .sort((a, b) => {
        const ap = window.TWS.impactPointsFromStats(a);
        const bp = window.TWS.impactPointsFromStats(b);
        if (sort === 'points-asc') return ap - bp;
        if (sort === 'name-asc') return String(a.displayName || a.name).localeCompare(String(b.displayName || b.name));
        return bp - ap;
      });
    list.innerHTML = visible.map((member) => {
      const points = window.TWS.impactPointsFromStats(member);
      const id = member.uid || member.id || member.username;
      return `
        <div class="solver-list-row" data-select-solver="${esc(id)}" style="padding:12px;border-bottom:1px solid var(--border-light)">
          <div class="row-avatar">${esc(member.initials || window.TWS.initialsFromName(member.displayName || member.name))}</div>
          <div class="row-info"><span class="row-name">${esc(member.displayName || member.name)}</span><span class="row-xp">${esc(window.TWS.memberPrefix(member))}${member.adminRole ? ` - ${esc(member.adminRole)}` : ''}</span></div>
          <span class="row-solved-badge">${points.toLocaleString()} IP</span>
        </div>
      `;
    }).join('');
    list.querySelectorAll('[data-select-solver]').forEach((row) => row.addEventListener('click', () => selectMember(row.dataset.selectSolver)));
  }

  function renderPartnersLedger() {
    const list = document.getElementById('partnersCompactList');
    if (!list) return;
    const search = document.getElementById('partnerListSearch')?.value.trim().toLowerCase() || '';
    const visible = partners.filter((partner) => !search || `${partner.name} ${partner.email} ${partner.focus} ${partner.bio}`.toLowerCase().includes(search));
    list.innerHTML = visible.length ? visible.map((partner) => `
      <div class="solver-list-row" data-select-partner="${esc(partner.id)}" style="padding:12px;border-bottom:1px solid var(--border-light)">
        <div class="row-avatar">${esc(window.TWS.initialsFromName(partner.name || 'Partner'))}</div>
        <div class="row-info"><span class="row-name">${esc(partner.name || 'Unnamed Partner')}</span><span class="row-xp">${esc(partner.focus || partner.email || 'Supporting Partner')}</span></div>
      </div>
    `).join('') : '<div style="padding:18px;opacity:.65">No supporting partners yet.</div>';
    list.querySelectorAll('[data-select-partner]').forEach((row) => row.addEventListener('click', () => selectPartner(row.dataset.selectPartner)));
  }

  function renderTaskCategoryOptions() {
    const select = document.getElementById('editTaskCategory');
    if (!select) return;
    const current = select.value;
    select.innerHTML = taskCategories.map((item) => `<option value="${esc(item.name)}">${esc(item.name)}</option>`).join('');
    if (current && Array.from(select.options).some((option) => option.value === current)) select.value = current;
  }

  function renderTasksLedger() {
    const list = document.getElementById('tasksCompactList');
    if (!list) return;
    const search = document.getElementById('taskListSearch')?.value.trim().toLowerCase() || '';
    const visible = tasks.filter((task) => !search || `${task.title} ${task.category} ${task.description} ${task.status}`.toLowerCase().includes(search));
    list.innerHTML = visible.length ? visible.map((task) => `
      <div class="solver-list-row" data-select-task="${esc(task.id)}" style="padding:12px;border-bottom:1px solid var(--border-light)">
        <div class="row-avatar">${esc(String(task.category || 'Task').slice(0, 2).toUpperCase())}</div>
        <div class="row-info"><span class="row-name">${esc(task.title || 'Untitled Task')}</span><span class="row-xp">${esc(task.category)} - ${esc(task.status)} - ${Number(task.expReward).toLocaleString()} EXP</span></div>
      </div>
    `).join('') : '<div style="padding:18px;opacity:.65">No community tasks have been created yet.</div>';
    list.querySelectorAll('[data-select-task]').forEach((row) => row.addEventListener('click', () => selectTask(row.dataset.selectTask)));
  }

  function selectTask(taskId) {
    const form = document.getElementById('taskEditorForm');
    const unselected = document.getElementById('taskUnselectedState');
    if (!form || !unselected) return;
    selectedTaskId = taskId;
    const task = tasks.find((item) => item.id === taskId) || {
      id: '',
      title: '',
      description: '',
      category: taskCategories[0]?.name || 'Community Service',
      difficulty: 'Easy',
      cadence: 'One-time',
      estimatedTime: '',
      expReward: 0,
      impactPointReward: 0,
      verificationRequirement: 'Evaluator review required',
      startDate: '',
      endDate: '',
      status: 'Draft',
      instructions: '',
      submissionGuidelines: ''
    };
    renderTaskCategoryOptions();
    unselected.style.display = 'none';
    form.style.display = 'block';
    document.getElementById('taskEditorTitle').textContent = task.title || 'New Community Task';
    document.getElementById('taskEditorMeta').textContent = `${task.status || 'Draft'} - ${task.category || 'Community Service'}`;
    setFieldValue('editTaskTitle', task.title || '');
    setFieldValue('editTaskDescription', task.description || '');
    setFieldValue('editTaskCategory', task.category || taskCategories[0]?.name || 'Community Service');
    setFieldValue('editTaskDifficulty', task.difficulty || 'Easy');
    setFieldValue('editTaskCadence', task.cadence || 'One-time');
    setFieldValue('editTaskTime', task.estimatedTime || '');
    setFieldValue('editTaskExp', Number(task.expReward) || 0);
    setFieldValue('editTaskIp', Number(task.impactPointReward) || 0);
    setFieldValue('editTaskStart', task.startDate || '');
    setFieldValue('editTaskEnd', task.endDate || '');
    setFieldValue('editTaskStatus', task.status || 'Draft');
    setFieldValue('editTaskVerification', task.verificationRequirement || 'Evaluator review required');
    setFieldValue('editTaskInstructions', task.instructions || '');
    setFieldValue('editTaskGuidelines', task.submissionGuidelines || '');
  }

  function taskPayload(overrides = {}) {
    const existing = tasks.find((item) => item.id === selectedTaskId) || {};
    return {
      ...existing,
      id: overrides.id || existing.id || `task_${Date.now()}`,
      title: fieldValue('editTaskTitle').trim(),
      description: fieldValue('editTaskDescription').trim(),
      category: fieldValue('editTaskCategory', taskCategories[0]?.name || 'Community Service'),
      difficulty: fieldValue('editTaskDifficulty', 'Easy'),
      cadence: fieldValue('editTaskCadence', 'One-time'),
      estimatedTime: fieldValue('editTaskTime').trim(),
      expReward: Number(fieldValue('editTaskExp')) || 0,
      impactPointReward: Number(fieldValue('editTaskIp')) || 0,
      startDate: fieldValue('editTaskStart'),
      endDate: fieldValue('editTaskEnd'),
      status: overrides.status || fieldValue('editTaskStatus', 'Draft'),
      verificationRequirement: fieldValue('editTaskVerification').trim() || 'Evaluator review required',
      instructions: fieldValue('editTaskInstructions').trim(),
      submissionGuidelines: fieldValue('editTaskGuidelines').trim()
    };
  }

  async function saveSelectedTask(overrides = {}) {
    const payload = taskPayload(overrides);
    if (!payload.title) {
      alert('Task title is required.');
      return;
    }
    const saved = await window.TWS.saveCommunityTask(payload);
    selectedTaskId = saved.id;
    window.TWS.logSystemActivity('TASK', `Saved community task "${saved.title}".`);
    await refresh();
    selectTask(saved.id);
  }

  async function duplicateSelectedTask() {
    if (!selectedTaskId) return;
    await saveSelectedTask({ id: `task_${Date.now()}` });
  }

  async function deleteSelectedTask() {
    if (!selectedTaskId || !confirm('Delete this community task? Existing submissions remain in history.')) return;
    await window.TWS.deleteCommunityTask(selectedTaskId);
    window.TWS.logSystemActivity('TASK', `Deleted community task ${selectedTaskId}.`);
    selectedTaskId = '';
    document.getElementById('taskEditorForm').style.display = 'none';
    document.getElementById('taskUnselectedState').style.display = 'flex';
    await refresh();
  }

  async function addTaskCategory() {
    const name = fieldValue('newTaskCategory').trim();
    if (!name) return;
    await window.TWS.saveTaskCategory(name);
    window.TWS.logSystemActivity('TASK', `Added task category ${name}.`);
    taskCategories = await window.TWS.loadTaskCategoriesAsync();
    renderTaskCategoryOptions();
    setFieldValue('newTaskCategory', '');
  }

  function selectMember(memberId) {
    selectedMemberId = memberId;
    const member = members.find((item) => [item.uid, item.id, item.username].includes(memberId));
    if (!member) return;
    const points = window.TWS.impactPointsFromStats(member);
    const progression = member.progression || window.TWS.progressionFromExperience(member.experience || member.stats?.experience || 0);
    document.getElementById('solverUnselectedState').style.display = 'none';
    document.getElementById('solverProfileForm').style.display = 'block';
    document.getElementById('profileName').textContent = member.displayName || member.name || member.username;
    document.getElementById('profileRole').textContent = `${window.TWS.memberPrefix(member)}${member.adminRole ? ` - ${member.adminRole}` : ''}`;
    document.getElementById('profileInitials').textContent = member.initials || window.TWS.initialsFromName(member.displayName || member.name);
    document.getElementById('editSolverPoints').value = points;
    populateProgressionControls();
    setFieldValue('editSolverExperience', Number(member.experience || member.stats?.experience || 0));
    setFieldValue('editProgressionRank', progression.rank);
    setFieldValue('editProgressionLevel', progression.level);
    document.getElementById('editSolverSolved').value = Number(member.solved || member.stats?.problemsSolved || 0);
    setFieldValue('editAdminRole', member.adminRole || '');
    setFieldValue('editSupportingPartner', String(Boolean(member.isSupportingPartner)));
    document.getElementById('editSolverSpecialty').value = member.specialty || '';
    document.querySelectorAll('input[name="badges"]').forEach((input) => {
      input.checked = (member.badges || []).includes(input.value);
    });
  }

  function selectPartner(partnerId) {
    const form = document.getElementById('partnerProfileForm');
    const unselected = document.getElementById('partnerUnselectedState');
    if (!form || !unselected) return;
    selectedPartnerId = partnerId;
    const partner = partners.find((item) => item.id === partnerId) || {};
    unselected.style.display = 'none';
    form.style.display = 'block';
    document.getElementById('partnerProfileName').textContent = partner.name || 'New Partner';
    document.getElementById('partnerProfileMeta').textContent = partner.email || 'Supporting Partner';
    setFieldValue('editPartnerName', partner.name || '');
    setFieldValue('editPartnerEmail', partner.email || '');
    setFieldValue('editPartnerOwnerUid', partner.ownerUid || '');
    setFieldValue('editPartnerWebsite', partner.website || '');
    setFieldValue('editPartnerLogo', partner.logo || '');
    setFieldValue('editPartnerFocus', partner.focus || '');
    setFieldValue('editPartnerBio', partner.bio || '');
  }

  async function saveSelectedMember() {
    if (!selectedMemberId) return;
    const member = members.find((item) => [item.uid, item.id, item.username].includes(selectedMemberId));
    if (!member) return;
    const points = Number(document.getElementById('editSolverPoints').value) || 0;
    const currentProgression = member.progression || window.TWS.progressionFromExperience(member.experience || member.stats?.experience || 0);
    const selectedRank = fieldValue('editProgressionRank', currentProgression.rank);
    const selectedLevel = Number(fieldValue('editProgressionLevel', currentProgression.level)) || 1;
    const enteredExperience = Number(fieldValue('editSolverExperience', member.experience || member.stats?.experience || 0)) || 0;
    const rankExperience = window.TWS.experienceForProgression(selectedRank, selectedLevel);
    const experience = Math.max(enteredExperience, rankExperience);
    const solved = Number(document.getElementById('editSolverSolved').value) || 0;
    const adminRole = fieldValue('editAdminRole', member.adminRole || '');
    const previousRole = member.adminRole || member.role || 'Member';
    const accessRole = adminRole && adminRole !== 'Supporting Partner' ? adminRole : 'Member';
    const isSupportingPartner = fieldValue('editSupportingPartner', String(Boolean(member.isSupportingPartner))) === 'true' || adminRole === 'Supporting Partner';
    const dashboardAccess = Array.from(new Set([...(roleAccess[accessRole] || ['user']), ...(isSupportingPartner ? ['supportingPartner'] : [])]));
    const badges = Array.from(document.querySelectorAll('input[name="badges"]:checked')).map((input) => input.value);
    const currentPoints = window.TWS.impactPointsFromStats(member);
    const currentExperience = Number(member.experience || member.stats?.experience || 0);
    const currentSolved = Number(member.solved || member.stats?.problemsSolved || 0);
    const progressionChanged = points !== currentPoints || experience !== currentExperience || solved !== currentSolved;
    if (progressionChanged && !canManageSystemSession()) {
      alert('Only superadmins can directly edit member EXP, Impact Points, or solved counts. Use friction finalization to award verified contribution points.');
      return;
    }
    await window.TWS.saveUserProfile(selectedMemberId, {
      ...member,
      specialty: document.getElementById('editSolverSpecialty').value.trim(),
      badges,
      points,
      impactPoints: points,
      experience,
      solved,
      role: accessRole,
      adminRole,
      isSupportingPartner,
      dashboardAccess,
      stats: { ...(member.stats || {}), experience, impactPoints: points, totalImpactPoints: points, problemsSolved: solved }
    });
    if (member.email && window.TWSAccess?.setRoleAssignment) {
      await window.TWSAccess.setRoleAssignment({
        email: member.email,
        displayName: member.displayName || member.name || member.username,
        role: accessRole,
        isSupportingPartner,
        dashboardAccess
      });
    }
    window.TWS.logSystemActivity('LEDGER', `Updated solver ledger profile for ${member.displayName || member.username}.`);
    if (previousRole !== (adminRole || 'Member')) {
      window.TWS.logSystemActivity('AUDIT', `${session.displayName || session.email} changed ${member.displayName || member.username} role from ${previousRole || 'Member'} to ${adminRole || 'Member'}.`);
    }
    await refresh();
    selectMember(selectedMemberId);
  }

  async function saveSelectedPartner() {
    const name = document.getElementById('editPartnerName').value.trim();
    if (!name) {
      alert('Partner name is required.');
      return;
    }
    const id = selectedPartnerId || `partner_${Date.now()}`;
    const payload = {
      id,
      name,
      email: document.getElementById('editPartnerEmail').value.trim().toLowerCase(),
      ownerUid: document.getElementById('editPartnerOwnerUid').value.trim(),
      website: document.getElementById('editPartnerWebsite').value.trim(),
      logo: document.getElementById('editPartnerLogo').value.trim(),
      focus: document.getElementById('editPartnerFocus').value.trim(),
      bio: document.getElementById('editPartnerBio').value.trim()
    };
    await window.TWS.savePartnerProfile(id, payload);
    window.TWS.logSystemActivity('SYSTEM', `Saved supporting partner ${name}.`);
    selectedPartnerId = id;
    await refresh();
    selectPartner(id);
  }

  async function deleteSelectedPartner() {
    if (!selectedPartnerId || !confirm('Remove this supporting partner profile?')) return;
    await window.TWS.deletePartnerProfile(selectedPartnerId);
    window.TWS.logSystemActivity('SYSTEM', `Removed supporting partner ${selectedPartnerId}.`);
    selectedPartnerId = '';
    const form = document.getElementById('partnerProfileForm');
    const unselected = document.getElementById('partnerUnselectedState');
    if (form) form.style.display = 'none';
    if (unselected) unselected.style.display = 'flex';
    await refresh();
  }

  async function recruitMember() {
    const displayName = prompt('Display name for the new member?');
    if (!displayName) return;
    const email = String(prompt('Email for this member?') || '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
      alert('A valid email is required to create a member.');
      return;
    }
    const username = window.TWS.toUsername(prompt('Username for this member?') || displayName);
    const id = `manual_${Date.now()}`;
    if (!(await window.TWS.identityAvailable({ username, email, uid: id }))) {
      alert('That username, email, or user ID is already attached to another account.');
      return;
    }
    await window.TWS.saveUserProfile(id, {
      id,
      email,
      displayName,
      username,
      role: 'Member',
      adminRole: '',
      specialty: '',
      badges: [],
      stats: { experience: 0, impactPoints: 0, totalImpactPoints: 0, problemsSolved: 0 }
    });
    window.TWS.logSystemActivity('SYSTEM', `Recruited member ${displayName}.`);
    await refresh();
  }

  async function deleteSelectedMember() {
    if (!selectedMemberId || !confirm('Remove this user from the community directory?')) return;
    try {
      await window.TWS.deleteUserProfile(selectedMemberId);
      window.TWS.logSystemActivity('SYSTEM', `Removed community member ${selectedMemberId}.`);
      selectedMemberId = '';
      document.getElementById('solverProfileForm').style.display = 'none';
      document.getElementById('solverUnselectedState').style.display = 'flex';
      await refresh();
    } catch (err) {
      alert('This account does not have permission to remove that member.');
      console.warn('Member delete blocked by backend rules.', err);
    }
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
      const email = fieldValue('roleAssignEmail').trim().toLowerCase();
      const displayName = fieldValue('roleAssignName').trim();
      const role = fieldValue('roleAssignRole', 'Member');
      const reason = prompt('Reason for this role change?') || 'No reason provided';
      const partner = confirm('Should this person also have Supporting Partner dashboard access?');
      const dashboardAccess = [...(roleAccess[role] || ['user'])];
      if (partner) dashboardAccess.push('supportingPartner');
      if (!window.TWSAccess?.setRoleAssignment) {
        alert('Role assignment service is still loading. Please try again in a moment.');
        return;
      }
      const result = await window.TWSAccess.setRoleAssignment({ email, displayName, role, isSupportingPartner: partner, dashboardAccess });
      const member = members.find((item) => String(item.email || '').toLowerCase() === email.toLowerCase());
      if (member) {
        await window.TWS.saveUserProfile(member.uid || member.id || member.username, {
          ...member,
          role,
          adminRole: ['Member', 'Contributor'].includes(role) ? '' : role,
          isSupportingPartner: partner,
          dashboardAccess,
          privileges: result.privileges || []
        });
        await refresh();
      }
      const status = document.getElementById('roleAssignStatus');
      if (status) status.textContent = `${result.role} access saved for ${result.email}.`;
      window.TWS.logSystemActivity('AUDIT', `${session.displayName || session.email} assigned ${role} to ${displayName || email}. Reason: ${reason}`);
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
    document.getElementById('partnerListSearch')?.addEventListener('input', renderPartnersLedger);
    document.getElementById('taskListSearch')?.addEventListener('input', renderTasksLedger);
    document.getElementById('btnAddTask')?.addEventListener('click', () => {
      selectedTaskId = '';
      selectTask('');
    });
    document.getElementById('btnSaveTask')?.addEventListener('click', () => saveSelectedTask());
    document.getElementById('btnArchiveTask')?.addEventListener('click', () => saveSelectedTask({ status: 'Archived' }));
    document.getElementById('btnDuplicateTask')?.addEventListener('click', duplicateSelectedTask);
    document.getElementById('btnDeleteTask')?.addEventListener('click', deleteSelectedTask);
    document.getElementById('btnAddTaskCategory')?.addEventListener('click', addTaskCategory);
    document.getElementById('btnAddPartner')?.addEventListener('click', () => {
      selectedPartnerId = '';
      selectPartner('');
    });
    document.getElementById('btnSavePartner')?.addEventListener('click', saveSelectedPartner);
    document.getElementById('btnDeletePartner')?.addEventListener('click', deleteSelectedPartner);
    document.getElementById('editProgressionRank')?.addEventListener('change', () => {
      const rank = document.getElementById('editProgressionRank').value;
      const level = Number(document.getElementById('editProgressionLevel').value) || 1;
      document.getElementById('editSolverExperience').value = window.TWS.experienceForProgression(rank, level);
    });
    document.getElementById('editProgressionLevel')?.addEventListener('change', () => {
      const rank = document.getElementById('editProgressionRank').value;
      const level = Number(document.getElementById('editProgressionLevel').value) || 1;
      document.getElementById('editSolverExperience').value = window.TWS.experienceForProgression(rank, level);
    });
    document.getElementById('btnRecruitSolver')?.addEventListener('click', recruitMember);
    document.getElementById('btnSaveSolver')?.addEventListener('click', saveSelectedMember);
    document.getElementById('btnDeleteSolver')?.addEventListener('click', deleteSelectedMember);
    document.getElementById('settingsForm')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      settings = {
        baseFrictionXP: Number(document.getElementById('setBaseFrictionXP').value) || 50,
        baseSolutionXP: Number(document.getElementById('setBaseSolutionXP').value) || 150,
        impactRewards: settings.impactRewards || window.TWS.defaultImpactRewards,
        experienceRewards: settings.experienceRewards || window.TWS.defaultExperienceRewards,
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
    partners = await window.TWS.loadPartnersAsync([]);
    tasks = await window.TWS.loadCommunityTasksAsync([]);
    taskSubmissions = await window.TWS.loadTaskSubmissionsAsync([]);
    taskCategories = await window.TWS.loadTaskCategoriesAsync();
    settings = await window.TWS.loadSettings(settings);
    renderStats();
    renderReviewQueue();
    renderVerificationQueue();
    renderMembersLedger();
    renderPartnersLedger();
    renderTaskCategoryOptions();
    renderTasksLedger();
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
    renderPartnersLedger();
    renderTaskCategoryOptions();
    renderTasksLedger();
    renderSettings();
    renderLogs();
    initControls();
    initRoleAssignment();
    initSignOut();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
