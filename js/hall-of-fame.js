/* ============================================
   TOGETHER WE SOLVE — hall-of-fame.js
   Drifting Golden Dust & Pantheon Interactions
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

  /* ─── GOLD DUST CANVAS ─────────────────────── */
  function initGoldDustCanvas() {
    const canvas = document.getElementById('goldDustCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let W, H;
    let particles = [];
    const maxParticles = 45;
    
    let mouse = { x: null, y: null, tx: null, ty: null };

    function resize() {
      W = canvas.width = canvas.offsetWidth;
      H = canvas.height = canvas.offsetHeight;
      initParticles();
    }

    class GoldDust {
      constructor() {
        this.reset();
        this.y = Math.random() * H; // Initial randomized heights
      }

      reset() {
        this.x = Math.random() * W;
        this.y = H + 20;
        this.size = Math.random() * 2 + 0.5;
        this.speed = Math.random() * 0.4 + 0.15;
        this.opacity = Math.random() * 0.4 + 0.15;
        this.angle = Math.random() * Math.PI * 2;
        this.swingSpeed = Math.random() * 0.02 + 0.005;
        this.swingWidth = Math.random() * 20 + 5;
      }

      update() {
        this.y -= this.speed;
        this.angle += this.swingSpeed;
        
        // Sway horizontally in a sine wave
        const currentX = this.x + Math.sin(this.angle) * this.swingWidth;

        // Apply mouse draft effect
        let finalX = currentX;
        if (mouse.x !== null && mouse.y !== null) {
          const dx = currentX - mouse.x;
          const dy = this.y - mouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 180) {
            const wind = (180 - dist) / 180;
            // Push particles in direction of mouse drift or away
            finalX += (dx / dist) * wind * 15;
          }
        }

        // Draw particle
        ctx.beginPath();
        ctx.arc(finalX, this.y, this.size, 0, Math.PI * 2);
        
        // Gold / Clay warm tones
        ctx.fillStyle = `rgba(200, 125, 85, ${this.opacity})`;
        ctx.shadowBlur = this.size * 2;
        ctx.shadowColor = 'rgba(200, 125, 85, 0.4)';
        ctx.fill();
        ctx.shadowBlur = 0; // Reset shadow

        // Reset if drifted off the top
        if (this.y < -10) {
          this.reset();
        }
      }
    }

    function initParticles() {
      particles = [];
      for (let i = 0; i < maxParticles; i++) {
        particles.push(new GoldDust());
      }
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      particles.forEach(p => p.update());
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

  /* ─── HERO ENTRANCE ANIMATIONS ────────────── */
  function animateHero() {
    const tl = gsap.timeline({ delay: 0.2 });
    gsap.set('.hero-eyebrow, .hero-headline, .hero-tagline, .hero-body', { y: 30, opacity: 0 });

    tl.to('.hero-eyebrow', { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' })
      .to('.hero-headline', { opacity: 1, y: 0, duration: 1.0, ease: 'power3.out' }, '-=0.5')
      .to('.hero-tagline', { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' }, '-=0.6')
      .to('.hero-body', { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' }, '-=0.5');
  }

  /* ─── SCROLL TRIGGER CARDS REVEALS ────────── */
  function initScrollTriggers() {
    // Labels and section headlines
    document.querySelectorAll('.label, .section-headline').forEach(el => {
      gsap.set(el, { opacity: 0, y: 20 });
      ScrollTrigger.create({
        trigger: el,
        start: 'top 90%',
        onEnter: () => gsap.to(el, { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' }),
        once: true
      });
    });

    // Legend cards stagger
    gsap.set('.legend-card', { opacity: 0, y: 40 });
    ScrollTrigger.create({
      trigger: '.legends-grid',
      start: 'top 85%',
      onEnter: () => {
        gsap.to('.legend-card', {
          opacity: 1,
          y: 0,
          duration: 1.1,
          stagger: 0.12,
          ease: 'power3.out'
        });
      },
      once: true
    });
  }

  /* ─── STORY MODAL OVERLAYS ────────────────── */
  function initModals() {
    const cards = document.querySelectorAll('.legend-card');
    const closeBtns = document.querySelectorAll('.close-modal-btn');
    const overlays = document.querySelectorAll('.story-modal-overlay');

    // Open Modal
    cards.forEach(card => {
      card.addEventListener('click', () => {
        const id = card.getAttribute('data-legend');
        const modal = document.getElementById(`modal-${id}`);
        if (modal) {
          modal.classList.add('active');
          lenis.stop(); // Stop scroll when modal is active
          
          // Animate content elements slightly for premium feel
          const content = modal.querySelector('.story-modal-card');
          gsap.fromTo(content, 
            { y: 50, scale: 0.98, opacity: 0 }, 
            { y: 0, scale: 1, opacity: 1, duration: 0.6, ease: 'power3.out' }
          );
        }
      });
    });

    // Close Modal helper
    function closeModal(modal) {
      const content = modal.querySelector('.story-modal-card');
      gsap.to(content, {
        y: 30,
        scale: 0.98,
        opacity: 0,
        duration: 0.4,
        ease: 'power2.in',
        onComplete: () => {
          modal.classList.remove('active');
          lenis.start(); // Resume scroll
        }
      });
    }

    // Close on X button click
    closeBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const modal = btn.closest('.story-modal-overlay');
        if (modal) closeModal(modal);
      });
    });

    // Close on overlay backdrop click
    overlays.forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          closeModal(overlay);
        }
      });
    });

    // Close on Escape key
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const activeModal = document.querySelector('.story-modal-overlay.active');
        if (activeModal) closeModal(activeModal);
      }
    });
  }

  /* ─── INIT ─────────────────────────────────── */
  function init() {
    gsap.registerPlugin(ScrollTrigger);

    initGoldDustCanvas();
    animateHero();
    initScrollTriggers();
    initModals();
  }

  document.addEventListener('DOMContentLoaded', init);

})();
