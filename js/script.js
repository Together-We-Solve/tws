/* ============================================
   TOGETHER WE SOLVE — script.js
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

  /* ─── SCROLL LINKS ─────────────────────────── */
  document.querySelectorAll('.scroll-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.querySelector(link.getAttribute('href'));
      if (target) lenis.scrollTo(target, { offset: -80 });
    });
  });

  document.querySelectorAll('.footer-nav a').forEach(link => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      if (href && href.startsWith('#')) {
        e.preventDefault();
        const target = document.querySelector(href);
        if (target) lenis.scrollTo(target, { offset: -80 });
      }
    });
  });

  /* ─── NAV SCROLL STATE ─────────────────────── */
  const nav = document.getElementById('nav');
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

  /* ─── HERO CANVAS — NETWORK ────────────────── */
  function initHeroCanvas() {
    const canvas = document.getElementById('heroCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let W, H, nodes = [], animId;

    function resize() {
      W = canvas.width = canvas.offsetWidth;
      H = canvas.height = canvas.offsetHeight;
    }

    function Node(x, y) {
      this.x = x;
      this.y = y;
      this.vx = (Math.random() - 0.5) * 0.22;
      this.vy = (Math.random() - 0.5) * 0.22;
      this.r = Math.random() * 1.5 + 0.5;
      this.opacity = Math.random() * 0.5 + 0.2;
    }

    function initNodes() {
      nodes = [];
      const count = Math.min(Math.floor((W * H) / 14000), 90);
      for (let i = 0; i < count; i++) {
        nodes.push(new Node(Math.random() * W, Math.random() * H));
      }
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      const DIST = 160;

      for (let n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < -20) n.x = W + 20;
        if (n.x > W + 20) n.x = -20;
        if (n.y < -20) n.y = H + 20;
        if (n.y > H + 20) n.y = -20;
      }

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < DIST) {
            const alpha = (1 - d / DIST) * 0.25;
            ctx.beginPath();
            ctx.strokeStyle = `rgba(37,99,235,${alpha})`;
            ctx.lineWidth = 0.8;
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
          }
        }
      }

      for (let n of nodes) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${n.opacity})`;
        ctx.fill();
      }

      animId = requestAnimationFrame(draw);
    }

    resize();
    initNodes();
    draw();

    const ro = new ResizeObserver(() => {
      resize();
      initNodes();
    });
    ro.observe(canvas.parentElement);
  }

  /* ─── JOIN CANVAS — DENSER NETWORK ────────── */
  function initJoinCanvas() {
    const canvas = document.getElementById('joinCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let W, H, nodes = [];

    function resize() {
      W = canvas.width = canvas.offsetWidth;
      H = canvas.height = canvas.offsetHeight;
    }

    function Node() {
      this.x = Math.random() * W;
      this.y = Math.random() * H;
      this.vx = (Math.random() - 0.5) * 0.18;
      this.vy = (Math.random() - 0.5) * 0.18;
      this.r = Math.random() * 2 + 0.5;
    }

    function init() {
      nodes = [];
      const count = Math.min(Math.floor((W * H) / 9000), 130);
      for (let i = 0; i < count; i++) nodes.push(new Node());
    }

    let pulse = 0;

    function draw() {
      ctx.clearRect(0, 0, W, H);
      pulse += 0.008;
      const DIST = 180;

      for (let n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < -20) n.x = W + 20;
        if (n.x > W + 20) n.x = -20;
        if (n.y < -20) n.y = H + 20;
        if (n.y > H + 20) n.y = -20;
      }

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < DIST) {
            const pAlpha = 0.15 + Math.sin(pulse) * 0.06;
            const alpha = (1 - d / DIST) * pAlpha;
            const useGreen = Math.random() > 0.7;
            ctx.beginPath();
            ctx.strokeStyle = useGreen
              ? `rgba(34,197,94,${alpha})`
              : `rgba(37,99,235,${alpha})`;
            ctx.lineWidth = 0.7;
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
          }
        }
      }

      for (let n of nodes) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,0.35)`;
        ctx.fill();
      }

      requestAnimationFrame(draw);
    }

    resize();
    init();
    draw();

    const ro = new ResizeObserver(() => { resize(); init(); });
    ro.observe(canvas.parentElement);
  }

  /* ─── VISION CANVAS ────────────────────────── */
  function initVisionCanvas() {
    const canvas = document.querySelector('#visionCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let W, H;

    function resize() {
      const wrap = canvas.parentElement;
      W = canvas.width = wrap.offsetWidth;
      H = canvas.height = wrap.offsetHeight;
    }

    let t = 0;
    const paths = Array.from({ length: 6 }, (_, i) => ({
      offset: i * (Math.PI / 3),
      speed: 0.0004 + i * 0.0001,
      alpha: 0.15 + i * 0.04,
    }));

    function draw() {
      ctx.clearRect(0, 0, W, H);
      t += 0.5;
      for (let p of paths) {
        ctx.beginPath();
        for (let x = 0; x <= W; x += 4) {
          const y = H / 2 + Math.sin((x * 0.005) + t * p.speed * 1000 + p.offset) * (H * 0.12);
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `rgba(37,99,235,${p.alpha})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      requestAnimationFrame(draw);
    }

    resize();
    draw();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement);
  }

  /* ─── SPLIT TYPE HELPER ────────────────────── */
  function splitAndAnimate(selector, trigger, options = {}) {
    const els = document.querySelectorAll(selector);
    els.forEach(el => {
      try {
        const split = new SplitType(el, { types: 'lines' });
        gsap.set(split.lines, { y: '110%', opacity: 0 });
        ScrollTrigger.create({
          trigger: trigger || el,
          start: 'top 88%',
          onEnter: () => {
            gsap.to(split.lines, {
              y: '0%',
              opacity: 1,
              duration: options.duration || 1,
              stagger: options.stagger || 0.08,
              ease: options.ease || 'power3.out',
              delay: options.delay || 0,
            });
          },
          once: true,
        });
        el.style.overflow = 'hidden';
      } catch (_) {
        gsap.set(el, { opacity: 0, y: 20 });
        ScrollTrigger.create({
          trigger: el,
          start: 'top 88%',
          onEnter: () => gsap.to(el, { opacity: 1, y: 0, duration: 0.9, ease: 'power2.out' }),
          once: true,
        });
      }
    });
  }

  /* ─── HERO ENTRANCE ────────────────────────── */
  function animateHero() {
    const tl = gsap.timeline({ delay: 0.3 });

    tl.to('.hero-eyebrow', { opacity: 1, y: 0, duration: 0.9, ease: 'power2.out' })
      .to('.hero-headline', { opacity: 1, y: 0, duration: 1.1, ease: 'power3.out' }, '-=0.5')
      .to('.hero-tagline', { opacity: 1, y: 0, duration: 0.9, ease: 'power2.out' }, '-=0.6')
      .to('.hero-body', { opacity: 1, y: 0, duration: 0.9, ease: 'power2.out' }, '-=0.5')
      .to('.hero-actions', { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' }, '-=0.4')
      .to('.hero-scroll-hint', { opacity: 1, duration: 0.8, ease: 'power2.out' }, '-=0.3');
  }

  /* ─── GENERIC REVEAL ───────────────────────── */
  function animateRevealText(els, stagger = 0.1) {
    els.forEach(el => {
      ScrollTrigger.create({
        trigger: el,
        start: 'top 90%',
        onEnter: () => {
          gsap.to(el, {
            opacity: 1,
            y: 0,
            duration: 1,
            ease: 'power3.out',
          });
        },
        once: true,
      });
    });
  }

  /* ─── REALITY SECTION ──────────────────────── */
  function animateReality() {
    document.querySelectorAll('.reveal-text').forEach(el => {
      gsap.set(el, { opacity: 0, y: 20 });
    });

    ScrollTrigger.batch('.reality .reveal-text', {
      start: 'top 88%',
      onEnter: batch => gsap.to(batch, {
        opacity: 1, y: 0, duration: 1, stagger: 0.12, ease: 'power3.out'
      }),
      once: true,
    });

    ScrollTrigger.batch('.reality-marker', {
      start: 'top 85%',
      onEnter: batch => gsap.to(batch, {
        opacity: 1, scaleX: 1, duration: 0.8, stagger: 0.1, ease: 'power2.out'
      }),
      once: true,
    });
  }

  /* ─── WHY ROWS ─────────────────────────────── */
  function animateWhyRows() {
    ScrollTrigger.create({
      trigger: '.why-rows',
      start: 'top 85%',
      onEnter: () => {
        gsap.to('.why-row', {
          opacity: 1,
          y: 0,
          duration: 0.9,
          stagger: 0.1,
          ease: 'power3.out',
        });
      },
      once: true,
    });
  }

  /* ─── BELIEF LINES ─────────────────────────── */
  function animateBelief() {
    ScrollTrigger.create({
      trigger: '.belief-quote',
      start: 'top 80%',
      onEnter: () => {
        gsap.to('.belief-line', {
          opacity: 1,
          y: 0,
          duration: 1.1,
          stagger: 0.15,
          ease: 'power3.out',
        });
      },
      once: true,
    });

    ScrollTrigger.batch('.belief-support p', {
      start: 'top 88%',
      onEnter: batch => gsap.to(batch, {
        opacity: 1, y: 0, duration: 0.9, stagger: 0.12, ease: 'power2.out'
      }),
      once: true,
    });
  }

  /* ─── JOURNEY STEPS ────────────────────────── */
  function animateJourney() {
    const steps = document.querySelectorAll('.journey-step');
    const connectors = document.querySelectorAll('.journey-connector');

    steps.forEach((step, i) => {
      ScrollTrigger.create({
        trigger: step,
        start: 'top 82%',
        onEnter: () => {
          gsap.to(step, {
            opacity: 1,
            x: 0,
            duration: 0.8,
            ease: 'power3.out',
            onComplete: () => step.classList.add('active'),
          });
          if (connectors[i]) {
            gsap.to(connectors[i], {
              scaleY: 1,
              duration: 0.6,
              ease: 'power2.inOut',
              delay: 0.4,
            });
          }
        },
        once: true,
      });
    });
  }

  /* ─── VALUE CARDS ──────────────────────────── */
  function animateValues() {
    ScrollTrigger.batch('.value-card', {
      start: 'top 88%',
      onEnter: batch => gsap.to(batch, {
        opacity: 1, y: 0, duration: 0.9, stagger: 0.08, ease: 'power3.out'
      }),
      once: true,
    });
  }

  /* ─── VISION LINES ─────────────────────────── */
  function animateVision() {
    document.querySelectorAll('.vision-line').forEach((line, i) => {
      ScrollTrigger.create({
        trigger: line,
        start: 'top 85%',
        onEnter: () => {
          gsap.to(line, {
            opacity: 1,
            y: 0,
            duration: 1,
            ease: 'power3.out',
            delay: i * 0.04,
          });
          setTimeout(() => line.classList.add('in-view'), i * 40 + 600);
        },
        once: true,
      });
    });

    ScrollTrigger.create({
      trigger: '.vision-close',
      start: 'top 88%',
      onEnter: () => gsap.to('.vision-close', { opacity: 1, y: 0, duration: 1, ease: 'power2.out' }),
      once: true,
    });
  }

  /* ─── JOIN SECTION ─────────────────────────── */
  function animateJoin() {
    ScrollTrigger.batch('.join .reveal-text, .join-headline', {
      start: 'top 88%',
      onEnter: batch => gsap.to(batch, {
        opacity: 1, y: 0, duration: 1, stagger: 0.1, ease: 'power3.out'
      }),
      once: true,
    });

    ScrollTrigger.create({
      trigger: '.join-progression',
      start: 'top 88%',
      onEnter: () => gsap.to('.join-progression', { opacity: 1, duration: 1, ease: 'power2.out' }),
      once: true,
    });
  }

  /* ─── PARALLAX HERO CONTENT ────────────────── */
  function initParallax() {
    gsap.to('.hero-content', {
      y: 60,
      ease: 'none',
      scrollTrigger: {
        trigger: '.hero',
        start: 'top top',
        end: 'bottom top',
        scrub: true,
      }
    });
  }

  /* ─── LABEL REVEALS ────────────────────────── */
  function animateLabels() {
    document.querySelectorAll('.label').forEach(el => {
      ScrollTrigger.create({
        trigger: el,
        start: 'top 90%',
        onEnter: () => gsap.to(el, { opacity: 1, y: 0, duration: 0.7, ease: 'power2.out' }),
        once: true,
      });
    });
  }

  /* ─── SECTION HEADLINE REVEALS ────────────── */
  function animateSectionHeadlines() {
    document.querySelectorAll('.section-headline').forEach(el => {
      gsap.set(el, { opacity: 0, y: 30 });
      ScrollTrigger.create({
        trigger: el,
        start: 'top 85%',
        onEnter: () => gsap.to(el, { opacity: 1, y: 0, duration: 1.1, ease: 'power3.out' }),
        once: true,
      });
    });
  }

  /* ─── INIT ─────────────────────────────────── */
  function init() {
    gsap.registerPlugin(ScrollTrigger);

    // Canvases
    initHeroCanvas();
    initJoinCanvas();
    initVisionCanvas();

    // Entrance
    animateHero();

    // Sections
    animateLabels();
    animateSectionHeadlines();
    animateReality();
    animateWhyRows();
    animateBelief();
    animateJourney();
    animateValues();
    animateVision();
    animateJoin();
    initParallax();

    // Generic reveals
    animateRevealText(document.querySelectorAll('.reveal-vision'));
  }

  document.addEventListener('DOMContentLoaded', init);

})();
