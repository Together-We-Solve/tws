(function () {
  'use strict';

  const esc = window.TWS.escapeHTML;
  const mode = window.TWS_DASHBOARD_MODE || 'Superadmin';
  let session = null;
  let problems = [];
  let referrals = [];
  let selectedReferralId = '';
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
  let selectedImpactArchiveId = '';

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
    try {
      const { configModule, db, firestoreModule } = await window.TWS.getFirebaseDataApiSafe();
      const snap = await firestoreModule.getDocs(firestoreModule.collection(db, configModule.accessCollections.referrals));
      referrals = snap.docs.map(doc => doc.data());
    } catch (e) {
      console.warn('Failed to load referrals', e);
    }
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

    const pendingReferralsCount = referrals.filter(r => r.status === 'Pending Verification').length;
    const badgeReferralCount = document.getElementById('badgeReferralCount');
    if (badgeReferralCount) {
      badgeReferralCount.textContent = pendingReferralsCount;
      badgeReferralCount.style.display = pendingReferralsCount > 0 ? 'inline-block' : 'none';
    }
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

  function renderBadgeControls() {
    const grid = document.querySelector('.badges-check-grid');
    if (!grid) return;
    grid.innerHTML = window.TWS.badgeCatalog
      .filter((badge) => badge.source === 'admin')
      .map((badge) => `
        <label class="badge-check-card">
          <input type="checkbox" name="badges" value="${esc(badge.id)}" />
          <div class="badge-check-inner">
            <span class="badge-check-icon">${esc(badge.icon)}</span>
            <span class="badge-check-title">${esc(badge.name)}</span>
          </div>
        </label>
      `).join('');
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
      const currentSpendable = window.TWS.spendablePointsFromStats(member);
      const currentLifetime = window.TWS.impactPointsFromStats(member);
      const currentExperience = window.TWS.experienceFromStats(member);
      const solved = Number(member.solved || member.stats?.problemsSolved || 0) + 1;
      const history = Array.isArray(member.awardHistory) ? member.awardHistory : [];
      const points = Number(award.points) || 0;
      const experience = Number(award.experience) || 0;
      const nextProfile = {
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
          impactPoints: currentSpendable + points,
          totalImpactPoints: currentLifetime + points,
          problemsSolved: solved
        }
      };
      nextProfile.badges = window.TWS.badgeStorageValues(member.badges, nextProfile);
      await window.TWS.saveUserProfile(id, nextProfile);
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

  function renderImpactArchiveLedger() {
    const list = document.getElementById('impactArchiveList');
    if (!list) return;
    const search = document.getElementById('impactArchiveSearch')?.value.trim().toLowerCase() || '';
    const solved = problems
      .filter((problem) => problem.status === 'Solved')
      .filter((problem) => !search || `${problem.title} ${problem.category} ${problem.solvedBy} ${problem.archiveSummary} ${problem.archiveOutcome}`.toLowerCase().includes(search))
      .sort((a, b) => String(b.updatedAt || b.createdAt || b.date || '').localeCompare(String(a.updatedAt || a.createdAt || a.date || '')));
    list.innerHTML = solved.length ? solved.map((problem) => `
      <div class="solver-list-row" data-select-impact="${esc(problem.id)}" style="padding:12px;border-bottom:1px solid var(--border-light)">
        <div class="row-avatar">${esc(String(problem.category || 'IP').slice(0, 2).toUpperCase())}</div>
        <div class="row-info">
          <span class="row-name">${esc(problem.title || 'Untitled Problem')}</span>
          <span class="row-xp">${esc(problem.category || 'Community')} - ${esc(problem.solvedBy || 'No resolver recorded')}</span>
        </div>
        <span class="row-solved-badge">${Number(problem.archiveRippleReach || 0).toLocaleString()} reached</span>
      </div>
    `).join('') : '<div style="padding:18px;opacity:.65">No solved impact records yet.</div>';
    list.querySelectorAll('[data-select-impact]').forEach((row) => row.addEventListener('click', () => selectImpactArchiveRecord(row.dataset.selectImpact)));
  }

  function selectImpactArchiveRecord(problemId) {
    selectedImpactArchiveId = problemId;
    const problem = problems.find((item) => item.id === problemId);
    const form = document.getElementById('impactArchiveForm');
    const empty = document.getElementById('impactArchiveUnselectedState');
    if (!problem || !form || !empty) return;
    empty.style.display = 'none';
    form.style.display = 'block';
    document.getElementById('impactArchiveTitle').textContent = problem.title || 'Impact Record';
    document.getElementById('impactArchiveMeta').textContent = `${problem.category || 'Community'} - ${problem.solvedBy || 'No resolver recorded'}`;
    setFieldValue('editArchiveSummary', problem.archiveSummary || problem.resolution || problem.ownerReview || '');
    setFieldValue('editArchiveOutcome', problem.archiveOutcome || problem.ownerReview || problem.resolution || '');
    setFieldValue('editArchiveHoursSaved', Number(problem.archiveHoursSaved) || 0);
    setFieldValue('editArchiveRippleReach', Number(problem.archiveRippleReach) || 0);
    setFieldValue('editArchiveClones', Number(problem.archiveClones ?? problem.clones) || 0);
    setFieldValue('editArchiveViews', Number(problem.archiveViews ?? problem.views) || 0);
  }

  async function saveImpactArchiveRecord() {
    if (!selectedImpactArchiveId || !canManageSystemSession()) return;
    const problem = problems.find((item) => item.id === selectedImpactArchiveId);
    if (!problem || problem.status !== 'Solved') {
      alert('Only solved records can be edited for the public impact archive.');
      return;
    }
    const patch = {
      archiveSummary: fieldValue('editArchiveSummary').trim(),
      archiveOutcome: fieldValue('editArchiveOutcome').trim(),
      archiveHoursSaved: Math.max(0, Number(fieldValue('editArchiveHoursSaved')) || 0),
      archiveRippleReach: Math.max(0, Number(fieldValue('editArchiveRippleReach')) || 0),
      archiveClones: Math.max(0, Number(fieldValue('editArchiveClones')) || 0),
      archiveViews: Math.max(0, Number(fieldValue('editArchiveViews')) || 0),
      archiveEditedBy: session?.uid || session?.email || '',
      archiveEditedAt: new Date().toISOString()
    };
    await window.TWS.updateProblem(selectedImpactArchiveId, patch);
    window.TWS.logSystemActivity('AUDIT', `Updated impact archive record "${problem.title || selectedImpactArchiveId}".`);
    await refresh();
    selectImpactArchiveRecord(selectedImpactArchiveId);
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
    const points = window.TWS.spendablePointsFromStats(member);
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
    const badgeIds = window.TWS.badgeStorageValues(member.badges, member);
    document.querySelectorAll('input[name="badges"]').forEach((input) => {
      input.checked = badgeIds.includes(input.value);
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
    const automaticBadges = window.TWS.normalizeBadges(member.badges, member)
      .filter((badge) => badge.source === 'automatic')
      .map((badge) => badge.id);
    const badges = Array.from(new Set(automaticBadges.concat(
      Array.from(document.querySelectorAll('input[name="badges"]:checked')).map((input) => input.value)
    )));
    const currentAdminBadges = window.TWS.normalizeBadges(member.badges, member).filter((badge) => badge.source === 'admin').map((badge) => badge.id).sort();
    const nextAdminBadges = badges.filter((id) => window.TWS.resolveBadge(id).source === 'admin').sort();
    const currentPoints = window.TWS.spendablePointsFromStats(member);
    const currentTotalPoints = window.TWS.impactPointsFromStats(member);
    const currentExperience = Number(member.experience || member.stats?.experience || 0);
    const currentSolved = Number(member.solved || member.stats?.problemsSolved || 0);
    const progressionChanged = points !== currentPoints || experience !== currentExperience || solved !== currentSolved;
    if (progressionChanged && !canManageSystemSession()) {
      alert('Only superadmins can directly edit member EXP, Impact Points, or solved counts. Use friction finalization to award verified contribution points.');
      return;
    }
    if (JSON.stringify(currentAdminBadges) !== JSON.stringify(nextAdminBadges) && !canManageSystemSession()) {
      alert('Only superadmins can award or remove admin badges.');
      return;
    }
    await window.TWS.saveUserProfile(selectedMemberId, {
      ...member,
      specialty: document.getElementById('editSolverSpecialty').value.trim(),
      badges: window.TWS.badgeStorageValues(badges, { ...member, stats: { ...(member.stats || {}), experience, impactPoints: points, totalImpactPoints: Math.max(currentTotalPoints, points), problemsSolved: solved } }),
      points,
      impactPoints: points,
      experience,
      solved,
      role: accessRole,
      adminRole,
      isSupportingPartner,
      dashboardAccess,
      stats: { ...(member.stats || {}), experience, impactPoints: points, totalImpactPoints: Math.max(currentTotalPoints, points), problemsSolved: solved }
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
    document.getElementById('impactArchiveSearch')?.addEventListener('input', renderImpactArchiveLedger);
    document.getElementById('btnSaveImpactArchive')?.addEventListener('click', saveImpactArchiveRecord);
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
    document.getElementById('btnClearLogs')?.addEventListener('click', () => {
      if (!confirm('Clear activity logs?')) return;
      window.TWS.clearSystemLogs();
      renderLogs();
    });
  }

  function renderReferralList() {
    const listContainer = document.getElementById('referralMasterList');
    const emptyPlaceholder = document.getElementById('referralQueueEmpty');
    const queueCountEl = document.getElementById('referralQueueCount');
    if (!listContainer) return;

    listContainer.innerHTML = '';
    const queryStr = (document.getElementById('referralListSearch')?.value || '').trim().toLowerCase();

    const filtered = referrals.filter(r => {
      if (!queryStr) return true;
      return String(r.inviteeName || '').toLowerCase().includes(queryStr) ||
             String(r.inviteeUsername || '').toLowerCase().includes(queryStr) ||
             String(r.inviterName || '').toLowerCase().includes(queryStr) ||
             String(r.inviterUsername || '').toLowerCase().includes(queryStr);
    });

    const sorted = [...filtered].sort((a, b) => {
      const aPending = a.status === 'Pending Verification' ? 1 : 0;
      const bPending = b.status === 'Pending Verification' ? 1 : 0;
      if (aPending !== bPending) return bPending - aPending;
      return new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0);
    });

    const pendingCount = sorted.filter(r => r.status === 'Pending Verification').length;
    if (queueCountEl) queueCountEl.textContent = `${pendingCount} pending review`;

    if (sorted.length === 0) {
      if (emptyPlaceholder) emptyPlaceholder.style.display = 'block';
      return;
    }

    if (emptyPlaceholder) emptyPlaceholder.style.display = 'none';

    sorted.forEach(ref => {
      const card = document.createElement('div');
      card.className = `master-item-card${selectedReferralId === ref.id ? ' active' : ''}`;
      
      let statusClass = 'status-pending';
      if (ref.status === 'Approved') statusClass = 'status-solved';
      else if (ref.status === 'Rejected') statusClass = 'status-flagged';
      else if (ref.status === 'Revoked') statusClass = 'status-archived';

      card.innerHTML = `
        <div class="card-left">
          <span class="card-author">@${esc(ref.inviteeUsername)}</span>
          <h4 class="card-item-title" style="margin-top: 4px;">Referred by @${esc(ref.inviterUsername)}</h4>
          <span class="card-timestamp">${new Date(ref.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
        </div>
        <div class="card-right">
          <span class="status-badge ${statusClass}">${esc(ref.status)}</span>
        </div>
      `;

      card.onclick = () => {
        selectedReferralId = ref.id;
        document.querySelectorAll('#referralMasterList .master-item-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        renderReferralDetail();
      };

      listContainer.appendChild(card);
    });
  }

  function renderReferralDetail() {
    const emptyState = document.getElementById('referralDetailEmpty');
    const contentWrap = document.getElementById('referralDetailContent');
    if (!emptyState || !contentWrap) return;

    if (!selectedReferralId) {
      emptyState.style.display = 'block';
      contentWrap.style.display = 'none';
      return;
    }

    const ref = referrals.find(r => r.id === selectedReferralId);
    if (!ref) {
      selectedReferralId = '';
      emptyState.style.display = 'block';
      contentWrap.style.display = 'none';
      return;
    }

    emptyState.style.display = 'none';
    contentWrap.style.display = 'block';

    document.getElementById('referralDetailInvitee').textContent = `${ref.inviteeName} (@${ref.inviteeUsername})`;
    document.getElementById('referralDetailInviter').textContent = `Invited by: ${ref.inviterName} (@${ref.inviterUsername})`;

    const statusEl = document.getElementById('referralDetailStatus');
    if (statusEl) {
      statusEl.textContent = ref.status;
      statusEl.className = 'status-badge';
      if (ref.status === 'Approved') statusEl.classList.add('status-solved');
      else if (ref.status === 'Rejected') statusEl.classList.add('status-flagged');
      else if (ref.status === 'Revoked') statusEl.classList.add('status-archived');
      else statusEl.classList.add('status-pending');
    }

    document.getElementById('referralReviewNotes').value = ref.rejectionReason || '';

    const inviter = members.find(m => m.uid === ref.inviterUid);
    const invitee = members.find(m => m.uid === ref.inviteeUid);

    const checkSelf = ref.inviterUid === ref.inviteeUid;
    const checkIp = invitee && inviter && invitee.lastIp && inviter.lastIp && invitee.lastIp !== 'unknown' && invitee.lastIp === inviter.lastIp;
    const checkAgent = ref.inviteeUserAgent && inviter && inviter.lastUserAgent && ref.inviteeUserAgent === inviter.lastUserAgent;
    
    const tempDomains = ['mailinator.com', 'yopmail.com', 'tempmail.com', '10minutemail.com', 'guerrillamail.com'];
    const emailDomain = String(ref.inviteeEmail || '').split('@')[1] || '';
    const checkEmail = tempDomains.includes(emailDomain.toLowerCase());

    const emailVerified = invitee ? (invitee.emailVerified === true) : false;
    const profileCompleted = invitee ? (invitee.bio && invitee.bio.trim().length > 5 && invitee.displayName) : false;
    const activityCount = invitee ? ((Number(invitee.stats?.problemsIdentified) || 0) + (Number(invitee.stats?.problemsSolved) || 0)) : 0;
    const checkActivity = activityCount >= 1;

    setAuditCheck('chkSelfReferral', !checkSelf, checkSelf ? 'FAIL: Same accounts detected' : 'PASS: Distinct accounts');
    setAuditCheck('chkDuplicateIp', !checkIp, checkIp ? 'FAIL: Matching network IP detected' : 'PASS: Distinct IP networks');
    setAuditCheck('chkSuspiciousDevice', !checkAgent, checkAgent ? 'FAIL: Matching browser agent detected' : 'PASS: Distinct browser footprints');
    setAuditCheck('chkDisposableEmail', !checkEmail, checkEmail ? 'FAIL: Temporary email provider detected' : 'PASS: Valid email domain');

    setAuditCheck('chkVipEmailVerified', emailVerified, emailVerified ? 'PASS: Email address is verified' : 'Awaiting: Email address verification');
    setAuditCheck('chkVipProfileCompleted', profileCompleted, profileCompleted ? 'PASS: Bio and display name completed' : 'Awaiting: Profile bio and display name');
    setAuditCheck('chkVipActivity', checkActivity, checkActivity ? `PASS: Solver has ${activityCount} platform activities` : `Awaiting: Minimum activity check (${activityCount}/1 completed)`);

    const btnApprove = document.getElementById('btnApproveReferral');
    const btnReject = document.getElementById('btnRejectReferral');

    if (ref.status !== 'Pending Verification') {
      if (btnApprove) btnApprove.disabled = true;
      if (btnReject) {
        btnReject.disabled = false;
        btnReject.textContent = 'Revoke Referral';
        btnReject.style.color = '#c85555';
      }
    } else {
      if (btnApprove) btnApprove.disabled = false;
      if (btnReject) {
        btnReject.disabled = false;
        btnReject.textContent = 'Reject Referral';
        btnReject.style.color = '#c85555';
      }
    }
  }

  function setAuditCheck(elementId, passed, message) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const iconEl = el.querySelector('.check-icon');
    const descEl = el.querySelector('.check-desc');
    if (passed) {
      if (iconEl) iconEl.textContent = '✅';
      el.style.opacity = '1';
    } else {
      if (iconEl) iconEl.textContent = '❌';
      el.style.opacity = '1';
    }
    if (descEl) descEl.textContent = message;
  }

  function initReferralTab() {
    const searchInput = document.getElementById('referralListSearch');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        renderReferralList();
      });
    }

    document.getElementById('btnApproveReferral')?.addEventListener('click', async () => {
      if (!selectedReferralId) return;
      const ref = referrals.find(r => r.id === selectedReferralId);
      if (!ref) return;

      if (!confirm(`Approve referral of ${ref.inviteeName}? This will award IP/EXP rewards to ${ref.inviterName}.`)) return;

      try {
        const { configModule, db, firestoreModule } = await window.TWS.getFirebaseDataApiSafe();
        const referralRef = firestoreModule.doc(db, 'referrals', ref.id);
        
        const note = document.getElementById('referralReviewNotes').value.trim() || 'Approved by administrator';
        const now = new Date().toISOString();
        
        const newHistory = [...(ref.history || [])];
        newHistory.push({
          status: 'Approved',
          updatedBy: session.uid,
          updatedAt: now,
          notes: note
        });

        await firestoreModule.updateDoc(referralRef, {
          status: 'Approved',
          rejectionReason: note,
          validationDate: now,
          verifiedAt: now,
          history: newHistory
        });

        await window.TWS.recalculateUserReferralProgression(ref.inviterUid);

        await window.TWS.createNotification({
          userId: ref.inviterUid,
          email: ref.inviteeEmail,
          type: 'referral',
          title: 'Referral Verified!',
          message: `Your referral of ${ref.inviteeName} has been approved. You earned +1 IP and EXP rewards!`
        });

        await window.TWS.logSystemActivity({
          action: 'REFERRAL_APPROVE',
          detail: `Approved referral of ${ref.inviteeName} by ${ref.inviterName}.`,
          userId: session.uid
        });

        alert('Referral successfully approved.');
        await refresh();
      } catch (err) {
        console.error(err);
        alert('Failed to approve referral.');
      }
    });

    document.getElementById('btnRejectReferral')?.addEventListener('click', async () => {
      if (!selectedReferralId) return;
      const ref = referrals.find(r => r.id === selectedReferralId);
      if (!ref) return;

      const isRevoking = ref.status === 'Approved';
      const actionName = isRevoking ? 'Revoke' : 'Reject';

      const note = document.getElementById('referralReviewNotes').value.trim();
      if (!note) {
        alert('Please specify the rejection or revocation reason in the notes field.');
        return;
      }

      if (!confirm(`Are you sure you want to ${actionName.toLowerCase()} the referral of ${ref.inviteeName}?`)) return;

      try {
        const { configModule, db, firestoreModule } = await window.TWS.getFirebaseDataApiSafe();
        const referralRef = firestoreModule.doc(db, 'referrals', ref.id);
        
        const now = new Date().toISOString();
        const newHistory = [...(ref.history || [])];
        newHistory.push({
          status: isRevoking ? 'Revoked' : 'Rejected',
          updatedBy: session.uid,
          updatedAt: now,
          notes: note
        });

        await firestoreModule.updateDoc(referralRef, {
          status: isRevoking ? 'Revoked' : 'Rejected',
          rejectionReason: note,
          validationDate: now,
          history: newHistory
        });

        await window.TWS.recalculateUserReferralProgression(ref.inviterUid);

        await window.TWS.createNotification({
          userId: ref.inviterUid,
          email: ref.inviteeEmail,
          type: 'referral',
          title: `Referral ${isRevoking ? 'Revoked' : 'Rejected'}`,
          message: `Your referral of ${ref.inviteeName} has been ${isRevoking ? 'revoked' : 'rejected'}. Reason: ${note}`
        });

        await window.TWS.logSystemActivity({
          action: isRevoking ? 'REFERRAL_REVOKE' : 'REFERRAL_REJECT',
          detail: `${isRevoking ? 'Revoked' : 'Rejected'} referral of ${ref.inviteeName} by ${ref.inviterName}. Reason: ${note}`,
          userId: session.uid
        });

        alert(`Referral successfully ${isRevoking ? 'revoked' : 'rejected'}.`);
        await refresh();
      } catch (err) {
        console.error(err);
        alert(`Failed to ${isRevoking ? 'revoke' : 'reject'} referral.`);
      }
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
    try {
      const { configModule, db, firestoreModule } = await window.TWS.getFirebaseDataApiSafe();
      const snap = await firestoreModule.getDocs(firestoreModule.collection(db, configModule.accessCollections.referrals));
      referrals = snap.docs.map(doc => doc.data());
    } catch (e) {
      console.warn(e);
    }
    renderStats();
    renderReviewQueue();
    renderVerificationQueue();
    renderMembersLedger();
    renderPartnersLedger();
    renderTaskCategoryOptions();
    renderTasksLedger();
    renderImpactArchiveLedger();
    renderSettings();
    renderLogs();
    renderReferralList();
    renderReferralDetail();
  }

  async function init() {
    if (!(await load())) return;
    renderShell();
    renderBadgeControls();
    renderStats();
    renderReviewQueue();
    renderVerificationQueue();
    renderMembersLedger();
    renderPartnersLedger();
    renderTaskCategoryOptions();
    renderTasksLedger();
    renderImpactArchiveLedger();
    renderSettings();
    renderLogs();
    renderReferralList();
    renderReferralDetail();
    initControls();
    initRoleAssignment();
    initReferralTab();
    initSignOut();
    initCosmeticsManager();
  }

  function initCosmeticsManager() {
    let cosmeticsList = [];
    let selectedCosmeticId = null;

    const listContainer = document.getElementById('cosmeticsMasterList');
    const unselectedState = document.getElementById('cosmeticsUnselectedState');
    const editorForm = document.getElementById('cosmeticEditorForm');
    const filterCat = document.getElementById('cosmeticsFilterCategory');
    const listSearch = document.getElementById('cosmeticListSearch');
    const cosmeticsCount = document.getElementById('cosmeticsCount');
    const btnAddCosmetic = document.getElementById('btnAddCosmetic');

    const titleEl = document.getElementById('cosmeticEditorTitle');
    const idLabel = document.getElementById('cosmeticIdLabel');
    const idInput = document.getElementById('cosmeticEditIdInput');
    const nameInput = document.getElementById('cosmeticEditName');
    const catSelect = document.getElementById('cosmeticEditCategory');
    const raritySelect = document.getElementById('cosmeticEditRarity');
    const acqSelect = document.getElementById('cosmeticEditAcquisition');
    const reqLevelGroup = document.getElementById('cosmeticEditReqLevelGroup');
    const reqLevelInput = document.getElementById('cosmeticEditReqLevel');
    const reqAchievementGroup = document.getElementById('cosmeticEditReqAchievementGroup');
    const reqAchievementInput = document.getElementById('cosmeticEditReqAchievement');
    const priceGroup = document.getElementById('cosmeticEditPriceGroup');
    const priceInput = document.getElementById('cosmeticEditPrice');
    const reqRoleGroup = document.getElementById('cosmeticEditReqRoleGroup');
    const reqRoleInput = document.getElementById('cosmeticEditReqRole');
    const descInput = document.getElementById('cosmeticEditDescription');
    const assetPathGroup = document.getElementById('cosmeticEditAssetPathGroup');
    const assetPathInput = document.getElementById('cosmeticEditAssetPath');
    const svgContentInput = document.getElementById('cosmeticEditSvgContent');
    const enabledInput = document.getElementById('cosmeticEditEnabled');

    const rewardInstructionsGroup = document.getElementById('rewardInstructionsGroup');
    const rewardInstructionsInput = document.getElementById('cosmeticEditRedeemInstructions');
    const rewardCodeGroup = document.getElementById('rewardCodeGroup');
    const rewardCodeInput = document.getElementById('cosmeticEditRedeemCode');
    const rewardUrlGroup = document.getElementById('rewardUrlGroup');
    const rewardUrlInput = document.getElementById('cosmeticEditExternalUrl');

    const btnDelete = document.getElementById('btnDeleteCosmetic');
    const btnCancel = document.getElementById('btnCancelCosmeticEdit');
    const btnSave = document.getElementById('btnSaveCosmeticEdit');

    if (!listContainer || !editorForm) return;

    function showEditor(cosmetic) {
      selectedCosmeticId = cosmetic ? cosmetic.id : null;
      if (titleEl) titleEl.textContent = cosmetic ? 'Edit Cosmetic' : 'Add Cosmetic';
      if (idLabel) idLabel.textContent = cosmetic ? `ID: ${cosmetic.id}` : 'ID: New Item';
      
      if (idInput) {
        idInput.value = cosmetic?.id || '';
        idInput.disabled = Boolean(cosmetic);
        // Hide container if editing (ID is immutable), show if adding new
        const parent = idInput.parentElement;
        if (parent) {
          parent.style.display = cosmetic ? 'none' : 'block';
        }
      }

      if (nameInput) nameInput.value = cosmetic?.name || '';
      if (catSelect) catSelect.value = cosmetic?.category || 'face';
      if (raritySelect) raritySelect.value = cosmetic?.rarity || 'Common';
      if (acqSelect) acqSelect.value = cosmetic?.acquisition || 'Level';
      if (reqLevelInput) reqLevelInput.value = cosmetic?.reqLevel || 1;
      if (reqAchievementInput) reqAchievementInput.value = cosmetic?.reqAchievement || '';
      if (priceInput) priceInput.value = cosmetic?.price || 10;
      if (reqRoleInput) reqRoleInput.value = cosmetic?.reqRole || 'Founder';
      if (descInput) descInput.value = cosmetic?.description || '';
      if (assetPathInput) assetPathInput.value = cosmetic?.assetPath || cosmetic?.imageUrl || '';
      if (svgContentInput) svgContentInput.value = cosmetic?.svgContent || '';
      if (enabledInput) enabledInput.checked = cosmetic ? Boolean(cosmetic.enabled) : true;

      if (rewardInstructionsInput) rewardInstructionsInput.value = cosmetic?.redeemInstructions || '';
      if (rewardCodeInput) rewardCodeInput.value = cosmetic?.redeemCode || '';
      if (rewardUrlInput) rewardUrlInput.value = cosmetic?.externalUrl || '';

      updateCategoryFields();

      if (btnDelete) {
        btnDelete.style.display = cosmetic ? 'inline-block' : 'none';
      }

      updateAcquisitionFields();
      if (unselectedState) unselectedState.style.display = 'none';
      editorForm.style.display = 'block';
    }

    function hideEditor() {
      editorForm.style.display = 'none';
      if (unselectedState) unselectedState.style.display = 'flex';
      selectedCosmeticId = null;
      listContainer.querySelectorAll('.master-queue-item').forEach(c => c.classList.remove('selected'));
    }

    function updateAcquisitionFields() {
      const acq = acqSelect?.value;
      if (reqLevelGroup) reqLevelGroup.style.display = acq === 'Level' ? 'block' : 'none';
      if (reqAchievementGroup) reqAchievementGroup.style.display = acq === 'Achievement' ? 'block' : 'none';
      if (priceGroup) priceGroup.style.display = acq === 'Marketplace' ? 'block' : 'none';
      if (reqRoleGroup) reqRoleGroup.style.display = acq === 'Role' ? 'block' : 'none';
    }

    function updateCategoryFields() {
      const cat = catSelect?.value;
      const isReward = ['ai-credits', 'gift-card', 'physical-reward', 'external-service', 'other-reward'].includes(cat);
      const isPremiumAvatar = cat === 'premiumAvatar';
      if (rewardInstructionsGroup) rewardInstructionsGroup.style.display = isReward ? 'block' : 'none';
      if (rewardCodeGroup) rewardCodeGroup.style.display = isReward ? 'block' : 'none';
      if (rewardUrlGroup) rewardUrlGroup.style.display = isReward ? 'block' : 'none';
      if (assetPathGroup) assetPathGroup.style.display = isPremiumAvatar ? 'block' : 'none';
    }

    acqSelect?.addEventListener('change', updateAcquisitionFields);
    catSelect?.addEventListener('change', updateCategoryFields);

    async function loadAndRender() {
      try {
        cosmeticsList = await window.TWS.loadCosmeticsAsync();
      } catch (_) {
        cosmeticsList = [];
      }
      renderCosmeticsList();
    }

    function renderCosmeticsList() {
      const catVal = filterCat?.value || 'all';
      const searchVal = listSearch?.value.trim().toLowerCase() || '';

      let items = cosmeticsList;
      if (catVal !== 'all') items = items.filter((c) => c.category === catVal);
      if (searchVal) {
        items = items.filter((c) => 
          String(c.name || '').toLowerCase().includes(searchVal) || 
          String(c.id || '').toLowerCase().includes(searchVal) ||
          String(c.description || '').toLowerCase().includes(searchVal)
        );
      }

      if (cosmeticsCount) {
        cosmeticsCount.textContent = `${items.length} item${items.length === 1 ? '' : 's'} loaded`;
      }

      listContainer.innerHTML = '';
      if (items.length === 0) {
        listContainer.innerHTML = `<div style="grid-column:1/-1;text-align:center;opacity:0.5;padding:40px;">No cosmetics found. Click "+ Add New" to create one.</div>`;
        return;
      }

      items.forEach((item) => {
        const card = document.createElement('div');
        card.className = `master-queue-item${selectedCosmeticId === item.id ? ' selected' : ''}`;
        card.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
            <div>
              <span style="font-size:10px;text-transform:uppercase;letter-spacing:.05em;opacity:.5;">${esc(item.category)}</span>
              <h4 style="font-family:var(--font-display);font-size:15px;margin:2px 0;">${esc(item.name)}</h4>
            </div>
            <span style="font-size:9px;font-weight:700;text-transform:uppercase;padding:2px 8px;border-radius:4px;background:var(--bg-warm);border:1px solid var(--border-light);">${esc(item.rarity)}</span>
          </div>
          <div style="font-size:11px;opacity:.7;margin-top:4px;">
            Acquisition: <strong>${esc(item.acquisition)}</strong>${item.acquisition === 'Marketplace' ? ` &middot; ${item.price} IP` : ''}${item.acquisition === 'Level' ? ` &middot; Level ${item.reqLevel}` : ''}${item.acquisition === 'Role' ? ` &middot; ${esc(item.reqRole || 'Admin role')}` : ''}
          </div>
          <div style="font-size:11px;opacity:.55;margin-top:4px;">${esc(item.description || '—')}</div>
          <div style="display:flex;align-items:center;gap:8px;margin-top:8px;">
            <span style="font-size:10px;padding:2px 8px;border-radius:20px;${item.enabled ? 'background:rgba(61,90,69,.1);color:var(--accent-moss);' : 'background:var(--bg-fog);opacity:.5;'}">${item.enabled ? 'Enabled' : 'Disabled'}</span>
          </div>
        `;

        card.addEventListener('click', () => {
          selectedCosmeticId = item.id;
          listContainer.querySelectorAll('.master-queue-item').forEach(c => c.classList.remove('selected'));
          card.classList.add('selected');
          showEditor(item);
        });

        listContainer.appendChild(card);
      });
    }

    btnAddCosmetic?.addEventListener('click', () => {
      listContainer.querySelectorAll('.master-queue-item').forEach(c => c.classList.remove('selected'));
      showEditor(null);
    });

    btnCancel?.addEventListener('click', hideEditor);

    btnDelete?.addEventListener('click', async () => {
      if (!selectedCosmeticId) return;
      if (!window.confirm(`Delete cosmetic "${selectedCosmeticId}"? This cannot be undone.`)) return;
      try {
        await window.TWS.deleteCosmetic(selectedCosmeticId);
        window.TWS.logSystemActivity('AUDIT', `Deleted cosmetic asset "${selectedCosmeticId}".`);
        hideEditor();
        await loadAndRender();
      } catch (err) {
        window.TWS.showToast(`Error: ${err.message}`);
      }
    });

    btnSave?.addEventListener('click', async () => {
      const idField = selectedCosmeticId || idInput?.value.trim();
      const name = nameInput?.value.trim();
      if (!idField || !name) {
        window.TWS.showToast('Cosmetic ID and Name are required.');
        return;
      }
      const acq = acqSelect?.value || 'Level';
      const existing = cosmeticsList.find(c => c.id === idField) || {};
      const cosmetic = {
        ...existing,
        id: idField,
        name,
        category: catSelect?.value || 'face',
        rarity: raritySelect?.value || 'Common',
        acquisition: acq,
        reqLevel: acq === 'Level' ? Number(reqLevelInput?.value) || 1 : null,
        reqAchievement: acq === 'Achievement' ? reqAchievementInput?.value.trim() : null,
        reqRole: acq === 'Role' ? reqRoleInput?.value || 'Founder' : null,
        price: acq === 'Marketplace' ? Number(priceInput?.value) || 10 : null,
        description: descInput?.value.trim() || '',
        enabled: enabledInput ? enabledInput.checked : true,
        releaseDate: existing.releaseDate || new Date().toISOString().split('T')[0],
        redeemInstructions: rewardInstructionsInput?.value.trim() || '',
        redeemCode: rewardCodeInput?.value.trim() || '',
        externalUrl: rewardUrlInput?.value.trim() || '',
        assetPath: assetPathInput?.value.trim() || '',
        svgContent: svgContentInput?.value.trim() || existing.svgContent || ''
      };
      try {
        await window.TWS.saveCosmetic(cosmetic.id, cosmetic);
        window.TWS.logSystemActivity('AUDIT', `Saved cosmetic asset "${cosmetic.id}".`);
        hideEditor();
        await loadAndRender();
      } catch (err) {
        window.TWS.showToast(`Error: ${err.message}`);
      }
    });

    filterCat?.addEventListener('change', renderCosmeticsList);
    listSearch?.addEventListener('input', renderCosmeticsList);

    document.querySelector('.nav-tab-btn[data-tab="cosmetics"]')?.addEventListener('click', () => {
      if (cosmeticsList.length === 0) loadAndRender();
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
