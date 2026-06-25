/* =======================================================
   TOGETHER WE SOLVE — js/user-settings.js
   Private User Settings & Workspace JS Controller
   ======================================================= */

(function () {
  'use strict';
  const esc = window.TWS.escapeHTML;

  let currentUserSession = null;
  let currentUserProfile = null;
  let activeVerificationProblemId = null;

  // Default seed list if empty (fallback)
  const defaultSolvers = [
    { id: 'sol_1', name: 'Elena Rostova', role: 'The Bridge Builder', specialty: 'Technical Systems & Language', points: 4850, solved: 12, initials: 'ER', badges: ['Golden Heart', 'Deep Thinker'] },
    { id: 'sol_2', name: 'Marcus Vance', role: 'The Catalyst', specialty: 'Community & Environment', points: 4210, solved: 9, initials: 'MV', badges: ['Root Sprouter', 'Constant Beacon'] },
    { id: 'sol_3', name: 'Aiko Tanaka', role: 'The Oracle', specialty: 'Educational Mentorship', points: 3950, solved: 8, initials: 'AT', badges: ['Sudden Light', 'Dignity Guard'] }
  ];

  /* ─── SESSION LOAD & VALIDATION ──────────────── */
  async function loadSession() {
    try {
      const session = JSON.parse(sessionStorage.getItem('portal_session'));
      if (!session) {
        window.location.href = 'login.html';
        return;
      }
      currentUserSession = session;

      // Fetch corresponding profile from solvers registry
      const solvers = await window.TWS.loadMovementMembersAsync(defaultSolvers);
      let profile = solvers.find((solver) => (
        solver.uid === currentUserSession.uid ||
        solver.email === currentUserSession.email ||
        solver.username === currentUserSession.username
      )) || window.TWS.ensureSolverProfile(currentUserSession);

      if (!profile) {
        // Create a default profile if newly logged in and no profile exists
        const displayName = currentUserSession.displayName || currentUserSession.username || currentUserSession.email || 'Together We Solve Member';
        const initials = displayName.split(' ').map(n => n.charAt(0)).join('').toUpperCase().substring(0, 2) || 'US';
        profile = {
          id: 'sol_' + Date.now(),
          name: displayName,
          username: window.TWS.toUsername(currentUserSession.username || displayName),
          email: currentUserSession.email || '',
          role: currentUserSession.role || 'Member',
          specialty: 'General Help & Mentorship',
          points: 0,
          solved: 0,
          initials: initials,
          badges: ['First Spark']
        };
      }

      currentUserProfile = profile;
    } catch (err) {
      console.error('Session loading failed:', err);
    }
  }

  /* ─── RENDER IDENTITY DETAILS & STATS ───────── */
  function renderProfileDetails() {
    if (!currentUserProfile) return;

    // Populate inputs
    const nameInput = document.getElementById('displayName');
    const usernameInput = document.getElementById('displayUsername');
    const specInput = document.getElementById('displaySpecialty');
    const initialsInput = document.getElementById('avatarInitials');
    const previewCircle = document.getElementById('avatarPreview');

    if (nameInput) nameInput.value = currentUserProfile.name;
    if (usernameInput) usernameInput.value = currentUserProfile.username || window.TWS.toUsername(currentUserProfile.name);
    if (specInput) specInput.value = currentUserProfile.specialty;
    if (initialsInput) initialsInput.value = currentUserProfile.initials;
    
    if (previewCircle) {
      previewCircle.textContent = currentUserProfile.initials;
      previewCircle.style.background = 'var(--accent-clay)';
    }

    // Dynamic initials typing preview
    if (initialsInput && previewCircle) {
      initialsInput.addEventListener('input', (e) => {
        previewCircle.textContent = e.target.value.toUpperCase().substring(0, 2);
      });
    }

    // Render stats card
    const pointsEl = document.getElementById('credPoints');
    const solvedEl = document.getElementById('credSolved');
    const rankEl = document.getElementById('credRank');

    if (pointsEl) pointsEl.textContent = `${currentUserProfile.points.toLocaleString()} XP`;
    if (solvedEl) solvedEl.textContent = `${currentUserProfile.solved} Solved`;
    
    if (rankEl) {
      let rank = 'Level I';
      if (currentUserProfile.points >= 1500) rank = 'Level II';
      if (currentUserProfile.points >= 3000) rank = 'Level III';
      if (currentUserProfile.points >= 4500) rank = 'Level IV';
      rankEl.textContent = rank;
    }

    // Render badges rack
    const rack = document.getElementById('compactBadgesRack');
    if (rack) {
      rack.innerHTML = '';
      const badgeIconMap = {
        'Golden Heart': '❤️',
        'Deep Thinker': '🧠',
        'Root Sprouter': '🌿',
        'Constant Beacon': '🕯️',
        'Sudden Light': '💡',
        'Dignity Guard': '🛡️',
        'First Spark': '✨'
      };

      currentUserProfile.badges.forEach(badge => {
        const icon = badgeIconMap[badge] || '🏅';
        const bubble = document.createElement('div');
        bubble.className = 'compact-badge-bubble';
        bubble.innerHTML = `<span class="badge-bubble-icon">${esc(icon)}</span> ${esc(badge)}`;
        rack.appendChild(bubble);
      });
    }
  }

  /* ─── SAVE IDENTITY PROFILE FORM ────────────── */
  function initIdentityForm() {
    const form = document.getElementById('identityForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const name = document.getElementById('displayName').value.trim();
      const username = window.TWS.toUsername(document.getElementById('displayUsername').value);
      const specialty = document.getElementById('displaySpecialty').value.trim();
      const initials = document.getElementById('avatarInitials').value.toUpperCase().substring(0, 2).trim();

      if (name.length < 3 || username.length < 3) {
        alert('Validation Error: Please write a valid full name and username with at least 3 characters.');
        return;
      }

      if (!/^[a-z0-9_]{3,30}$/.test(username)) {
        alert('Validation Error: Usernames can only use lowercase letters, numbers, and underscores.');
        return;
      }

      try {
        const solvers = await window.TWS.loadMovementMembersAsync(defaultSolvers);
        const previousName = currentUserProfile.name;
        const usernameTaken = solvers.some(s => s.id !== currentUserProfile.id && window.TWS.toUsername(s.username || s.name) === username);

        if (usernameTaken) {
          alert('That username is already taken. Please choose another one.');
          return;
        }

        // Update solver profile in local storage registry
        const updatedSolvers = solvers.map(s => {
          if (s.id === currentUserProfile.id) {
            return {
              ...s,
              name: name,
              username: username,
              specialty: specialty,
              initials: initials
            };
          }
          return s;
        });

        if (currentUserSession.uid && window.TWS.saveUserProfile) {
          await window.TWS.saveUserProfile(currentUserSession.uid, {
            email: currentUserSession.email || '',
            displayName: name,
            username,
            role: currentUserSession.role || currentUserProfile.role || 'Member',
            specialty,
            initials,
            stats: {
              totalImpactPoints: currentUserProfile.points || 0,
              problemsSolved: currentUserProfile.solved || 0
            }
          });
        }

        // Sync active session identity if changed
        currentUserSession.displayName = name;
        currentUserSession.username = username;
        sessionStorage.setItem('portal_session', JSON.stringify(currentUserSession));

        // Update active profile references
        currentUserProfile.name = name;
        currentUserProfile.username = username;
        currentUserProfile.specialty = specialty;
        currentUserProfile.initials = initials;

        // Write to system activity logs
        await window.TWS.logSystemActivity('LEDGER', `User "${previousName}" updated their identity profile (New name: "${name}", username: "@${username}", initials: "${initials}").`);

        // GSAP success alert animation
        gsap.fromTo('#btnSaveIdentity', 
          { scale: 0.95 },
          { scale: 1.0, duration: 0.5, ease: 'elastic.out(1, 0.3)' }
        );

        alert('Profile credentials saved successfully!');
        window.location.reload();
      } catch (err) {
        console.error('Failed to save profile changes:', err);
      }
    });
  }

  /* ─── POPULATE MY VOICED FRICTIONS ──────────── */
  async function loadMyFrictionsTracker() {
    const tableBody = document.getElementById('trackerTableBody');
    const emptyState = document.getElementById('trackerEmptyState');

    if (!tableBody) return;
    tableBody.innerHTML = '';

    try {
      const allProblems = await window.TWS.loadProblemsAsync([]);
      
      // Filter problems voiced by the active user
      // Match by prob.solver which acts as the owner's username
      const myFrictions = allProblems.filter(p => (
        p.ownerUid === currentUserSession.uid ||
        p.solver === currentUserProfile.name ||
        p.solver === currentUserProfile.username ||
        p.ownerUsername === currentUserProfile.username ||
        window.TWS.toUsername(p.solver) === currentUserProfile.username
      ));

      if (myFrictions.length > 0) {
        if (emptyState) emptyState.style.display = 'none';
        
        myFrictions.forEach(prob => {
          const row = document.createElement('tr');
          row.setAttribute('data-id', prob.id);

          const badgeClassMap = {
            'Pending Review': 'pending-review',
            'Open': 'open-challenge',
            'Closed by Owner': 'closed-owner',
            'Solved': 'solved'
          };
          
          let displayStatus = prob.status;
          let badgeClass = badgeClassMap[prob.status] || 'pending-review';

          // If the admin accepted the draft but the owner hasn't closed it yet
          if (prob.status === 'Pending Owner Closure' || (prob.status === 'Open' && prob.contributors && prob.contributors.length > 0 && !prob.solvedBy)) {
            // Wait! If there are contributors and not yet solved, it is an Open challenge in progress
            // BUT if status is specifically 'Pending Owner Closure', it needs owner review!
            if (prob.status === 'Pending Owner Closure') {
              displayStatus = 'Pending Review';
              badgeClass = 'pending-owner';
            }
          }

          // Format Attempts
          const attemptsCount = prob.contributors ? prob.contributors.length : 0;
          const attemptsTxt = attemptsCount > 0 
            ? `<span style="font-weight: 500; color: var(--accent-moss);">${attemptsCount} Contributor${attemptsCount > 1 ? 's' : ''} attempting</span>`
            : '<span style="opacity: 0.5;">No attempts yet</span>';

          // Action column buttons
          let actionHtml = `<span style="opacity: 0.5; font-size: 12px;">No actions</span>`;
          if (prob.status === 'Pending Owner Closure' || (prob.status === 'Open' && prob.contributors && prob.contributors.length > 0 && !prob.solvedBy)) {
            actionHtml = `<button type="button" class="btn btn-outline btn-sm btn-verify-solver" style="padding: 6px 14px; font-size: 11px;">Review & Close</button>`;
          }

          row.innerHTML = `
            <td style="opacity: 0.65; white-space: nowrap;">${esc(prob.date)}</td>
            <td style="font-family: var(--font-display); font-size: 15px; color: var(--accent-moss);">${esc(prob.title)}</td>
            <td><span class="status-badge" style="font-size: 9px; padding: 2px 8px; border: 1px solid var(--border-light); background: rgba(28,30,29,0.02);">${esc(prob.category)}</span></td>
            <td>${attemptsTxt}</td>
            <td><span class="status-badge ${badgeClass}">${displayStatus === 'Pending Owner Closure' ? 'Pending Review' : displayStatus}</span></td>
            <td style="text-align: right; white-space: nowrap;">${actionHtml}</td>
          `;

          // Attach click listener for resolution review modal
          const btnVerify = row.querySelector('.btn-verify-solver');
          if (btnVerify) {
            btnVerify.addEventListener('click', () => {
              openVerificationModal(prob);
            });
          }

          tableBody.appendChild(row);
        });
      } else {
        if (emptyState) emptyState.style.display = 'block';
      }
    } catch (err) {
      console.error('Failed to load voiced frictions:', err);
    }
  }

  /* ─── OWNER VERIFICATION MODAL ───────────────── */
  function openVerificationModal(prob) {
    const modal = document.getElementById('verificationModal');
    if (!modal) return;

    activeVerificationProblemId = prob.id;

    // Load problem details
    document.getElementById('modalProblemTitle').textContent = prob.title;

    // Populate Select Winner Dropdown
    const selectWinner = document.getElementById('verifySelectWinner');
    if (selectWinner) {
      selectWinner.innerHTML = '';
      if (prob.contributors && prob.contributors.length > 0) {
        prob.contributors.forEach(name => {
          const opt = document.createElement('option');
          opt.value = name;
          opt.textContent = name;
          selectWinner.appendChild(opt);
        });
      } else {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = 'No contributors found';
        selectWinner.appendChild(opt);
      }
    }

    // Reset feedback textarea
    document.getElementById('verifyReviewText').value = '';

    modal.style.display = 'flex';
    gsap.from('.modal-card', {
      opacity: 0,
      y: 40,
      scale: 0.95,
      duration: 0.5,
      ease: 'power3.out'
    });
  }

  function initModalControls() {
    const modal = document.getElementById('verificationModal');
    const closeBtn = document.getElementById('btnCloseModal');
    const rejectBtn = document.getElementById('btnRejectSolution');
    const form = document.getElementById('verificationForm');

    if (!modal) return;

    // Close Modal
    const closeModal = () => {
      gsap.to('.modal-card', {
        opacity: 0,
        y: 20,
        scale: 0.95,
        duration: 0.3,
        ease: 'power2.in',
        onComplete: () => {
          modal.style.display = 'none';
          activeVerificationProblemId = null;
        }
      });
    };

    if (closeBtn) closeBtn.addEventListener('click', closeModal);

    // Escape Key closes modal
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.style.display === 'flex') {
        closeModal();
      }
    });

    // Handle Solution Approval (Owner Close)
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!activeVerificationProblemId) return;

        const winner = document.getElementById('verifySelectWinner').value;
        const complexity = document.getElementById('verifyComplexity').value;
        const reviewText = document.getElementById('verifyReviewText').value.trim();

        if (!winner) {
          alert('Audit Error: Please select the solver who resolved your friction.');
          return;
        }
        if (reviewText.length < 15) {
          alert('Audit Error: Please write a descriptive resolution review (minimum 15 characters).');
          return;
        }

        try {
          const problems = await window.TWS.loadProblemsAsync([]);
          await window.TWS.updateProblem(activeVerificationProblemId, {
            status: 'Closed by Owner',
            solvedBy: winner,
            complexity: complexity,
            ownerReview: reviewText
          });

          // Log action
          const problemTitle = problems.find(p => p.id === activeVerificationProblemId)?.title || activeVerificationProblemId;
          window.TWS.logSystemActivity('AUDIT', `Owner "${currentUserProfile.name}" closed friction "${problemTitle}". Marked solved by "${winner}" (${complexity} complexity).`);

          alert('Challenge successfully closed and submitted to council for final point distribution audits!');
          closeModal();
          loadMyFrictionsTracker();
        } catch (err) {
          console.error('Failed to close challenge:', err);
        }
      });
    }

    // Handle Solution Rejection (Send back to loop)
    if (rejectBtn) {
      rejectBtn.addEventListener('click', async () => {
        if (!activeVerificationProblemId) return;

        const reviewText = document.getElementById('verifyReviewText').value.trim();
        if (reviewText.length < 15) {
          alert('Audit Error: Please explain in the feedback textarea why this solution draft was rejected (minimum 15 characters).');
          return;
        }

        if (confirm('Are you sure you want to send this solution back for revision? It will re-open the challenge to the solver.')) {
          try {
            const problems = await window.TWS.loadProblemsAsync([]);
            await window.TWS.updateProblem(activeVerificationProblemId, {
              status: 'Open',
              ownerReview: 'Revision Request: ' + reviewText
            });

            // Log action
            const problemTitle = problems.find(p => p.id === activeVerificationProblemId)?.title || activeVerificationProblemId;
            window.TWS.logSystemActivity('AUDIT', `Owner "${currentUserProfile.name}" rejected solution draft for "${problemTitle}" and requested revisions.`);

            alert('Solution draft rejected. Solvers have been notified to revise their implementation.');
            closeModal();
            loadMyFrictionsTracker();
          } catch (err) {
            console.error('Failed to reject solution draft:', err);
          }
        }
      });
    }
  }

  /* ─── NAV SCROLL STATE ─────────────────────── */
  function initNavScroll() {
    const nav = document.getElementById('nav');
    if (!nav) return;

    window.addEventListener('scroll', () => {
      if (window.scrollY > 80) {
        nav.classList.add('scrolled');
      } else {
        nav.classList.remove('scrolled');
      }
    });
  }

  /* ─── SIGN OUT PORTAL ──────────────────────── */
  function initSignOut() {
    const signOutBtn = document.getElementById('signOutBtn');
    if (!signOutBtn) return;

    signOutBtn.addEventListener('click', () => {
      sessionStorage.removeItem('portal_session');
      window.location.href = 'login.html';
    });
  }

  /* ─── INIT ─────────────────────────────────── */
  async function init() {
    await loadSession();
    renderProfileDetails();
    initIdentityForm();
    loadMyFrictionsTracker();
    initModalControls();
    initNavScroll();
    initSignOut();
  }

  document.addEventListener('DOMContentLoaded', init);

})();
