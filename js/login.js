/* ============================================
   TOGETHER WE SOLVE — js/login.js
   Interactive Constellations & Portal Login
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

  /* ─── CONSTELLATION CANVAS BACKDROP ────────── */
  function initLoginCanvas() {
    const canvas = document.getElementById('loginCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let W, H;
    let particles = [];
    const maxParticles = 50;
    
    // Interactive states when typing
    let focusState = false;
    let speedMultiplier = 1;
    let attractionRadius = 150;

    function resize() {
      W = canvas.width = canvas.offsetWidth;
      H = canvas.height = canvas.offsetHeight;
      initParticles();
    }

    class StarNode {
      constructor() {
        this.reset();
        this.x = Math.random() * W;
        this.y = Math.random() * H;
      }

      reset() {
        this.x = Math.random() * W;
        this.y = H + 15;
        this.radius = Math.random() * 2 + 0.5;
        this.speedY = Math.random() * 0.3 + 0.1;
        this.speedX = (Math.random() - 0.5) * 0.2;
        this.color = Math.random() > 0.45 
          ? 'rgba(35, 56, 43, 0.15)'   // Moss green
          : 'rgba(200, 125, 85, 0.12)'; // Clay
      }

      update() {
        // Apply upward drift
        this.y -= this.speedY * speedMultiplier;
        this.x += this.speedX * speedMultiplier;

        // Bounce horizontally
        if (this.x < 0 || this.x > W) this.speedX = -this.speedX;

        // Draw node
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();

        // Recycle if drifts off top
        if (this.y < -10) {
          this.reset();
        }
      }
    }

    function initParticles() {
      particles = [];
      for (let i = 0; i < maxParticles; i++) {
        particles.push(new StarNode());
      }
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);

      // Update & draw star nodes
      particles.forEach(p => p.update());

      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const p1 = particles[i];
          const p2 = particles[j];
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          // Draw links if within distance (expand radius on focus)
          const maxDist = focusState ? attractionRadius * 1.4 : attractionRadius;
          if (dist < maxDist) {
            const opacity = (1 - (dist / maxDist)) * 0.12;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = i % 2 === 0
              ? `rgba(200, 125, 85, ${opacity})`
              : `rgba(35, 56, 43, ${opacity})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }

      requestAnimationFrame(draw);
    }

    // Connect input focus events to speed up canvas particles
    const inputs = document.querySelectorAll('.login-form input');
    inputs.forEach(input => {
      input.addEventListener('focus', () => {
        focusState = true;
        gsap.to({ val: speedMultiplier }, {
          val: 3.5,
          duration: 0.8,
          onUpdate: function () { speedMultiplier = this.targets()[0].val; }
        });
      });

      input.addEventListener('blur', () => {
        focusState = false;
        gsap.to({ val: speedMultiplier }, {
          val: 1.0,
          duration: 1.2,
          onUpdate: function () { speedMultiplier = this.targets()[0].val; }
        });
      });
    });

    resize();
    draw();

    window.addEventListener('resize', () => {
      W = canvas.width = canvas.offsetWidth;
      H = canvas.height = canvas.offsetHeight;
    });
  }

  /* ─── ENTRANCE TIMELINE ANIMATION ──────────── */
  function animateLoginCard() {
    gsap.from('.login-card', {
      opacity: 0,
      y: 30,
      scale: 0.98,
      duration: 1.2,
      delay: 0.2,
      ease: 'power3.out'
    });
  }

  /* ─── FORM SUBMIT & REDIRECT STATE ─────────── */
  function initLoginForm() {
    const form = document.getElementById('loginForm');
    if (!form) return;

    form.addEventListener('submit', (e) => {
      e.preventDefault();

      const username = document.getElementById('username').value.trim();
      const role = document.querySelector('input[name="role"]:checked').value;

      // Save user session in sessionStorage
      const sessionData = {
        username: username || 'Elena Rostova',
        role: role,
        loginTime: Date.now()
      };

      try {
        sessionStorage.setItem('portal_session', JSON.stringify(sessionData));
      } catch (err) {
        console.error('Failed to write session data to sessionStorage:', err);
      }

      // Card exit animations before redirect
      gsap.to('.login-card', {
        opacity: 0,
        y: -20,
        scale: 0.98,
        duration: 0.5,
        ease: 'power2.in',
        onComplete: () => {
          // Redirect to appropriate dashboard
          if (role === 'Admin') {
            window.location.href = 'admin-dashboard.html';
          } else {
            window.location.href = 'user-dashboard.html';
          }
        }
      });
    });
  }

  /* ─── INIT ─────────────────────────────────── */
  function init() {
    gsap.registerPlugin(ScrollTrigger);

    initLoginCanvas();
    animateLoginCard();
    initLoginForm();
  }

  document.addEventListener('DOMContentLoaded', init);

})();
