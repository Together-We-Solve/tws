/* ============================================
   TOGETHER WE SOLVE — script.js
   Evolved Generative & Organic Animations
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



  /* ─── JOURNEY CANVAS — GROWING ROOTS ───────── */
  function initJourneyCanvas() {
    const canvas = document.getElementById('journeyCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const steps = document.querySelectorAll('.journey-step');
    const dots = document.querySelectorAll('.step-dot');

    let W, H, dotCoords = [];
    // Segments progress: segment i represents connection from dot i to dot i+1
    let segmentProgress = Array(steps.length - 1).fill(0);

    function resize() {
      W = canvas.width = canvas.offsetWidth;
      H = canvas.height = canvas.offsetHeight;
      updateDotCoordinates();
      draw();
    }

    function updateDotCoordinates() {
      const canvasRect = canvas.getBoundingClientRect();
      dotCoords = [];
      dots.forEach(dot => {
        const dotRect = dot.getBoundingClientRect();
        const x = dotRect.left - canvasRect.left + dotRect.width / 2;
        const y = dotRect.top - canvasRect.top + dotRect.height / 2;
        dotCoords.push({ x, y });
      });
    }

    // Helper to evaluate cubic bezier point
    function getBezierPoint(p1, cp1, cp2, p2, t) {
      const mt = 1 - t;
      const mt2 = mt * mt;
      const mt3 = mt2 * mt;
      const t2 = t * t;
      const t3 = t2 * t;
      
      const x = mt3 * p1.x + 3 * mt2 * t * cp1.x + 3 * mt * t2 * cp2.x + t3 * p2.x;
      const y = mt3 * p1.y + 3 * mt2 * t * cp1.y + 3 * mt * t2 * cp2.y + t3 * p2.y;
      return { x, y };
    }

    // Draw little organic leaves at step dots
    function drawLeaf(x, y, angle, size) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.beginPath();
      // Draw organic leaf shape using bezier curves
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(-size / 2, -size / 2, -size / 2, -size, 0, -size);
      ctx.bezierCurveTo(size / 2, -size, size / 2, -size / 2, 0, 0);
      ctx.fillStyle = '#23382B'; // Moss green
      ctx.fill();
      ctx.strokeStyle = '#FAF6F0'; // Warm Ivory spine
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      if (dotCoords.length < 2) return;

      // Draw the growing path segment by segment
      for (let i = 0; i < dotCoords.length - 1; i++) {
        const p1 = dotCoords[i];
        const p2 = dotCoords[i + 1];
        const t = segmentProgress[i];

        if (t <= 0) continue;

        const dy = p2.y - p1.y;
        // Wiggle the control points horizontally (alternating directions) to create winding organic flow down the center
        const wiggleSign = i % 2 === 0 ? 1 : -1;
        const cp1 = { x: p1.x + wiggleSign * 35, y: p1.y + dy * 0.35 };
        const cp2 = { x: p2.x - wiggleSign * 35, y: p1.y + dy * 0.65 };

        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);

        // Draw curves with resolution
        const stepsCount = Math.floor(t * 30);
        for (let j = 1; j <= stepsCount; j++) {
          const currT = (j / stepsCount) * t;
          const pt = getBezierPoint(p1, cp1, cp2, p2, currT);
          ctx.lineTo(pt.x, pt.y);
        }

        ctx.strokeStyle = 'rgba(200, 125, 85, 0.4)'; // Clay root path background shadow
        ctx.lineWidth = 4;
        ctx.stroke();

        ctx.strokeStyle = '#23382B'; // Deep Moss root
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Draw leaves on active nodes
      dotCoords.forEach((dot, index) => {
        // If the step is active, draw a leaf sprouting
        const step = steps[index];
        if (step && step.classList.contains('active')) {
          const isLeft = index % 2 === 0;
          const leafSize = 10;
          if (isLeft) {
            drawLeaf(dot.x, dot.y, -Math.PI / 4, leafSize);
            drawLeaf(dot.x, dot.y, -Math.PI / 1.5, leafSize * 0.8);
          } else {
            drawLeaf(dot.x, dot.y, Math.PI / 4, leafSize);
            drawLeaf(dot.x, dot.y, Math.PI / 1.5, leafSize * 0.8);
          }
        }
      });
    }

    // Bind segments to ScrollTriggers of the steps
    steps.forEach((step, i) => {
      ScrollTrigger.create({
        trigger: step,
        start: 'top 80%',
        onEnter: () => {
          step.classList.add('active');
          
          // Animate step text block itself to fade/slide in
          gsap.to(step, {
            opacity: 1,
            y: 0,
            duration: 1.1,
            ease: 'power3.out'
          });

          draw();
          
          // Animate the root segment growing down to this step
          if (i > 0) {
            gsap.to(segmentProgress, {
              [i - 1]: 1,
              duration: 1.4,
              ease: 'power2.out',
              onUpdate: draw
            });
          }
        },
        once: true
      });
    });

    resize();
    
    window.addEventListener('resize', () => {
      updateDotCoordinates();
      draw();
    });

    // Redraw periodically during scroll triggers to maintain sync
    ScrollTrigger.addEventListener('refresh', () => {
      updateDotCoordinates();
      draw();
    });
  }

  /* ─── VISION CANVAS — TOPOGRAPHIC WAVES ────── */
  function initVisionCanvas() {
    const canvas = document.querySelector('#visionCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let W, H, layers = [];

    function resize() {
      const wrap = canvas.parentElement;
      W = canvas.width = wrap.offsetWidth;
      H = canvas.height = wrap.offsetHeight;
      createLayers();
    }

    function createLayers() {
      // Warm, organic topographic waves
      layers = [
        { baseHeight: H * 0.45, amp: 28, freq: 0.0018, speed: 0.0015, color: 'rgba(35, 56, 43, 0.35)', phase: 0 },
        { baseHeight: H * 0.35, amp: 35, freq: 0.0025, speed: 0.0012, color: 'rgba(61, 90, 108, 0.25)', phase: Math.PI / 3 },
        { baseHeight: H * 0.25, amp: 22, freq: 0.003, speed: 0.002, color: 'rgba(200, 125, 85, 0.15)', phase: Math.PI * 0.75 },
        { baseHeight: H * 0.15, amp: 40, freq: 0.0012, speed: 0.001, color: 'rgba(26, 46, 34, 0.45)', phase: Math.PI }
      ];
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);

      layers.forEach(l => {
        l.phase += l.speed;
        ctx.beginPath();
        ctx.moveTo(0, H + 20);

        for (let x = 0; x <= W; x += 8) {
          const y = H - l.baseHeight + 
                    Math.sin(x * l.freq + l.phase) * l.amp + 
                    Math.cos(x * 0.004 + l.phase * 0.5) * (l.amp * 0.3);
          ctx.lineTo(x, y);
        }

        ctx.lineTo(W + 20, H + 20);
        ctx.closePath();
        ctx.fillStyle = l.color;
        ctx.fill();
      });

      requestAnimationFrame(draw);
    }

    resize();
    draw();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement);
  }

  /* ─── JOIN CANVAS — WATERCOLOR RIPPLES ─────── */
  function initJoinCanvas() {
    const canvas = document.getElementById('joinCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let W, H, ripples = [];

    function resize() {
      W = canvas.width = canvas.offsetWidth;
      H = canvas.height = canvas.offsetHeight;
    }

    class Ripple {
      constructor(x, y) {
        this.x = x || Math.random() * W;
        this.y = y || Math.random() * H;
        this.r = 10;
        this.maxRadius = Math.random() * 200 + 150;
        this.speed = Math.random() * 0.8 + 0.6;
        this.opacity = 0.55;
        this.phase = Math.random() * Math.PI;
        this.noiseSpeed = Math.random() * 0.02 + 0.01;
      }

      update() {
        this.r += this.speed;
        this.phase += this.noiseSpeed;
        this.opacity = 1 - (this.r / this.maxRadius);
      }

      draw() {
        ctx.beginPath();
        const segments = 16;
        
        // Draw imperfect organic circle to mimic bleeding ink/watercolor ripples
        for (let i = 0; i <= segments; i++) {
          const angle = (i / segments) * Math.PI * 2;
          const noise = Math.sin(angle * 5 + this.phase) * (this.r * 0.06);
          const rad = this.r + noise;
          const rx = this.x + Math.cos(angle) * rad;
          const ry = this.y + Math.sin(angle) * rad;
          
          if (i === 0) ctx.moveTo(rx, ry);
          else ctx.lineTo(rx, ry);
        }

        ctx.closePath();
        ctx.strokeStyle = `rgba(200, 125, 85, ${this.opacity * 0.35})`;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    }

    function addRipple() {
      if (ripples.length < 5) {
        ripples.push(new Ripple());
      }
    }

    // Add continuous slow ripples representing collective waves of influence
    setInterval(addRipple, 2200);

    // Spawn a ripple on click/touch to show small actions create impact
    canvas.addEventListener('click', (e) => {
      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      ripples.push(new Ripple(clickX, clickY));
    });

    function draw() {
      ctx.clearRect(0, 0, W, H);
      ripples.forEach((r, index) => {
        r.update();
        r.draw();
        if (r.r >= r.maxRadius) {
          ripples.splice(index, 1);
        }
      });
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
              stagger: options.stagger || 0.06,
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
    const tl = gsap.timeline({ delay: 0.2 });

    tl.to('.hero-eyebrow', { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' })
      .to('.hero-headline', { opacity: 1, y: 0, duration: 1.0, ease: 'power3.out' }, '-=0.5')
      .to('.hero-tagline', { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' }, '-=0.6')
      .to('.hero-body', { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' }, '-=0.5')
      .to('.hero-actions', { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' }, '-=0.4')
      .to('.hero-scroll-hint', { opacity: 1, duration: 0.8, ease: 'power2.out' }, '-=0.3');
  }

  /* ─── GENERIC REVEAL ───────────────────────── */
  function animateRevealText(els) {
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
    document.querySelectorAll('.reality .reveal-text').forEach(el => {
      gsap.set(el, { opacity: 0, y: 20 });
    });

    ScrollTrigger.batch('.reality .reveal-text', {
      start: 'top 88%',
      onEnter: batch => gsap.to(batch, {
        opacity: 1, y: 0, duration: 1, stagger: 0.1, ease: 'power3.out'
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
        opacity: 1, y: 0, duration: 1, stagger: 0.08, ease: 'power3.out'
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
      y: 40,
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
    initJourneyCanvas();
    initVisionCanvas();
    initJoinCanvas();

    // Entrance
    animateHero();

    // Sections
    animateLabels();
    animateSectionHeadlines();
    animateReality();
    animateWhyRows();
    animateBelief();
    animateValues();
    animateVision();
    animateJoin();
    initParallax();

    // Generic reveals
    animateRevealText(document.querySelectorAll('.reveal-vision'));
  }

  document.addEventListener('DOMContentLoaded', init);

})();
