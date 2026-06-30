(function () {
  'use strict';

  const esc = window.TWS.escapeHTML;
  function initSmoothScroll() {
    if (!window.gsap || !window.ScrollTrigger) return;
    const nav = document.getElementById('nav');
    if (nav) {
      ScrollTrigger.create({
        start: 'top -80',
        onUpdate: (self) => nav.classList.toggle('scrolled', self.scroll() > 80)
      });
    }
  }

  function initRippleCanvas() {
    const canvas = document.getElementById('rippleCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let width = 0;
    let height = 0;
    let ripples = [];

    function resize() {
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
    }

    function addRipple(x = Math.random() * width, y = Math.random() * height) {
      if (ripples.length >= 6) return;
      ripples.push({
        x,
        y,
        radius: 8,
        maxRadius: Math.random() * 150 + 120,
        speed: Math.random() * 0.9 + 0.7,
        phase: Math.random() * Math.PI,
        noiseFreq: Math.random() * 3 + 3
      });
    }

    function drawRipple(ripple) {
      ripple.radius += ripple.speed;
      ripple.phase += 0.015;
      const opacity = Math.max(0, 1 - (ripple.radius / ripple.maxRadius));
      ctx.beginPath();
      for (let index = 0; index <= 24; index += 1) {
        const angle = (index / 24) * Math.PI * 2;
        const noise = Math.sin(angle * ripple.noiseFreq + ripple.phase) * (ripple.radius * 0.07);
        const radius = ripple.radius + noise;
        const x = ripple.x + Math.cos(angle) * radius;
        const y = ripple.y + Math.sin(angle) * radius;
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = `rgba(200, 125, 85, ${opacity * 0.25})`;
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.strokeStyle = `rgba(35, 56, 43, ${opacity * 0.1})`;
      ctx.lineWidth = 0.6;
      ctx.stroke();
    }

    function draw() {
      ctx.clearRect(0, 0, width, height);
      ripples.forEach(drawRipple);
      ripples = ripples.filter((ripple) => ripple.radius < ripple.maxRadius);
      requestAnimationFrame(draw);
    }

    resize();
    setInterval(() => addRipple(), 2600);
    canvas.addEventListener('mousemove', (event) => {
      if (Math.random() <= 0.94) return;
      const rect = canvas.getBoundingClientRect();
      addRipple(event.clientX - rect.left, event.clientY - rect.top);
    });
    canvas.addEventListener('click', (event) => {
      const rect = canvas.getBoundingClientRect();
      addRipple(event.clientX - rect.left, event.clientY - rect.top);
    });
    window.addEventListener('resize', resize);
    draw();
  }

  function formatNumber(value) {
    return Math.max(0, Number(value) || 0).toLocaleString();
  }

  function categoryClass(category) {
    return {
      Education: 'edu',
      Technical: 'tech',
      Environmental: 'env',
      Community: 'comm'
    }[category] || 'tech';
  }

  function identityKey(value) {
    if (typeof value === 'object' && value) {
      return window.TWS.toUsername(value.username || value.displayName || value.name || value.email || value.uid || value.id || '');
    }
    return window.TWS.toUsername(value);
  }

  function contributorNames(problem) {
    return Array.from(new Set((Array.isArray(problem.contributors) ? problem.contributors : [])
      .map((item) => typeof item === 'string' ? item : (item.displayName || item.username || item.name || ''))
      .concat(problem.solvedBy || '')
      .map((item) => String(item || '').trim())
      .filter(Boolean)));
  }

  function archiveSummary(problem) {
    return problem.archiveSummary || problem.resolution || problem.ownerReview || problem.friction || '';
  }

  function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  }

  function setArchiveStats(problems, members) {
    const solved = problems.filter((problem) => problem.status === 'Solved');
    const solverKeys = new Set();
    solved.forEach((problem) => contributorNames(problem).forEach((name) => {
      const key = identityKey(name);
      if (key) solverKeys.add(key);
    }));
    members.forEach((member) => {
      const solvedCount = Number(member.stats?.problemsSolved ?? member.solved) || 0;
      const key = solvedCount > 0 ? identityKey(member) : '';
      if (key) solverKeys.add(key);
    });
    setText('archiveSolvedCount', formatNumber(solved.length));
    setText('archiveHoursSaved', formatNumber(solved.reduce((sum, problem) => sum + (Number(problem.archiveHoursSaved) || 0), 0)));
    setText('archiveActiveSolvers', formatNumber(solverKeys.size));
    setText('archiveRippleReach', formatNumber(solved.reduce((sum, problem) => sum + (Number(problem.archiveRippleReach) || 0), 0)));
  }

  function renderProblem(problem) {
    const names = contributorNames(problem);
    const solvedBy = problem.solvedBy || names[0] || '';
    const others = names.filter((name) => name !== solvedBy);
    const othersHtml = others.length
      ? ` (with participation from: ${others.map((name) => `<a href="${window.TWS.profileUrl(name)}" style="color: var(--accent-ocean); font-weight: 500;">${esc(name)}</a>`).join(', ')})`
      : '';
    const awardParts = [];
    if (Number(problem.winnerXP) || Number(problem.winnerEXP)) awardParts.push(`Solver: +${formatNumber(problem.winnerXP)} IP / +${formatNumber(problem.winnerEXP)} EXP`);
    if (Number(problem.attemptXP) || Number(problem.attemptEXP)) awardParts.push(`Attempts: +${formatNumber(problem.attemptXP)} IP / +${formatNumber(problem.attemptEXP)} EXP`);
    const summary = archiveSummary(problem);
    const outcome = problem.archiveOutcome || problem.ownerReview || problem.resolution || 'No verified outcome note recorded.';
    return `
      <div class="timeline-item" data-category="${esc(problem.category || 'Community')}">
        <div class="timeline-marker"></div>
        <div class="timeline-card">
          <div class="card-header">
            <span class="item-date">${esc(problem.date || '')}</span>
            <span class="category-tag ${categoryClass(problem.category)}">${esc(problem.category || 'Community')}</span>
          </div>
          <h3 class="item-title">${esc(problem.title || 'Untitled Problem')} <span class="archive-badge">Verified Solution</span></h3>
          <p class="item-summary">${esc(summary ? `${summary.slice(0, 160)}${summary.length > 160 ? '...' : ''}` : 'No archive summary recorded.')}</p>
          <div class="item-meta">
            <span class="meta-field">Resolved By: ${solvedBy ? `<a href="${window.TWS.profileUrl(solvedBy)}" style="color: var(--accent-moss); font-weight: 600; text-decoration: underline;">${esc(solvedBy)}</a>${othersHtml}` : 'Not recorded'}</span>
            <div class="ripple-score">
              <span class="score-val">${formatNumber(problem.archiveClones)} Clones</span>
              <span class="score-val">${formatNumber(problem.archiveViews)} Views</span>
              <span class="score-val">${formatNumber(problem.archiveRippleReach)} Reached</span>
            </div>
          </div>
          <button class="expand-btn">View Detailed Journey <span class="arrow">Down</span></button>
          <div class="item-drawer">
            <div class="drawer-content">
              <div class="drawer-section">
                <h4>The Friction</h4>
                <p>${esc(problem.friction || 'No friction detail recorded.')}</p>
              </div>
              <div class="drawer-section">
                <h4>The Search</h4>
                <p>${esc(problem.tried || 'No search notes recorded.')}</p>
              </div>
              <div class="drawer-section">
                <h4>The Ripple</h4>
                <p>${esc(problem.ripple || 'No ripple notes recorded.')}</p>
              </div>
              <div class="drawer-section archive-wide">
                <h4>Verified Outcome</h4>
                <p>${esc(outcome)}</p>
                <p>${esc(awardParts.length ? awardParts.join(' | ') : 'No award totals recorded.')}</p>
                <p>${esc(Number(problem.archiveHoursSaved) ? `${formatNumber(problem.archiveHoursSaved)} hours saved recorded.` : 'No hours-saved estimate recorded.')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function refreshLayout() {
    if (window.ScrollTrigger) ScrollTrigger.refresh();
  }

  function initAccordions() {
    document.querySelectorAll('.timeline-card').forEach((card) => {
      const button = card.querySelector('.expand-btn');
      const drawer = card.querySelector('.item-drawer');
      const content = card.querySelector('.drawer-content');
      if (!button || !drawer || !content || !window.gsap) return;
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        const expanded = card.classList.contains('expanded');
        card.classList.toggle('expanded', !expanded);
        gsap.to(drawer, {
          height: expanded ? 0 : content.offsetHeight + 24,
          duration: expanded ? 0.5 : 0.6,
          ease: expanded ? 'power3.inOut' : 'power3.out',
          onComplete: refreshLayout
        });
      });
    });
  }

  function initFiltering() {
    const searchInput = document.getElementById('archiveSearch');
    const tagButtons = document.querySelectorAll('.tag-btn');
    let activeFilter = 'all';
    let searchQuery = '';

    function applyFilter() {
      const items = document.querySelectorAll('.timeline-item');
      let visibleCount = 0;
      items.forEach((item) => {
        const category = item.getAttribute('data-category') || '';
        const text = item.textContent.toLowerCase();
        const matches = (activeFilter === 'all' || category === activeFilter) && (!searchQuery || text.includes(searchQuery));
        if (matches) visibleCount += 1;
        item.style.display = matches ? 'block' : 'none';
        item.style.opacity = matches ? '1' : '0';
      });
      const empty = document.getElementById('archiveEmptyState');
      if (empty) empty.style.display = visibleCount ? 'none' : 'block';
      refreshLayout();
    }

    tagButtons.forEach((button) => {
      button.addEventListener('click', () => {
        tagButtons.forEach((item) => item.classList.remove('active'));
        button.classList.add('active');
        activeFilter = button.getAttribute('data-filter') || 'all';
        applyFilter();
      });
    });
    if (searchInput) {
      searchInput.addEventListener('input', (event) => {
        searchQuery = event.target.value.toLowerCase().trim();
        applyFilter();
      });
    }
  }

  function initAnimations() {
    if (!window.gsap || !window.ScrollTrigger) return;
    gsap.set('.hero-eyebrow, .hero-headline, .hero-tagline, .hero-body', { y: 30, opacity: 0 });
    gsap.timeline({ delay: 0.2 })
      .to('.hero-eyebrow', { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' })
      .to('.hero-headline', { opacity: 1, y: 0, duration: 1, ease: 'power3.out' }, '-=0.5')
      .to('.hero-tagline', { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' }, '-=0.6')
      .to('.hero-body', { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' }, '-=0.5');
    gsap.set('.stat-card', { opacity: 0, y: 30 });
    ScrollTrigger.create({
      trigger: '.stats-grid',
      start: 'top 88%',
      onEnter: () => gsap.to('.stat-card', { opacity: 1, y: 0, duration: 1, stagger: 0.1, ease: 'power3.out' }),
      once: true
    });
    gsap.set('.timeline-item', { opacity: 0, x: -15 });
    ScrollTrigger.create({
      trigger: '.archive-timeline',
      start: 'top 85%',
      onEnter: () => gsap.to('.timeline-item', { opacity: 1, x: 0, duration: 0.9, stagger: 0.12, ease: 'power2.out' }),
      once: true
    });
  }

  async function loadArchiveData() {
    const timeline = document.getElementById('archiveTimeline');
    if (!timeline) return;
    try {
      const problems = await window.TWS.loadProblemsAsync([]);
      const members = await window.TWS.loadMovementMembersAsync([]);
      const solved = problems
        .filter((problem) => problem.status === 'Solved')
        .sort((a, b) => String(b.updatedAt || b.createdAt || b.date || '').localeCompare(String(a.updatedAt || a.createdAt || a.date || '')));
      setArchiveStats(problems, members);
      timeline.innerHTML = solved.length
        ? `${solved.map(renderProblem).join('')}<div class="archive-empty-state" id="archiveEmptyState" style="display:none">No archive records match this search.</div>`
        : '<div class="archive-empty-state" id="archiveEmptyState">No solved impact records have been archived yet.</div>';
    } catch (err) {
      console.error('Failed to load impact archive records.', err);
      timeline.innerHTML = '<div class="archive-empty-state" id="archiveEmptyState">Impact records could not be loaded right now.</div>';
    }
  }

  async function init() {
    if (window.gsap && window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);
    initSmoothScroll();
    await loadArchiveData();
    initRippleCanvas();
    initAnimations();
    initAccordions();
    initFiltering();
    refreshLayout();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
