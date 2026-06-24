/* =======================================================
   TOGETHER WE SOLVE — js/user-dashboard.js
   Dynamic Public Solver Profiles & Sprouting Footprints
   ======================================================= */

(function () {
  'use strict';

  let activeSolverProfile = null;
  let currentUserSession = null;

  // Fallback defaults if localStorage is empty
  const defaultSolvers = [
    { id: 'sol_1', name: 'Elena Rostova', role: 'The Bridge Builder', specialty: 'Technical Systems & Language', points: 4850, solved: 12, initials: 'ER', badges: ['Golden Heart', 'Deep Thinker'] },
    { id: 'sol_2', name: 'Marcus Vance', role: 'The Catalyst', specialty: 'Community & Environment', points: 4210, solved: 9, initials: 'MV', badges: ['Root Sprouter', 'Constant Beacon'] },
    { id: 'sol_3', name: 'Aiko Tanaka', role: 'The Oracle', specialty: 'Educational Mentorship', points: 3950, solved: 8, initials: 'AT', badges: ['Sudden Light', 'Dignity Guard'] }
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

  /* ─── ROUTING & PROFILE LOAD ────────────────── */
  function loadProfileData() {
    try {
      // Load session
      currentUserSession = JSON.parse(sessionStorage.getItem('portal_session'));
      
      const solvers = JSON.parse(localStorage.getItem('community_solvers')) || defaultSolvers;

      // Parse URL parameters
      const urlParams = new URLSearchParams(window.location.search);
      const idParam = urlParams.get('id');
      const nameParam = urlParams.get('username');

      let targetSolver = null;

      if (idParam) {
        targetSolver = solvers.find(s => s.id === idParam);
      } else if (nameParam) {
        const cleanName = nameParam.replace(/_/g, ' ').toLowerCase();
        targetSolver = solvers.find(s => s.name.toLowerCase() === cleanName);
      }

      // Fallback: If no parameters or not found, show currently logged-in user
      if (!targetSolver && currentUserSession) {
        targetSolver = solvers.find(s => s.name === currentUserSession.username);
      }

      // Ultimate Fallback: Default to Elena Rostova if no session and no params
      if (!targetSolver) {
        targetSolver = solvers[0]; 
      }

      activeSolverProfile = targetSolver;

      // Toggle "Edit Profile Settings" button if viewer is the owner
      const editBtn = document.getElementById('btnEditProfile');
      if (editBtn && currentUserSession && currentUserSession.username === activeSolverProfile.name) {
        editBtn.style.display = 'inline-block';
      }
    } catch (err) {
      console.error('Failed to load profile routing:', err);
    }
  }

  /* ─── RENDER PROFILE DOM ELEMENTS ───────────── */
  function renderProfile() {
    if (!activeSolverProfile) return;

    // Header
    const nameEl = document.getElementById('welcomeMessage');
    const taglineEl = document.getElementById('profileTagline');
    const bioEl = document.getElementById('profileBio');

    if (nameEl) nameEl.textContent = activeSolverProfile.name;
    if (taglineEl) {
      taglineEl.textContent = `${activeSolverProfile.role} • ${activeSolverProfile.specialty} Specialty`;
    }
    if (bioEl) {
      bioEl.textContent = `Here is the ledger of ${activeSolverProfile.name}'s collaborative footprint. Explore their resolved challenges, cooperative attempts, voiced frictions, and earned honors of empathy.`;
    }

    // Stats
    const xpEl = document.getElementById('userXP');
    const solvedEl = document.getElementById('userSolvedCount');
    const frictionsEl = document.getElementById('userFrictionsCount');
    const rankEl = document.getElementById('userRank');

    const problems = JSON.parse(localStorage.getItem('community_problems')) || [];
    const voicedCount = problems.filter(p => p.solver === activeSolverProfile.name).length;

    if (xpEl) xpEl.textContent = activeSolverProfile.points.toLocaleString();
    if (solvedEl) solvedEl.textContent = activeSolverProfile.solved;
    if (frictionsEl) frictionsEl.textContent = voicedCount;

    if (rankEl) {
      let rank = 'Level I';
      if (activeSolverProfile.points >= 1500) rank = 'Level II';
      if (activeSolverProfile.points >= 3000) rank = 'Level III';
      if (activeSolverProfile.points >= 4500) rank = 'Level IV';
      rankEl.textContent = rank;
    }

    // Render Badges Gallery
    renderBadgesGallery();

    // Render Portfolios
    renderPortfolios(problems);

    // Render Voiced Frictions
    renderVoicedFrictions(problems);
  }

  function renderBadgesGallery() {
    const grid = document.getElementById('badgesGrid');
    if (!grid) return;
    grid.innerHTML = '';

    const badgeCatalog = {
      'Golden Heart': { icon: '❤️', honor: 'Level V Honor', desc: 'Awarded for extreme empathy, dignity, and clarity in co-authoring community solutions.' },
      'Deep Thinker': { icon: '🧠', honor: 'Level IV Honor', desc: 'Awarded for resolving complex, multi-step structural and engineering blockades.' },
      'Root Sprouter': { icon: '🌿', honor: 'Level III Honor', desc: 'Awarded for consistent local ecological and agricultural contributions.' },
      'Constant Beacon': { icon: '🕯️', honor: 'Level III Honor', desc: 'Awarded for long-term consistency and community dedication.' },
      'Sudden Light': { icon: '💡', honor: 'Common Honor', desc: 'Awarded for brilliant, immediate breakthroughs on critical roadblocks.' },
      'Dignity Guard': { icon: '🛡️', honor: 'Level IV Honor', desc: 'Awarded for guarding community safety and accessibility.' },
      'First Spark': { icon: '✨', honor: 'Common Honor', desc: 'Earned by voicing your first obstacle and trusting the community with your vulnerability.' }
    };

    if (activeSolverProfile.badges.length === 0) {
      grid.innerHTML = `<div style="grid-column: span 3; text-align: center; opacity: 0.6; padding: 20px;">No badges earned yet. Complete challenges to earn honors!</div>`;
      return;
    }

    activeSolverProfile.badges.forEach(badge => {
      const details = badgeCatalog[badge] || { icon: '🏅', honor: 'Community Honor', desc: 'Awarded for helpful cooperative participation.' };
      const card = document.createElement('div');
      card.className = 'badge-card';
      card.innerHTML = `
        <div class="badge-card-accent"></div>
        <div class="badge-icon-wrap">${details.icon}</div>
        <h3>${badge}</h3>
        <span class="badge-level">${details.honor}</span>
        <p class="badge-desc">${details.desc}</p>
      `;
      grid.appendChild(card);
    });
  }

  function renderPortfolios(problems) {
    const winnerList = document.getElementById('winnerPortfolioList');
    const attemptsList = document.getElementById('attemptsPortfolioList');

    if (!winnerList || !attemptsList) return;

    winnerList.innerHTML = '';
    attemptsList.innerHTML = '';

    // 1. Resolved Challenges (Winner)
    const resolvedChallenges = problems.filter(p => p.status === 'Solved' && p.solvedBy === activeSolverProfile.name);

    if (resolvedChallenges.length > 0) {
      resolvedChallenges.forEach(prob => {
        const card = document.createElement('div');
        card.className = 'portfolio-card';
        card.style.cssText = 'background: var(--bg-warm); border: 1px solid var(--border-light); padding: 20px; border-radius: 8px; margin-bottom: 16px; text-align: left; position: relative; box-shadow: 0 2px 8px rgba(0,0,0,0.01);';
        
        card.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="font-size: 10px; opacity: 0.5;">${prob.date}</span>
            <span class="status-badge solved" style="font-size: 8px; padding: 1px 8px; border-radius: 100px; background: rgba(35, 56, 43, 0.08); color: var(--accent-moss); font-weight: 600; text-transform: uppercase;">Resolved</span>
          </div>
          <h4 style="font-family: var(--font-display); font-size: 16px; color: var(--accent-moss); margin-bottom: 6px; font-weight: 400;">${prob.title}</h4>
          <p style="font-size: 12.5px; opacity: 0.75; line-height: 1.5; margin-bottom: 12px;">${prob.friction.substring(0, 90)}...</p>
          <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed var(--border-light); padding-top: 10px; font-size: 11px;">
            <span>Category: <strong>${prob.category}</strong></span>
            <span style="font-weight: 600; color: var(--accent-moss);">+${prob.winnerXP || 150} XP Bounty</span>
          </div>
        `;
        winnerList.appendChild(card);
      });
    } else {
      winnerList.innerHTML = `<div style="text-align: center; opacity: 0.5; padding: 40px 20px; border: 1px dashed var(--border-light); border-radius: 8px; font-size: 13.5px;">No resolved challenges yet.</div>`;
    }

    // 2. Collaborative Attempts (Attempted but not Winner)
    const collaborativeAttempts = problems.filter(p => p.contributors && p.contributors.includes(activeSolverProfile.name) && p.solvedBy !== activeSolverProfile.name);

    if (collaborativeAttempts.length > 0) {
      collaborativeAttempts.forEach(prob => {
        const card = document.createElement('div');
        card.className = 'portfolio-card';
        card.style.cssText = 'background: var(--bg-warm); border: 1px solid var(--border-light); padding: 20px; border-radius: 8px; margin-bottom: 16px; text-align: left; position: relative; box-shadow: 0 2px 8px rgba(0,0,0,0.01);';
        
        let statusTxt = 'Attempted';
        let statusColor = 'rgba(61, 90, 108, 0.08); color: var(--accent-ocean);';
        if (prob.status === 'Solved') {
          statusTxt = 'Participated';
          statusColor = 'rgba(35, 56, 43, 0.06); color: var(--accent-moss);';
        }

        card.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="font-size: 10px; opacity: 0.5;">${prob.date}</span>
            <span style="font-size: 8px; padding: 1px 8px; border-radius: 100px; font-weight: 600; text-transform: uppercase; background: ${statusColor}">${statusTxt}</span>
          </div>
          <h4 style="font-family: var(--font-display); font-size: 16px; color: var(--accent-moss); margin-bottom: 6px; font-weight: 400;">${prob.title}</h4>
          <p style="font-size: 12.5px; opacity: 0.75; line-height: 1.5; margin-bottom: 12px;">${prob.friction.substring(0, 90)}...</p>
          <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed var(--border-light); padding-top: 10px; font-size: 11px;">
            <span>Category: <strong>${prob.category}</strong></span>
            <span style="font-weight: 600; color: var(--accent-ocean);">+${prob.attemptXP || 40} XP Attempt</span>
          </div>
        `;
        attemptsList.appendChild(card);
      });
    } else {
      attemptsList.innerHTML = `<div style="text-align: center; opacity: 0.5; padding: 40px 20px; border: 1px dashed var(--border-light); border-radius: 8px; font-size: 13.5px;">No collaborative attempts yet.</div>`;
    }
  }

  function renderVoicedFrictions(problems) {
    const listContainer = document.getElementById('userFrictionsList');
    const placeholder = document.getElementById('frictionsPlaceholder');

    if (!listContainer) return;

    // Clear previous cards, leaving placeholder in DOM
    const cards = listContainer.querySelectorAll('.user-friction-card');
    cards.forEach(c => c.remove());

    const userProblems = problems.filter(p => p.solver === activeSolverProfile.name);

    if (userProblems.length > 0) {
      if (placeholder) placeholder.style.display = 'none';

      userProblems.forEach(prob => {
        const card = document.createElement('div');
        card.className = 'user-friction-card';

        const categoryClassMap = {
          'Education': 'edu',
          'Technical': 'tech',
          'Environmental': 'env',
          'Community': 'comm'
        };
        const catClass = categoryClassMap[prob.category] || 'tech';
        
        let displayStatus = prob.status;
        if (prob.status === 'Pending Owner Closure') {
          displayStatus = 'Pending Review'; // Keep user-friendly
        }
        const statusClass = displayStatus.toLowerCase().replace(/ /g, '-');

        let solverTxt = prob.solver; // Default
        if (prob.status === 'Open') {
          solverTxt = 'Seeking Solver...';
        } else if (prob.status === 'Solved') {
          solverTxt = prob.solvedBy || 'Co-Authored';
        } else if (prob.status === 'Closed by Owner' || prob.status === 'Pending Owner Closure') {
          solverTxt = prob.solvedBy || 'Reviewing Proposed Solutions';
        }

        // Show attempting contributors if open
        let attemptsTxt = '';
        if (prob.status === 'Open' && prob.contributors && prob.contributors.length > 0) {
          attemptsTxt = `<div style="font-size: 11px; margin-top: 5px; opacity: 0.7;">Attempts: <strong>${prob.contributors.join(', ')}</strong></div>`;
        }

        card.innerHTML = `
          <div class="card-header">
            <div class="card-header-left">
              <span class="card-date">${prob.date}</span>
              <span class="status-badge ${statusClass}">${displayStatus}</span>
            </div>
            <span class="category-tag ${catClass}">${prob.category}</span>
          </div>
          <h3 class="card-title">${prob.title}</h3>
          
          <div class="card-details-grid">
            <div class="detail-section">
              <h4>The Friction</h4>
              <p>${prob.friction}</p>
            </div>
            <div class="detail-section">
              <h4>The Search</h4>
              <p>${prob.tried}</p>
            </div>
            <div class="detail-section">
              <h4>Expected Ripple</h4>
              <p>${prob.ripple}</p>
            </div>
          </div>

          ${prob.status === 'Solved' && prob.ownerReview ? `
            <div style="background: rgba(35, 56, 43, 0.02); border-left: 2px solid var(--accent-moss); padding: 12px 16px; font-size: 12.5px; border-radius: 0 6px 6px 0; margin-top: 16px;">
              <strong style="color: var(--accent-moss); text-transform: uppercase; font-size: 9.5px; display: block; margin-bottom: 2px;">Your Verified Review:</strong>
              "${prob.ownerReview}"
            </div>
          ` : ''}

          <div class="card-footer" style="margin-top: 18px; padding-top: 14px; border-top: 1px dashed var(--border-light);">
            <div class="footer-meta">
              Solver: <strong style="color: var(--accent-clay);">${solverTxt}</strong>
              ${attemptsTxt}
            </div>
            <div class="score-stats">
              <span class="score-lbl">✨ ${prob.clones} Clones</span>
              <span class="score-lbl">👁️ ${prob.views} Views</span>
            </div>
          </div>
        `;
        listContainer.appendChild(card);
      });

      // Stagger animate cards
      gsap.from('.user-friction-card', {
        opacity: 0,
        y: 20,
        duration: 0.8,
        stagger: 0.1,
        ease: 'power2.out'
      });
    } else {
      if (placeholder) placeholder.style.display = 'block';
    }
  }

  /* ─── ORGANIC SPROUT CANVAS ────────────────── */
  function initSproutCanvas() {
    const canvas = document.getElementById('sproutCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let W, H;
    let vines = [];

    function resize() {
      W = canvas.width = canvas.offsetWidth;
      H = canvas.height = canvas.offsetHeight;
      initVines();
    }

    class VineBranch {
      constructor(startX, startY, angle, length, depth) {
        this.startX = startX;
        this.startY = startY;
        this.angle = angle;
        this.length = length;
        this.depth = depth;
        this.growProgress = 0;
        this.childBranches = [];
        this.leaves = [];
        
        const leavesCount = Math.floor(Math.random() * 3) + 2;
        for (let i = 0; i < leavesCount; i++) {
          this.leaves.push({
            t: Math.random() * 0.6 + 0.3,
            side: Math.random() > 0.5 ? 1 : -1,
            size: 0,
            maxSize: Math.random() * 6 + 4,
            rotation: (Math.random() - 0.5) * 0.5
          });
        }
      }

      update() {
        if (this.growProgress < 1) {
          this.growProgress += 0.008;
        }

        const endX = this.startX + Math.cos(this.angle) * this.length * this.growProgress;
        const endY = this.startY + Math.sin(this.angle) * this.length * this.growProgress;

        ctx.beginPath();
        ctx.moveTo(this.startX, this.startY);
        
        const midX = this.startX + Math.cos(this.angle) * this.length * 0.5 * this.growProgress;
        const midY = this.startY + Math.sin(this.angle) * this.length * 0.5 * this.growProgress;
        const wiggleX = Math.sin(this.growProgress * 5) * 4;
        ctx.quadraticCurveTo(midX + wiggleX, midY, endX, endY);
        
        ctx.strokeStyle = '#23382B';
        ctx.lineWidth = Math.max(4 - this.depth * 0.8, 1.2);
        ctx.stroke();

        if (this.growProgress > 0.4) {
          this.leaves.forEach(leaf => {
            const leafT = (this.growProgress - leaf.t) / (1 - leaf.t);
            if (leafT > 0) {
              leaf.size = leaf.maxSize * Math.min(leafT * 2, 1);
              
              const lx = this.startX + Math.cos(this.angle) * this.length * leaf.t;
              const ly = this.startY + Math.sin(this.angle) * this.length * leaf.t;
              
              ctx.save();
              ctx.translate(lx, ly);
              ctx.rotate(this.angle + (Math.PI / 2) * leaf.side + leaf.rotation);
              
              ctx.beginPath();
              ctx.moveTo(0, 0);
              ctx.bezierCurveTo(-leaf.size / 2, -leaf.size / 2, -leaf.size / 2, -leaf.size, 0, -leaf.size);
              ctx.bezierCurveTo(leaf.size / 2, -leaf.size, leaf.size / 2, -leaf.size / 2, 0, 0);
              ctx.fillStyle = 'rgba(200, 125, 85, 0.65)';
              ctx.fill();
              ctx.restore();
            }
          });
        }

        if (this.growProgress >= 1 && this.depth < 3 && this.childBranches.length === 0) {
          const branchCount = Math.random() > 0.5 ? 2 : 1;
          for (let i = 0; i < branchCount; i++) {
            const newAngle = this.angle + (Math.random() - 0.5) * 1.1;
            const newLength = this.length * (Math.random() * 0.2 + 0.65);
            this.childBranches.push(new VineBranch(endX, endY, newAngle, newLength, this.depth + 1));
          }
        }

        this.childBranches.forEach(child => child.update());
      }
    }

    function initVines() {
      vines = [];
      vines.push(new VineBranch(W * 0.15, H + 10, -Math.PI / 2.2, 110, 1));
      vines.push(new VineBranch(W * 0.5, H + 10, -Math.PI / 2, 130, 1));
      vines.push(new VineBranch(W * 0.85, H + 10, -Math.PI / 1.8, 100, 1));
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      vines.forEach(vine => vine.update());
      requestAnimationFrame(draw);
    }

    resize();
    draw();

    window.addEventListener('resize', () => {
      W = canvas.width = canvas.offsetWidth;
      H = canvas.height = canvas.offsetHeight;
    });
  }

  /* ─── SIGN OUT FUNCTIONALITY ───────────────── */
  function initSignOut() {
    const signOutBtn = document.getElementById('signOutBtn');
    if (!signOutBtn) return;

    signOutBtn.addEventListener('click', () => {
      sessionStorage.removeItem('portal_session');
      
      gsap.to('.hero-content, .stats-grid, .portfolio-section, .user-frictions-list, .badges-grid', {
        opacity: 0,
        y: -15,
        duration: 0.4,
        stagger: 0.05,
        ease: 'power2.in',
        onComplete: () => {
          window.location.href = 'login.html';
        }
      });
    });
  }

  /* ─── ENTRANCE ANIMATIONS ──────────────────── */
  function animateDashboard() {
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

    gsap.set('.badge-card', { opacity: 0, y: 30 });
    ScrollTrigger.create({
      trigger: '.badges-grid',
      start: 'top 88%',
      onEnter: () => {
        gsap.to('.badge-card', {
          opacity: 1,
          y: 0,
          duration: 0.9,
          stagger: 0.1,
          ease: 'power2.out'
        });
      },
      once: true
    });
  }

  /* ─── INIT ─────────────────────────────────── */
  function init() {
    gsap.registerPlugin(ScrollTrigger);

    loadProfileData();
    renderProfile();
    initSproutCanvas();
    initSignOut();
    animateDashboard();
  }

  document.addEventListener('DOMContentLoaded', init);

})();
