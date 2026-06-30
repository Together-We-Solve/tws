(function () {
  'use strict';

  const esc = window.TWS.escapeHTML;
  let problems = [];

  function getSession() {
    return JSON.parse(localStorage.getItem('portal_session') || 'null');
  }

  function participantKey(session) {
    return window.TWS.toUsername(session.username || session.displayName || session.email);
  }

  function categoryClass(category) {
    return {
      Education: 'edu',
      Technical: 'tech',
      Environmental: 'env',
      Community: 'comm'
    }[category] || 'tech';
  }

  function render(list) {
    const root = document.getElementById('openFrictionsList');
    if (!root) return;
    const open = list.filter((problem) => problem.status === 'Open');
    root.innerHTML = open.length ? open.map((problem) => {
      const contributors = (problem.contributors || []).map((item) => typeof item === 'string' ? item : item.username || item.displayName);
      return `
        <div class="timeline-item" data-search="${esc(`${problem.title} ${problem.category} ${problem.friction}`.toLowerCase())}">
          <div class="timeline-marker"></div>
          <div class="timeline-card">
            <div class="card-header"><span class="item-date">${esc(problem.date)}</span><span class="category-tag ${categoryClass(problem.category)}">${esc(problem.category)}</span></div>
            <h3 class="item-title">${esc(problem.title)}</h3>
            <p class="item-summary">${esc(problem.friction)}</p>
            <div class="item-meta">
              <span class="meta-field">Posted by ${esc(problem.ownerName || problem.ownerUsername || 'member')}</span>
              <span class="meta-field">${contributors.length} participant${contributors.length === 1 ? '' : 's'}</span>
            </div>
            <div class="item-drawer" style="height:auto">
              <div class="drawer-content">
                <div class="drawer-section"><h4>What was tried</h4><p>${esc(problem.tried || '')}</p></div>
                <div class="drawer-section"><h4>Ripple</h4><p>${esc(problem.ripple || '')}</p></div>
              </div>
            </div>
            <button class="btn btn-primary btn-sm" data-join="${esc(problem.id)}">Register as participant</button>
          </div>
        </div>
      `;
    }).join('') : '<div class="timeline-card" style="padding:24px">No open frictions are public right now.</div>';

    root.querySelectorAll('[data-join]').forEach((button) => button.addEventListener('click', () => join(button.dataset.join)));
  }

  async function join(problemId) {
    const session = getSession();
    if (!session) {
      window.location.href = 'login.html';
      return;
    }
    const problem = problems.find((item) => item.id === problemId);
    if (!problem) return;
    const username = participantKey(session);
    const contributors = (problem.contributors || []).map((item) => typeof item === 'string' ? item : item.username || item.displayName);
    if (contributors.includes(username)) {
      alert('You are already registered as a participant.');
      return;
    }
    contributors.push(username);
    await window.TWS.updateProblem(problemId, { contributors });
    window.TWS.logSystemActivity('LEDGER', `${username} registered as a participant on "${problem.title}".`);
    problems = await window.TWS.loadProblemsAsync([]);
    render(problems);
  }

  function initSearch() {
    document.getElementById('openSearch')?.addEventListener('input', (event) => {
      const query = event.target.value.trim().toLowerCase();
      document.querySelectorAll('#openFrictionsList .timeline-item').forEach((item) => {
        item.style.display = item.dataset.search.includes(query) ? 'block' : 'none';
      });
    });
  }

  async function init() {
    problems = await window.TWS.loadProblemsAsync([]);
    render(problems);
    initSearch();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
