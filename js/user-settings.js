(function () {
  'use strict';

  const esc = window.TWS.escapeHTML;
  let session = null;
  let profile = null;
  let editedAvatar = '';
  let editedBanner = '';
  let tempAvatarConfig = {};
  let tempPremiumAvatarId = '';
  let avatarEditMode = 'builder';
  let tempBannerValue = '';
  const DEFAULT_AVATAR = {
    face: 'face-round',
    skinTone: 'skin-peach',
    hair: 'hair-sidepart',
    hairColor: 'hair-black',
    eyebrows: 'eyebrows-flat',
    eyes: 'eyes-classic',
    eyeColor: 'eye-brown',
    mouth: 'mouth-smile',
    facialHair: 'facialHair-none',
    glasses: 'glasses-none',
    hat: 'hat-none',
    accessories: 'accessories-none',
    clothing: 'clothing-tshirt',
    clothingColor: 'clothing-moss',
    jacket: 'jacket-none',
    backpack: 'backpack-none',
    background: 'bg-solid',
    backgroundColor: 'color-teal',
    effect: 'effect-none',
    frame: 'frame-none'
  };

  function getSession() {
    return JSON.parse(localStorage.getItem('portal_session') || 'null');
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

  function getIdentityFormValues() {
    return {
      displayName: document.getElementById('displayName')?.value.trim() || '',
      username: window.TWS.toUsername(document.getElementById('displayUsername')?.value || ''),
      specialty: document.getElementById('displaySpecialty')?.value.trim() || '',
      initials: document.getElementById('avatarInitials')?.value.toUpperCase().slice(0, 2) || '',
      bio: document.getElementById('profileBioInput')?.value.trim() || '',
      country: document.getElementById('profileCountry')?.value.trim() || '',
      website: document.getElementById('profileWebsite')?.value.trim() || '',
      linkedin: document.getElementById('profileLinkedin')?.value.trim() || '',
      github: document.getElementById('profileGithub')?.value.trim() || '',
      profileAccent: document.getElementById('profileAccent')?.value || 'moss',
      availability: document.getElementById('profileAvailability')?.value || ''
    };
  }

  function buildProfilePayload(overrides = {}) {
    const values = getIdentityFormValues();
    return {
      ...(profile || {}),
      uid: session.uid || profile?.uid || '',
      email: session.email || profile?.email || '',
      displayName: values.displayName || profile?.displayName || session.displayName || '',
      username: values.username || profile?.username || session.username || '',
      usernameLower: values.username || profile?.usernameLower || session.username || '',
      specialty: values.specialty,
      initials: values.initials || window.TWS.initialsFromName(values.displayName || profile?.displayName || session.displayName),
      avatar: editedAvatar,
      profilePicture: editedAvatar,
      banner: editedBanner,
      bio: values.bio,
      country: values.country,
      website: values.website,
      linkedin: values.linkedin,
      github: values.github,
      profileAccent: values.profileAccent,
      availability: values.availability,
      ...overrides
    };
  }

  async function persistProfile(overrides = {}) {
    const userId = activeUserId();
    if (!userId) {
      alert('Could not identify your account. Please sign in again.');
      return false;
    }
    const payload = buildProfilePayload(overrides);
    await window.TWS.saveUserProfile(userId, payload);
    profile = { ...profile, ...payload };
    session.displayName = payload.displayName;
    session.username = payload.username;
    session.avatar = payload.avatar;
    localStorage.setItem('portal_session', JSON.stringify(session));
    syncPublicProfileLink();
    return true;
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
    await window.TWS.loadCosmeticsAsync();
    if (profile && !profile.referralCode) {
      profile.referralCode = window.TWS.generateReferralCode();
      await window.TWS.saveUserProfile(profile.uid || session.uid, profile);
    }
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

  function parseAvatarConfig(avatarStr) {
    if (avatarStr && avatarStr.startsWith('avatar:config:')) {
      try {
        return JSON.parse(avatarStr.slice('avatar:config:'.length));
      } catch (e) {}
    }
    return { ...DEFAULT_AVATAR };
  }

  function premiumAvatarIdFromValue(avatarStr) {
    return avatarStr && avatarStr.startsWith('avatar:premium:') ? avatarStr.slice('avatar:premium:'.length) : '';
  }

  function selectedPremiumAvatar() {
    const premiumId = premiumAvatarIdFromValue(editedAvatar) || tempPremiumAvatarId;
    return (window.TWS.memory.cosmetics || []).find(item => item.id === premiumId && (item.category === 'premiumAvatar' || item.category === 'adminRoleAvatar')) || null;
  }

  function currentProfilePictureValue() {
    const premiumItem = selectedPremiumAvatar();
    return premiumItem ? window.TWS.cosmeticImageSource(premiumItem) || editedAvatar : editedAvatar;
  }

  function renderProfile() {
    const points = window.TWS.impactPointsFromStats(profile);
    document.getElementById('displayName').value = profile?.displayName || profile?.name || session.displayName || '';
    document.getElementById('displayUsername').value = profile?.username || session.username || '';
    document.getElementById('displaySpecialty').value = profile?.specialty || '';
    document.getElementById('profileBioInput').value = profile?.bio || '';
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
    
    editedAvatar = profile?.avatar || '';
    editedBanner = profile?.banner || '';
    
    const bannerPreview = document.getElementById('settingsBannerPreview');
    const avatarPreview = document.getElementById('settingsAvatarPreview');
    if (bannerPreview) {
      window.TWS.renderProfileBanner(editedBanner, bannerPreview);
    }
    if (avatarPreview) {
      avatarPreview.innerHTML = window.TWS.renderAvatarHTML(profile);
    }
    
    syncPublicProfileLink();
  }

  function renderBuilderOptions(category) {
    const grid = document.getElementById('builderOptionsGrid');
    if (!grid) return;
    grid.innerHTML = '';
    const cosmetics = window.TWS.memory.cosmetics || [];
    const categoryCosmetics = cosmetics.filter(c => c.category === category);
    if (category === 'premiumAvatar' || category === 'adminRoleAvatar') {
      renderPremiumAvatarOptions(grid, categoryCosmetics);
      return;
    }
    categoryCosmetics.forEach(item => {
      const isUnlocked = window.TWS.isCosmeticUnlocked(item, profile);
      const isSelected = tempAvatarConfig[category] === item.id;
      const card = document.createElement('div');
      card.className = `option-card ${isUnlocked ? 'unlocked' : 'locked'} ${isSelected ? 'active' : ''} rarity-${item.rarity.toLowerCase()}`;
      let text = '';
      if (!isUnlocked) {
        if (item.acquisition === 'Level') {
          text = `Lv. ${item.reqLevel}`;
        } else if (item.acquisition === 'Achievement') {
          text = 'Reward';
        } else {
          text = 'Store';
        }
      }
      card.innerHTML = `
        <div class="option-preview-area" id="option-preview-${item.id}"></div>
        <div class="option-info-wrapper">
          <div class="option-preview-badge">${text || item.rarity}</div>
          <div class="option-item-name">${esc(item.name)}</div>
        </div>
      `;

      const previewArea = card.querySelector(`#option-preview-${item.id}`);
      if (previewArea) {
        if (category === 'skinTone') {
          const skinColorMap = {
            'skin-peach': '#ffd8b3',
            'skin-tan': '#e0a96d',
            'skin-olive': '#d4b285',
            'skin-bronze': '#ba825a',
            'skin-dark': '#6b462b',
            'skin-cyan': '#00bcd4',
            'skin-obsidian': '#1e293b',
            'skin-gold': '#eab308'
          };
          previewArea.innerHTML = `<div style="width:28px;height:28px;border-radius:50%;background:${skinColorMap[item.id] || '#ccc'};border:2px solid var(--border-light);box-shadow:inset 0 2px 4px rgba(0,0,0,0.1)"></div>`;
        } else if (category === 'hairColor') {
          const hairColorMap = {
            'hair-black': '#0f0f0f',
            'hair-brown': '#4a311b',
            'hair-blonde': '#ca8a04',
            'hair-red': '#991b1b',
            'hair-silver': '#94a3b8',
            'hair-green': '#166534',
            'hair-rainbow': 'linear-gradient(135deg, #ef4444, #f97316, #eab308, #22c55e, #3b82f6, #a855f7)'
          };
          previewArea.innerHTML = `<div style="width:28px;height:28px;border-radius:50%;background:${hairColorMap[item.id] || '#ccc'};border:2px solid var(--border-light);box-shadow:inset 0 2px 4px rgba(0,0,0,0.1)"></div>`;
        } else if (category === 'clothingColor') {
          const clothingColorMap = {
            'clothing-gray': '#4b5563',
            'clothing-moss': '#23382b',
            'clothing-clay': '#c87d55',
            'clothing-ocean': '#3d5a6c',
            'clothing-royal': '#312e81',
            'clothing-orange': '#ea580c'
          };
          previewArea.innerHTML = `<div style="width:28px;height:28px;border-radius:4px;background:${clothingColorMap[item.id] || '#ccc'};border:2px solid var(--border-light);box-shadow:inset 0 2px 4px rgba(0,0,0,0.1)"></div>`;
        } else if (category === 'backgroundColor') {
          const bgColorMap = {
            'color-gray': '#1e293b',
            'color-teal': '#0f766e',
            'color-clay': '#9a3412',
            'color-violet': '#581c87',
            'color-gold': '#78350f',
            'color-slate': '#0f172a',
            'color-blue': '#1e3a8a',
            'color-green': '#064e3b',
            'color-rose': '#881337'
          };
          previewArea.innerHTML = `<div style="width:28px;height:28px;border-radius:4px;background:${bgColorMap[item.id] || '#ccc'};border:2px solid var(--border-light);box-shadow:inset 0 2px 4px rgba(0,0,0,0.1)"></div>`;
        } else {
          const config = { ...tempAvatarConfig, [category]: item.id };
          previewArea.innerHTML = window.TWS.renderAvatarSVG(config);
        }
      }

      card.addEventListener('click', () => {
        if (!isUnlocked) {
          window.TWS.showToast(`Locked: ${item.description || 'Unavailable'}`);
          return;
        }
        tempAvatarConfig[category] = item.id;
        document.getElementById('builderAvatarPreview').innerHTML = window.TWS.renderAvatarSVG(tempAvatarConfig);
        renderBuilderOptions(category);
      });
      grid.appendChild(card);
    });
  }

  function renderPremiumAvatarOptions(grid, premiumAvatars) {
    grid.innerHTML = '';
    if (!premiumAvatars.length) {
      grid.innerHTML = `<div class="span-full premium-avatar-empty">No premium profile pictures are available yet.</div>`;
      return;
    }
    premiumAvatars.forEach(item => {
      const isUnlocked = window.TWS.isCosmeticUnlocked(item, profile);
      const isSelected = tempPremiumAvatarId === item.id;
      const card = document.createElement('div');
      card.className = `option-card premium-avatar-card ${isUnlocked ? 'unlocked' : 'locked'} ${isSelected ? 'active' : ''} rarity-${item.rarity.toLowerCase()}`;
      let text = item.rarity;
      if (!isUnlocked) {
        if (item.acquisition === 'Role') {
          text = item.reqRole || 'Role';
        } else if (item.acquisition === 'Level') {
          text = `Lv. ${item.reqLevel}`;
        } else if (item.acquisition === 'Achievement') {
          text = 'Reward';
        } else {
          text = 'Store';
        }
      }
      const imagePath = window.TWS.cosmeticImageSource(item);
      card.innerHTML = `
        <div class="option-preview-area premium-avatar-preview">${imagePath ? `<img src="${esc(imagePath)}" alt="${esc(item.name)}" />` : `<span>${esc(String(item.name || item.id).slice(0, 2).toUpperCase())}</span>`}</div>
        <div class="option-info-wrapper">
          <div class="option-preview-badge">${esc(text)}</div>
          <div class="option-item-name">${esc(item.name)}</div>
        </div>
      `;
      card.addEventListener('click', () => {
        if (!isUnlocked) {
          window.TWS.showToast(`Locked: ${item.description || 'Unavailable'}`);
          return;
        }
        tempPremiumAvatarId = item.id;
        avatarEditMode = 'premium';
        document.getElementById('builderAvatarPreview').innerHTML = window.TWS.renderPremiumAvatarHTML(item, profile);
        renderPremiumAvatarOptions(grid, premiumAvatars);
      });
      grid.appendChild(card);
    });
  }

  function renderBannerOptions() {
    const grid = document.getElementById('bannerOptionsGrid');
    if (!grid) return;
    grid.innerHTML = '';
    const cosmetics = window.TWS.memory.cosmetics || [];
    const bannerCosmetics = cosmetics.filter(c => c.category === 'banner');
    bannerCosmetics.forEach(item => {
      const isUnlocked = window.TWS.isCosmeticUnlocked(item, profile);
      const isSelected = tempBannerValue === item.id;
      const card = document.createElement('div');
      card.className = `banner-option-card ${isUnlocked ? 'unlocked' : 'locked'} ${isSelected ? 'active' : ''} rarity-${item.rarity.toLowerCase()}`;
      let text = '';
      if (!isUnlocked) {
        if (item.acquisition === 'Level') {
          text = `Lv. ${item.reqLevel}`;
        } else if (item.acquisition === 'Achievement') {
          text = 'Reward';
        } else {
          text = 'Store';
        }
      }
      card.innerHTML = `
        <div class="banner-preview-box" id="picker-preview-${item.id}"></div>
        <div class="banner-option-info">
          <div class="banner-option-name">${esc(item.name)}</div>
          <div class="banner-option-locked-msg">${text || item.rarity}</div>
        </div>
      `;
      grid.appendChild(card);
      const previewBox = card.querySelector(`#picker-preview-${item.id}`);
      window.TWS.renderProfileBanner(item.id, previewBox);
      card.addEventListener('click', () => {
        if (!isUnlocked) {
          window.TWS.showToast(`Locked: ${item.description || 'Unavailable'}`);
          return;
        }
        tempBannerValue = item.id;
        window.TWS.renderProfileBanner(tempBannerValue, document.getElementById('pickerBannerPreview'));
        renderBannerOptions();
      });
    });
  }

  function initAppearanceEditor() {
    const btnOpenAvatar = document.getElementById('btnOpenAvatarBuilder');
    const btnOpenBanner = document.getElementById('btnOpenBannerPicker');
    const modalAvatar = document.getElementById('avatarBuilderModal');
    const modalBanner = document.getElementById('bannerPickerModal');
    const btnCloseAvatar = document.getElementById('btnCloseAvatarBuilder');
    const btnCloseBanner = document.getElementById('btnCloseBannerPicker');
    const btnCancelAvatar = document.getElementById('btnCancelAvatarChange');
    const btnCancelBanner = document.getElementById('btnCancelBannerChange');
    const btnSaveAvatar = document.getElementById('btnSaveAvatarChange');
    const btnSaveBanner = document.getElementById('btnSaveBannerChange');
    const selectCategory = document.getElementById('avatarCategorySelect');
    
    if (btnOpenAvatar && modalAvatar) {
      btnOpenAvatar.addEventListener('click', () => {
        tempAvatarConfig = parseAvatarConfig(editedAvatar);
        tempPremiumAvatarId = premiumAvatarIdFromValue(editedAvatar);
        avatarEditMode = tempPremiumAvatarId ? 'premium' : 'builder';
        modalAvatar.style.display = 'flex';
        if (avatarEditMode === 'premium') {
          const premiumItem = (window.TWS.memory.cosmetics || []).find(item => item.id === tempPremiumAvatarId);
          document.getElementById('builderAvatarPreview').innerHTML = premiumItem ? window.TWS.renderPremiumAvatarHTML(premiumItem, profile) : window.TWS.renderAvatarSVG(tempAvatarConfig);
          const activeCat = premiumItem?.category === 'adminRoleAvatar' ? 'adminRoleAvatar' : 'premiumAvatar';
          selectCategory.value = activeCat;
          renderBuilderOptions(activeCat);
        } else {
          document.getElementById('builderAvatarPreview').innerHTML = window.TWS.renderAvatarSVG(tempAvatarConfig);
          selectCategory.value = 'face';
          renderBuilderOptions('face');
        }
      });
    }
    
    if (btnOpenBanner && modalBanner) {
      btnOpenBanner.addEventListener('click', () => {
        tempBannerValue = editedBanner || 'banner-community';
        modalBanner.style.display = 'flex';
        window.TWS.renderProfileBanner(tempBannerValue, document.getElementById('pickerBannerPreview'));
        renderBannerOptions();
      });
    }
    
    if (btnCloseAvatar) btnCloseAvatar.addEventListener('click', () => modalAvatar.style.display = 'none');
    if (btnCancelAvatar) btnCancelAvatar.addEventListener('click', () => modalAvatar.style.display = 'none');
    
    if (btnCloseBanner) btnCloseBanner.addEventListener('click', () => modalBanner.style.display = 'none');
    if (btnCancelBanner) btnCancelBanner.addEventListener('click', () => modalBanner.style.display = 'none');
    
    if (selectCategory) {
      selectCategory.addEventListener('change', () => {
        const cat = selectCategory.value;
        if (cat !== 'premiumAvatar' && cat !== 'adminRoleAvatar') {
          avatarEditMode = 'builder';
          document.getElementById('builderAvatarPreview').innerHTML = window.TWS.renderAvatarSVG(tempAvatarConfig);
        }
        renderBuilderOptions(cat);
      });
    }
    
    if (btnSaveAvatar) {
      btnSaveAvatar.addEventListener('click', () => {
        editedAvatar = avatarEditMode === 'premium' && tempPremiumAvatarId
          ? `avatar:premium:${tempPremiumAvatarId}`
          : 'avatar:config:' + JSON.stringify(tempAvatarConfig);
        const profilePictureValue = currentProfilePictureValue();
        const avatarPreview = document.getElementById('settingsAvatarPreview');
        if (avatarPreview) {
          avatarPreview.innerHTML = avatarEditMode === 'premium' && tempPremiumAvatarId
            ? window.TWS.renderAvatarHTML({ ...profile, avatar: editedAvatar, profilePicture: profilePictureValue })
            : window.TWS.renderAvatarSVG(tempAvatarConfig);
        }
        persistProfile({ avatar: editedAvatar, profilePicture: profilePictureValue }).then(() => {
          modalAvatar.style.display = 'none';
        }).catch((err) => {
          console.error('Unable to save avatar', err);
          alert('Your avatar preview updated, but we could not save it right now.');
        });
      });
    }
    
    if (btnSaveBanner) {
      btnSaveBanner.addEventListener('click', () => {
        editedBanner = tempBannerValue;
        const bannerPreview = document.getElementById('settingsBannerPreview');
        if (bannerPreview) {
          window.TWS.renderProfileBanner(editedBanner, bannerPreview);
        }
        persistProfile({ banner: editedBanner }).then(() => {
          modalBanner.style.display = 'none';
        }).catch((err) => {
          console.error('Unable to save banner', err);
          alert('Your banner preview updated, but we could not save it right now.');
        });
      });
    }
  }

  function initProfileForm() {
    const initialsInput = document.getElementById('avatarInitials');
    initialsInput?.addEventListener('input', () => document.getElementById('avatarPreview').textContent = initialsInput.value.toUpperCase().slice(0, 2));
    document.getElementById('displayUsername')?.addEventListener('input', syncPublicProfileLink);
    initAppearanceEditor();
    document.getElementById('identityForm')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const values = getIdentityFormValues();
      const displayName = values.displayName;
      const username = values.username;
      const specialty = values.specialty;
      const initials = values.initials;
      const avatar = editedAvatar;
      const profilePicture = currentProfilePictureValue();
      const banner = editedBanner;
      const userId = activeUserId();
      if (displayName.length < 3 || !window.TWS.validUsername(username)) {
        alert('Use a valid display name and a username with lowercase letters, numbers, or underscores.');
        return;
      }
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
          profilePicture,
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
      profile = { ...profile, displayName, username, usernameLower: username, avatar, profilePicture, banner };
      session.displayName = displayName;
      session.username = username;
      session.avatar = avatar;
      localStorage.setItem('portal_session', JSON.stringify(session));
      syncPublicProfileLink();
      alert('Profile updated.');
    });
  }

  function initSignOut() {
    document.getElementById('signOutBtn')?.addEventListener('click', () => {
      localStorage.removeItem('portal_session');
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
