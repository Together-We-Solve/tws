/* ============================================
   TOGETHER WE SOLVE — leaderboard.js
   Dynamic Solver Rankings & Generative Networks
   ============================================ */

(function () {
  'use strict';

  // Default seed database if empty
  const defaultSolvers = [
    { id: 'sol_1', name: 'Elena Rostova', role: 'The Bridge Builder', specialty: 'Technical Systems & Language', points: 4850, solved: 12, initials: 'ER', badges: ['Golden Heart', 'Deep Thinker'] },
    { id: 'sol_2', name: 'Marcus Vance', role: 'The Catalyst', specialty: 'Community & Environment', points: 4210, solved: 9, initials: 'MV', badges: ['Root Sprouter', 'Constant Beacon'] },
    { id: 'sol_3', name: 'Aiko Tanaka', role: 'The Oracle', specialty: 'Educational Mentorship', points: 3950, solved: 8, initials: 'AT', badges: ['Sudden Light', 'Dignity Guard'] },
    { id: 'sol_4', name: 'David K.', role: 'The Code Pioneer', specialty: 'Web Infrastructure', points: 3520, solved: 7, initials: 'DK', badges: ['Constant Beacon'] },
    { id: 'sol_5', name: 'Amara Diallo', role: 'The Compass', specialty: 'Healthcare Educator', points: 3240, solved: 6, initials: 'AD', badges: ['Golden Heart'] },
    { id: 'sol_6', name: 'Siddharth Nair', role: 'The Eco Architect', specialty: 'Local Ecology', points: 3110, solved: 5, initials: 'SN', badges: ['Root Sprouter'] },
    { id: 'sol_7', name: 'Clara Dupont', role: 'The Clarity Weaver', specialty: 'Technical Writing', points: 2890, solved: 5, initials: 'CD', badges: ['Deep Thinker'] },
    { id: 'sol_8', name: 'Mateo Silva', role: 'The Civic Guard', specialty: 'Neighborhood Care', points: 2650, solved: 4, initials: 'MS', badges: ['Constant Beacon'] },
    { id: 'sol_9', name: 'Zoe Chen', role: 'The Form Weaver', specialty: 'UI/UX Mentorship', points: 2420, solved: 4, initials: 'ZC', badges: ['Dignity Guard'] },
    { id: 'sol_10', name: 'Liam O\'Connor', role: 'The Deep Miner', specialty: 'Historical Research', points: 2180, solved: 3, initials: 'LO', badges: ['Deep Thinker'] }
  ];

  /* ─── LENIS SMOOTH SCROLL ──────────────────── */
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

  /* ─── NAV SCROLL STATE ─────────────────────── */
  const nav = document.getElementById('nav');
  if (nav) {
    ScrollTrigger.create({
      start: 'top -80',
      onUpdate: (self) => {
        if (self.scroll() > 80) {
          nav.classList.add('scrolled');
        } else {
          nav.classList.remove('scrolled');
        }
      }
    });
  }

  /* ─── COOPERATIVE ENERGY CANVAS ────────────── */
  function initLeaderboardCanvas() {
    const canvas = document.getElementById('leaderboardCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let W, H;
    let particles = [];
    const maxParticles = 60;
    const connectionDist = 120;
    
    let mouse = { x: null, y: null, radius: 150 };
    
    function resize() {
      W = canvas.width = canvas.offsetWidth;
      H = canvas.height = canvas.offsetHeight;
      initParticles();
    }

    class Particle {
      constructor() {
        this.x = Math.random() * W;
        this.y = Math.random() * H;
        this.vx = (Math.random() - 0.5) * 0.45;
        this.vy = (Math.random() - 0.5) * 0.45;
        this.radius = Math.random() * 2.5 + 1;
        this.color = Math.random() > 0.45 ? 'rgba(35, 56, 43, 0.25)' : 'rgba(200, 125, 85, 0.2)';
      }

      update() {
        this.x += this.vx;
        this.y += this.vy;

        if (this.x < 0 || this.x > W) this.vx = -this.vx;
        if (this.y < 0 || this.y > H) this.vy = -this.vy;

        if (mouse.x !== null && mouse.y !== null) {
          const dx = this.x - mouse.x;
          const dy = this.y - mouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < mouse.radius) {
            const force = (mouse.radius - dist) / mouse.radius;
            const angle = Math.atan2(dy, dx);
            this.x += Math.cos(angle) * force * 1.5;
            this.y += Math.sin(angle) * force * 1.5;
          }
        }
      }

      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
      }
    }

    function initParticles() {
      particles = [];
      for (let i = 0; i < maxParticles; i++) {
        particles.push(new Particle());
      }
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);

      particles.forEach(p => {
        p.update();
        p.draw();
      });

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const p1 = particles[i];
          const p2 = particles[j];
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < connectionDist) {
            const opacity = (1 - (dist / connectionDist)) * 0.15;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            
            ctx.strokeStyle = i % 2 === 0 
              ? `rgba(35, 56, 43, ${opacity})`
              : `rgba(200, 125, 85, ${opacity})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }

      requestAnimationFrame(draw);
    }

    window.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    });

    window.addEventListener('mouseleave', () => {
      mouse.x = null;
      mouse.y = null;
    });

    resize();
    draw();

    window.addEventListener('resize', () => {
      W = canvas.width = canvas.offsetWidth;
      H = canvas.height = canvas.offsetHeight;
    });
  }

  /* ─── DYNAMIC LEADERBOARD GENERATION ───────── */
  function loadLeaderboardData() {
    const podiumGrid = document.querySelector('.podium-grid');
    const ledgerTableBody = document.querySelector('#ledgerTable tbody');

    if (!podiumGrid || !ledgerTableBody) return;

    try {
      const solvers = JSON.parse(localStorage.getItem('community_solvers')) || defaultSolvers;
      
      // Sort by points descending
      solvers.sort((a, b) => b.points - a.points);

      // 1. RENDER PODIUM (TOP 3)
      podiumGrid.innerHTML = '';
      
      const rankOrder = [1, 0, 2]; // Index mapping: Rank 2 (left), Rank 1 (center), Rank 3 (right)
      const rankClasses = ['rank-2', 'rank-1', 'rank-3'];
      const rankLabels = [2, 1, 3];
      const defaultQuotes = [
        "\"Helping a neighbor rebuild is not a chore; it is the fundamental brick of community.\"",
        "\"Knowledge is the only resource that increases when you share it with others.\"",
        "\"Questions are doors. When we answer them together, we walk through them together.\""
      ];

      rankOrder.forEach((solverIndex, orderIdx) => {
        const solver = solvers[solverIndex];
        if (!solver) return;

        const rankClass = rankClasses[orderIdx];
        const rankNum = rankLabels[orderIdx];
        const quote = defaultQuotes[solverIndex] || "\"Vulnerability is the core of cooperative growth.\"";
        const urlName = solver.name.replace(/ /g, '_');

        // Gold highlighting for Rank 1
        const goldClass = rankNum === 1 ? 'gold' : '';

        const card = document.createElement('div');
        card.className = `podium-card ${rankClass}`;
        card.setAttribute('data-rank', rankNum);
        card.style.cursor = 'pointer';

        card.innerHTML = `
          <div class="podium-badge">${rankNum}</div>
          <div class="avatar-wrap">
            <div class="avatar-initials">${solver.initials}</div>
          </div>
          <h3 class="podium-name">${solver.name}</h3>
          <span class="podium-title">${solver.role}</span>
          <div class="podium-specialty">${solver.specialty}</div>
          <div class="podium-metrics">
            <div class="metric-item">
              <span class="metric-val">${solver.points.toLocaleString()}</span>
              <span class="metric-lbl">Impact Pts</span>
            </div>
            <div class="metric-item">
              <span class="metric-val">${solver.solved}</span>
              <span class="metric-lbl">Solved</span>
            </div>
          </div>
          <div class="podium-badges">
            ${solver.badges.map(b => `<span class="badge-tag ${goldClass}">${b}</span>`).join('')}
          </div>
          <p class="podium-quote">${quote}</p>
        `;

        // Redirect card click to public profile
        card.addEventListener('click', () => {
          window.location.href = `user-dashboard.html?username=${urlName}`;
        });

        podiumGrid.appendChild(card);
      });

      // 2. RENDER THE LEDGER TABLE (RANKS 4+)
      ledgerTableBody.innerHTML = '';

      for (let i = 3; i < solvers.length; i++) {
        const solver = solvers[i];
        const rankStr = (i + 1) < 10 ? `0${i + 1}` : `${i + 1}`;
        const urlName = solver.name.replace(/ /g, '_');

        const row = document.createElement('tr');
        row.className = 'ledger-row';
        row.setAttribute('data-specialty', solver.specialty.split(' & ')[0].split(' ')[0]); // Get clean category tag

        row.innerHTML = `
          <td class="col-rank"><span class="rank-number">${rankStr}</span></td>
          <td class="col-solver">
            <div class="solver-profile" style="cursor: pointer;">
              <div class="solver-avatar">${solver.initials}</div>
              <div class="solver-info">
                <span class="solver-name">${solver.name}</span>
                <span class="solver-sub">${solver.role}</span>
              </div>
            </div>
          </td>
          <td class="col-specialty"><span class="specialty-lbl">${solver.specialty}</span></td>
          <td class="col-solved"><span class="solved-count">${solver.solved} challenges</span></td>
          <td class="col-badges">
            <div class="badges-row">
              ${solver.badges.map(b => `<span class="mini-badge">${b}</span>`).join('')}
            </div>
          </td>
          <td class="col-impact"><span class="impact-val">${solver.points.toLocaleString()} XP</span></td>
        `;

        // Redirect row profile click to public profile
        row.querySelector('.solver-profile').addEventListener('click', () => {
          window.location.href = `user-dashboard.html?username=${urlName}`;
        });

        ledgerTableBody.appendChild(row);
      }

    } catch (err) {
      console.error('Failed to dynamically render leaderboard:', err);
    }
  }

  /* ─── HERO ENTRANCE ANIMATIONS ────────────── */
  function animateHero() {
    const tl = gsap.timeline({ delay: 0.2 });

    gsap.set('.hero-eyebrow, .hero-headline, .hero-tagline, .hero-body', { y: 30, opacity: 0 });

    tl.to('.hero-eyebrow', { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' })
      .to('.hero-headline', { opacity: 1, y: 0, duration: 1.0, ease: 'power3.out' }, '-=0.5')
      .to('.hero-tagline', { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' }, '-=0.6')
      .to('.hero-body', { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' }, '-=0.5');
  }

  /* ─── SCROLL TRIGGER REVEALS ──────────────── */
  function initScrollTriggers() {
    gsap.set('.podium-card', { opacity: 0, y: 50 });
    ScrollTrigger.create({
      trigger: '.podium-grid',
      start: 'top 85%',
      onEnter: () => {
        gsap.to('.podium-card.rank-2', { opacity: 1, y: 0, duration: 1.2, ease: 'power3.out' });
        gsap.to('.podium-card.rank-1', { opacity: 1, y: 0, duration: 1.4, ease: 'power3.out', delay: 0.15 });
        gsap.to('.podium-card.rank-3', { opacity: 1, y: 0, duration: 1.1, ease: 'power3.out', delay: 0.3 });
      },
      once: true
    });

    document.querySelectorAll('.label, .section-headline').forEach(el => {
      gsap.set(el, { opacity: 0, y: 20 });
      ScrollTrigger.create({
        trigger: el,
        start: 'top 90%',
        onEnter: () => gsap.to(el, { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' }),
        once: true
      });
    });

    gsap.set('.ledger-row', { opacity: 0, y: 15 });
    ScrollTrigger.create({
      trigger: '#ledgerTable',
      start: 'top 88%',
      onEnter: () => {
        gsap.to('.ledger-row', {
          opacity: 1,
          y: 0,
          duration: 0.8,
          stagger: 0.08,
          ease: 'power2.out'
        });
      },
      once: true
    });
  }

  /* ─── INTERACTIVE SEARCH & FILTERING ───────── */
  function initFiltering() {
    const searchInput = document.getElementById('solverSearch');
    const filterButtons = document.querySelectorAll('.filter-btn');
    
    function filterTable() {
      const activeFilterBtn = document.querySelector('.filter-btn.active');
      const activeFilter = activeFilterBtn ? activeFilterBtn.getAttribute('data-filter') : 'all';
      const searchQuery = searchInput ? searchInput.value.toLowerCase().trim() : '';

      const tableRows = document.querySelectorAll('.ledger-row');

      tableRows.forEach(row => {
        const specialty = row.querySelector('.specialty-lbl').textContent.toLowerCase();
        const solverName = row.querySelector('.solver-name').textContent.toLowerCase();
        const solverSub = row.querySelector('.solver-sub').textContent.toLowerCase();
        
        const badges = Array.from(row.querySelectorAll('.mini-badge'))
          .map(b => b.textContent.toLowerCase())
          .join(' ');
        
        const matchesFilter = activeFilter === 'all' || specialty.includes(activeFilter.toLowerCase());
        const matchesSearch = solverName.includes(searchQuery) || 
                            solverSub.includes(searchQuery) || 
                            badges.includes(searchQuery);

        if (matchesFilter && matchesSearch) {
          if (row.style.display === 'none' || row.style.opacity === '0') {
            row.style.display = 'table-row';
            gsap.fromTo(row, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' });
          }
        } else {
          if (row.style.display !== 'none') {
            gsap.to(row, {
              opacity: 0,
              y: -10,
              duration: 0.3,
              ease: 'power2.in',
              onComplete: () => {
                row.style.display = 'none';
              }
            });
          }
        }
      });
    }

    filterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        filterButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        filterTable();
      });
    });

    if (searchInput) {
      searchInput.addEventListener('input', () => {
        filterTable();
      });
    }
  }

  /* ─── INIT ─────────────────────────────────── */
  function init() {
    gsap.registerPlugin(ScrollTrigger);

    initLeaderboardCanvas();
    loadLeaderboardData();
    animateHero();
    initScrollTriggers();
    initFiltering();
  }

  document.addEventListener('DOMContentLoaded', init);

})();
