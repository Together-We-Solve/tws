(function () {
  'use strict';

  const esc = window.TWS.escapeHTML;

  function initials(name) {
    return window.TWS.initialsFromName(name || 'Partner');
  }

  function partnerLogo(partner) {
    if (partner.logo) {
      return `<img class="member-avatar" src="${esc(partner.logo)}" alt="${esc(partner.name)} logo" />`;
    }
    return `<div class="member-avatar">${esc(initials(partner.name))}</div>`;
  }

  async function renderPartners() {
    const grid = document.getElementById('supportingPartnersGrid');
    if (!grid) return;

    const partners = (await window.TWS.loadPartnersAsync([]))
      .filter((partner) => partner.name && partner.bio);

    if (!partners.length) {
      grid.innerHTML = `
        <div class="empty-state">
          <h3>No supporting partners listed yet.</h3>
          <p>Partner listings appear here after a supporting partner saves their profile from the partner dashboard.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = partners.map((partner) => {
      const href = window.TWS.safeExternalUrl(partner.website);
      const tag = partner.focus || 'Supporting Partner';
      return `
        <a class="member-card" href="${esc(href || '#')}" ${href ? 'target="_blank" rel="noopener"' : ''}>
          ${partnerLogo(partner)}
          <h3>${esc(partner.name)}</h3>
          <span class="member-role">${esc(tag)}</span>
          <p class="member-bio">${esc(partner.bio)}</p>
          ${href ? '<div class="member-meta"><span>Visit website</span></div>' : ''}
        </a>
      `;
    }).join('');
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
      dots = Array.from({ length: 34 }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.16,
        vy: (Math.random() - 0.5) * 0.16,
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
        ctx.fillStyle = 'rgba(35, 56, 43, 0.28)';
        ctx.fill();
      });
      requestAnimationFrame(draw);
    }

    resize();
    draw();
    window.addEventListener('resize', resize);
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (window.gsap && window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);
    initCanvas();
    renderPartners();
  });
})();
