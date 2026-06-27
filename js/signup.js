import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import { getAuth, createUserWithEmailAndPassword, updateProfile } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import { getFirestore, doc, getDoc, getDocs, collection, query, where, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
import { firebaseConfig, accessCollections } from './firebase-config.js';

(function () {
  'use strict';

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  const lenis = new Lenis({ lerp: 0.08, smoothWheel: true, touchMultiplier: 1.5 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  function friendlySignupError(error) {
    const code = error?.code || '';
    if (code.includes('email-already-in-use')) return 'That email already has an account. Please sign in instead.';
    if (code.includes('invalid-email')) return 'Enter a valid email address.';
    if (code.includes('weak-password')) return 'Use a password with at least 6 characters.';
    if (code.includes('permission-denied')) return 'Account created, but Firestore blocked profile creation. Check Firestore rules for users.';
    return 'Could not create your account. Please try again.';
  }

  function initLoginCanvas() {
    const canvas = document.getElementById('loginCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let width = 0;
    let height = 0;
    let particles = [];

    function resize() {
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
      particles = Array.from({ length: 44 }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.22,
        vy: -Math.random() * 0.25 - 0.08,
        radius: Math.random() * 2 + 0.8,
        color: Math.random() > 0.45 ? 'rgba(35, 56, 43, 0.22)' : 'rgba(200, 125, 85, 0.2)'
      }));
    }

    function draw() {
      ctx.clearRect(0, 0, width, height);
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.y < -12) {
          p.x = Math.random() * width;
          p.y = height + 12;
        }
        if (p.x < -12 || p.x > width + 12) p.vx *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
      });
      requestAnimationFrame(draw);
    }

    resize();
    draw();
    window.addEventListener('resize', resize);
  }

  async function identityExists({ username, email, uid = '' }) {
    const normalized = window.TWS.toUsername(username);
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanUid = String(uid || '').trim();
    try {
      const usersRef = collection(db, accessCollections.users);
      const checks = [
        getDocs(query(usersRef, where('username', '==', normalized))),
        getDocs(query(usersRef, where('usernameLower', '==', normalized))),
        getDocs(query(usersRef, where('email', '==', cleanEmail)))
      ];
      if (cleanUid) checks.push(getDocs(query(usersRef, where('uid', '==', cleanUid))));
      const snapshots = await Promise.all(checks);
      const uidDoc = cleanUid ? await getDoc(doc(db, accessCollections.users, cleanUid)) : null;
      return snapshots.some((snapshot) => !snapshot.empty) || Boolean(uidDoc?.exists());
    } catch (error) {
      return !(await window.TWS.identityAvailable({ username: normalized, email: cleanEmail, uid: cleanUid }));
    }
  }

  function initSignupForm() {
    const form = document.getElementById('signupForm');
    const errorEl = document.getElementById('signupError');
    const submitBtn = document.getElementById('signupSubmitBtn');
    if (!form) return;

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const displayName = document.getElementById('displayName').value.trim();
      const username = window.TWS.toUsername(document.getElementById('username').value);
      const email = document.getElementById('email').value.trim().toLowerCase();
      const password = document.getElementById('password').value;

      if (errorEl) errorEl.textContent = '';
      if (displayName.length < 3 || username.length < 3 || !/^[a-z0-9_]{3,30}$/.test(username)) {
        if (errorEl) errorEl.textContent = 'Use a valid display name and a username with lowercase letters, numbers, or underscores.';
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Creating Account...';

      try {
        if (await identityExists({ username, email })) {
          throw new Error('identity-taken');
        }

        const credential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(credential.user, { displayName });

        if (await identityExists({ username, email, uid: credential.user.uid })) {
          throw new Error('identity-taken');
        }

        const userDoc = {
          uid: credential.user.uid,
          email,
          displayName,
          username,
          usernameLower: username,
          role: 'Member',
          privileges: [],
          joinedDate: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
          stats: {
            totalImpactPoints: 0,
            problemsSolved: 0,
            problemsIdentified: 0,
            helpfulResponses: 0,
            knowledgeContributions: 0
          },
          badges: [],
          bio: '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };

        await setDoc(doc(db, accessCollections.users, credential.user.uid), userDoc, { merge: true });

        sessionStorage.setItem('portal_session', JSON.stringify({
          uid: credential.user.uid,
          email,
          displayName,
          username,
          role: 'Member',
          privileges: [],
          loginTime: Date.now()
        }));
        sessionStorage.setItem('community_invite_ready', 'true');

        window.location.href = 'home.html';
      } catch (error) {
        if (error.message === 'identity-taken') {
          if (errorEl) errorEl.textContent = 'That username, email, or user ID is already attached to another account.';
        } else if (errorEl) {
          errorEl.textContent = friendlySignupError(error);
        }
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Create Member Account <span class="btn-arrow">&nearr;</span>';
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    gsap.registerPlugin(ScrollTrigger);
    initLoginCanvas();
    gsap.from('.login-card', { opacity: 0, y: 30, duration: 0.8, ease: 'power3.out' });
    initSignupForm();
  });
})();
