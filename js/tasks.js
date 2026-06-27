(function () {
  'use strict';

  const esc = window.TWS.escapeHTML;
  let session = null;
  let tasks = [];
  let submissions = [];
  let members = [];
  let categories = [];
  let selectedId = '';
  let selectedType = '';
  let activeFilter = 'available';

  function getSession() {
    return JSON.parse(sessionStorage.getItem('portal_session') || 'null');
  }

  function ownSubmission(item) {
    return item.memberUid === session?.uid || String(item.memberEmail || '').toLowerCase() === String(session?.email || '').toLowerCase();
  }

  function taskIsAvailable(task) {
    const now = new Date();
    const starts = task.startDate ? new Date(`${task.startDate}T00:00:00`) : null;
    const ends = task.endDate ? new Date(`${task.endDate}T23:59:59`) : null;
    return task.status === 'Published' && (!starts || starts <= now) && (!ends || ends >= now);
  }

  function latestSubmissionForTask(taskId) {
    return submissions
      .filter((item) => item.taskId === taskId && ownSubmission(item))
      .sort((a, b) => String(b.submittedAt || '').localeCompare(String(a.submittedAt || '')))[0] || null;
  }

  function statusClass(status) {
    return String(status || '').toLowerCase().replace(/\s+/g, '-');
  }

  function formatDate(value) {
    if (!value) return 'No date';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  async function load() {
    session = getSession();
    if (!session) {
      window.location.href = 'login.html';
      return false;
    }
    const [loadedTasks, loadedSubmissions, loadedMembers, loadedCategories] = await Promise.all([
      window.TWS.loadCommunityTasksAsync([]),
      window.TWS.loadTaskSubmissionsAsync([]),
      window.TWS.loadMovementMembersAsync([]),
      window.TWS.loadTaskCategoriesAsync()
    ]);
    tasks = loadedTasks;
    submissions = loadedSubmissions;
    members = loadedMembers;
    categories = loadedCategories;
    return true;
  }

  function renderProfileStats() {
    const member = members.find((item) => item.uid === session.uid || String(item.email || '').toLowerCase() === String(session.email || '').toLowerCase());
    const experience = window.TWS.experienceFromStats(member || session || {});
    const progression = window.TWS.progressionFromExperience(experience);
    document.getElementById('memberExp').textContent = experience.toLocaleString();
    document.getElementById('memberProgression').textContent = progression.label;
  }

  function renderCategoryFilter() {
    const select = document.getElementById('taskCategoryFilter');
    if (!select) return;
    const current = select.value || 'all';
    select.innerHTML = '<option value="all">All categories</option>' + categories.map((item) => `<option value="${esc(item.name)}">${esc(item.name)}</option>`).join('');
    select.value = Array.from(select.options).some((option) => option.value === current) ? current : 'all';
  }

  function filteredRows() {
    const search = document.getElementById('taskSearch')?.value.trim().toLowerCase() || '';
    const category = document.getElementById('taskCategoryFilter')?.value || 'all';
    const available = tasks.filter(taskIsAvailable);
    const rowMap = {
      available: available.filter((task) => {
        const latest = latestSubmissionForTask(task.id);
        return !latest || ['Rejected', 'Information Requested'].includes(latest.status);
      }).map((task) => ({ type: 'task', task, submission: latestSubmissionForTask(task.id) })),
      pending: submissions.filter((item) => ownSubmission(item) && item.status === 'Pending Verification').map((submission) => ({ type: 'submission', task: tasks.find((item) => item.id === submission.taskId), submission })),
      info: submissions.filter((item) => ownSubmission(item) && item.status === 'Information Requested').map((submission) => ({ type: 'submission', task: tasks.find((item) => item.id === submission.taskId), submission })),
      completed: submissions.filter((item) => ownSubmission(item) && item.status === 'Approved').map((submission) => ({ type: 'submission', task: tasks.find((item) => item.id === submission.taskId), submission })),
      rejected: submissions.filter((item) => ownSubmission(item) && item.status === 'Rejected').map((submission) => ({ type: 'submission', task: tasks.find((item) => item.id === submission.taskId), submission })),
      history: submissions.filter(ownSubmission).map((submission) => ({ type: 'submission', task: tasks.find((item) => item.id === submission.taskId), submission }))
    };
    return (rowMap[activeFilter] || []).filter(({ task, submission }) => {
      const text = `${task?.title || submission?.taskTitle || ''} ${task?.category || submission?.category || ''} ${task?.description || ''} ${submission?.description || ''}`.toLowerCase();
      const rowCategory = task?.category || submission?.category || '';
      return (!search || text.includes(search)) && (category === 'all' || rowCategory === category);
    });
  }

  function renderList() {
    const list = document.getElementById('taskList');
    if (!list) return;
    const rows = filteredRows();
    list.innerHTML = rows.length ? rows.map(({ type, task, submission }) => {
      const id = type === 'task' ? task.id : submission.id;
      const title = task?.title || submission?.taskTitle || 'Untitled task';
      const status = submission?.status || 'Available';
      return `
        <button class="task-row ${selectedId === id ? 'active' : ''}" data-type="${esc(type)}" data-id="${esc(id)}">
          <span class="task-row-meta">${esc(task?.category || submission?.category || 'Community')} · ${esc(task?.difficulty || 'Task')}</span>
          <strong>${esc(title)}</strong>
          <span>${esc(task?.estimatedTime || 'Review instructions before starting')}</span>
          <small class="task-status ${esc(statusClass(status))}">${esc(status)}</small>
        </button>
      `;
    }).join('') : `
      <div class="task-empty-list">
        <h2>No tasks here yet</h2>
        <p>When task data is available for this status, it will appear here.</p>
      </div>
    `;
    list.querySelectorAll('.task-row').forEach((row) => row.addEventListener('click', () => {
      selectedId = row.dataset.id;
      selectedType = row.dataset.type;
      renderList();
      renderDetail();
    }));
  }

  function attachmentInputs() {
    return `
      <div class="proof-grid">
        <label>Photo proof<input id="proofPhotos" type="file" accept="image/*" multiple /></label>
        <label>Documents<input id="proofDocuments" type="file" accept=".pdf,.doc,.docx,.txt,.md,image/*" multiple /></label>
        <label>Video proof<input id="proofVideos" type="file" accept="video/*" multiple /></label>
      </div>
      <label>External links<textarea id="proofLinks" rows="3" placeholder="One URL per line"></textarea></label>
    `;
  }

  function renderSubmissionForm(task, submission) {
    const canAdd = !submission || ['Rejected', 'Information Requested', 'In Progress'].includes(submission.status);
    if (!canAdd) return '';
    const buttonText = submission?.status === 'Information Requested' ? 'Send Additional Proof' : 'Submit for Verification';
    return `
      <form class="proof-form" id="proofForm">
        <h3>${esc(buttonText)}</h3>
        <label>Completed activity description<textarea id="proofDescription" required rows="5">${esc(submission?.description || '')}</textarea></label>
        <label>Reflection<textarea id="proofReflection" rows="4">${esc(submission?.reflection || '')}</textarea></label>
        ${attachmentInputs()}
        <button class="btn-primary" type="submit">${esc(buttonText)}</button>
        <p class="proof-note">Proof is reviewed by an evaluator before EXP or Impact Points are awarded.</p>
      </form>
    `;
  }

  function renderAttachments(submission) {
    const attachments = submission?.attachments || [];
    const links = submission?.links || [];
    if (!attachments.length && !links.length) return '<p class="muted">No proof attachments submitted yet.</p>';
    return `
      <div class="attachment-list">
        ${attachments.map((item) => `<a href="${esc(item.url || '#')}" target="_blank" rel="noopener">${esc(item.name || item.type || 'Attachment')}</a>`).join('')}
        ${links.map((link) => `<a href="${esc(window.TWS.safeExternalUrl(link))}" target="_blank" rel="noopener">${esc(link)}</a>`).join('')}
      </div>
    `;
  }

  function renderDetail() {
    const pane = document.getElementById('taskDetail');
    if (!pane) return;
    const submission = selectedType === 'submission'
      ? submissions.find((item) => item.id === selectedId)
      : null;
    const task = selectedType === 'task'
      ? tasks.find((item) => item.id === selectedId)
      : tasks.find((item) => item.id === submission?.taskId);
    const latest = submission || latestSubmissionForTask(task?.id);
    if (!task && !submission) {
      pane.innerHTML = '<div class="task-empty-detail"><h2>Select a task</h2><p>Choose an available task or submission to see instructions, proof requirements, and reward status.</p></div>';
      return;
    }
    pane.innerHTML = `
      <article class="task-detail-inner">
        <div class="detail-kicker">${esc(task?.category || submission?.category || 'Community Task')}</div>
        <h2>${esc(task?.title || submission?.taskTitle || 'Untitled task')}</h2>
        <div class="reward-strip">
          <span>${Number(task?.expReward ?? submission?.expReward ?? 0).toLocaleString()} EXP</span>
          <span>${Number(task?.impactPointReward ?? submission?.impactPointReward ?? 0).toLocaleString()} IP</span>
          <span>${esc(task?.difficulty || 'Task')}</span>
          <span>${esc(task?.cadence || 'One-time')}</span>
        </div>
        <p>${esc(task?.description || '')}</p>
        <dl class="task-facts">
          <div><dt>Estimated time</dt><dd>${esc(task?.estimatedTime || 'Not specified')}</dd></div>
          <div><dt>Window</dt><dd>${esc(formatDate(task?.startDate))} to ${esc(formatDate(task?.endDate))}</dd></div>
          <div><dt>Verification</dt><dd>${esc(task?.verificationRequirement || 'Evaluator review required')}</dd></div>
          <div><dt>Status</dt><dd>${esc(latest?.status || 'Available')}</dd></div>
        </dl>
        <section>
          <h3>Instructions</h3>
          <p>${esc(task?.instructions || 'No additional instructions have been published for this task.')}</p>
        </section>
        <section>
          <h3>Submission Guidelines</h3>
          <p>${esc(task?.submissionGuidelines || 'Submit clear proof and a short description of the completed activity.')}</p>
        </section>
        ${latest ? `
          <section>
            <h3>Your Submission</h3>
            <p>${esc(latest.description || '')}</p>
            ${latest.reflection ? `<p>${esc(latest.reflection)}</p>` : ''}
            ${renderAttachments(latest)}
            ${latest.evaluatorComments ? `<div class="review-note"><strong>Evaluator note</strong><p>${esc(latest.evaluatorComments)}</p></div>` : ''}
          </section>
        ` : ''}
        ${renderSubmissionForm(task, latest)}
      </article>
    `;
    document.getElementById('proofForm')?.addEventListener('submit', (event) => submitProof(event, task, latest));
  }

  async function filesToAttachments(inputId, type) {
    const files = Array.from(document.getElementById(inputId)?.files || []);
    return Promise.all(files.map((file) => new Promise((resolve, reject) => {
      if (file.size > 512000) {
        reject(new Error('file-too-large'));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve({ type, name: file.name, size: file.size, mimeType: file.type, url: reader.result });
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    })));
  }

  async function submitProof(event, task, existing) {
    event.preventDefault();
    try {
      const [photos, documents, videos] = await Promise.all([
        filesToAttachments('proofPhotos', 'photo'),
        filesToAttachments('proofDocuments', 'document'),
        filesToAttachments('proofVideos', 'video')
      ]);
      const links = document.getElementById('proofLinks').value.split(/\n+/).map((item) => window.TWS.safeExternalUrl(item)).filter(Boolean);
      const payload = {
        id: existing?.id || `submission_${Date.now()}`,
        taskId: task.id,
        taskTitle: task.title,
        category: task.category,
        description: document.getElementById('proofDescription').value.trim(),
        reflection: document.getElementById('proofReflection').value.trim(),
        attachments: [...(existing?.attachments || []), ...photos, ...documents, ...videos],
        links: Array.from(new Set([...(existing?.links || []), ...links])),
        status: 'Pending Verification',
        expReward: task.expReward,
        impactPointReward: task.impactPointReward,
        historyNote: existing?.status === 'Information Requested' ? 'Additional proof submitted' : 'Submitted for verification'
      };
      await window.TWS.saveTaskSubmission(payload);
      selectedType = 'submission';
      selectedId = payload.id;
      await refresh();
    } catch (err) {
      if (String(err?.message || '').includes('duplicate-proof')) {
        alert('This proof appears to match a previous submission. Please submit unique evidence for each task.');
      } else if (String(err?.message || '').includes('file-too-large')) {
        alert('Each uploaded proof file must be 500 KB or smaller in this static app.');
      } else {
        alert('Unable to submit this task proof right now.');
      }
      console.warn('Task submission failed.', err);
    }
  }

  function initControls() {
    document.querySelectorAll('.task-tab').forEach((button) => button.addEventListener('click', () => {
      activeFilter = button.dataset.filter;
      selectedId = '';
      selectedType = '';
      document.querySelectorAll('.task-tab').forEach((item) => item.classList.remove('active'));
      button.classList.add('active');
      renderList();
      renderDetail();
    }));
    document.getElementById('taskSearch')?.addEventListener('input', renderList);
    document.getElementById('taskCategoryFilter')?.addEventListener('change', renderList);
  }

  async function refresh() {
    const [loadedSubmissions, loadedMembers] = await Promise.all([
      window.TWS.loadTaskSubmissionsAsync([]),
      window.TWS.loadMovementMembersAsync([])
    ]);
    submissions = loadedSubmissions;
    members = loadedMembers;
    renderProfileStats();
    renderList();
    renderDetail();
  }

  async function init() {
    if (!(await load())) return;
    renderProfileStats();
    renderCategoryFilter();
    renderList();
    renderDetail();
    initControls();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
