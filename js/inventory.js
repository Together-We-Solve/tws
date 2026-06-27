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
    return JSON.parse(sessionStorage.getItem('portal_session') || 'null');
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
    if (item.category === 'banner') {
      const wrapper = document.createElement('div');
      wrapper.className = 'preview-banner-wrapper';
      container.appendChild(wrapper);
      window.TWS.renderProfileBanner(item.id, wrapper);
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
    return cosmetics.filter(item => window.TWS.isCosmeticUnlocked(item, profile));
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
    
    const contentCollection = document.getElementById('collectionTabContent');
    const contentRoad = document.getElementById('roadTabContent');

    tabCollection?.addEventListener('click', () => {
      tabCollection.classList.add('active');
      tabRoad?.classList.remove('active');
      if (contentCollection) contentCollection.style.display = 'block';
      if (contentRoad) contentRoad.style.display = 'none';
      renderCollection();
    });

    tabRoad?.addEventListener('click', () => {
      tabRoad.classList.add('active');
      tabCollection?.classList.remove('active');
      if (contentRoad) contentRoad.style.display = 'block';
      if (contentCollection) contentCollection.style.display = 'none';
      renderTimeline();
    });

    document.getElementById('collectionCategory')?.addEventListener('change', renderCollection);

    document.getElementById('signOutBtn')?.addEventListener('click', () => {
      sessionStorage.removeItem('portal_session');
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
