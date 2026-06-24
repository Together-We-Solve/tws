/* ============================================
   TOGETHER WE SOLVE — leaderboard.js
   Evolved Generative Networks & Ledger Interactions
   ============================================ */

(function () {
  'use strict';

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
    
    // Mouse interaction coordinate tracking
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
        this.color = Math.random() > 0.45 ? 'rgba(35, 56, 43, 0.25)' : 'rgba(200, 125, 85, 0.2)'; // Forest moss or Earthy clay
      }

      update() {
        this.x += this.vx;
        this.y += this.vy;

        // Bounce at boundaries
        if (this.x < 0 || this.x > W) this.vx = -this.vx;
        if (this.y < 0 || this.y > H) this.vy = -this.vy;

        // Mouse push effect
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

      // Update and draw particles
      particles.forEach(p => {
        p.update();
        p.draw();
      });

      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const p1 = particles[i];
          const p2 = particles[j];
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < connectionDist) {
            // Calculate line opacity based on distance
            const opacity = (1 - (dist / connectionDist)) * 0.15;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            
            // Alternating connection colors
            ctx.strokeStyle = i % 2 === 0 
              ? `rgba(35, 56, 43, ${opacity})`  // Moss lines
              : `rgba(200, 125, 85, ${opacity})`; // Clay lines
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }

      requestAnimationFrame(draw);
    }

    // Event Listeners
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
    // Staggered podium entrance
    gsap.set('.podium-card', { opacity: 0, y: 50 });
    ScrollTrigger.create({
      trigger: '.podium-grid',
      start: 'top 85%',
      onEnter: () => {
        // Animate rank 2, then rank 1, then rank 3
        gsap.to('.podium-card.rank-2', { opacity: 1, y: 0, duration: 1.2, ease: 'power3.out' });
        gsap.to('.podium-card.rank-1', { opacity: 1, y: 0, duration: 1.4, ease: 'power3.out', delay: 0.15 });
        gsap.to('.podium-card.rank-3', { opacity: 1, y: 0, duration: 1.1, ease: 'power3.out', delay: 0.3 });
      },
      once: true
    });

    // Label and Section headline reveals
    document.querySelectorAll('.label, .section-headline').forEach(el => {
      gsap.set(el, { opacity: 0, y: 20 });
      ScrollTrigger.create({
        trigger: el,
        start: 'top 90%',
        onEnter: () => gsap.to(el, { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' }),
        once: true
      });
    });

    // Ledger table rows fade in stagger
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
    const tableRows = document.querySelectorAll('.ledger-row');
    
    let activeFilter = 'all';
    let searchQuery = '';

    function filterTable() {
      tableRows.forEach(row => {
        const specialty = row.getAttribute('data-specialty');
        const solverName = row.querySelector('.solver-name').textContent.toLowerCase();
        const solverSub = row.querySelector('.solver-sub').textContent.toLowerCase();
        
        // Find badge texts inside the row
        const badges = Array.from(row.querySelectorAll('.mini-badge'))
          .map(b => b.textContent.toLowerCase())
          .join(' ');
        
        const matchesFilter = activeFilter === 'all' || specialty === activeFilter;
        const matchesSearch = solverName.includes(searchQuery) || 
                            solverSub.includes(searchQuery) || 
                            badges.includes(searchQuery);

        if (matchesFilter && matchesSearch) {
          // Row matches filters, animate in
          if (row.style.display === 'none' || row.style.opacity === '0') {
            row.style.display = 'table-row';
            gsap.fromTo(row, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' });
          }
        } else {
          // Row does not match filters, fade out and hide
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

    // Filter button clicks
    filterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        filterButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeFilter = btn.getAttribute('data-filter');
        filterTable();
      });
    });

    // Search input typing
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        filterTable();
      });
    }
  }

  /* ─── INIT ─────────────────────────────────── */
  function init() {
    gsap.registerPlugin(ScrollTrigger);

    initLeaderboardCanvas();
    animateHero();
    initScrollTriggers();
    initFiltering();
  }

  document.addEventListener('DOMContentLoaded', init);

})();
