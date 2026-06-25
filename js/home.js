(function () {
  'use strict';

  const esc = window.TWS.escapeHTML;
  const session = JSON.parse(sessionStorage.getItem('portal_session') || 'null');

  if (!session) {
    window.location.href = 'index.html';
    return;
  }

  const greeting = document.getElementById('homeGreeting');
  if (greeting) greeting.textContent = `Welcome back, ${session.displayName || session.username || 'member'}.`;

  async function renderActivity() {
    const grid = document.getElementById('homeActivityGrid');
    if (!grid) return;

    const problems = await window.TWS.loadProblemsAsync([]);
    const mine = problems.filter((problem) => (
      problem.ownerUid === session.uid ||
      problem.ownerUsername === session.username ||
      window.TWS.toUsername(problem.solver) === session.username
    ));
    const open = problems.filter((problem) => ['Open', 'Pending Owner Closure'].includes(problem.status)).slice(0, 3);

    const cards = [
      {
        title: 'My Frictions',
        body: `${mine.length} problem${mine.length === 1 ? '' : 's'} connected to your account.`,
        href: 'user-settings.html',
        meta: 'Review owner actions'
      },
      {
        title: 'Open Problems',
        body: `${open.length} current problem${open.length === 1 ? '' : 's'} ready for community help.`,
        href: 'impact-archive.html',
        meta: 'Join a solution'
      },
      {
        title: 'Public Profile',
        body: 'Keep your username, profile, and contribution identity up to date.',
        href: `user-profile.html?username=${encodeURIComponent(session.username || '')}`,
        meta: 'View profile'
      }
    ];

    grid.innerHTML = cards.map((card) => `
      <a class="member-card" href="${esc(card.href)}">
        <h3>${esc(card.title)}</h3>
        <span class="member-role">${esc(card.meta)}</span>
        <p class="member-bio">${esc(card.body)}</p>
      </a>
    `).join('');
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

  document.addEventListener('DOMContentLoaded', () => {
    gsap.registerPlugin(ScrollTrigger);
    initCanvas();
    renderActivity();
  });
})();
