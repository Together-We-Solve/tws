(function () {
  'use strict';

  const esc = window.TWS.escapeHTML;
  let session = null;
  let profile = null;
  let cosmetics = [];

  const DEFAULT_PREVIEW_BASE = {
    face: 'face-round',
    skinTone: 'skin-peach',
    hair: 'hair-none',
    hairColor: 'hair-black',
    eyebrows: 'eyebrows-flat',
    eyes: 'eyes-classic',
    eyeColor: 'eye-brown',
    mouth: 'mouth-neutral',
    facialHair: 'facialHair-none',
    glasses: 'glasses-none',
    hat: 'hat-none',
    accessories: 'accessories-none',
    clothing: 'clothing-tshirt',
    clothingColor: 'clothing-gray',
    jacket: 'jacket-none',
    backpack: 'backpack-none',
    background: 'bg-solid',
    backgroundColor: 'color-gray',
    effect: 'effect-none',
    frame: 'frame-none'
  };

  function getSession() {
    return JSON.parse(localStorage.getItem('portal_session') || 'null');
  }

  function sameIdentity(member) {
    const sessionUid = String(session?.uid || '').toLowerCase();
    const sessionEmail = String(session?.email || '').toLowerCase();
    return Boolean(
      (sessionUid && String(member.uid || member.id || '').toLowerCase() === sessionUid) ||
      (sessionEmail && String(member.email || '').toLowerCase() === sessionEmail)
    );
  }

  async function load() {
    session = getSession();
    if (!session) {
      window.location.href = 'login.html';
      return;
    }
    const members = await window.TWS.loadMovementMembersAsync([]);
    profile = members.find(sameIdentity) || window.TWS.ensureSolverProfile(session);
    cosmetics = await window.TWS.loadCosmeticsAsync();
  }

  function renderProgression() {
    const exp = profile.experience || 0;
    const prog = window.TWS.progressionFromExperience(exp);

    const levelBadge = document.getElementById('userLevelBadge');
    const rankText = document.getElementById('userRankText');
    const expFill = document.getElementById('userExpFill');
    const expText = document.getElementById('userExpText');

    if (levelBadge) levelBadge.textContent = `Level ${prog.level}`;
    if (rankText) rankText.textContent = window.TWS.memberPrefix(profile);
    if (expFill) expFill.style.width = `${prog.progressPercent}%`;
    if (expText) expText.textContent = `${prog.currentLevelExperience.toLocaleString()} / ${prog.nextLevelExperience.toLocaleString()} EXP`;
    
    profile.progressionLevel = prog.level;
  }

  function renderPreview(item, container) {
    container.innerHTML = '';
    const rewardCats = ['ai-credits', 'gift-card', 'physical-reward', 'external-service', 'other-reward'];
    if (item.category === 'banner') {
      const wrapper = document.createElement('div');
      wrapper.className = 'preview-banner-wrapper';
      container.appendChild(wrapper);
      window.TWS.renderProfileBanner(item.id, wrapper);
    } else if (rewardCats.includes(item.category)) {
      const rewardSvgs = {
        'ai-credits': `<svg viewBox="0 0 100 100" width="40" height="40" fill="none" stroke="var(--accent-moss)" stroke-width="2"><rect x="25" y="25" width="50" height="50" rx="10" stroke-width="3" /><path d="M15 35 H25 M15 50 H25 M15 65 H25 M75 35 H85 M75 50 H85 M75 65 H85" stroke-linecap="round" stroke-width="3" /><path d="M35 15 V25 M50 15 V25 M65 15 V25 M35 75 V85 M50 75 V85 M65 75 V85" stroke-linecap="round" stroke-width="3" /><circle cx="50" cy="50" r="10" fill="var(--accent-moss)" opacity="0.2" /><path d="M45 50 Q50 42 55 50 T65 50" stroke-width="2" /></svg>`,
        'gift-card': `<svg viewBox="0 0 100 100" width="40" height="40" fill="none" stroke="var(--accent-clay)" stroke-width="2"><rect x="15" y="25" width="70" height="50" rx="8" stroke-width="3" /><line x1="15" y1="40" x2="85" y2="40" stroke-width="3" /><rect x="25" y="55" width="16" height="10" rx="2" fill="var(--accent-clay)" opacity="0.3" /><path d="M 65 35 L 75 45 M 75 35 L 65 45" stroke-linecap="round" stroke-width="2" /></svg>`,
        'physical-reward': `<svg viewBox="0 0 100 100" width="40" height="40" fill="none" stroke="var(--accent-moss)" stroke-width="2"><path d="M15 35 L50 15 L85 35 L50 55 Z" stroke-width="2.5" /><path d="M15 35 V70 L50 90 V55 Z" stroke-width="2.5" /><path d="M85 35 V70 L50 90 V55 Z" stroke-width="2.5" /><path d="M50 15 V55 M15 35 L50 55 L85 35" stroke-opacity="0.5" /><path d="M42 20 L50 24 L58 20" stroke="var(--accent-clay)" stroke-width="1.5" /></svg>`,
        'external-service': `<svg viewBox="0 0 100 100" width="40" height="40" fill="none" stroke="var(--accent-moss)" stroke-width="2"><path d="M25 65 A15 15 0 0 1 35 37 A22 22 0 0 1 73 45 A15 15 0 0 1 75 65 Z" stroke-width="2.5" /><circle cx="50" cy="58" r="4" fill="var(--accent-moss)" /><path d="M50 62 V72 H56 M50 67 H54" stroke-linecap="round" stroke-width="2" /></svg>`,
        'other-reward': `<svg viewBox="0 0 100 100" width="40" height="40" fill="none" stroke="var(--accent-clay)" stroke-width="2"><rect x="22" y="38" width="56" height="42" rx="4" stroke-width="3" /><rect x="18" y="28" width="64" height="10" rx="2" stroke-width="3" /><line x1="50" y1="28" x2="50" y2="80" stroke-width="2.5" /><path d="M50 28 C40 18, 50 10, 50 28 C50 10, 60 18, 50 28 Z" stroke-width="2" /></svg>`
      };
      container.innerHTML = `
        <div class="reward-preview-container" style="display:flex;align-items:center;justify-content:center;height:100%;background:rgba(28,30,29,0.02);border-radius:12px;width:100%;">
          ${rewardSvgs[item.category] || rewardSvgs['other-reward']}
        </div>
      `;
    } else {
      const config = { ...DEFAULT_PREVIEW_BASE, [item.category]: item.id };
      if (item.category === 'hairColor') {
        config.hair = 'hair-sidepart';
      }
      if (item.category === 'clothingColor') {
        config.clothing = 'clothing-tshirt';
      }
      if (item.category === 'backgroundColor') {
        config.background = 'bg-solid';
      }
      container.innerHTML = window.TWS.renderAvatarSVG(config);
    }
  }

  function getUnlockedItems() {
    const rewardCats = ['ai-credits', 'gift-card', 'physical-reward', 'external-service', 'other-reward'];
    return cosmetics.filter(item => window.TWS.isCosmeticUnlocked(item, profile) && !rewardCats.includes(item.category));
  }

  function renderCollection() {
    const grid = document.getElementById('collectionGrid');
    if (!grid) return;
    grid.innerHTML = '';

    const categoryFilter = document.getElementById('collectionCategory').value;
    let items = getUnlockedItems();

    if (categoryFilter !== 'all') {
      items = items.filter(c => c.category === categoryFilter);
    }

    if (items.length === 0) {
      grid.innerHTML = `<div class="span-full" style="text-align:center; padding: 40px; opacity:0.5;">No cosmetics unlocked in this category yet.</div>`;
      return;
    }

    items.forEach(item => {
      const card = document.createElement('div');
      card.className = `inventory-item-card`;
      card.innerHTML = `
        <div class="inventory-preview-area" id="inv-preview-${item.id}"></div>
        <div class="inventory-card-details">
          <span class="inventory-item-cat">${item.category}</span>
          <h4 class="inventory-item-name">${esc(item.name)}</h4>
          <span class="inventory-item-rarity rarity-${item.rarity.toLowerCase()}">${item.rarity}</span>
        </div>
      `;
      grid.appendChild(card);
      const previewArea = card.querySelector(`#inv-preview-${item.id}`);
      renderPreview(item, previewArea);
    });
  }

  function renderRewards() {
    const grid = document.getElementById('rewardsGrid');
    if (!grid) return;
    grid.innerHTML = '';

    const rewardCats = ['ai-credits', 'gift-card', 'physical-reward', 'external-service', 'other-reward'];
    const owned = profile.ownedCosmetics || [];
    const purchasedRewards = cosmetics.filter(item => 
      rewardCats.includes(item.category) && owned.includes(item.id)
    );

    if (purchasedRewards.length === 0) {
      grid.innerHTML = `<div class="span-full" style="text-align:center; padding: 40px; opacity:0.5;">No rewards claimed yet. Visit the Marketplace to browse and acquire rewards!</div>`;
      return;
    }

    purchasedRewards.forEach(item => {
      const card = document.createElement('div');
      card.className = `inventory-item-card reward-item-card`;
      card.style.display = 'flex';
      card.style.flexDirection = 'column';
      card.style.gap = '12px';
      card.style.padding = '16px';
      card.style.background = 'var(--bg-warm)';
      card.style.border = '1px solid var(--border-light)';
      card.style.borderRadius = '12px';

      card.innerHTML = `
        <div style="display:flex;gap:12px;align-items:center;">
          <div class="inventory-preview-area" id="reward-prev-${item.id}" style="width:50px;height:50px;flex-shrink:0;"></div>
          <div class="inventory-card-details" style="flex:1;">
            <span class="inventory-item-cat" style="font-size:10px;text-transform:uppercase;opacity:0.5;">${esc(item.category)}</span>
            <h4 class="inventory-item-name" style="margin:2px 0 4px 0;font-size:15px;">${esc(item.name)}</h4>
            <span class="inventory-item-rarity rarity-${item.rarity.toLowerCase()}">${item.rarity}</span>
          </div>
        </div>
        <div style="font-size:12px;opacity:0.75;line-height:1.5;">${esc(item.description || 'No description.')}</div>
        <div class="reward-claim-details" style="background:#fff;border:1px solid var(--border-light);border-radius:8px;padding:12px;margin-top:4px;">
          ${item.redeemInstructions ? `
            <h5 style="margin:0 0 4px 0;font-size:11px;font-weight:600;opacity:0.6;font-family:var(--font-display);">Redemption Instructions</h5>
            <p style="margin:0 0 10px 0;font-size:12px;white-space:pre-line;line-height:1.4;">${esc(item.redeemInstructions)}</p>
          ` : ''}
          ${item.redeemCode ? `
            <h5 style="margin:0 0 4px 0;font-size:11px;font-weight:600;opacity:0.6;font-family:var(--font-display);">Redemption Code</h5>
            <div style="display:flex;gap:8px;align-items:center;">
              <input type="text" value="${esc(item.redeemCode)}" readonly id="rewardCode-${item.id}" style="flex:1;padding:6px 10px;border:1px solid var(--border-light);border-radius:4px;font-family:monospace;font-size:13px;background:var(--bg-warm);" />
              <button class="btn btn-outline btn-sm" onclick="navigator.clipboard.writeText('${esc(item.redeemCode)}');window.TWS.showToast('Copied code!')" style="padding:4px 8px;font-size:11px;white-space:nowrap;">Copy</button>
            </div>
          ` : ''}
          ${item.externalUrl ? `
            <a href="${esc(item.externalUrl)}" target="_blank" rel="noopener" class="btn btn-outline btn-sm" style="display:inline-block;width:100%;text-align:center;margin-top:8px;font-size:11px;padding:6px 0;">Go to Claim Page &nearr;</a>
          ` : ''}
        </div>
      `;
      grid.appendChild(card);
      const prevContainer = card.querySelector(`#reward-prev-${item.id}`);
      if (prevContainer) {
        renderPreview(item, prevContainer);
      }
    });
  }

  function renderTimeline() {
    const timeline = document.getElementById('roadTimeline');
    if (!timeline) return;
    timeline.innerHTML = '';

    const userLevel = profile.progressionLevel || 1;
    const levelItems = cosmetics.filter(c => c.enabled && c.acquisition === 'Level');
    
    const levelsMap = {};
    levelItems.forEach(item => {
      const lvl = item.reqLevel || 1;
      if (!levelsMap[lvl]) levelsMap[lvl] = [];
      levelsMap[lvl].push(item);
    });

    const sortedLevels = Object.keys(levelsMap).map(Number).sort((a, b) => a - b);

    if (sortedLevels.length === 0) {
      timeline.innerHTML = `<div style="text-align:center; opacity:0.5; padding: 40px;">No progression cosmetics found.</div>`;
      return;
    }

    sortedLevels.forEach(lvl => {
      const isAchieved = userLevel >= lvl;
      const unlocks = levelsMap[lvl];
      const segment = document.createElement('div');
      segment.className = `road-milestone-segment ${isAchieved ? 'achieved' : 'locked'}`;

      let cardsHtml = '';
      unlocks.forEach(item => {
        cardsHtml += `
          <div class="road-unlock-card">
            <div class="road-unlock-preview ${item.category === 'banner' ? 'banner-preview' : ''}" id="road-prev-${item.id}"></div>
            <div class="road-unlock-info">
              <span class="road-unlock-name">${esc(item.name)}</span>
              <span class="road-unlock-type">${item.category}</span>
            </div>
          </div>
        `;
      });

      segment.innerHTML = `
        <div class="road-indicator-node">${isAchieved ? '✓' : lvl}</div>
        <div class="road-milestone-content">
          <div class="road-milestone-header">
            <h3 class="road-milestone-title">Level ${lvl} Rewards</h3>
            <span class="road-milestone-status">${isAchieved ? 'Unlocked' : 'Locked'}</span>
          </div>
          <div class="road-unlocks-grid">
            ${cardsHtml}
          </div>
        </div>
      `;

      timeline.appendChild(segment);

      unlocks.forEach(item => {
        const prevContainer = segment.querySelector(`#road-prev-${item.id}`);
        if (prevContainer) {
          renderPreview(item, prevContainer);
        }
      });
    });
  }

  function initEvents() {
    const tabCollection = document.getElementById('tabBtnCollection');
    const tabRoad = document.getElementById('tabBtnRoad');
    const tabRewards = document.getElementById('tabBtnRewards');
    
    const contentCollection = document.getElementById('collectionTabContent');
    const contentRoad = document.getElementById('roadTabContent');
    const contentRewards = document.getElementById('rewardsTabContent');

    tabCollection?.addEventListener('click', () => {
      tabCollection.classList.add('active');
      tabRoad?.classList.remove('active');
      tabRewards?.classList.remove('active');
      if (contentCollection) contentCollection.style.display = 'block';
      if (contentRoad) contentRoad.style.display = 'none';
      if (contentRewards) contentRewards.style.display = 'none';
      renderCollection();
    });

    tabRoad?.addEventListener('click', () => {
      tabRoad.classList.add('active');
      tabCollection?.classList.remove('active');
      tabRewards?.classList.remove('active');
      if (contentRoad) contentRoad.style.display = 'block';
      if (contentCollection) contentCollection.style.display = 'none';
      if (contentRewards) contentRewards.style.display = 'none';
      renderTimeline();
    });

    tabRewards?.addEventListener('click', () => {
      tabRewards.classList.add('active');
      tabCollection?.classList.remove('active');
      tabRoad?.classList.remove('active');
      if (contentRewards) contentRewards.style.display = 'block';
      if (contentCollection) contentCollection.style.display = 'none';
      if (contentRoad) contentRoad.style.display = 'none';
      renderRewards();
    });

    document.getElementById('collectionCategory')?.addEventListener('change', renderCollection);

    document.getElementById('signOutBtn')?.addEventListener('click', () => {
      localStorage.removeItem('portal_session');
      window.location.href = 'login.html';
    });
  }

  async function init() {
    await load();
    renderProgression();
    renderCollection();
    initEvents();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
