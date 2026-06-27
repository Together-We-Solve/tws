import { createUserWithEmailAndPassword, updateProfile } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import { doc, getDoc, getDocs, collection, query, where, runTransaction, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
import { accessCollections } from './firebase-config.js';
import { auth, db } from './firebase-core.js';

(function () {
  'use strict';

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
    const cleanUid = String(uid || '').trim().toLowerCase();
    const sameIdentity = (data = {}, id = '') => (
      (cleanUid && String(data.uid || id || '').trim().toLowerCase() === cleanUid) ||
      (cleanEmail && String(data.email || '').trim().toLowerCase() === cleanEmail)
    );
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
      const usernameDoc = accessCollections.usernames ? await getDoc(doc(db, accessCollections.usernames, normalized)) : null;
      const profileConflict = snapshots.some((snapshot) => snapshot.docs.some((item) => !sameIdentity(item.data(), item.id)));
      const uidConflict = Boolean(uidDoc?.exists() && !sameIdentity(uidDoc.data(), uidDoc.id));
      const usernameConflict = Boolean(usernameDoc?.exists() && !sameIdentity(usernameDoc.data(), usernameDoc.id));
      return profileConflict || uidConflict || usernameConflict;
    } catch (error) {
      return !(await window.TWS.identityAvailable({ username: normalized, email: cleanEmail, uid: cleanUid }));
    }
  }

  function initSignupForm() {
    const form = document.getElementById('signupForm');
    const errorEl = document.getElementById('signupError');
    const submitBtn = document.getElementById('signupSubmitBtn');
    if (!form) return;

    const cachedRef = localStorage.getItem('tws_referral_ref');
    let validReferrer = null;

    if (cachedRef) {
      const usersRef = collection(db, accessCollections.users);
      getDocs(query(usersRef, where('referralCode', '==', cachedRef))).then((snap) => {
        if (!snap.empty) {
          const referrerDoc = snap.docs[0];
          validReferrer = {
            uid: referrerDoc.id,
            displayName: referrerDoc.data().displayName || referrerDoc.data().username,
            username: referrerDoc.data().username,
            email: referrerDoc.data().email
          };
          const refContainer = document.getElementById('referredByContainer');
          const refText = document.getElementById('referrerCodeText');
          if (refContainer && refText) {
            refText.textContent = `${validReferrer.displayName} (${cachedRef})`;
            refContainer.style.display = 'block';
          }
        }
      }).catch((err) => {
        console.warn(err);
      });
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const displayName = document.getElementById('displayName').value.trim();
      const username = window.TWS.toUsername(document.getElementById('username').value);
      const email = document.getElementById('email').value.trim().toLowerCase();
      const password = document.getElementById('password').value;

      if (errorEl) errorEl.textContent = '';
      if (displayName.length < 3 || !window.TWS.validUsername(username)) {
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

        const selfRefCode = window.TWS.generateReferralCode();
        const userDoc = {
          uid: credential.user.uid,
          email,
          displayName,
          username,
          usernameLower: username,
          role: 'Member',
          privileges: [],
          joinedDate: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
          referralCode: selfRefCode,
          referralTier: 'Bronze Connector',
          referralBadgeLevel: 0,
          stats: {
            experience: 0,
            impactPoints: 0,
            totalImpactPoints: 0,
            problemsSolved: 0,
            problemsIdentified: 0,
            helpfulResponses: 0,
            knowledgeContributions: 0,
            successfulReferrals: 0,
            pendingReferrals: 0,
            rejectedReferrals: 0,
            referralImpactPoints: 0,
            referralExperience: 0
          },
          badges: ['first-step'],
          bio: '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };

        if (validReferrer) {
          userDoc.referredBy = validReferrer.uid;
          userDoc.referredByCode = cachedRef;
        }

        await runTransaction(db, async (transaction) => {
          const userRef = doc(db, accessCollections.users, credential.user.uid);
          const usernameRef = doc(db, accessCollections.usernames, username);
          const usernameSnapshot = await transaction.get(usernameRef);
          if (usernameSnapshot.exists() && usernameSnapshot.data().uid !== credential.user.uid) {
            throw new Error('identity-taken');
          }

          if (validReferrer) {
            const referrerRef = doc(db, accessCollections.users, validReferrer.uid);
            const referrerSnapshot = await transaction.get(referrerRef);
            if (referrerSnapshot.exists()) {
              const rData = referrerSnapshot.data();
              const rStats = rData.stats || {};
              const currentPending = Number(rStats.pendingReferrals) || 0;
              transaction.update(referrerRef, {
                'stats.pendingReferrals': currentPending + 1
              });
            }

            const referralId = `ref_${credential.user.uid}`;
            const referralRef = doc(db, 'referrals', referralId);

            let clientIp = 'unknown';
            try {
              const ipRes = await fetch('https://api.ipify.org?format=json').then(r => r.json());
              if (ipRes && ipRes.ip) clientIp = ipRes.ip;
            } catch (ipErr) {}

            transaction.set(referralRef, {
              id: referralId,
              inviterUid: validReferrer.uid,
              inviterName: validReferrer.displayName,
              inviterUsername: validReferrer.username,
              inviteeUid: credential.user.uid,
              inviteeName: displayName,
              inviteeUsername: username,
              inviteeEmail: email,
              status: 'Pending Verification',
              submittedAt: new Date().toISOString(),
              validationDate: null,
              rejectionReason: null,
              verifiedAt: null,
              inviteeIp: clientIp,
              inviteeUserAgent: navigator.userAgent,
              validationEvidence: {
                emailVerified: false,
                accountAgeDays: 0,
                profileCompleted: false,
                activityCount: 0
              },
              fraudScore: {
                selfReferral: false,
                duplicateIp: false,
                suspiciousDevice: false,
                disposableEmail: false
              },
              history: [{
                status: 'Pending Verification',
                updatedBy: 'system',
                updatedAt: new Date().toISOString()
              }]
            }, { merge: true });

            const notifId = `notif_ref_${credential.user.uid}`;
            const notifRef = doc(db, accessCollections.notifications, notifId);
            transaction.set(notifRef, {
              id: notifId,
              userId: validReferrer.uid,
              email: validReferrer.email,
              type: 'referral',
              title: 'New Pending Referral',
              message: `${displayName} has signed up using your referral link. Rewards will be verified soon.`,
              read: false,
              createdBy: credential.user.uid,
              createdAt: new Date().toISOString()
            }, { merge: true });
          }

          transaction.set(usernameRef, {
            uid: credential.user.uid,
            email,
            username,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          }, { merge: true });
          transaction.set(userRef, userDoc, { merge: true });
        });

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
