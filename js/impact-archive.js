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
        // Skip private drafts or pending reviews
        if (prob.status === 'Pending Review' || prob.status === 'Pending Owner Closure' || prob.status === 'Closed by Owner') {
          return;
        }

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

        const isSolved = prob.status === 'Solved';

        let badgeHtml = '';
        let solverMetaHtml = '';
        let opportunityHtml = '';

        if (isSolved) {
          badgeHtml = `<span style="font-size: 10px; font-family: var(--font-body); text-transform: uppercase; letter-spacing: 0.1em; padding: 3px 10px; border-radius: 100px; background: rgba(35, 56, 43, 0.08); color: var(--accent-moss); margin-left: 8px; font-weight: 600; vertical-align: middle;">Co-Authored Solution</span>`;
          
          const solverUrlName = prob.solvedBy.replace(/ /g, '_');
          const othersList = prob.contributors ? prob.contributors.filter(c => c !== prob.solvedBy) : [];
          let othersHtml = '';
          if (othersList.length > 0) {
            othersHtml = ` (with participation from: ${othersList.map(c => `<a href="user-dashboard.html?username=${c.replace(/ /g, '_')}" style="color: var(--accent-ocean); font-weight: 500;">${c}</a>`).join(', ')})`;
          }

          solverMetaHtml = `
            <span class="meta-field">Resolved By: <a href="user-dashboard.html?username=${solverUrlName}" style="color: var(--accent-moss); font-weight: 600; text-decoration: underline;">${prob.solvedBy}</a>${othersHtml}</span>
          `;

          opportunityHtml = `
            <div class="drawer-section" style="grid-column: span 3; border-top: 1px dashed var(--border-light); padding-top: 18px; margin-top: 12px; background: rgba(35, 56, 43, 0.015); padding: 16px; border-radius: 8px;">
              <h4 style="color: var(--accent-moss); margin-bottom: 6px; text-transform: uppercase; font-size: 11px; font-weight: 600;">Verified Resolution & Owner Feedback</h4>
              <p style="font-style: italic; opacity: 0.85;">"${prob.ownerReview || 'Challenge successfully completed and archived.'}"</p>
              <div style="font-size: 11px; opacity: 0.6; margin-top: 10px; display: flex; gap: 15px;">
                <span>Complexity: <strong>${prob.complexity}</strong></span>
                <span>Council Award: <strong>+${prob.winnerXP || 150} XP Solver, +${prob.attemptXP || 40} XP Attempts</strong></span>
              </div>
            </div>
          `;
        } else {
          badgeHtml = `<span style="font-size: 10px; font-family: var(--font-body); text-transform: uppercase; letter-spacing: 0.1em; padding: 3px 10px; border-radius: 100px; background: rgba(200, 125, 85, 0.1); color: var(--accent-clay); margin-left: 8px; font-weight: 600; vertical-align: middle;">Open Challenge</span>`;
          
          const attemptsCount = prob.contributors ? prob.contributors.length : 0;
          let attemptsInfo = 'Seeking Solver...';
          if (attemptsCount > 0) {
            attemptsInfo = `${attemptsCount} Solver${attemptsCount > 1 ? 's' : ''} attempting (External)`;
          }

          solverMetaHtml = `
            <span class="meta-field">Status: <strong style="color: var(--accent-clay); font-style: italic;">${attemptsInfo}</strong></span>
          `;

          let contributorsAvatarsHtml = '';
          if (attemptsCount > 0) {
            contributorsAvatarsHtml = `
              <div style="margin-top: 8px; font-size: 12px; opacity: 0.7;">
                Attempting: <strong>${prob.contributors.join(', ')}</strong>
              </div>
            `;
          }

          opportunityHtml = `
            <div class="drawer-section" style="grid-column: span 3; border-top: 1px dashed var(--border-light); padding-top: 18px; margin-top: 12px; display: flex; flex-direction: column; gap: 12px; align-items: flex-start;">
              <h4 style="color: var(--accent-clay); text-transform: uppercase; font-size: 11px; font-weight: 600;">Cooperative Bounty Opportunity</h4>
              <p>This challenge is currently open and being solved in external applications. You can self-assign to register your attempt, earning participation points even if someone else closes it first.</p>
              ${contributorsAvatarsHtml}
              <div style="display: flex; gap: 10px; margin-top: 8px; width: 100%;">
                <button type="button" class="btn btn-primary btn-sm btn-attempt-challenge" data-id="${prob.id}" style="padding: 8px 16px; font-size: 12px; border-radius: 100px; border: none; cursor: pointer; background: var(--accent-moss); color: var(--bg-warm);">Claim & Attempt Challenge</button>
                <a href="user-dashboard.html" class="btn btn-outline btn-sm" style="padding: 8px 16px; font-size: 12px; border-radius: 100px; border: 1px solid var(--border-light); color: var(--text-charcoal); text-decoration: none;">View Profiles</a>
              </div>
            </div>
          `;
        }

        item.innerHTML = `
          <div class="timeline-marker"></div>
          <div class="timeline-card">
            <div class="card-header">
              <span class="item-date">${prob.date}</span>
              <span class="category-tag ${catClass}">${prob.category}</span>
            </div>
            <h3 class="item-title">${prob.title} ${badgeHtml}</h3>
            <p class="item-summary">${prob.friction.substring(0, 120)}...</p>
            
            <div class="item-meta">
              ${solverMetaHtml}
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
                ${opportunityHtml}
              </div>
            </div>
          </div>
        `;
        
        // Prepend to timeline to display at the top of the archive
        timeline.insertBefore(item, timeline.firstChild);
      });

      // Attach click events for "Attempt Challenge"
      document.querySelectorAll('.btn-attempt-challenge').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation(); // Avoid triggering accordion toggle
          const problemId = btn.getAttribute('data-id');
          attemptChallenge(problemId);
        });
      });

    } catch (err) {
      console.error('Failed to load custom problems from localStorage:', err);
    }
  }

  function attemptChallenge(problemId) {
    try {
      const session = JSON.parse(sessionStorage.getItem('portal_session'));
      if (!session) {
        alert('Authentication Error: Please sign in to the portal to claim and attempt this challenge.');
        window.location.href = 'login.html';
        return;
      }

      const username = session.username;

      const problems = JSON.parse(localStorage.getItem('community_problems')) || [];
      const problem = problems.find(p => p.id === problemId);

      if (!problem) return;

      if (!problem.contributors) {
        problem.contributors = [];
      }

      if (problem.contributors.includes(username)) {
        alert('Challenge Notification: You are already registered as an attempting contributor for this challenge!');
        return;
      }

      problem.contributors.push(username);
      localStorage.setItem('community_problems', JSON.stringify(problems));

      // Record system log
      const logs = JSON.parse(localStorage.getItem('admin_system_logs')) || [];
      logs.unshift({
        timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }) + ' ' + new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        type: 'LEDGER',
        message: `Contributor "${username}" self-assigned to attempt challenge "${problem.title}" externally.`
      });
      localStorage.setItem('admin_system_logs', JSON.stringify(logs));

      alert(`Success! You have successfully registered as a contributor to attempt "${problem.title}"!\nWork on your solution externally. The problem owner will verify the winner and complexity once resolved.`);
      
      window.location.reload();
    } catch (err) {
      console.error('Failed to attempt challenge:', err);
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
