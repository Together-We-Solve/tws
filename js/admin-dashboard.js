/* =======================================================
   TOGETHER WE SOLVE — js/admin-dashboard.js
   High-density Operational Oversight Console JS
   ======================================================= */

(function () {
  'use strict';
  const esc = window.TWS.escapeHTML;

  // State Variables
  let activeProblemId = null;
  let activeSolverId = null;
  let isRecruitingMode = false;
  const dashboardMode = window.TWS_DASHBOARD_MODE || 'Founder';

  function getProblems() {
    return window.TWS.memory.problems.length ? window.TWS.memory.problems : defaultProblems;
  }

  function getSolvers() {
    return window.TWS.memory.users.length ? window.TWS.memory.users : defaultSolvers;
  }

  async function saveProblemToFirestore(problem) {
    await window.TWS.saveProblem(problem);
  }

  async function deleteProblemFromFirestore(problemId) {
    await window.TWS.deleteProblem(problemId);
  }

  async function saveSolverToFirestore(solver) {
    const id = solver.uid || solver.id || window.TWS.toUsername(solver.username || solver.name);
    await window.TWS.saveUserProfile(id, {
      ...solver,
      displayName: solver.displayName || solver.name,
      username: solver.username || window.TWS.toUsername(solver.name),
      stats: {
        ...(solver.stats || {}),
        totalImpactPoints: Number(solver.points) || Number(solver.stats?.totalImpactPoints) || 0,
        problemsSolved: Number(solver.solved) || Number(solver.stats?.problemsSolved) || 0
      }
    });
  }

  // Default Solvers Directory to seed Firestore if empty
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

  // Default Problems to seed Firestore if empty
  const defaultProblems = [
    {
      id: 'prob_1',
      title: 'Micro-Grid Energy Surplus Allocation',
      category: 'Technical',
      friction: 'Solar cooperatives lack a local spreadsheet format to log and swap battery surpluses among households without internet-connected smart meters.',
      tried: 'Attempted to use Google Sheets, but network cuts in the valley prevent real-time updates during peak shedding hours.',
      ripple: 'Affects 24 families in the mountain cooperative, resulting in wasted excess power while others sit in dark blocks.',
      date: 'June 2026',
      status: 'Pending Review',
      solver: 'Seeking Solver...',
      contributors: [],
      solvedBy: '',
      complexity: '',
      ownerReview: '',
      winnerXP: 0,
      attemptXP: 0,
      clones: 0,
      views: 5
    },
    {
      id: 'prob_2',
      title: 'Neighborhood Tool Library Clipboard Ledger',
      category: 'Community',
      friction: 'Local tool cooperative has constant borrow disputes because the paper clipboard logs get wet, smudged, or lost entirely.',
      tried: 'Tried writing on a chalkboard, but children wiped it. Tried a spreadsheet, but the garden manager does not own a smartphone.',
      ripple: 'Stops 80+ active neighbors from borrowing seeders, pruners, and tillers safely, leading to agricultural delays.',
      date: 'May 2026',
      status: 'Open',
      solver: 'Seeking Solver...',
      contributors: [],
      solvedBy: '',
      complexity: '',
      ownerReview: '',
      winnerXP: 0,
      attemptXP: 0,
      clones: 1,
      views: 18
    },
    {
      id: 'prob_3',
      title: 'SMS Agricultural Pest Alert Gateway',
      category: 'Environmental',
      friction: 'Farmers need a fast, non-internet method to query regional crop blight alerts and organic pesticide recipes on basic 2G phones.',
      tried: 'Looked at smartphone apps, but rural cellular signals are too weak to load heavy images or maps.',
      ripple: 'Affects over 8,500 smallholders who cannot identify pest migrations before crops are destroyed.',
      date: 'June 2026',
      status: 'Open',
      solver: 'Seeking Solver...',
      contributors: ['Kofi Anan', 'Amara Diallo', 'Marcus Vance'],
      solvedBy: '',
      complexity: '',
      ownerReview: '',
      winnerXP: 0,
      attemptXP: 0,
      clones: 4,
      views: 42
    },
    {
      id: 'prob_4',
      title: 'Urban Runoff Water Filtration Bed',
      category: 'Environmental',
      friction: 'Rainwater runoff from the surrounding street tarmac carries silt and motor oil directly into our community allotments reservoir.',
      tried: 'Tried laying plastic tarps, but they blocked rainwater absorption entirely and flooded the garden gates.',
      ripple: 'Affects 40 community gardeners and threatens the food safety of carrots, radishes, and leafy greens.',
      date: 'April 2026',
      status: 'Closed by Owner',
      solver: 'Marcus Vance',
      contributors: ['Marcus Vance', 'Elena Rostova', 'Aiko Tanaka'],
      solvedBy: 'Marcus Vance',
      complexity: 'Medium',
      ownerReview: 'Marcus\'s gravel-and-biochar filter bed design successfully cleared the standing silt in the community garden. The tomatoes are thriving! Highly recommend this layout.',
      winnerXP: 200,
      attemptXP: 40,
      clones: 6,
      views: 64
    },
    {
      id: 'prob_5',
      title: 'Offline Lesson Blueprint Binder',
      category: 'Education',
      friction: 'Primary school teachers have no way to access open educational curricula when regional power grids fail and shut down school servers.',
      tried: 'Tried saving PDFs on personal phones, but the screens are too small to teach from and batteries drain by midday.',
      ripple: 'Stops classes for 120 children in the local municipal school during grid outages.',
      date: 'March 2026',
      status: 'Solved',
      solver: 'Aiko Tanaka',
      contributors: ['Aiko Tanaka', 'Clara Dupont'],
      solvedBy: 'Aiko Tanaka',
      complexity: 'Low',
      ownerReview: 'The physical binder blueprint saved our weekly workshops when the local internet line was severed. Absolute life saver.',
      winnerXP: 100,
      attemptXP: 40,
      clones: 12,
      views: 89
    }
  ];

  /* ─── SESSION SECURITY CHECK ────────────────── */
  function checkSession() {
    try {
      const session = JSON.parse(sessionStorage.getItem('portal_session'));
      if (!session) {
        window.location.href = 'login.html';
        return;
      }
      const privileges = Array.isArray(session.privileges) ? session.privileges : [];
      const founderRoles = ['Founder', 'Co-Founder'];
      const evaluatorRoles = ['Founder', 'Co-Founder', 'Evaluator', 'Innovator'];
      const canManageSystem = founderRoles.includes(session.role) || privileges.includes('manage_system');
      const canEvaluate = evaluatorRoles.includes(session.role)
        || privileges.includes('evaluate_submissions')
        || privileges.includes('award_points')
        || privileges.includes('close_verified_problems');

      if (dashboardMode === 'Evaluator' && !canEvaluate) {
        window.location.href = founderRoles.includes(session.role) ? 'admin-dashboard.html' : 'user-profile.html';
        return;
      }
      if (dashboardMode !== 'Evaluator' && !canManageSystem) {
        window.location.href = canEvaluate ? 'evaluator-dashboard.html' : 'user-profile.html';
        return;
      }

      if (dashboardMode === 'Evaluator') {
        document.querySelectorAll('.founder-only').forEach((el) => el.remove());
      }

      // Update Admin Sidebar details
      const profileNameEl = document.querySelector('.profile-name');
      const avatarEl = document.querySelector('.admin-avatar');
      const profileLabel = session.displayName || session.username;
      if (profileNameEl && profileLabel) {
        profileNameEl.textContent = profileLabel;
        // Extract initials
        const parts = profileLabel.split(' ');
        let initials = '';
        if (parts.length > 0) initials += parts[0].charAt(0).toUpperCase();
        if (parts.length > 1) initials += parts[1].charAt(0).toUpperCase();
        if (avatarEl && initials) avatarEl.textContent = initials;
      }
    } catch (err) {
      console.error('Session validation error:', err);
    }
  }

  /* ─── SYSTEM ACTIVITY LOGGING ────────────────── */
  function logSystemActivity(type, message) {
    window.TWS.logSystemActivity(type, message);
    renderSystemLogs();
  }

  function renderSystemLogs() {
    const consoleLines = document.getElementById('logConsoleLines');
    if (!consoleLines) return;

    try {
      const logs = window.TWS.loadSystemLogs();
      if (logs.length === 0) {
        consoleLines.innerHTML = `<div class="log-line"><span class="log-timestamp">[System Initialized]</span> <span class="log-tag system">SYSTEM</span> Terminal online. Standing by for administrative actions...</div>`;
        return;
      }

      consoleLines.innerHTML = logs.map(log => `
        <div class="log-line">
          <span class="log-timestamp">[${esc(log.timestamp)}]</span>
          <span class="log-tag ${esc(log.type).toLowerCase()}">${esc(log.type)}</span>
          <span class="log-content">${esc(log.message)}</span>
        </div>
      `).join('');
    } catch (err) {
      console.error('Failed to render system logs:', err);
    }
  }

  function initLogsControls() {
    const clearBtn = document.getElementById('btnClearLogs');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear all activity logs? This action is irreversible.')) {
          window.TWS.clearSystemLogs();
          logSystemActivity('SYSTEM', 'Cleared system activity log history.');
          renderSystemLogs();
        }
      });
    }
  }

  /* ─── SYSTEM PILLARS CANVAS ────────────────── */
  function initPillarCanvas() {
    const canvas = document.getElementById('pillarCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let W, H;
    let pillars = [];
    const pillarCount = 4;

    function resize() {
      W = canvas.width = canvas.offsetWidth;
      H = canvas.height = canvas.offsetHeight;
      initPillars();
    }

    class Pillar {
      constructor(x, width) {
        this.x = x;
        this.width = width;
        this.heightVal = Math.random() * 60 + 100;
        this.pulsePhase = Math.random() * Math.PI * 2;
        this.pulseSpeed = Math.random() * 0.01 + 0.003;
        this.color = Math.random() > 0.5
          ? 'rgba(35, 56, 43, 0.03)'
          : 'rgba(200, 125, 85, 0.02)';
        this.particles = [];
      }

      update() {
        this.pulsePhase += this.pulseSpeed;
        const animatedHeight = this.heightVal + Math.sin(this.pulsePhase) * 10;

        ctx.fillStyle = this.color;
        ctx.fillRect(this.x - this.width / 2, H - animatedHeight, this.width, animatedHeight);

        ctx.strokeStyle = this.color.replace('0.03', '0.15').replace('0.02', '0.15');
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(this.x - this.width / 2, H - animatedHeight);
        ctx.lineTo(this.x + this.width / 2, H - animatedHeight);
        ctx.stroke();

        if (Math.random() > 0.96 && this.particles.length < 10) {
          this.particles.push({
            px: this.x + (Math.random() - 0.5) * this.width,
            py: H - animatedHeight,
            size: Math.random() * 1.2 + 0.4,
            speedY: Math.random() * 0.4 + 0.2,
            opacity: 0.5
          });
        }

        this.particles.forEach((p, idx) => {
          p.py -= p.speedY;
          p.opacity -= 0.0025;

          ctx.beginPath();
          ctx.arc(p.px, p.py, p.size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(200, 125, 85, ${p.opacity})`;
          ctx.fill();

          if (p.opacity <= 0) {
            this.particles.splice(idx, 1);
          }
        });
      }
    }

    function initPillars() {
      pillars = [];
      const segment = W / (pillarCount + 1);
      for (let i = 1; i <= pillarCount; i++) {
        const x = segment * i + (Math.random() - 0.5) * 20;
        const width = Math.random() * 40 + 40;
        pillars.push(new Pillar(x, width));
      }
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      pillars.forEach(p => p.update());
      requestAnimationFrame(draw);
    }

    resize();
    draw();

    window.addEventListener('resize', () => {
      W = canvas.width = canvas.offsetWidth;
      H = canvas.height = canvas.offsetHeight;
    });
  }

  /* ─── DYNAMIC STATISTICS COMPUTATIONS ────────── */
  function calculateSystemStats() {
    try {
      const problems = getProblems();
      const solvers = getSolvers();

      // Pending Review (status: 'Pending Review')
      const pendingReviews = problems.filter(p => p.status === 'Pending Review').length;
      // Pending Verification / Closed by Owner (status: 'Closed by Owner')
      const pendingVerifications = problems.filter(p => p.status === 'Closed by Owner').length;
      // Total Solved
      const solvedProblems = problems.filter(p => p.status === 'Solved').length;
      // Total published challenges (excluding pending reviews)
      const totalChallenges = problems.filter(p => p.status !== 'Pending Review').length;
      
      const resolutionRate = totalChallenges > 0 ? Math.round((solvedProblems / totalChallenges) * 100) : 0;
      const totalSolvers = solvers.length;
      const totalXP = solvers.reduce((sum, s) => sum + Number(s.points || s.stats?.totalImpactPoints || 0), 0);

      // Update DOM
      const statPendingReviewsEl = document.getElementById('statPendingReviews');
      const statPendingVerificationsEl = document.getElementById('statPendingVerifications');
      const statResolutionRateEl = document.getElementById('statResolutionRate');
      const statTotalSolvedEl = document.getElementById('statTotalSolved');
      const statTotalSolversEl = document.getElementById('statTotalSolvers');
      const statTotalXPEl = document.getElementById('statTotalXP');

      const badgePendingCountEl = document.getElementById('badgePendingCount');
      const badgeVerificationCountEl = document.getElementById('badgeVerificationCount');

      if (statPendingReviewsEl) statPendingReviewsEl.textContent = pendingReviews;
      if (statPendingVerificationsEl) statPendingVerificationsEl.textContent = pendingVerifications;
      if (statResolutionRateEl) statResolutionRateEl.textContent = `${resolutionRate}%`;
      if (statTotalSolvedEl) statTotalSolvedEl.textContent = `${solvedProblems} Solved`;
      if (statTotalSolversEl) statTotalSolversEl.textContent = totalSolvers;
      if (statTotalXPEl) statTotalXPEl.textContent = `${totalXP.toLocaleString()} XP`;

      if (badgePendingCountEl) badgePendingCountEl.textContent = pendingReviews;
      if (badgeVerificationCountEl) badgeVerificationCountEl.textContent = pendingVerifications;

      // Pulse verifications badge if action is required
      const verBadge = document.getElementById('statPendingVerificationsBadge');
      if (verBadge) {
        if (pendingVerifications > 0) {
          verBadge.textContent = '';
          verBadge.className = 'stat-trend trend-warning';
        } else {
          verBadge.textContent = '';
          verBadge.className = 'stat-trend trend-neutral';
        }
      }
    } catch (err) {
      console.error('Failed to compute system statistics:', err);
    }
  }

  /* ─── TAB NAVIGATION SWITCHING ────────────── */
  function initTabNavigation() {
    const tabButtons = document.querySelectorAll('.nav-tab-btn');
    const tabPanels = document.querySelectorAll('.console-tab-panel');
    const activeTabTitle = document.getElementById('activeTabTitle');

    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');

        tabButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        tabPanels.forEach(p => p.classList.remove('active'));
        const targetPanel = document.getElementById(`panel-${targetTab}`);
        if (targetPanel) targetPanel.classList.add('active');

        if (activeTabTitle) {
          activeTabTitle.textContent = btn.querySelector('.tab-label').textContent;
        }

        // Trigger dynamic loads based on tab selection
        if (targetTab === 'review') {
          loadReviewQueue();
        } else if (targetTab === 'verification') {
          loadVerificationQueue();
        } else if (targetTab === 'solvers') {
          loadSolversLedger();
        } else if (targetTab === 'logs') {
          renderSystemLogs();
        }

        ScrollTrigger.refresh();
      });
    });
  }

  /* ─── TAB 1: OPERATIONAL REVIEW QUEUE ──────── */
  function loadReviewQueue() {
    const masterList = document.getElementById('reviewMasterList');
    const emptyPlaceholder = document.getElementById('reviewQueueEmpty');
    const detailUnselected = document.getElementById('detailUnselectedState');
    const detailForm = document.getElementById('detailEditorForm');
    const subtitleCount = document.getElementById('masterQueueCount');

    if (!masterList) return;

    masterList.innerHTML = '';
    activeProblemId = null;

    if (detailForm) detailForm.style.display = 'none';
    if (detailUnselected) detailUnselected.style.display = 'flex';

    try {
      const allProblems = getProblems();
      
      // Filter out problems that are NOT 'Pending Review'
      let pendingProblems = allProblems.filter(p => p.status === 'Pending Review');

      // Apply Search Filter
      const searchVal = document.getElementById('frictionListSearch').value.toLowerCase().trim();
      const catVal = document.getElementById('frictionCategoryFilter').value;

      if (searchVal) {
        pendingProblems = pendingProblems.filter(p => 
          p.title.toLowerCase().includes(searchVal) || 
          p.friction.toLowerCase().includes(searchVal)
        );
      }

      // Apply Category Filter
      if (catVal !== 'all') {
        pendingProblems = pendingProblems.filter(p => p.category === catVal);
      }

      if (subtitleCount) {
        subtitleCount.textContent = `${pendingProblems.length} pending review`;
      }

      if (pendingProblems.length > 0) {
        if (emptyPlaceholder) emptyPlaceholder.style.display = 'none';
        masterList.style.display = 'block';

        pendingProblems.forEach(prob => {
          const item = document.createElement('div');
          item.className = 'master-queue-item';
          item.setAttribute('data-id', prob.id);

          const categoryClassMap = {
            'Education': 'edu',
            'Technical': 'tech',
            'Environmental': 'env',
            'Community': 'comm'
          };
          const catClass = categoryClassMap[prob.category] || 'tech';

          item.innerHTML = `
            <div class="item-header-meta">
            <span class="item-meta-author">${esc(prob.date)}</span>
            <span class="category-mini-tag ${catClass}">${esc(prob.category)}</span>
          </div>
            <h4 class="item-title-text">${esc(prob.title)}</h4>
            <p class="item-snippet">${esc(prob.friction)}</p>
          `;

          item.addEventListener('click', () => {
            document.querySelectorAll('.master-queue-item').forEach(el => el.classList.remove('selected'));
            item.classList.add('selected');
            loadFrictionDetails(prob);
          });

          masterList.appendChild(item);
        });
      } else {
        if (emptyPlaceholder) emptyPlaceholder.style.display = 'block';
        masterList.style.display = 'none';
      }
    } catch (err) {
      console.error('Failed to load review queue:', err);
    }
  }

  function loadFrictionDetails(prob) {
    const detailUnselected = document.getElementById('detailUnselectedState');
    const detailForm = document.getElementById('detailEditorForm');

    if (!detailForm || !detailUnselected) return;

    detailUnselected.style.display = 'none';
    detailForm.style.display = 'block';

    activeProblemId = prob.id;

    // Set fields
    document.getElementById('detailAuthor').innerHTML = `Draft Case ID: <strong style="color: var(--accent-clay);">${esc(prob.id)}</strong>`;
    document.getElementById('detailDate').textContent = prob.date;

    const catTag = document.getElementById('detailCategoryTag');
    catTag.textContent = prob.category;
    catTag.className = 'category-tag ' + (prob.category === 'Education' ? 'edu' : prob.category === 'Technical' ? 'tech' : prob.category === 'Environmental' ? 'env' : 'comm');

    document.getElementById('editTitle').value = prob.title;
    document.getElementById('editFriction').value = prob.friction;
    document.getElementById('editTried').value = prob.tried;
    document.getElementById('editRipple').value = prob.ripple;

    // Pre-populate resolution story text field - used only as seed resolution when published
    document.getElementById('editResolution').value = prob.resolution || '';
  }

  function initReviewActions() {
    // Search and Category triggers
    const searchInput = document.getElementById('frictionListSearch');
    const catSelect = document.getElementById('frictionCategoryFilter');

    if (searchInput) {
      searchInput.addEventListener('input', loadReviewQueue);
    }
    if (catSelect) {
      catSelect.addEventListener('change', loadReviewQueue);
    }

    // Publish Button
    const publishBtn = document.getElementById('btnPublishFriction');
    if (publishBtn) {
      publishBtn.addEventListener('click', async () => {
        if (!activeProblemId) return;

        const title = document.getElementById('editTitle').value.trim();
        const friction = document.getElementById('editFriction').value.trim();
        const tried = document.getElementById('editTried').value.trim();
        const ripple = document.getElementById('editRipple').value.trim();

        if (title.length < 5 || friction.length < 20) {
          alert('Audit Error: Please write a descriptive title (min 5 characters) and a detailed friction wall (min 20 characters).');
          return;
        }

        try {
          const allProblems = getProblems();
          let publishedProblem = null;
          const updatedProblems = allProblems.map(p => {
            if (p.id === activeProblemId) {
              publishedProblem = {
                ...p,
                title: title,
                friction: friction,
                tried: tried,
                ripple: ripple,
                status: 'Open',
                contributors: p.contributors || []
              };
              return publishedProblem;
            }
            return p;
          });

          window.TWS.memory.problems = updatedProblems;
          if (publishedProblem) await saveProblemToFirestore(publishedProblem);
          logSystemActivity('AUDIT', `Approved & published friction "${title}" to the public timeline as an Open Challenge.`);
          alert('Friction successfully audited and published as an Open Challenge!');

          // GSAP slide and fade out card
          const cardEl = document.querySelector(`.master-queue-item[data-id="${activeProblemId}"]`);
          if (cardEl) {
            gsap.to(cardEl, {
              opacity: 0,
              x: 40,
              duration: 0.4,
              onComplete: () => {
                calculateSystemStats();
                loadReviewQueue();
              }
            });
          } else {
            calculateSystemStats();
            loadReviewQueue();
          }
        } catch (err) {
          console.error('Failed to publish friction:', err);
        }
      });
    }

    // Flag / Clarify Button
    const flagBtn = document.getElementById('btnFlagFriction');
    if (flagBtn) {
      flagBtn.addEventListener('click', () => {
        if (!activeProblemId) return;
        alert(`Friction ${activeProblemId} has been flagged for clarification. In a production build, this sends a revision request to the author.`);
        logSystemActivity('AUDIT', `Flagged friction ID ${activeProblemId} for author revision.`);
      });
    }

    // Delete Submission Button
    const deleteBtn = document.getElementById('btnDeleteFriction');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', async () => {
        if (!activeProblemId) return;

        if (confirm('Are you sure you want to delete this voiced friction submission? This action is permanent.')) {
          try {
            await deleteProblemFromFirestore(activeProblemId);
            logSystemActivity('AUDIT', `Deleted spam/inappropriate friction submission ID ${activeProblemId}.`);

            const cardEl = document.querySelector(`.master-queue-item[data-id="${activeProblemId}"]`);
            if (cardEl) {
              gsap.to(cardEl, {
                opacity: 0,
                x: -40,
                duration: 0.4,
                onComplete: () => {
                  calculateSystemStats();
                  loadReviewQueue();
                }
              });
            } else {
              calculateSystemStats();
              loadReviewQueue();
            }
          } catch (err) {
            console.error('Failed to delete friction:', err);
          }
        }
      });
    }
  }

  /* ─── TAB 2: DYNAMIC VERIFICATION AUDITS ──────── */
  function loadVerificationQueue() {
    const grid = document.getElementById('verificationCardsGrid');
    const emptyPlaceholder = document.getElementById('verificationQueueEmpty');

    if (!grid) return;
    grid.innerHTML = '';

    try {
      const allProblems = getProblems();
      const pendingClosures = allProblems.filter(p => p.status === 'Closed by Owner');

      if (pendingClosures.length > 0) {
        if (emptyPlaceholder) emptyPlaceholder.style.display = 'none';
        grid.style.display = 'block';

        pendingClosures.forEach(prob => {
          const card = document.createElement('div');
          card.className = 'audit-card';
          card.setAttribute('data-id', prob.id);

          // Complexity Point Calculation Guidelines
          let suggestedPoints = 100;
          if (prob.complexity === 'Medium') suggestedPoints = 200;
          if (prob.complexity === 'High') suggestedPoints = 400;

          card.innerHTML = `
            <div class="audit-card-header">
              <div>
                <span class="audit-category">${esc(prob.category)} Systems</span>
                <h4 class="audit-title">${esc(prob.title)}</h4>
              </div>
              <span class="complexity-indicator ${esc(prob.complexity).toLowerCase()}">${esc(prob.complexity)} Complexity</span>
            </div>
            
            <div class="audit-meta-row" style="flex-wrap: wrap; gap: 15px; font-size: 12.5px; border-bottom: 1px dashed var(--border-light); padding-bottom: 12px; margin-bottom: 12px;">
              <span>Problem Owner: <strong>${esc(prob.solver || 'Unknown')}</strong></span>
              <span>Selected Solver (Winner): <strong style="color: var(--accent-moss);">${esc(prob.solvedBy)}</strong></span>
              <span>Other Attempted Contributors: <strong>${esc(prob.contributors.filter(c => c !== prob.solvedBy).join(', ') || 'None')}</strong></span>
            </div>

            <div class="verification-card-detail-box">
              <span style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--accent-clay); display: block; margin-bottom: 4px;">Friction Context:</span>
              ${esc(prob.friction)}
            </div>
            
            <div class="verification-card-resolution">
              <span style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--accent-moss); display: block; margin-bottom: 4px;">Owner's Resolution Review & Feedback:</span>
              "${esc(prob.ownerReview || 'No review written.')}"
            </div>

            <div style="display: flex; gap: 20px; align-items: center; margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--border-light); flex-wrap: wrap;">
              <div class="editor-field-group" style="margin: 0; flex: 1; min-width: 150px;">
                <label class="editor-label" style="font-size: 10px; margin-bottom: 4px;">Winner Award XP (${esc(prob.solvedBy)})</label>
                <input type="number" class="editor-input val-winner-xp" value="${suggestedPoints}" style="padding: 8px 12px; font-size: 13px;" />
              </div>
              <div class="editor-field-group" style="margin: 0; flex: 1; min-width: 150px;">
                <label class="editor-label" style="font-size: 10px; margin-bottom: 4px;">Participant XP (Attempts)</label>
                <input type="number" class="editor-input val-attempt-xp" value="40" style="padding: 8px 12px; font-size: 13px;" />
              </div>
              
              <div class="audit-action-footer" style="display: flex; gap: 8px; flex: 2; min-width: 250px; justify-content: flex-end; margin-top: 15px;">
                <button class="btn btn-outline btn-sm btn-danger btn-reject-solution" style="padding: 8px 16px; font-size: 12px;">Reject & Re-open</button>
                <button class="btn btn-primary btn-sm btn-approve-solution" style="padding: 8px 16px; font-size: 12px;">Finalize & Award XP</button>
              </div>
            </div>
          `;

          // Approve Event
          card.querySelector('.btn-approve-solution').addEventListener('click', () => {
            const winXP = parseInt(card.querySelector('.val-winner-xp').value) || 0;
            const attXP = parseInt(card.querySelector('.val-attempt-xp').value) || 0;
            finalizeSolutionAudit(prob.id, winXP, attXP, card);
          });

          // Reject Event
          card.querySelector('.btn-reject-solution').addEventListener('click', () => {
            rejectSolutionAudit(prob.id, card);
          });

          grid.appendChild(card);
        });
      } else {
        if (emptyPlaceholder) emptyPlaceholder.style.display = 'block';
        grid.style.display = 'none';
      }
    } catch (err) {
      console.error('Failed to load verification audits:', err);
    }
  }

  async function finalizeSolutionAudit(problemId, winnerXP, attemptXP, cardElement) {
    try {
      const problems = getProblems();
      const solvers = getSolvers();

      let winnerName = '';
      let attemptsList = [];
      let challengeTitle = '';

      // Update problem status to Solved and record final point distribution
      let finalizedProblem = null;
      const updatedProblems = problems.map(p => {
        if (p.id === problemId) {
          winnerName = p.solvedBy;
          attemptsList = p.contributors.filter(c => c !== p.solvedBy);
          challengeTitle = p.title;

          finalizedProblem = {
            ...p,
            status: 'Solved',
            winnerXP: winnerXP,
            attemptXP: attemptXP,
            clones: p.clones + Math.floor(Math.random() * 5) + 3,
            views: p.views + Math.floor(Math.random() * 50) + 20
          };
          return finalizedProblem;
        }
        return p;
      });

      // Award XP in Solvers ledger
      const updatedSolvers = solvers.map(s => {
        // Winner gets high points and solved count +1
        if (s.name === winnerName) {
          return {
            ...s,
            points: s.points + winnerXP,
            solved: s.solved + 1
          };
        }
        // Attempted contributors get flat participation points
        if (attemptsList.includes(s.name)) {
          return {
            ...s,
            points: s.points + attemptXP
          };
        }
        return s;
      });

      // Persist updates
      window.TWS.memory.problems = updatedProblems;
      window.TWS.memory.users = updatedSolvers;
      if (finalizedProblem) await saveProblemToFirestore(finalizedProblem);
      await Promise.all(updatedSolvers.map(saveSolverToFirestore));

      logSystemActivity('AUDIT', `Finalized audit for "${challengeTitle}". Awarded +${winnerXP} XP to solver "${winnerName}" (Winner) and +${attemptXP} XP to participants [${attemptsList.join(', ') || 'None'}].`);
      alert(`Challenge successfully finalized!\n- ${winnerName} awarded +${winnerXP} XP\n- Participants awarded +${attemptXP} XP`);

      // GSAP slide out card
      gsap.to(cardElement, {
        opacity: 0,
        y: -30,
        duration: 0.4,
        onComplete: () => {
          calculateSystemStats();
          loadVerificationQueue();
        }
      });
    } catch (err) {
      console.error('Failed to finalize solution audit:', err);
    }
  }

  async function rejectSolutionAudit(problemId, cardElement) {
    if (!confirm('Are you sure you want to reject this solution draft and re-open the challenge? The status will revert to "Open" and solvers will need to re-attempt.')) {
      return;
    }

    try {
      const problems = getProblems();
      let challengeTitle = '';

      let rejectedProblem = null;
      const updatedProblems = problems.map(p => {
        if (p.id === problemId) {
          challengeTitle = p.title;
          rejectedProblem = {
            ...p,
            status: 'Open', // Revert back to Open challenge
            solvedBy: '',
            complexity: '',
            ownerReview: '',
            winnerXP: 0,
            attemptXP: 0
          };
          return rejectedProblem;
        }
        return p;
      });

      window.TWS.memory.problems = updatedProblems;
      if (rejectedProblem) await saveProblemToFirestore(rejectedProblem);
      logSystemActivity('AUDIT', `Rejected closure for "${challengeTitle}". Reverted status back to Open Challenge.`);
      alert('Closure rejected. The challenge has been re-opened for community contributors.');

      // GSAP slide out card
      gsap.to(cardElement, {
        opacity: 0,
        x: -40,
        duration: 0.4,
        onComplete: () => {
          calculateSystemStats();
          loadVerificationQueue();
        }
      });
    } catch (err) {
      console.error('Failed to reject solution audit:', err);
    }
  }

  /* ─── TAB 3: DYNAMIC SOLVERS LEDGER MANAGEMENT ── */
  function loadSolversLedger() {
    const listContainer = document.getElementById('solversCompactList');
    const searchInput = document.getElementById('solverListSearch');
    const sortSelect = document.getElementById('solverSortSelect');
    const recruitBtn = document.getElementById('btnRecruitSolver');

    if (!listContainer) return;

    resetSolverEditor();

    renderSolversList();

    // Attach search event
    if (searchInput) {
      searchInput.removeEventListener('input', renderSolversList);
      searchInput.addEventListener('input', renderSolversList);
    }

    // Attach sort event
    if (sortSelect) {
      sortSelect.removeEventListener('change', renderSolversList);
      sortSelect.addEventListener('change', renderSolversList);
    }

    // Recruit Solver click
    if (recruitBtn) {
      recruitBtn.removeEventListener('click', triggerRecruitMode);
      recruitBtn.addEventListener('click', triggerRecruitMode);
    }
  }

  function renderSolversList() {
    const listContainer = document.getElementById('solversCompactList');
    const searchVal = document.getElementById('solverListSearch').value.toLowerCase().trim();
    const sortVal = document.getElementById('solverSortSelect').value;

    if (!listContainer) return;
    listContainer.innerHTML = '';

    try {
      let solvers = getSolvers();

      // Filter
      if (searchVal) {
        solvers = solvers.filter(s => 
          String(s.name || s.displayName || '').toLowerCase().includes(searchVal) ||
          String(s.role || '').toLowerCase().includes(searchVal) ||
          String(s.specialty || '').toLowerCase().includes(searchVal)
        );
      }

      // Sort
      if (sortVal === 'points-desc') {
        solvers.sort((a, b) => Number(b.points || b.stats?.totalImpactPoints || 0) - Number(a.points || a.stats?.totalImpactPoints || 0));
      } else if (sortVal === 'points-asc') {
        solvers.sort((a, b) => Number(a.points || a.stats?.totalImpactPoints || 0) - Number(b.points || b.stats?.totalImpactPoints || 0));
      } else if (sortVal === 'name-asc') {
        solvers.sort((a, b) => String(a.name || a.displayName || '').localeCompare(String(b.name || b.displayName || '')));
      }

      solvers.forEach(solver => {
        const row = document.createElement('div');
        row.className = 'solver-list-row';
        row.setAttribute('data-id', solver.id);
        if (activeSolverId === solver.id && !isRecruitingMode) {
          row.classList.add('selected');
        }

        row.innerHTML = `
          <div class="row-avatar">${esc(solver.initials || window.TWS.initialsFromName(solver.name || solver.displayName))}</div>
          <div class="row-info">
            <span class="row-name">${esc(solver.name || solver.displayName)}</span>
            <span class="row-xp">${esc(solver.role)}</span>
          </div>
          <span class="row-solved-badge">${Number(solver.points || solver.stats?.totalImpactPoints || 0).toLocaleString()} XP</span>
        `;

        row.addEventListener('click', () => {
          isRecruitingMode = false;
          document.querySelectorAll('.solver-list-row').forEach(el => el.classList.remove('selected'));
          row.classList.add('selected');
          loadSolverProfileForm(solver);
        });

        listContainer.appendChild(row);
      });
    } catch (err) {
      console.error('Failed to render solvers list:', err);
    }
  }

  function resetSolverEditor() {
    activeSolverId = null;
    isRecruitingMode = false;

    const profileForm = document.getElementById('solverProfileForm');
    const profileUnselected = document.getElementById('solverUnselectedState');
    if (profileForm) profileForm.style.display = 'none';
    if (profileUnselected) {
      profileUnselected.style.display = 'flex';
      profileUnselected.querySelector('h3').textContent = 'Select a Solver';
      profileUnselected.querySelector('p').textContent = 'Choose a solver from the directory to adjust their impact points, manage their specialties, or award custom badges of empathy.';
    }
  }

  function triggerRecruitMode() {
    isRecruitingMode = true;
    activeSolverId = null;

    document.querySelectorAll('.solver-list-row').forEach(el => el.classList.remove('selected'));

    const profileForm = document.getElementById('solverProfileForm');
    const profileUnselected = document.getElementById('solverUnselectedState');

    if (!profileForm || !profileUnselected) return;

    profileUnselected.style.display = 'none';
    profileForm.style.display = 'block';

    // Set Header to Creation Mode
    document.getElementById('profileName').textContent = 'Recruit Contributor';
    document.getElementById('profileRole').textContent = 'New Solver Registration';
    document.getElementById('profileInitials').textContent = '+';

    // Clear Inputs
    document.getElementById('editSolverPoints').value = 0;
    document.getElementById('editSolverSolved').value = 0;
    document.getElementById('editSolverSpecialty').value = '';

    // Clear Checkboxes
    const checkBoxes = document.querySelectorAll('input[name="badges"]');
    checkBoxes.forEach(cb => cb.checked = false);

    // Dynamic insertion of name field for recruitment
    let nameFieldGroup = document.getElementById('recruitNameFieldGroup');
    if (!nameFieldGroup) {
      nameFieldGroup = document.createElement('div');
      nameFieldGroup.id = 'recruitNameFieldGroup';
      nameFieldGroup.className = 'editor-field-group span-full';
      nameFieldGroup.innerHTML = `
        <label for="editSolverName" class="editor-label">Full Display Name</label>
        <input type="text" id="editSolverName" class="editor-input" placeholder="e.g., Jane Doe" />
      `;
      const grid = document.querySelector('.solver-edit-grid');
      if (grid) grid.insertBefore(nameFieldGroup, grid.firstChild);
    } else {
      nameFieldGroup.style.display = 'block';
      document.getElementById('editSolverName').value = '';
    }

    // Hide Delete Solver button during recruitment
    const deleteBtn = document.getElementById('btnDeleteSolver');
    if (deleteBtn) deleteBtn.style.display = 'none';
  }

  function loadSolverProfileForm(solver) {
    const profileForm = document.getElementById('solverProfileForm');
    const profileUnselected = document.getElementById('solverUnselectedState');

    if (!profileForm || !profileUnselected) return;

    profileUnselected.style.display = 'none';
    profileForm.style.display = 'block';

    activeSolverId = solver.id;

    // Set Header
    document.getElementById('profileName').textContent = solver.name;
    document.getElementById('profileRole').textContent = solver.role;
    document.getElementById('profileInitials').textContent = solver.initials;

    // Set Inputs
    document.getElementById('editSolverPoints').value = solver.points;
    document.getElementById('editSolverSolved').value = solver.solved;
    document.getElementById('editSolverSpecialty').value = solver.specialty;

    // Set Checkboxes
    const checkBoxes = document.querySelectorAll('input[name="badges"]');
    checkBoxes.forEach(cb => {
      cb.checked = solver.badges.includes(cb.value);
    });

    // Hide Recruitment Name field if visible
    const nameFieldGroup = document.getElementById('recruitNameFieldGroup');
    if (nameFieldGroup) nameFieldGroup.style.display = 'none';

    // Show Delete Solver button
    const deleteBtn = document.getElementById('btnDeleteSolver');
    if (deleteBtn) deleteBtn.style.display = 'block';
  }

  function initSolverActions() {
    const saveBtn = document.getElementById('btnSaveSolver');
    const deleteBtn = document.getElementById('btnDeleteSolver');

    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        const solvers = getSolvers();
        const points = parseInt(document.getElementById('editSolverPoints').value) || 0;
        const solved = parseInt(document.getElementById('editSolverSolved').value) || 0;
        const specialty = document.getElementById('editSolverSpecialty').value.trim() || 'General Helping';

        // Collect checked badges
        const checkedBadges = [];
        document.querySelectorAll('input[name="badges"]:checked').forEach(cb => {
          checkedBadges.push(cb.value);
        });

        if (isRecruitingMode) {
          // Recruitment saving
          const nameInput = document.getElementById('editSolverName');
          const name = nameInput ? nameInput.value.trim() : '';

          if (name.length < 3) {
            alert('Ledger Error: Please provide a valid full name (minimum 3 characters) for the new contributor.');
            return;
          }

          // Generate initials and role
          const parts = name.split(' ');
          let initials = '';
          if (parts.length > 0) initials += parts[0].charAt(0).toUpperCase();
          if (parts.length > 1) initials += parts[1].charAt(0).toUpperCase();
          if (!initials) initials = 'CO';

          const newId = 'sol_' + Date.now();
          const newSolver = {
            id: newId,
            name: name,
            role: 'Contributor',
            specialty: specialty,
            points: points,
            solved: solved,
            initials: initials,
            badges: checkedBadges
          };

          window.TWS.memory.users = solvers.concat(newSolver);
          await saveSolverToFirestore(newSolver);
          logSystemActivity('LEDGER', `Recruited new community contributor "${name}" (${initials}) with specialty: "${specialty}".`);
          alert(`Contributor ${name} has been successfully added to the solvers directory!`);

          isRecruitingMode = false;
          activeSolverId = newId;

          // Re-render
          calculateSystemStats();
          renderSolversList();
          loadSolverProfileForm(newSolver);
        } else {
          // Normal profile saving
          if (!activeSolverId) return;

          const updatedSolvers = solvers.map(s => {
            if (s.id === activeSolverId) {
              return {
                ...s,
                points: points,
                solved: solved,
                specialty: specialty,
                badges: checkedBadges
              };
            }
            return s;
          });

          window.TWS.memory.users = updatedSolvers;
          const updatedSolver = updatedSolvers.find(s => s.id === activeSolverId);
          if (updatedSolver) await saveSolverToFirestore(updatedSolver);
          logSystemActivity('LEDGER', `Updated profile stats for solver ID ${activeSolverId} (${points} XP, ${solved} solved).`);
          alert('Solver profile updated in ledger registry.');

          calculateSystemStats();
          renderSolversList();
        }
      });
    }

    if (deleteBtn) {
      deleteBtn.addEventListener('click', async () => {
        if (!activeSolverId) return;

        if (confirm('Are you sure you want to remove this solver from the community directory? Their historical contributions will remain, but they will be deleted from the leaderboard rankings.')) {
          try {
            const solvers = getSolvers();
            const targetSolver = solvers.find(s => s.id === activeSolverId);
            const updatedSolvers = solvers.filter(s => s.id !== activeSolverId);

            window.TWS.memory.users = updatedSolvers;
            logSystemActivity('LEDGER', `De-registered contributor "${targetSolver ? targetSolver.name : activeSolverId}" from the ledger.`);
            alert('Contributor de-registered from the registry.');

            resetSolverEditor();
            calculateSystemStats();
            renderSolversList();
          } catch (err) {
            console.error('Failed to delete solver:', err);
          }
        }
      });
    }
  }

  /* ─── TAB 4: SYSTEM SETTINGS & DATABASE CONTROL ── */
  async function initSettingsForm() {
    const form = document.getElementById('settingsForm');
    if (!form) return;

    // Load constraints
    try {
      let settings = await window.TWS.loadSettings({
        baseFrictionXP: 50,
        baseSolutionXP: 150,
        minTitleLen: 8,
        minFrictionLen: 40,
        encouragementLevel: 'medium'
      });
      document.getElementById('setBaseFrictionXP').value = settings.baseFrictionXP;
      document.getElementById('setBaseSolutionXP').value = settings.baseSolutionXP;
      document.getElementById('setMinTitleLen').value = settings.minTitleLen;
      document.getElementById('setMinFrictionLen').value = settings.minFrictionLen;
      document.getElementById('setEncouragementLevel').value = settings.encouragementLevel;
    } catch (_) {}

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const baseFrictionXP = parseInt(document.getElementById('setBaseFrictionXP').value) || 50;
      const baseSolutionXP = parseInt(document.getElementById('setBaseSolutionXP').value) || 150;
      const minTitleLen = parseInt(document.getElementById('setMinTitleLen').value) || 8;
      const minFrictionLen = parseInt(document.getElementById('setMinFrictionLen').value) || 40;
      const encouragementLevel = document.getElementById('setEncouragementLevel').value;

      const newSettings = {
        baseFrictionXP,
        baseSolutionXP,
        minTitleLen,
        minFrictionLen,
        encouragementLevel
      };

      try {
        await window.TWS.saveSettings(newSettings);
        logSystemActivity('SYSTEM', 'Saved new global community XP weights and form validation parameters.');
        alert('System configurations successfully saved!');
      } catch (err) {
        console.error('Failed to save settings:', err);
      }
    });

    // Database Actions: Export
    const exportBtn = document.getElementById('btnExportDB');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        try {
          const dbData = {
            problems: getProblems(),
            users: getSolvers(),
            settings: window.TWS.memory.settings || {},
            logs: window.TWS.memory.logs || []
          };

          const jsonString = JSON.stringify(dbData, null, 2);
          const blob = new Blob([jsonString], { type: 'application/json' });
          const url = URL.createObjectURL(blob);

          const link = document.createElement('a');
          const today = new Date().toISOString().slice(0, 10);
          link.download = `together-we-solve-backup-${today}.json`;
          link.href = url;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);

          logSystemActivity('DATABASE', 'Exported current Firestore snapshot as JSON backup.');
        } catch (err) {
          alert('Database Export Error: ' + err.message);
        }
      });
    }

    // Database Actions: Import
    const fileInput = document.getElementById('importDBFile');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async function (event) {
          try {
            const data = JSON.parse(event.target.result);

            // Validation checks
            const importedUsers = data.users || data.solvers;
            if (!data.problems || !Array.isArray(data.problems) || !Array.isArray(importedUsers)) {
              throw new Error('Invalid file structure: Missing "problems" and "users" arrays.');
            }

            await Promise.all(data.problems.map((problem) => window.TWS.saveProblem(problem)));
            await Promise.all(importedUsers.map(saveSolverToFirestore));
            if (data.settings) await window.TWS.saveSettings(data.settings);

            logSystemActivity('DATABASE', `Imported Firestore data from backup file: "${file.name}".`);
            alert('Database successfully imported into Firestore.');

            window.location.reload();
          } catch (err) {
            alert('Database Restore Failed: ' + err.message);
          }
        };
        reader.readAsText(file);
      });
    }

    // Database Actions: Reset
    const resetBtn = document.getElementById('btnResetDB');
    if (resetBtn) {
      resetBtn.addEventListener('click', async () => {
        if (confirm('CRITICAL WARNING: Are you sure you want to reset the entire database to clean system defaults? This will erase all custom submissions, solver modifications, and log history.')) {
          try {
            await Promise.all(defaultProblems.map((problem) => window.TWS.saveProblem(problem)));
            await Promise.all(defaultSolvers.map(saveSolverToFirestore));
            
            logSystemActivity('DATABASE', 'Wiped database registries and seeded factory defaults.');
            alert('System reset complete! Factory defaults seeded.');
            
            window.location.reload();
          } catch (err) {
            alert('Wipe operation failed: ' + err.message);
          }
        }
      });
    }
  }

  /* ─── SIGN OUT PORTAL ──────────────────────── */
  function initRoleAssignment() {
    const assignBtn = document.getElementById('btnAssignRole');
    if (!assignBtn) return;

    const emailInput = document.getElementById('roleAssignEmail');
    const nameInput = document.getElementById('roleAssignName');
    const roleInput = document.getElementById('roleAssignRole');
    const statusEl = document.getElementById('roleAssignStatus');

    const setStatus = (message, isError = false) => {
      if (!statusEl) return;
      statusEl.textContent = message;
      statusEl.style.color = isError ? '#b91c1c' : '#166534';
    };

    assignBtn.addEventListener('click', async () => {
      const email = emailInput?.value.trim();
      const displayName = nameInput?.value.trim();
      const role = roleInput?.value;

      if (!email || !role) {
        setStatus('Enter an email and select a role before assigning access.', true);
        return;
      }

      if (!window.TWSAccess?.setRoleAssignment) {
        setStatus('Firebase access module is not ready. Refresh and try again.', true);
        return;
      }

      assignBtn.disabled = true;
      setStatus('Saving role assignment...');

      try {
        const result = await window.TWSAccess.setRoleAssignment({ email, displayName, role });
        setStatus(`${result.role} access saved for ${result.email}.`);
        logSystemActivity('SYSTEM', `Assigned ${result.role} privileges to ${result.email}.`);
      } catch (err) {
        console.error('Role assignment failed:', err);
        setStatus(err.message || 'Role assignment failed.', true);
      } finally {
        assignBtn.disabled = false;
      }
    });
  }

  function initSignOut() {
    const signOutBtn = document.getElementById('signOutBtn');
    if (!signOutBtn) return;

    signOutBtn.addEventListener('click', () => {
      sessionStorage.removeItem('portal_session');
      
      gsap.to('.admin-app-shell', {
        opacity: 0,
        scale: 0.98,
        duration: 0.4,
        ease: 'power2.in',
        onComplete: () => {
          window.location.href = 'login.html';
        }
      });
    });
  }

  /* ─── FACTORY SEEDING ON LOAD ────────────────── */
  async function ensureSeededDatabase() {
    try {
      if (window.TWS?.loadProblemsAsync) {
        await window.TWS.loadProblemsAsync(defaultProblems);
      }
      if (window.TWS?.loadMovementMembersAsync) {
        await window.TWS.loadMovementMembersAsync(defaultSolvers);
      }
    } catch (err) {
      console.error('Failed to seed database:', err);
    }
  }

  /* ─── INIT ─────────────────────────────────── */
  async function init() {
    gsap.registerPlugin(ScrollTrigger);

    checkSession();
    await ensureSeededDatabase();
    initPillarCanvas();
    calculateSystemStats();
    initTabNavigation();
    loadReviewQueue();
    initReviewActions();
    loadVerificationQueue();
    loadSolversLedger();
    initSolverActions();
    await initSettingsForm();
    initRoleAssignment();
    initLogsControls();
    initSignOut();

    // Console entrance animation
    gsap.from('.admin-app-shell', {
      opacity: 0,
      duration: 0.8,
      ease: 'power3.out'
    });
  }

  document.addEventListener('DOMContentLoaded', init);

})();
