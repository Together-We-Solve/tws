import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import { getAuth, signInWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
import { firebaseConfig, fixedRoles, accessCollections } from './firebase-config.js';

(function () {
  'use strict';

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

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

  const nav = document.getElementById('nav');
  if (nav) {
    ScrollTrigger.create({
      start: 'top -80',
      onUpdate: (self) => {
        nav.classList.toggle('scrolled', self.scroll() > 80);
      }
    });
  }

  function initLoginCanvas() {
    const canvas = document.getElementById('loginCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let W = 0;
    let H = 0;
    let particles = [];
    const maxParticles = 50;
    let focusState = false;
    let speedMultiplier = 1;
    const attractionRadius = 150;

    function resize() {
      W = canvas.width = canvas.offsetWidth;
      H = canvas.height = canvas.offsetHeight;
      particles = Array.from({ length: maxParticles }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        radius: Math.random() * 2 + 0.5,
        speedY: Math.random() * 0.3 + 0.1,
        speedX: (Math.random() - 0.5) * 0.2,
        color: Math.random() > 0.45 ? 'rgba(35, 56, 43, 0.15)' : 'rgba(200, 125, 85, 0.12)'
      }));
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);

      particles.forEach((p) => {
        p.y -= p.speedY * speedMultiplier;
        p.x += p.speedX * speedMultiplier;
        if (p.x < 0 || p.x > W) p.speedX = -p.speedX;
        if (p.y < -10) {
          p.x = Math.random() * W;
          p.y = H + 15;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
      });

      for (let i = 0; i < particles.length; i += 1) {
        for (let j = i + 1; j < particles.length; j += 1) {
          const p1 = particles[i];
          const p2 = particles[j];
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const maxDist = focusState ? attractionRadius * 1.4 : attractionRadius;

          if (dist < maxDist) {
            const opacity = (1 - (dist / maxDist)) * 0.12;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = i % 2 === 0 ? `rgba(200, 125, 85, ${opacity})` : `rgba(35, 56, 43, ${opacity})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }

      requestAnimationFrame(draw);
    }

    document.querySelectorAll('.login-form input').forEach((input) => {
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
          val: 1,
          duration: 1.2,
          onUpdate: function () { speedMultiplier = this.targets()[0].val; }
        });
      });
    });

    resize();
    draw();
    window.addEventListener('resize', resize);
  }

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

  function friendlyAuthError(error) {
    const code = error?.code || '';
    if (firebaseConfig.apiKey.startsWith('REPLACE_')) {
      return 'Firebase is not configured yet. Update js/firebase-config.js with your project details.';
    }
    if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) {
      return 'Email or password is incorrect.';
    }
    if (code.includes('invalid-email')) return 'Enter a valid email address.';
    if (code.includes('too-many-requests')) return 'Too many attempts. Please wait before trying again.';
    return 'Could not sign in. Please try again.';
  }

  function displayNameFromUser(user) {
    if (user.displayName) return user.displayName;
    return user.email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function dashboardForAccess(role, privileges) {
    const access = Array.isArray(privileges) ? privileges : [];
    if (role === 'Founder' || role === 'Co-Founder' || access.includes('manage_system')) return 'admin-dashboard.html';
    if (['Evaluator', 'Innovator'].includes(role) || access.includes('evaluate_submissions') || access.includes('award_points')) return 'evaluator-dashboard.html';
    return 'user-settings.html';
  }

  async function loadAccessProfile(user) {
    const uidSnapshot = await getDoc(doc(db, accessCollections.users, user.uid));
    let data = uidSnapshot.exists() ? uidSnapshot.data() : {};

    if (user.email) {
      const emailKey = user.email.toLowerCase();
      const emailSnapshot = await getDoc(doc(db, accessCollections.roleAssignments, emailKey));
      if (emailSnapshot.exists()) data = { ...data, ...emailSnapshot.data() };
    }

    const role = fixedRoles.includes(data.role) ? data.role : 'Member';
    const privileges = Array.isArray(data.privileges) ? data.privileges : [];

    return {
      role,
      privileges,
      displayName: data.displayName || user.displayName || displayNameFromUser(user),
      isSupportingPartner: Boolean(data.isSupportingPartner || data.supportingPartner),
      dashboardAccess: Array.isArray(data.dashboardAccess) ? data.dashboardAccess : []
    };
  }

  async function upsertUserProfile(user, accessProfile) {
    const username = window.TWS.toUsername(accessProfile.username || accessProfile.displayName || user.email);
    const displayName = accessProfile.displayName || displayNameFromUser(user);
    await setDoc(doc(db, accessCollections.users, user.uid), {
      uid: user.uid,
      email: user.email,
      displayName,
      username,
      role: accessProfile.role,
      isSupportingPartner: accessProfile.isSupportingPartner,
      dashboardAccess: accessProfile.dashboardAccess,
      privileges: accessProfile.privileges,
      joinedDate: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      stats: {
        totalImpactPoints: 0,
        problemsSolved: 0
      },
      updatedAt: serverTimestamp()
    }, { merge: true });
    return { displayName, username };
  }

  function initLoginForm() {
    const form = document.getElementById('loginForm');
    const errorEl = document.getElementById('loginError');
    const submitBtn = document.getElementById('loginSubmitBtn');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      if (errorEl) errorEl.textContent = '';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Signing In...';
      }

      try {
        const credential = await signInWithEmailAndPassword(auth, email, password);
        const user = credential.user;
        const accessProfile = await loadAccessProfile(user);
        const profileIdentity = await upsertUserProfile(user, accessProfile);

        const sessionData = {
          uid: user.uid,
          email: user.email,
          displayName: profileIdentity.displayName,
          username: profileIdentity.username,
          role: accessProfile.role,
          privileges: accessProfile.privileges,
          isSupportingPartner: accessProfile.isSupportingPartner,
          dashboardAccess: accessProfile.dashboardAccess,
          loginTime: Date.now()
        };

        sessionStorage.setItem('portal_session', JSON.stringify(sessionData));
        window.TWS.ensureSolverProfile(sessionData, []);

        gsap.to('.login-card', {
          opacity: 0,
          y: -20,
          scale: 0.98,
          duration: 0.5,
          ease: 'power2.in',
          onComplete: () => {
            window.location.href = dashboardForAccess(accessProfile.role, accessProfile.privileges);
          }
        });
      } catch (err) {
        if (errorEl) errorEl.textContent = friendlyAuthError(err);
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = 'Sign In <span class="btn-arrow">&nearr;</span>';
        }
      }
    });
  }

  function init() {
    gsap.registerPlugin(ScrollTrigger);
    initLoginCanvas();
    animateLoginCard();
    initLoginForm();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
