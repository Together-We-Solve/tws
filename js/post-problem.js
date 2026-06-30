/* ============================================
   TOGETHER WE SOLVE — post-problem.js
   Wizard Navigation, Real-time Gauge, & Celebrations
   ============================================ */

(function () {
  'use strict';

  function getSession() {
    return JSON.parse(localStorage.getItem('portal_session') || 'null');
  }

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

  /* ─── WIZARD STEP NAVIGATION ────────────────── */
  let currentStepIndex = 1;
  const formSteps = document.querySelectorAll('.form-step');
  const branchNodes = document.querySelectorAll('.branch-node');
  
  // Validation constraints
  const constraints = {
    title: 8,
    friction: 40,
    tried: 30,
    ripple: 30
  };

  function validateStep(stepIndex) {
    let isValid = true;
    
    // Clear previous errors
    document.querySelectorAll(`.form-step#step-${stepIndex} .error-msg`).forEach(e => e.style.display = 'none');

    if (stepIndex === 1) {
      // Validate Category radio selection
      const categorySelected = document.querySelector('input[name="category"]:checked');
      if (!categorySelected) {
        document.getElementById('err-category').style.display = 'block';
        isValid = false;
      }
      
      // Validate Title text length
      const titleInput = document.getElementById('problemTitle');
      if (!titleInput || titleInput.value.trim().length < constraints.title) {
        document.getElementById('err-title').style.display = 'block';
        isValid = false;
      }
    } else if (stepIndex === 2) {
      const frictionInput = document.getElementById('problemFriction');
      if (!frictionInput || frictionInput.value.trim().length < constraints.friction) {
        document.getElementById('err-friction').style.display = 'block';
        isValid = false;
      }
    } else if (stepIndex === 3) {
      const triedInput = document.getElementById('problemTried');
      if (!triedInput || triedInput.value.trim().length < constraints.tried) {
        document.getElementById('err-tried').style.display = 'block';
        isValid = false;
      }
    } else if (stepIndex === 4) {
      const rippleInput = document.getElementById('problemRipple');
      if (!rippleInput || rippleInput.value.trim().length < constraints.ripple) {
        document.getElementById('err-ripple').style.display = 'block';
        isValid = false;
      }
    }

    return isValid;
  }

  function goToStep(stepIndex) {
    if (stepIndex < 1 || stepIndex > 4) return;
    
    const currentStepEl = document.getElementById(`step-${currentStepIndex}`);
    const nextStepEl = document.getElementById(`step-${stepIndex}`);
    
    if (!nextStepEl || !currentStepEl) return;

    // Transition animations using GSAP
    gsap.to(currentStepEl, {
      opacity: 0,
      y: -15,
      duration: 0.3,
      onComplete: () => {
        currentStepEl.classList.remove('active');
        nextStepEl.classList.add('active');
        
        gsap.fromTo(nextStepEl, 
          { opacity: 0, y: 15 }, 
          { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }
        );
        
        // Scroll to top of the form wrapper
        lenis.scrollTo('.form-wrapper', { offset: -100, duration: 0.8 });
      }
    });

    currentStepIndex = stepIndex;
    updateProgressBranch();
    updateEncouragementMessage();
  }

  function updateProgressBranch() {
    branchNodes.forEach((node, idx) => {
      const stepNum = idx + 1;
      node.classList.remove('active', 'completed');
      
      if (stepNum === currentStepIndex) {
        node.classList.add('active');
      } else if (stepNum < currentStepIndex) {
        node.classList.add('completed');
      }
    });
  }

  // Setup wizard button events
  document.querySelectorAll('.next-step-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (validateStep(currentStepIndex)) {
        goToStep(currentStepIndex + 1);
      }
    });
  });

  document.querySelectorAll('.prev-step-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      goToStep(currentStepIndex - 1);
    });
  });

  /* ─── VULNERABILITY GAUGE & TYPING FEEDBACK ─── */
  const gaugeFill = document.querySelector('.gauge-fill');
  const gaugePct = document.querySelector('.gauge-pct');
  const encouragementText = document.getElementById('encouragementText');
  
  const formFields = {
    title: document.getElementById('problemTitle'),
    friction: document.getElementById('problemFriction'),
    tried: document.getElementById('problemTried'),
    ripple: document.getElementById('problemRipple')
  };

  const circumference = 314.16; // 2 * PI * r (r=50)

  function calculateProgress() {
    let score = 0;
    
    // Category selection (15%)
    const categorySelected = document.querySelector('input[name="category"]:checked');
    if (categorySelected) score += 15;

    // Title length (10%)
    if (formFields.title) {
      const len = formFields.title.value.trim().length;
      if (len >= constraints.title) score += 10;
      else score += (len / constraints.title) * 10;
    }

    // Friction length (25%)
    if (formFields.friction) {
      const len = formFields.friction.value.trim().length;
      if (len >= constraints.friction) score += 25;
      else score += (len / constraints.friction) * 25;
    }

    // Tried length (25%)
    if (formFields.tried) {
      const len = formFields.tried.value.trim().length;
      if (len >= constraints.tried) score += 25;
      else score += (len / constraints.tried) * 25;
    }

    // Ripple length (25%)
    if (formFields.ripple) {
      const len = formFields.ripple.value.trim().length;
      if (len >= constraints.ripple) score += 25;
      else score += (len / constraints.ripple) * 25;
    }

    const finalPct = Math.min(Math.round(score), 100);
    
    // Update SVG Stroke offset
    if (gaugeFill) {
      const offset = circumference * (1 - finalPct / 100);
      gaugeFill.style.strokeDashoffset = offset;
    }

    // Update Text percentage
    if (gaugePct) {
      gaugePct.textContent = `${finalPct}%`;
    }
  }

  function updateEncouragementMessage() {
    if (!encouragementText) return;

    const categorySelected = document.querySelector('input[name="category"]:checked');
    const titleVal = formFields.title ? formFields.title.value.trim() : '';
    const frictionVal = formFields.friction ? formFields.friction.value.trim() : '';
    const triedVal = formFields.tried ? formFields.tried.value.trim() : '';
    const rippleVal = formFields.ripple ? formFields.ripple.value.trim() : '';

    if (!categorySelected && titleVal.length === 0) {
      encouragementText.textContent = "Complete the sections of the form to begin. Sharing your doubts takes courage — we are here to support you.";
    } else if (currentStepIndex === 1) {
      encouragementText.textContent = "Great start! Giving your obstacle a clear name is the first step toward finding its solution.";
    } else if (currentStepIndex === 2) {
      if (frictionVal.length < constraints.friction) {
        encouragementText.textContent = "Thank you for sharing your friction. Go into detail; expressing the obstacle clearly is an act of bravery.";
      } else {
        encouragementText.textContent = "Excellent detail! Voicing your wall with clarity helps solvers understand the exact friction you face.";
      }
    } else if (currentStepIndex === 3) {
      if (triedVal.length < constraints.tried) {
        encouragementText.textContent = "Explaining what you have tried is highly valuable. It prevents others from repeating failed quick-fixes.";
      } else {
        encouragementText.textContent = "Perfect. Documenting what hasn't worked narrows the search and guides our collaborative energy.";
      }
    } else if (currentStepIndex === 4) {
      if (rippleVal.length < constraints.ripple) {
        encouragementText.textContent = "Almost there! Estimating who else benefits turns your personal struggle into a shared roadmap for many.";
      } else {
        encouragementText.textContent = "Your spark is fully voiced and ready to be shared. The community stands ready to support you!";
      }
    }
  }

  // Bind input listeners for real-time updates
  Object.values(formFields).forEach(field => {
    if (field) {
      field.addEventListener('input', () => {
        calculateProgress();
        updateEncouragementMessage();
      });
    }
  });

  document.querySelectorAll('input[name="category"]').forEach(radio => {
    radio.addEventListener('change', () => {
      calculateProgress();
      updateEncouragementMessage();
    });
  });

  /* ─── CELEBRATION SHOWER CANVAS ─────────────── */
  function runCelebrationCanvas() {
    const canvas = document.getElementById('celebrationCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let W, H;
    let items = [];
    const maxItems = 75;

    function resize() {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
    }

    class CelebrationItem {
      constructor() {
        this.reset();
        this.y = Math.random() * -H; // Start above viewport
      }

      reset() {
        this.x = Math.random() * W;
        this.y = -20;
        this.size = Math.random() * 12 + 6;
        this.speedY = Math.random() * 1.5 + 1.2;
        this.speedX = (Math.random() - 0.5) * 1.0;
        this.angle = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 0.04;
        
        // Either organic green leaf, or warm clay watercolor confetti
        this.type = Math.random() > 0.45 ? 'leaf' : 'confetti';
        
        // Pastel watercolor tones
        this.color = this.type === 'leaf'
          ? `rgba(35, 56, 43, ${Math.random() * 0.4 + 0.3})` // Moss green leaf
          : `rgba(200, 125, 85, ${Math.random() * 0.4 + 0.3})`; // Clay confetti
      }

      update() {
        this.y += this.speedY;
        this.x += this.speedX;
        this.angle += this.rotationSpeed;

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        ctx.fillStyle = this.color;
        
        if (this.type === 'leaf') {
          // Draw organic leaf shape
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.bezierCurveTo(-this.size / 2, -this.size / 2, -this.size / 2, -this.size, 0, -this.size);
          ctx.bezierCurveTo(this.size / 2, -this.size, this.size / 2, -this.size / 2, 0, 0);
          ctx.fill();
        } else {
          // Draw watercolor ink dot
          ctx.beginPath();
          ctx.arc(0, 0, this.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();

        // Recycle if falls off bottom
        if (this.y > H + 20) {
          this.reset();
        }
      }
    }

    function initItems() {
      items = [];
      for (let i = 0; i < maxItems; i++) {
        items.push(new CelebrationItem());
      }
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      items.forEach(item => item.update());
      requestAnimationFrame(draw);
    }

    window.addEventListener('resize', resize);
    resize();
    initItems();
    draw();
  }

  /* ─── FORM SUBMISSION INTERCEPTION ──────────── */
  const form = document.getElementById('frictionForm');
  const overlay = document.getElementById('celebrationOverlay');

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      // Strict final validation across all steps
      let formIsValid = true;
      for (let i = 1; i <= 4; i++) {
        if (!validateStep(i)) {
          formIsValid = false;
          goToStep(i); // Redirect user to the first step containing an error
          break;
        }
      }

      if (formIsValid) {
        // Retrieve form field values
        const categorySelected = document.querySelector('input[name="category"]:checked').value;
        const title = formFields.title.value.trim();
        const friction = formFields.friction.value.trim();
        const tried = formFields.tried.value.trim();
        const ripple = formFields.ripple.value.trim();

        // Retrieve session to set author (owner)
        const session = getSession();
        if (!session) {
          window.location.href = 'login.html';
          return;
        }
        const authorName = session.displayName || session.username || session.email;
        const authorUsername = window.TWS.toUsername(session.username || authorName);

        // Create a structured problem object
        const newProblem = {
          id: 'prob_' + Date.now(),
          title: title,
          category: categorySelected,
          friction: friction,
          tried: tried,
          ripple: ripple,
          date: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
          status: 'Pending Review', // Set to Pending Review for admin audit
          solver: authorUsername,
          ownerUid: session.uid || '',
          ownerName: authorName,
          ownerUsername: authorUsername,
          contributors: [],
          solvedBy: '',
          complexity: '',
          ownerReview: '',
          winnerXP: 0,
          attemptXP: 0,
          clones: 0,
          views: 1
        };

        try {
          await window.TWS.saveProblem(newProblem);
          window.TWS.logSystemActivity('SYSTEM', `New friction "${title}" voiced by author "${authorName}". Queued for admin review.`);
        } catch (err) {
          console.error('Failed to save problem to Firestore:', err);
        }

        // Form is complete, trigger full-screen celebration
        if (overlay) {
          overlay.classList.add('active');
          lenis.stop(); // Prevent scrolling under overlay
          runCelebrationCanvas();
        }
      }
    });
  }

  /* ─── INIT ─────────────────────────────────── */
  function init() {
    gsap.registerPlugin(ScrollTrigger);
    calculateProgress();
    updateEncouragementMessage();
  }

  document.addEventListener('DOMContentLoaded', init);

})();
