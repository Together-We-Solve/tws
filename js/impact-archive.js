/* ============================================
   TOGETHER WE SOLVE — impact-archive.js
   Watercolor ripples & Timeline drawer interactions
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

  /* ─── WATERCOLOR RIPPLE CANVAS ──────────────── */
  function initRippleCanvas() {
    const canvas = document.getElementById('rippleCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let W, H;
    let ripples = [];
    
    function resize() {
      W = canvas.width = canvas.offsetWidth;
      H = canvas.height = canvas.offsetHeight;
    }

    class WatercolorRipple {
      constructor(x, y) {
        this.x = x || Math.random() * W;
        this.y = y || Math.random() * H;
        this.r = 8;
        this.maxRadius = Math.random() * 150 + 120;
        this.speed = Math.random() * 0.9 + 0.7;
        this.opacity = 0.5;
        this.phase = Math.random() * Math.PI;
        this.noiseFreq = Math.random() * 3 + 3;
      }

      update() {
        this.r += this.speed;
        this.phase += 0.015;
        this.opacity = 1 - (this.r / this.maxRadius);
      }

      draw() {
        ctx.beginPath();
        const segments = 24;
        
        // Draw highly organic watercolor bleeding edge using sine noise
        for (let i = 0; i <= segments; i++) {
          const angle = (i / segments) * Math.PI * 2;
          const noiseVal = Math.sin(angle * this.noiseFreq + this.phase) * (this.r * 0.07);
          const radiusWithNoise = this.r + noiseVal;
          const rx = this.x + Math.cos(angle) * radiusWithNoise;
          const ry = this.y + Math.sin(angle) * radiusWithNoise;

          if (i === 0) ctx.moveTo(rx, ry);
          else ctx.lineTo(rx, ry);
        }

        ctx.closePath();

        // Clay gradient rings fading outward
        ctx.strokeStyle = `rgba(200, 125, 85, ${this.opacity * 0.25})`;
        ctx.lineWidth = 1.4;
        ctx.stroke();

        // Muted forest green shadow ring
        ctx.strokeStyle = `rgba(35, 56, 43, ${this.opacity * 0.1})`;
        ctx.lineWidth = 0.6;
        ctx.stroke();
      }
    }

    function addAutoRipple() {
      if (ripples.length < 4) {
        ripples.push(new WatercolorRipple());
      }
    }

    // Organic auto-spawning representing community ripples
    const intervalId = setInterval(addAutoRipple, 2600);

    // Click/MouseMove triggers
    canvas.addEventListener('mousemove', (e) => {
      // Limit cursor ripples by chance to prevent canvas overcrowding
      if (Math.random() > 0.94) {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        ripples.push(new WatercolorRipple(mouseX, mouseY));
      }
    });

    canvas.addEventListener('click', (e) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      ripples.push(new WatercolorRipple(mouseX, mouseY));
    });

    function draw() {
      ctx.clearRect(0, 0, W, H);
      ripples.forEach((r, idx) => {
        r.update();
        r.draw();
        if (r.r >= r.maxRadius) {
          ripples.splice(idx, 1);
        }
      });
      requestAnimationFrame(draw);
    }

    resize();
    draw();

    window.addEventListener('resize', () => {
      W = canvas.width = canvas.offsetWidth;
      H = canvas.height = canvas.offsetHeight;
    });
  }

  /* ─── ENTRANCE ANIMATIONS ──────────────────── */
  function initAnimations() {
    // Hero Entrance
    const tl = gsap.timeline({ delay: 0.2 });
    gsap.set('.hero-eyebrow, .hero-headline, .hero-tagline, .hero-body', { y: 30, opacity: 0 });

    tl.to('.hero-eyebrow', { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' })
      .to('.hero-headline', { opacity: 1, y: 0, duration: 1.0, ease: 'power3.out' }, '-=0.5')
      .to('.hero-tagline', { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' }, '-=0.6')
      .to('.hero-body', { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' }, '-=0.5');

    // Stats Cards Stagger
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

    // Section Labels and Headlines
    document.querySelectorAll('.label, .section-headline').forEach(el => {
      gsap.set(el, { opacity: 0, y: 20 });
      ScrollTrigger.create({
        trigger: el,
        start: 'top 90%',
        onEnter: () => gsap.to(el, { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' }),
        once: true
      });
    });

    // Timeline Items Stagger
    gsap.set('.timeline-item', { opacity: 0, x: -15 });
    ScrollTrigger.create({
      trigger: '.archive-timeline',
      start: 'top 85%',
      onEnter: () => {
        gsap.to('.timeline-item', {
          opacity: 1,
          x: 0,
          duration: 0.9,
          stagger: 0.12,
          ease: 'power2.out'
        });
      },
      once: true
    });
  }

  /* ─── ACCORDION EXPANDABLE DRAWERS ────────── */
  function initAccordions() {
    const cards = document.querySelectorAll('.timeline-card');

    cards.forEach(card => {
      const btn = card.querySelector('.expand-btn');
      const drawer = card.querySelector('.item-drawer');
      const content = card.querySelector('.drawer-content');

      if (!btn || !drawer || !content) return;

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isExpanded = card.classList.contains('expanded');

        if (!isExpanded) {
          // Open drawer: measure scrollHeight of content
          const height = content.offsetHeight + 24; // account for margins/padding
          card.classList.add('expanded');
          
          gsap.to(drawer, {
            height: height,
            duration: 0.6,
            ease: 'power3.out',
            onComplete: () => {
              // Update Lenis scroll limits since page height changed
              ScrollTrigger.refresh();
              lenis.resize();
            }
          });
        } else {
          // Close drawer
          card.classList.remove('expanded');
          
          gsap.to(drawer, {
            height: 0,
            duration: 0.5,
            ease: 'power3.inOut',
            onComplete: () => {
              ScrollTrigger.refresh();
              lenis.resize();
            }
          });
        }
      });
    });
  }

  /* ─── TIMELINE SEARCH & FILTERING ──────────── */
  function initFiltering() {
    const searchInput = document.getElementById('archiveSearch');
    const tagButtons = document.querySelectorAll('.tag-btn');
    const timelineItems = document.querySelectorAll('.timeline-item');

    let activeFilter = 'all';
    let searchQuery = '';

    function filterTimeline() {
      timelineItems.forEach(item => {
        const category = item.getAttribute('data-category');
        const title = item.querySelector('.item-title').textContent.toLowerCase();
        const summary = item.querySelector('.item-summary').textContent.toLowerCase();
        const solver = item.querySelector('.meta-field').textContent.toLowerCase();
        
        // Match drawer content for deep searches
        const drawerTexts = Array.from(item.querySelectorAll('.drawer-section p, .drawer-section h4'))
          .map(el => el.textContent.toLowerCase())
          .join(' ');

        const matchesFilter = activeFilter === 'all' || category === activeFilter;
        const matchesSearch = title.includes(searchQuery) || 
                            summary.includes(searchQuery) || 
                            solver.includes(searchQuery) ||
                            drawerTexts.includes(searchQuery);

        if (matchesFilter && matchesSearch) {
          if (item.style.display === 'none' || item.style.opacity === '0') {
            item.style.display = 'block';
            gsap.fromTo(item, { opacity: 0, y: 15 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' });
          }
        } else {
          if (item.style.display !== 'none') {
            gsap.to(item, {
              opacity: 0,
              y: -10,
              duration: 0.3,
              ease: 'power2.in',
              onComplete: () => {
                item.style.display = 'none';
              }
            });
          }
        }
      });

      // Recalculate page size
      setTimeout(() => {
        ScrollTrigger.refresh();
        lenis.resize();
      }, 350);
    }

    tagButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        tagButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeFilter = btn.getAttribute('data-filter');
        filterTimeline();
      });
    });

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        filterTimeline();
      });
    }
  }

  /* ─── LOAD CUSTOM PERSISTED PROBLEMS ────────── */
  function loadCustomProblems() {
    const timeline = document.querySelector('.archive-timeline');
    if (!timeline) return;

    try {
      const customProblems = JSON.parse(localStorage.getItem('community_problems')) || [];
      
      // Iterate to prepend, showing the most recently added problem at the top
      customProblems.forEach(prob => {
        const item = document.createElement('div');
        item.className = 'timeline-item';
        item.setAttribute('data-category', prob.category);

        const categoryClassMap = {
          'Education': 'edu',
          'Technical': 'tech',
          'Environmental': 'env',
          'Community': 'comm'
        };
        const catClass = categoryClassMap[prob.category] || 'tech';

        item.innerHTML = `
          <div class="timeline-marker"></div>
          <div class="timeline-card">
            <div class="card-header">
              <span class="item-date">${prob.date}</span>
              <span class="category-tag ${catClass}">${prob.category}</span>
            </div>
            <h3 class="item-title">${prob.title} <span style="font-size: 11px; font-family: var(--font-body); text-transform: uppercase; letter-spacing: 0.1em; padding: 3px 8px; border-radius: 100px; background: rgba(200, 125, 85, 0.1); color: var(--accent-clay); margin-left: 8px; font-weight: 600; vertical-align: middle;">Active Friction</span></h3>
            <p class="item-summary">${prob.friction.substring(0, 120)}...</p>
            
            <div class="item-meta">
              <span class="meta-field">Solver: <strong style="color: var(--accent-clay); font-style: italic;">${prob.solver}</strong></span>
              <div class="ripple-score">
                <span class="score-val">✨ ${prob.clones} Clones</span>
                <span class="score-val">👁️ ${prob.views} Views</span>
              </div>
            </div>
            
            <button class="expand-btn">View Detailed Journey <span class="arrow">↓</span></button>
            
            <!-- Expanding Drawer -->
            <div class="item-drawer">
              <div class="drawer-content">
                <div class="drawer-section">
                  <h4>The Friction</h4>
                  <p>${prob.friction}</p>
                </div>
                <div class="drawer-section">
                  <h4>The Search (Tried)</h4>
                  <p>${prob.tried}</p>
                </div>
                <div class="drawer-section">
                  <h4>The Ripple (Outreach)</h4>
                  <p>${prob.ripple}</p>
                </div>
                <div class="drawer-section" style="grid-column: span 3; border-top: 1px dashed var(--border-light); padding-top: 18px; margin-top: 12px;">
                  <h4>The Opportunity</h4>
                  <p>This obstacle is currently open. If you have the experience or tools to help, <a href="mailto:help@togetherwesolve.org?subject=Solving: ${prob.title}" style="color: var(--accent-clay); text-decoration: underline; font-weight: 500;">Offer a Solution ↗</a> or start a collaboration with the author.</p>
                </div>
              </div>
            </div>
          </div>
        `;
        
        // Prepend to timeline to display at the top of the archive
        timeline.insertBefore(item, timeline.firstChild);
      });
    } catch (err) {
      console.error('Failed to load custom problems from localStorage:', err);
    }
  }

  /* ─── INIT ─────────────────────────────────── */
  function init() {
    gsap.registerPlugin(ScrollTrigger);

    loadCustomProblems();
    initRippleCanvas();
    initAnimations();
    initAccordions();
    initFiltering();
  }

  document.addEventListener('DOMContentLoaded', init);

})();
