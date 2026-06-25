/* =======================================================
   TOGETHER WE SOLVE - js/user-profile.js
   Reusable Public Contributor Profiles
   ======================================================= */

(function () {
  'use strict';

  const esc = window.TWS.escapeHTML;
  const fixedRoles = ['Member', 'Contributor', 'Steward', 'Evaluator', 'Innovator', 'Co-Founder', 'Founder', 'Supporting Partner'];
  let currentUserSession = null;
  let activeUser = null;

  const lenis = new Lenis({
    lerp: 0.08,
    smoothWheel: true,
    touchMultiplier: 1.5,
  });

  lenis.on('scroll', ScrollTrigger.update);

  gsap.ticker.add((time) => {
    lenis.raf(time * 1000);
  });

  gsap.ticker.lagSmoothing(0);

  const nav = document.getElementById('nav');
  if (nav) {
    ScrollTrigger.create({
      start: 'top -80',
      onUpdate: (self) => {
        nav.classList.toggle('scrolled', self.scroll() > 80);
      }
    });
  }

  function toSlug(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function initials(name) {
    return String(name || 'Together We Solve')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || 'TW';
  }

  function emptyState(text) {
    return `<div style="text-align: center; opacity: 0.55; padding: 40px 20px; border: 1px dashed var(--border-light); border-radius: 8px; font-size: 13.5px;">${esc(text)}</div>`;
  }

  function normalizeUser(raw) {
    const name = raw.displayName || raw.name || raw.username || 'Together We Solve Member';
    const username = raw.username || toSlug(name);
    const role = fixedRoles.includes(raw.role) ? raw.role : 'Member';
    const stats = raw.stats || {};

    return {
      id: String(raw.id || username),
      username,
      displayName: name,
      avatar: raw.avatar || '',
      banner: raw.banner || '',
      bio: raw.bio || '',
      role,
      joinedDate: raw.joinedDate || '',
      country: raw.country || '',
      website: raw.website || '',
      github: raw.github || '',
      linkedin: raw.linkedin || '',
      portfolio: raw.portfolio || '',
      socialLinks: Array.isArray(raw.socialLinks) ? raw.socialLinks : [],
      stats: {
        problemsIdentified: Number(stats.problemsIdentified) || 0,
        problemsSolved: Number(stats.problemsSolved) || 0,
        knowledgeContributions: Number(stats.knowledgeContributions) || 0,
        helpfulResponses: Number(stats.helpfulResponses) || 0,
        totalImpactPoints: Number(stats.totalImpactPoints) || 0,
        badgesEarned: Number(stats.badgesEarned) || 0,
        currentRank: stats.currentRank || rankFromPoints(Number(stats.totalImpactPoints) || 0),
        currentStreak: Number(stats.currentStreak) || 0,
        contributionStreak: Number(stats.contributionStreak || stats.currentStreak) || 0
      },
      badges: Array.isArray(raw.badges) ? raw.badges : [],
      timeline: Array.isArray(raw.timeline) ? raw.timeline : [],
      contributions: Array.isArray(raw.contributions) ? raw.contributions : [],
      categories: Array.isArray(raw.categories) ? raw.categories : []
    };
  }

  function rankFromPoints(points) {
    if (points >= 4500) return 'Level IV';
    if (points >= 3000) return 'Level III';
    if (points >= 1500) return 'Level II';
    return 'Level I';
  }

  function legacyUserToProfile(solver, problems) {
    const userProblems = problems.filter((problem) => problem.solver === solver.name);
    const solved = problems.filter((problem) => problem.status === 'Solved' && problem.solvedBy === solver.name);
    const attempts = problems.filter((problem) => problem.contributors && problem.contributors.includes(solver.name));
    const categories = {};

    [...userProblems, ...solved, ...attempts].forEach((problem) => {
      const key = problem.category || 'General';
      categories[key] = (categories[key] || 0) + 1;
    });

    const contributions = [
      ...userProblems.map((problem) => ({
        title: problem.title,
        type: 'Problem',
        date: problem.date,
        impact: `${Number(problem.views) || 0} views`,
        status: problem.status
      })),
      ...solved.map((problem) => ({
        title: problem.title,
        type: 'Solution',
        date: problem.date,
        impact: `+${Number(problem.winnerXP) || 150} points`,
        status: 'Solved'
      })),
      ...attempts.map((problem) => ({
        title: problem.title,
        type: 'Discussion',
        date: problem.date,
        impact: `+${Number(problem.attemptXP) || 40} attempt points`,
        status: problem.status
      }))
    ];

    return normalizeUser({
      id: solver.id,
      username: solver.username || toSlug(solver.name),
      displayName: solver.name,
      avatar: solver.avatar || '',
      banner: solver.banner || '',
      bio: solver.bio || '',
      role: fixedRoles.includes(solver.role) ? solver.role : 'Contributor',
      joinedDate: solver.joinedDate || '',
      country: solver.country || '',
      website: solver.website || '',
      github: solver.github || '',
      linkedin: solver.linkedin || '',
      portfolio: solver.portfolio || '',
      stats: {
        problemsIdentified: userProblems.length,
        problemsSolved: Number(solver.solved) || solved.length,
        knowledgeContributions: Number(solver.knowledgeContributions) || 0,
        helpfulResponses: Number(solver.helpfulResponses) || attempts.length,
        totalImpactPoints: Number(solver.points) || 0,
        badgesEarned: Array.isArray(solver.badges) ? solver.badges.length : 0,
        currentRank: solver.rank || rankFromPoints(Number(solver.points) || 0),
        currentStreak: Number(solver.currentStreak) || 0,
        contributionStreak: Number(solver.contributionStreak) || Number(solver.currentStreak) || 0
      },
      badges: Array.isArray(solver.badges) ? solver.badges : [],
      timeline: Array.isArray(solver.timeline) ? solver.timeline : [],
      contributions,
      categories: Object.entries(categories).map(([name, count]) => ({ name, count }))
    });
  }

  function getRouteIdentifier() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    const username = params.get('username') || params.get('user');
    const pathMatch = window.location.pathname.match(/\/user\/([^/]+)/);
    return {
      id,
      username: username ? window.TWS.toUsername(username) : (pathMatch ? window.TWS.toUsername(decodeURIComponent(pathMatch[1])) : '')
    };
  }

  async function loadProfileData() {
    currentUserSession = JSON.parse(sessionStorage.getItem('portal_session') || 'null');
    const route = getRouteIdentifier();
    const members = await window.TWS.loadMovementMembersAsync([]);
    const problems = await window.TWS.loadProblemsAsync([]);
    const users = members.map(normalizeUser);
    const solvers = members;

    activeUser = users.find((user) => (
      (route.id && user.id === route.id) ||
      (route.username && (window.TWS.toUsername(user.username) === route.username || window.TWS.toUsername(user.displayName) === route.username))
    ));

    if (!activeUser) {
      const solver = solvers.find((item) => (
        (route.id && item.id === route.id) ||
        (route.username && (window.TWS.toUsername(item.username || item.name) === route.username || window.TWS.toUsername(item.name) === route.username))
      ));
      if (solver) activeUser = legacyUserToProfile(solver, problems);
    }

    if (!activeUser && currentUserSession && !route.id && !route.username) {
      const profile = window.TWS.ensureSolverProfile(currentUserSession, solvers);
      activeUser = legacyUserToProfile(profile, problems);
    }
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function renderProfileHeader(user) {
    document.title = `${user.displayName} • Together We Solve`;
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', user.bio || `${user.displayName}'s public contributor profile on Together We Solve.`);

    setText('welcomeMessage', user.displayName);
    setText('profileTagline', `@${user.username} • ${user.role} • ${user.stats.currentRank}`);
    setText('profileBio', user.bio || 'No bio provided.');
    setText('profileTypeLabel', `${user.role} Profile`);

    const avatar = document.getElementById('profileAvatar');
    const fallback = document.getElementById('profileAvatarFallback');
    if (user.avatar && avatar && fallback) {
      avatar.src = user.avatar;
      avatar.alt = `${user.displayName} profile picture`;
      avatar.style.display = 'block';
      fallback.style.display = 'none';
    } else if (fallback) {
      fallback.textContent = initials(user.displayName);
    }

    const banner = document.getElementById('profileBanner');
    if (user.banner && banner) {
      banner.style.backgroundImage = `url("${user.banner}")`;
      banner.style.display = 'block';
    }

    const metaItems = [
      user.country ? `Country: ${user.country}` : '',
      user.joinedDate ? `Joined: ${user.joinedDate}` : '',
      `Streak: ${user.stats.contributionStreak} ${user.stats.contributionStreak === 1 ? 'day' : 'days'}`
    ].filter(Boolean);
    document.getElementById('profileMeta').innerHTML = metaItems.map((item) => `<span>${esc(item)}</span>`).join('');

    renderProfileLinks(user);

    const editBtn = document.getElementById('btnEditProfile');
    const isOwnProfile = currentUserSession && (
      currentUserSession.uid === user.id ||
      currentUserSession.username === user.username ||
      currentUserSession.username === user.displayName ||
      window.TWS.toUsername(currentUserSession.username || currentUserSession.displayName) === user.username
    );
    if (editBtn) editBtn.style.display = isOwnProfile ? 'inline-flex' : 'none';

    const authLink = document.getElementById('profileAuthLink');
    if (authLink && currentUserSession) {
      authLink.textContent = 'Signed In';
      authLink.href = 'user-settings.html';
    }
  }

  function renderProfileLinks(user) {
    const container = document.getElementById('profileLinks');
    if (!container) return;
    const links = [
      ['Website', user.website],
      ['GitHub', user.github],
      ['LinkedIn', user.linkedin],
      ['Portfolio', user.portfolio],
      ...user.socialLinks.map((link) => [link.label || 'Social', link.url])
    ].filter(([, url]) => url);

    if (links.length === 0) {
      container.style.display = 'none';
      container.innerHTML = '';
      return;
    }

    container.style.display = 'flex';
    container.innerHTML = links.map(([label, url]) => (
      `<a class="btn btn-outline btn-sm" href="${esc(url)}" target="_blank" rel="noopener" style="padding: 7px 14px; font-size: 11px;">${esc(label)}</a>`
    )).join('');
  }

  function renderStats(user) {
    setText('totalImpactPoints', user.stats.totalImpactPoints.toLocaleString());
    setText('problemsIdentified', user.stats.problemsIdentified.toLocaleString());
    setText('problemsSolved', user.stats.problemsSolved.toLocaleString());
    setText('currentRank', user.stats.currentRank);
    setText('currentRole', user.role);
    setText('knowledgeContributions', user.stats.knowledgeContributions.toLocaleString());
    setText('helpfulResponses', user.stats.helpfulResponses.toLocaleString());
    setText('currentStreak', user.stats.currentStreak.toLocaleString());
  }

  function renderCardList(id, items, emptyText, renderer) {
    const container = document.getElementById(id);
    if (!container) return;
    container.innerHTML = items.length ? items.map(renderer).join('') : emptyState(emptyText);
  }

  function renderTimeline(user) {
    renderCardList('impactTimelineList', user.timeline, 'No timeline activity yet.', (item) => `
      <div class="portfolio-card" style="background: var(--bg-warm); border: 1px solid var(--border-light); padding: 20px; border-radius: 8px; margin-bottom: 16px; text-align: left; box-shadow: 0 2px 8px rgba(0,0,0,0.01);">
        <span style="font-size: 10px; opacity: 0.5;">${esc(item.date || '')}</span>
        <h4 style="font-family: var(--font-display); font-size: 16px; color: var(--accent-moss); margin: 6px 0; font-weight: 400;">${esc(item.title || item.event || '')}</h4>
        <p style="font-size: 12.5px; opacity: 0.75; line-height: 1.5;">${esc(item.description || item.impact || '')}</p>
      </div>
    `);
  }

  function renderContributions(user) {
    renderCardList('recentContributionsList', user.contributions, 'No contributions yet.', (item) => `
      <div class="portfolio-card" style="background: var(--bg-warm); border: 1px solid var(--border-light); padding: 20px; border-radius: 8px; margin-bottom: 16px; text-align: left; box-shadow: 0 2px 8px rgba(0,0,0,0.01);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; gap: 16px;">
          <span style="font-size: 10px; opacity: 0.5;">${esc(item.date || '')}</span>
          <span class="status-badge solved" style="font-size: 8px; padding: 1px 8px; border-radius: 100px; background: rgba(35, 56, 43, 0.08); color: var(--accent-moss); font-weight: 600; text-transform: uppercase;">${esc(item.type || 'Contribution')}</span>
        </div>
        <h4 style="font-family: var(--font-display); font-size: 16px; color: var(--accent-moss); margin-bottom: 6px; font-weight: 400;">${esc(item.title || '')}</h4>
        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed var(--border-light); padding-top: 10px; font-size: 11px; gap: 16px;">
          <span>Impact: <strong>${esc(item.impact || 'Not recorded')}</strong></span>
          <span>${esc(item.status || '')}</span>
        </div>
      </div>
    `);
  }

  function renderCategories(user) {
    renderCardList('categoriesList', user.categories, 'No contribution areas yet.', (item) => `
      <div class="user-friction-card">
        <div class="card-header">
          <div class="card-header-left">
            <span class="status-badge solved">${esc(item.name || 'General')}</span>
          </div>
          <span class="category-tag tech">${Number(item.count) || 0}</span>
        </div>
        <h3 class="card-title">${esc(item.name || 'General')}</h3>
        <p style="opacity: 0.7;">${Number(item.count) || 0} ${Number(item.count) === 1 ? 'contribution' : 'contributions'}</p>
      </div>
    `);
  }

  function renderBadges(user) {
    const grid = document.getElementById('badgesGrid');
    if (!grid) return;
    if (user.badges.length === 0) {
      grid.innerHTML = emptyState('No badges earned.');
      return;
    }

    grid.innerHTML = user.badges.map((badge) => {
      const item = typeof badge === 'string' ? { name: badge } : badge;
      return `
        <div class="badge-card">
          <div class="badge-card-accent"></div>
          <div class="badge-icon-wrap">${esc(item.icon || '*')}</div>
          <h3>${esc(item.name || 'Community Badge')}</h3>
          <span class="badge-level">${esc(item.level || item.honor || 'Community Honor')}</span>
          <p class="badge-desc">${esc(item.description || 'Awarded for meaningful cooperative participation.')}</p>
        </div>
      `;
    }).join('');
  }

  function renderProfile() {
    if (!activeUser) {
      setText('welcomeMessage', 'Profile not found');
      setText('profileTagline', 'Together We Solve');
      setText('profileBio', 'No public profile data is available for this member.');
      ['recentContributionsList', 'impactTimelineList', 'categoriesList', 'badgesGrid'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = emptyState('No public information available.');
      });
      return;
    }

    renderProfileHeader(activeUser);
    renderStats(activeUser);
    renderContributions(activeUser);
    renderTimeline(activeUser);
    renderCategories(activeUser);
    renderBadges(activeUser);
  }

  function initSproutCanvas() {
    const canvas = document.getElementById('sproutCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let W;
    let H;
    let vines = [];

    function resize() {
      W = canvas.width = canvas.offsetWidth;
      H = canvas.height = canvas.offsetHeight;
      vines = [
        { x: W * 0.15, y: H + 10, angle: -Math.PI / 2.2, length: 110, progress: 0 },
        { x: W * 0.5, y: H + 10, angle: -Math.PI / 2, length: 130, progress: 0 },
        { x: W * 0.85, y: H + 10, angle: -Math.PI / 1.8, length: 100, progress: 0 }
      ];
    }

    function drawVine(vine) {
      vine.progress = Math.min(vine.progress + 0.008, 1);
      const endX = vine.x + Math.cos(vine.angle) * vine.length * vine.progress;
      const endY = vine.y + Math.sin(vine.angle) * vine.length * vine.progress;
      const midX = vine.x + Math.cos(vine.angle) * vine.length * 0.5 * vine.progress;
      const midY = vine.y + Math.sin(vine.angle) * vine.length * 0.5 * vine.progress;

      ctx.beginPath();
      ctx.moveTo(vine.x, vine.y);
      ctx.quadraticCurveTo(midX + Math.sin(vine.progress * 5) * 4, midY, endX, endY);
      ctx.strokeStyle = '#23382B';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      if (vine.progress > 0.55) {
        ctx.beginPath();
        ctx.arc(endX, endY, 5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(200, 125, 85, 0.65)';
        ctx.fill();
      }
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      vines.forEach(drawVine);
      requestAnimationFrame(draw);
    }

    resize();
    draw();
    window.addEventListener('resize', resize);
  }

  function animateProfile() {
    const tl = gsap.timeline({ delay: 0.2 });
    gsap.set('.hero-eyebrow, .hero-headline, .hero-tagline, .hero-body', { y: 30, opacity: 0 });

    tl.to('.hero-eyebrow', { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' })
      .to('.hero-headline', { opacity: 1, y: 0, duration: 1.0, ease: 'power3.out' }, '-=0.5')
      .to('.hero-tagline', { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' }, '-=0.6')
      .to('.hero-body', { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' }, '-=0.5');

    gsap.set('.stat-card', { opacity: 0, y: 30 });
    ScrollTrigger.create({
      trigger: '.stats-grid',
      start: 'top 88%',
      onEnter: () => {
        gsap.to('.stat-card', {
          opacity: 1,
          y: 0,
          duration: 1.0,
          stagger: 0.1,
          ease: 'power3.out'
        });
      },
      once: true
    });
  }

  async function init() {
    gsap.registerPlugin(ScrollTrigger);
    await loadProfileData();
    renderProfile();
    initSproutCanvas();
    animateProfile();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
