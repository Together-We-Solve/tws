(function () {
  'use strict';

  const esc = window.TWS.escapeHTML;

  const defaultSolvers = [
    { id: 'sol_1', name: 'Elena Rostova', role: 'Contributor', specialty: 'Technical Systems & Language', points: 4850, solved: 12, initials: 'ER', badges: ['Golden Heart', 'Deep Thinker'] },
    { id: 'sol_2', name: 'Marcus Vance', role: 'Steward', specialty: 'Community & Environment', points: 4210, solved: 9, initials: 'MV', badges: ['Root Sprouter', 'Constant Beacon'] },
    { id: 'sol_3', name: 'Aiko Tanaka', role: 'Contributor', specialty: 'Educational Mentorship', points: 3950, solved: 8, initials: 'AT', badges: ['Sudden Light', 'Dignity Guard'] }
  ];

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

  function initials(name) {
    return String(name || 'Member')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || 'TW';
  }

  function normalizeMember(raw) {
    const displayName = raw.displayName || raw.name || raw.username || 'Together We Solve Member';
    const username = window.TWS.toUsername(raw.username || displayName);
    const stats = raw.stats || {};
    return {
      id: raw.id || username,
      username,
      displayName,
      avatar: raw.avatar || '',
      role: raw.role || 'Member',
      specialty: raw.specialty || raw.country || '',
      bio: raw.bio || '',
      points: Number(stats.totalImpactPoints ?? raw.points) || 0,
      solved: Number(stats.problemsSolved ?? raw.solved) || 0
    };
  }

  async function loadMembers() {
    const members = await window.TWS.loadMovementMembersAsync(defaultSolvers);
    return members.map(normalizeMember);
  }

  function renderMembers(members) {
    const grid = document.getElementById('membersGrid');
    if (!grid) return;

    if (members.length === 0) {
      grid.innerHTML = '<div class="empty-state">No members found.</div>';
      return;
    }

    grid.innerHTML = members.map((member) => {
      const avatar = member.avatar
        ? `<img class="member-avatar" src="${esc(member.avatar)}" alt="${esc(member.displayName)} profile picture" />`
        : `<div class="member-avatar">${esc(initials(member.displayName))}</div>`;
      const profileHref = `user-profile.html?username=${encodeURIComponent(member.username)}`;
      return `
        <a class="member-card" href="${profileHref}" data-search="${esc(`${member.displayName} ${member.username} ${member.role} ${member.specialty}`.toLowerCase())}">
          ${avatar}
          <h3>${esc(member.displayName)}</h3>
          <span class="member-username">@${esc(member.username)}</span>
          <span class="member-role">${esc(member.role)}</span>
          <p class="member-bio">${esc(member.bio || member.specialty || 'No bio provided.')}</p>
          <div class="member-meta">
            <span>${member.points.toLocaleString()} pts</span>
            <span>${member.solved.toLocaleString()} solved</span>
          </div>
        </a>
      `;
    }).join('');

    gsap.from('.member-card', {
      opacity: 0,
      y: 26,
      duration: 0.8,
      stagger: 0.06,
      ease: 'power2.out'
    });
  }

  function initSearch() {
    const input = document.getElementById('memberSearch');
    const grid = document.getElementById('membersGrid');
    if (!input || !grid) return;

    input.addEventListener('input', () => {
      const query = input.value.trim().toLowerCase();
      let visible = 0;
      grid.querySelectorAll('.member-card').forEach((card) => {
        const match = card.getAttribute('data-search').includes(query);
        card.style.display = match ? 'flex' : 'none';
        if (match) visible += 1;
      });

      let empty = grid.querySelector('.empty-state');
      if (!visible) {
        if (!empty) {
          empty = document.createElement('div');
          empty.className = 'empty-state';
          empty.textContent = 'No members match that search.';
          grid.appendChild(empty);
        }
      } else if (empty) {
        empty.remove();
      }
    });
  }

  function initCanvas() {
    const canvas = document.getElementById('membersCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let width = 0;
    let height = 0;
    let dots = [];

    function resize() {
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
      dots = Array.from({ length: 42 }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.18,
        vy: (Math.random() - 0.5) * 0.18,
        r: Math.random() * 1.8 + 0.8
      }));
    }

    function draw() {
      ctx.clearRect(0, 0, width, height);
      dots.forEach((dot) => {
        dot.x += dot.vx;
        dot.y += dot.vy;
        if (dot.x < 0 || dot.x > width) dot.vx *= -1;
        if (dot.y < 0 || dot.y > height) dot.vy *= -1;
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, dot.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(200, 125, 85, 0.5)';
        ctx.fill();
      });
      requestAnimationFrame(draw);
    }

    resize();
    draw();
    window.addEventListener('resize', resize);
  }

  function init() {
    gsap.registerPlugin(ScrollTrigger);
    initCanvas();
    loadMembers().then(renderMembers);
    initSearch();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
