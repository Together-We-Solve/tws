(function () {
  'use strict';

  const esc = window.TWS.escapeHTML;

  const defaultCoreMembers = [
    {
      id: 'founder-shivaprasad',
      name: 'Shivaprasad V',
      username: 'shivaprasad',
      role: 'Founder',
      specialty: 'Community Design',
      bio: 'Shapes the mission, welcomes new collaborators, and keeps every decision anchored in dignity, access, and human usefulness.',
      avatar: 'assets/profile-shivaprasad.svg',
      focus: ['Community Design', 'Partnerships']
    }
  ];

  const defaultPartners = [
    {
      name: 'Learning Harbor',
      type: 'Education Access',
      description: 'Connects teachers, mentors, and student groups to reusable learning resources created by the community.',
      logo: 'assets/partner-logo-placeholder.svg',
      url: ''
    },
    {
      name: 'Open Loom Labs',
      type: 'Open Technology',
      description: 'Supports low-cost tooling, accessibility reviews, and open-source prototypes for high-impact community needs.',
      logo: 'assets/partner-logo-placeholder.svg',
      url: ''
    },
    {
      name: 'Civic Nest Network',
      type: 'Local Outreach',
      description: 'Helps route urgent neighborhood problems to people with the right local knowledge, language, and context.',
      logo: 'assets/partner-logo-placeholder.svg',
      url: ''
    },
    {
      name: 'Green Roots Collective',
      type: 'Environmental Action',
      description: 'Turns environmental blueprints into practical field guides for gardens, water systems, and restoration projects.',
      logo: 'assets/partner-logo-placeholder.svg',
      url: ''
    }
  ];

  async function loadCoreMembers() {
    const leadershipRoles = ['Founder', 'Co-Founder', 'Innovator', 'Evaluator', 'Steward'];
    const allMembers = await window.TWS.loadMovementMembersAsync(defaultCoreMembers);
    const members = allMembers
      .filter((member) => leadershipRoles.includes(member.role))
      .sort((a, b) => leadershipRoles.indexOf(a.role) - leadershipRoles.indexOf(b.role));

    return members.length ? members : allMembers;
  }

  async function renderCoreMembers() {
    const grid = document.getElementById('teamGrid');
    if (!grid) return;

    const members = await loadCoreMembers();
    grid.innerHTML = members.map((member, index) => {
      const focus = member.focus || member.categories || [member.specialty, member.role].filter(Boolean);
      const avatar = member.avatar
        ? `<img src="${esc(member.avatar)}" alt="Profile image for ${esc(member.displayName || member.name)}" />`
        : `<span>${esc(member.initials)}</span>`;

      return `
        <article class="team-card">
          <span class="member-index">${String(index + 1).padStart(2, '0')}</span>
          <a class="member-photo" href="${window.TWS.profileUrl(member.username || member.name)}">
            ${avatar}
          </a>
          <div class="member-content">
            <h3>${esc(member.displayName || member.name)}</h3>
            <p class="member-role">${esc(member.role)}</p>
            <p>${esc(member.bio || member.specialty || 'Helping guide the movement and support meaningful community problem-solving.')}</p>
            <div class="member-focus">
              ${focus.slice(0, 3).map((item) => `<span>${esc(item)}</span>`).join('')}
            </div>
          </div>
        </article>
      `;
    }).join('');
  }

  async function loadPartners() {
    return window.TWS.loadPartnersAsync(defaultPartners);
  }

  async function renderPartners() {
    const grid = document.getElementById('partnersGrid');
    if (!grid) return;

    const partners = await loadPartners();
    grid.innerHTML = partners.map((partner) => {
      const logo = partner.logo || 'assets/partner-logo-placeholder.svg';
      const link = partner.url
        ? `<a class="partner-link" href="${esc(partner.url)}" target="_blank" rel="noopener">Visit partner</a>`
        : '<span class="partner-link">Logo and link ready</span>';

      return `
        <article class="partner-card">
          <div class="partner-logo">
            <img src="${esc(logo)}" alt="${esc(partner.name)} logo" />
          </div>
          <div class="partner-content">
            <span class="partner-type">${esc(partner.type || 'Supporting Partner')}</span>
            <h3>${esc(partner.name || 'Supporting Partner')}</h3>
            <p>${esc(partner.description || 'Supports the movement through mentorship, resources, field access, or community reach.')}</p>
            ${link}
          </div>
        </article>
      `;
    }).join('');
  }

  let lenis;

  function initSmoothScroll() {
    lenis = new Lenis({
      lerp: 0.08,
      smoothWheel: true,
      touchMultiplier: 1.5,
    });

    lenis.on('scroll', ScrollTrigger.update);

    gsap.ticker.add((time) => {
      lenis.raf(time * 1000);
    });

    gsap.ticker.lagSmoothing(0);
  }

  function initNav() {
    const nav = document.getElementById('nav');
    if (!nav) return;

    ScrollTrigger.create({
      start: 'top -80',
      onUpdate: (self) => {
        nav.classList.toggle('scrolled', self.scroll() > 80);
      },
    });
  }

  function initCanvas() {
    const canvas = document.getElementById('teamCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let width = 0;
    let height = 0;
    let nodes = [];

    function resize() {
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
      const count = Math.min(58, Math.max(28, Math.floor(width / 26)));
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.22,
        r: Math.random() * 1.8 + 0.7,
      }));
    }

    function draw() {
      ctx.clearRect(0, 0, width, height);

      nodes.forEach((node) => {
        node.x += node.vx;
        node.y += node.vy;

        if (node.x < 0 || node.x > width) node.vx *= -1;
        if (node.y < 0 || node.y > height) node.vy *= -1;

        ctx.beginPath();
        ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(200, 125, 85, 0.5)';
        ctx.fill();
      });

      for (let i = 0; i < nodes.length; i += 1) {
        for (let j = i + 1; j < nodes.length; j += 1) {
          const a = nodes[i];
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 135) {
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(250, 246, 240, ${0.12 * (1 - distance / 135)})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }

      requestAnimationFrame(draw);
    }

    resize();
    draw();
    window.addEventListener('resize', resize);
  }

  function initReveals() {
    const heroTimeline = gsap.timeline({ delay: 0.15 });
    gsap.set('.hero-eyebrow, .hero-headline, .hero-tagline, .hero-body', { y: 30, opacity: 0 });

    heroTimeline
      .to('.hero-eyebrow', { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' })
      .to('.hero-headline', { opacity: 1, y: 0, duration: 1.0, ease: 'power3.out' }, '-=0.5')
      .to('.hero-tagline', { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' }, '-=0.6')
      .to('.hero-body', { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' }, '-=0.5');

    document.querySelectorAll('.label, .section-headline').forEach((el) => {
      gsap.set(el, { opacity: 0, y: 20 });
      ScrollTrigger.create({
        trigger: el,
        start: 'top 90%',
        onEnter: () => gsap.to(el, { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' }),
        once: true,
      });
    });

    [
      ['.team-grid', '.team-card'],
      ['.partners-grid', '.partner-card'],
      ['.principles-list', '.principle-row'],
    ].forEach(([trigger, selector]) => {
      gsap.set(selector, { opacity: 0, y: 36 });
      ScrollTrigger.create({
        trigger,
        start: 'top 84%',
        onEnter: () => {
          gsap.to(selector, {
            opacity: 1,
            y: 0,
            duration: 0.9,
            stagger: 0.1,
            ease: 'power3.out',
          });
        },
        once: true,
      });
    });
  }

  async function init() {
    gsap.registerPlugin(ScrollTrigger);
    initSmoothScroll();
    initNav();
    initCanvas();
    await renderCoreMembers();
    await renderPartners();
    initReveals();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
