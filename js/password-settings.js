import { EmailAuthProvider, onAuthStateChanged, reauthenticateWithCredential, updatePassword } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import { auth } from './firebase-core.js';

(function () {
  'use strict';

  function setStatus(message, isError = false) {
    const status = document.getElementById('passwordStatus');
    if (!status) return;
    status.textContent = message;
    status.style.color = isError ? '#c85555' : 'var(--accent-moss)';
  }

  function friendlyPasswordError(error) {
    const code = error?.code || '';
    if (code.includes('wrong-password') || code.includes('invalid-credential')) return 'Current password is incorrect.';
    if (code.includes('weak-password')) return 'Use a new password with at least 6 characters.';
    if (code.includes('too-many-requests')) return 'Too many attempts. Please wait a bit and try again.';
    if (code.includes('requires-recent-login')) return 'Please sign out, sign in again, and retry the password change.';
    return 'Could not change the password. Please try again.';
  }

  function currentUserReady() {
    if (auth.currentUser) return Promise.resolve(auth.currentUser);
    return new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        unsubscribe();
        resolve(user);
      });
    });
  }

  function initPasswordForm() {
    const form = document.getElementById('passwordForm');
    const button = document.getElementById('btnChangePassword');
    if (!form) return;

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const session = JSON.parse(localStorage.getItem('portal_session') || 'null');
      const currentPassword = document.getElementById('currentPassword').value;
      const newPassword = document.getElementById('newPassword').value;
      const confirmPassword = document.getElementById('confirmNewPassword').value;

      if (!session?.email) {
        setStatus('Sign in again before changing your password.', true);
        return;
      }
      if (newPassword !== confirmPassword) {
        setStatus('New password and confirmation do not match.', true);
        return;
      }
      if (newPassword.length < 6) {
        setStatus('Use a new password with at least 6 characters.', true);
        return;
      }

      button.disabled = true;
      button.textContent = 'Changing Password...';
      setStatus('');

      try {
        const user = await currentUserReady();
        if (!user) throw new Error('requires-recent-login');
        const credential = EmailAuthProvider.credential(session.email, currentPassword);
        await reauthenticateWithCredential(user, credential);
        await updatePassword(user, newPassword);
        form.reset();
        setStatus('Password changed successfully.');
      } catch (error) {
        setStatus(friendlyPasswordError(error), true);
      } finally {
        button.disabled = false;
        button.textContent = 'Change Password';
      }
    });
  }

  document.addEventListener('DOMContentLoaded', initPasswordForm);
})();
