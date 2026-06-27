(function () {
  'use strict';

  const esc = window.TWS.escapeHTML;
  let session = null;
  let profile = null;

  function getSession() {
    return JSON.parse(sessionStorage.getItem('portal_session') || 'null');
  }

  function activeUserId() {
    return session?.uid || session?.email || profile?.id || profile?.uid || '';
  }

  function sameIdentity(member) {
    const sessionUid = String(session?.uid || '').toLowerCase();
    const sessionEmail = String(session?.email || '').toLowerCase();
    return Boolean(
      (sessionUid && String(member.uid || member.id || '').toLowerCase() === sessionUid) ||
      (sessionEmail && String(member.email || '').toLowerCase() === sessionEmail)
    );
  }

  function syncPublicProfileLink() {
    const link = document.getElementById('viewPublicProfileLink');
    if (!link) return;
    const username = document.getElementById('displayUsername')?.value || profile?.username || session?.username || '';
    link.href = window.TWS.profileUrl(username);
  }

  async function load() {
    session = getSession();
    if (!session) {
      window.location.href = 'login.html';
      return;
    }
    const members = await window.TWS.loadMovementMembersAsync([]);
    profile = members.find(sameIdentity)
      || window.TWS.ensureSolverProfile(session);
  }

  function renderShell() {
    const hero = document.querySelector('.settings-hero .hero-content');
    if (hero) {
      hero.innerHTML = `
        <div class="hero-eyebrow"><span class="hero-eyebrow-text">User Dashboard</span><div class="hero-eyebrow-line"></div></div>
        <h1 class="hero-headline">Profile settings</h1>
        <p class="hero-tagline">Manage your editable public identity, contribution details, and profile credentials.</p>
      `;
    }

    const summaryTitle = document.querySelector('.card-summary .card-title');
    if (summaryTitle) summaryTitle.textContent = 'Member Rank';
    const subtitle = document.querySelector('.card-summary .card-subtitle');
    if (subtitle) subtitle.textContent = 'Your role is assigned by superadmins. Prefixes are earned from impact score.';
  }

  function renderProfile() {
    const points = window.TWS.impactPointsFromStats(profile);
    document.getElementById('displayName').value = profile?.displayName || profile?.name || session.displayName || '';
    document.getElementById('displayUsername').value = profile?.username || session.username || '';
    document.getElementById('displaySpecialty').value = profile?.specialty || '';
    document.getElementById('profileBioInput').value = profile?.bio || '';
    document.getElementById('profilePictureUrl').value = profile?.avatar || profile?.profilePicture || '';
    document.getElementById('profileBannerUrl').value = profile?.banner || '';
    document.getElementById('profileCountry').value = profile?.country || '';
    document.getElementById('profileWebsite').value = profile?.website || '';
    document.getElementById('profileLinkedin').value = profile?.linkedin || '';
    document.getElementById('profileGithub').value = profile?.github || '';
    document.getElementById('profileAccent').value = profile?.profileAccent || 'moss';
    document.getElementById('profileAvailability').value = profile?.availability || '';
    document.getElementById('avatarInitials').value = profile?.initials || window.TWS.initialsFromName(profile?.displayName || session.displayName);
    document.getElementById('avatarPreview').textContent = document.getElementById('avatarInitials').value || 'TW';
    document.getElementById('credPoints').textContent = `${points.toLocaleString()} IP`;
    document.getElementById('credSolved').textContent = `${Number(profile?.solved || profile?.stats?.problemsSolved || 0)} solved`;
    document.getElementById('credRank').textContent = `${window.TWS.memberPrefix(profile)}${profile?.adminRole ? ` • ${profile.adminRole}` : ''}`;
    syncPublicProfileLink();
  }

  function initProfileForm() {
    const initialsInput = document.getElementById('avatarInitials');
    initialsInput?.addEventListener('input', () => document.getElementById('avatarPreview').textContent = initialsInput.value.toUpperCase().slice(0, 2));
    document.getElementById('displayUsername')?.addEventListener('input', syncPublicProfileLink);
    initImageInput('profilePictureFile', 'profilePictureUrl');
    initImageInput('profileBannerFile', 'profileBannerUrl');
    document.getElementById('identityForm')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const displayName = document.getElementById('displayName').value.trim();
      const username = window.TWS.toUsername(document.getElementById('displayUsername').value);
      const specialty = document.getElementById('displaySpecialty').value.trim();
      const initials = document.getElementById('avatarInitials').value.toUpperCase().slice(0, 2);
      const avatar = document.getElementById('profilePictureUrl').value.trim();
      const banner = document.getElementById('profileBannerUrl').value.trim();
      if (displayName.length < 3 || !window.TWS.validUsername(username)) {
        alert('Use a valid display name and a username with lowercase letters, numbers, or underscores.');
        return;
      }
      const userId = activeUserId();
      if (!userId) {
        alert('Could not identify your account. Please sign in again.');
        return;
      }
      if (!(await window.TWS.identityAvailable({ username, email: session.email, uid: session.uid || userId }))) {
        alert('That username, email, or user ID is already attached to another account.');
        return;
      }
      try {
        await window.TWS.saveUserProfile(userId, {
          ...(profile || {}),
          uid: session.uid || profile?.uid || '',
          email: session.email || profile?.email || '',
          displayName,
          username,
          usernameLower: username,
          specialty,
          initials,
          avatar,
          profilePicture: avatar,
          banner,
          bio: document.getElementById('profileBioInput').value.trim(),
          country: document.getElementById('profileCountry').value.trim(),
          website: document.getElementById('profileWebsite').value.trim(),
          linkedin: document.getElementById('profileLinkedin').value.trim(),
          github: document.getElementById('profileGithub').value.trim(),
          profileAccent: document.getElementById('profileAccent').value,
          availability: document.getElementById('profileAvailability').value
        });
      } catch (err) {
        if (['username-taken', 'invalid-username'].includes(err?.message)) {
          alert('That username is not available.');
          return;
        }
        throw err;
      }
      session.displayName = displayName;
      session.username = username;
      session.avatar = avatar;
      sessionStorage.setItem('portal_session', JSON.stringify(session));
      profile = { ...profile, displayName, username, usernameLower: username, avatar, profilePicture: avatar };
      syncPublicProfileLink();
      alert('Profile updated.');
    });
  }

  function initImageInput(fileInputId, urlInputId) {
    const fileInput = document.getElementById(fileInputId);
    const urlInput = document.getElementById(urlInputId);
    if (!fileInput || !urlInput) return;
    fileInput.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        alert('Please choose an image file.');
        fileInput.value = '';
        return;
      }
      if (file.size > 650 * 1024) {
        alert('Please choose an image smaller than 650 KB, or paste an external image URL.');
        fileInput.value = '';
        return;
      }
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        urlInput.value = reader.result;
      });
      reader.readAsDataURL(file);
    });
  }

  function initSignOut() {
    document.getElementById('signOutBtn')?.addEventListener('click', () => {
      sessionStorage.removeItem('portal_session');
      window.location.href = 'login.html';
    });
  }

  async function init() {
    await load();
    renderShell();
    renderProfile();
    initProfileForm();
    initSignOut();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
