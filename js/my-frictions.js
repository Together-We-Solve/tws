(function () {
  'use strict';

  const esc = window.TWS.escapeHTML;
  let session = null;
  let problems = [];

  function getSession() {
    return JSON.parse(sessionStorage.getItem('portal_session') || 'null');
  }

  function owns(problem) {
    const username = window.TWS.toUsername(session?.username || session?.displayName || session?.email);
    return problem.ownerUid === session?.uid || problem.ownerUsername === username || window.TWS.toUsername(problem.solver) === username;
  }

  function participantName(item) {
    return typeof item === 'string' ? item : (item.displayName || item.username || item.name || '');
  }

  async function load() {
    session = getSession();
    if (!session) {
      window.location.href = 'login.html';
      return;
    }
    problems = await window.TWS.loadProblemsAsync([]);
  }

  function statusBadge(status) {
    const label = status === 'Pending Evaluation' ? 'Needs evaluator' : status;
    return `<span class="status-badge">${esc(label)}</span>`;
  }

  function renderFrictions() {
    const body = document.getElementById('trackerTableBody');
    const empty = document.getElementById('trackerEmptyState');
    if (!body) return;

    const mine = problems.filter(owns).filter((problem) => problem.status !== 'Solved');
    body.innerHTML = mine.map((problem) => {
      const contributors = (problem.contributors || []).map(participantName).filter(Boolean);
      const canReview = problem.status === 'Open' && contributors.length > 0;
      return `
        <tr data-id="${esc(problem.id)}">
          <td>${esc(problem.date)}</td>
          <td><strong>${esc(problem.title)}</strong><br><small>${esc(problem.friction || '').slice(0, 120)}</small></td>
          <td>${esc(problem.category)}</td>
          <td>${contributors.length ? contributors.map(esc).join(', ') : 'No participants yet'}</td>
          <td>${statusBadge(problem.status)}</td>
          <td style="text-align:right">
            ${canReview ? `<button class="btn btn-outline btn-sm" data-review="${esc(problem.id)}">Set solved</button>` : ''}
          </td>
        </tr>
      `;
    }).join('');

    if (empty) empty.style.display = mine.length ? 'none' : 'block';
    body.querySelectorAll('[data-review]').forEach((button) => {
      button.addEventListener('click', () => openReview(button.dataset.review));
    });
  }

  function openReview(problemId) {
    const problem = problems.find((item) => item.id === problemId);
    if (!problem) return;
    const contributors = (problem.contributors || []).map(participantName).filter(Boolean);
    const existing = new Map((problem.contributorReviews || []).map((review) => [review.name, review]));
    const modal = document.getElementById('verificationModal');
    document.getElementById('modalProblemTitle').textContent = problem.title;
    document.getElementById('verificationForm').innerHTML = `
      <div class="form-field-group span-full">
        <label class="form-label" for="verifyReviewText">Resolution summary</label>
        <textarea id="verifyReviewText" class="form-textarea" required>${esc(problem.ownerReview || '')}</textarea>
      </div>
      <div class="form-field-group span-full">
        <label class="form-label">Contributor notes</label>
        <div id="contributorReviewRows">
          ${contributors.map((name) => {
            const review = existing.get(name) || {};
            return `
              <div class="review-row" data-name="${esc(name)}" style="border:1px solid var(--border-light);padding:14px;margin:10px 0;border-radius:8px">
                <strong>${esc(name)}</strong>
                <textarea class="form-textarea contributor-comment" placeholder="What did they actually contribute?">${esc(review.comment || '')}</textarea>
                <label style="display:flex;gap:8px;align-items:center;margin-top:8px"><input type="checkbox" class="remove-suggestion" ${review.removeSuggested ? 'checked' : ''}> Suggest removal if they did not participate</label>
              </div>
            `;
          }).join('')}
        </div>
      </div>
      <div class="modal-action-footer">
        <button type="button" class="btn btn-outline btn-sm" id="btnCloseReview">Cancel</button>
        <button type="submit" class="btn btn-primary btn-sm">Send to evaluator</button>
      </div>
    `;
    modal.style.display = 'flex';
    document.getElementById('btnCloseReview').addEventListener('click', () => modal.style.display = 'none');
    document.getElementById('verificationForm').onsubmit = async (event) => {
      event.preventDefault();
      const ownerReview = document.getElementById('verifyReviewText').value.trim();
      const contributorReviews = Array.from(document.querySelectorAll('.review-row')).map((row) => ({
        name: row.dataset.name,
        comment: row.querySelector('.contributor-comment').value.trim(),
        removeSuggested: row.querySelector('.remove-suggestion').checked
      }));
      await window.TWS.updateProblem(problem.id, {
        status: 'Pending Evaluation',
        ownerReview,
        contributorReviews,
        suggestedRemovals: contributorReviews.filter((item) => item.removeSuggested).map((item) => item.name)
      });
      modal.style.display = 'none';
      await load();
      renderFrictions();
      alert('Sent to evaluator dashboard for final review.');
    };
  }

  function initSignOut() {
    document.getElementById('signOutBtn')?.addEventListener('click', () => {
      sessionStorage.removeItem('portal_session');
      window.location.href = 'login.html';
    });
  }

  async function init() {
    await load();
    renderFrictions();
    initSignOut();
    document.getElementById('btnCloseModal')?.addEventListener('click', () => {
      const modal = document.getElementById('verificationModal');
      if (modal) modal.style.display = 'none';
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
