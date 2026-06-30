(function () {
  'use strict';

  const esc = window.TWS.escapeHTML;
  let session = null;
  let profile = null;
  let cosmetics = [];
  let selectedCosmetic = null;

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

  function renderBalance() {
    const spendable = Number(profile?.stats?.impactPoints ?? profile?.impactPoints ?? 0);
    const balanceText = document.getElementById('userBalanceText');
    if (balanceText) {
      balanceText.textContent = `${spendable.toLocaleString()} IP`;
    }
  }

  function renderPreview(item, container) {
    container.innerHTML = '';
    const rewardCats = ['ai-credits', 'gift-card', 'physical-reward', 'external-service', 'other-reward'];
    if (item.category === 'banner') {
      const wrapper = document.createElement('div');
      wrapper.className = 'preview-banner-wrapper';
      container.appendChild(wrapper);
      window.TWS.renderProfileBanner(item.id, wrapper);
      container.classList.add('banner-box');
    } else if (rewardCats.includes(item.category)) {
      const rewardSvgs = {
        'ai-credits': `<svg viewBox="0 0 100 100" width="60" height="60" fill="none" stroke="var(--accent-moss)" stroke-width="2"><rect x="25" y="25" width="50" height="50" rx="10" stroke-width="3" /><path d="M15 35 H25 M15 50 H25 M15 65 H25 M75 35 H85 M75 50 H85 M75 65 H85" stroke-linecap="round" stroke-width="3" /><path d="M35 15 V25 M50 15 V25 M65 15 V25 M35 75 V85 M50 75 V85 M65 75 V85" stroke-linecap="round" stroke-width="3" /><circle cx="50" cy="50" r="10" fill="var(--accent-moss)" opacity="0.2" /><path d="M45 50 Q50 42 55 50 T65 50" stroke-width="2" /></svg>`,
        'gift-card': `<svg viewBox="0 0 100 100" width="60" height="60" fill="none" stroke="var(--accent-clay)" stroke-width="2"><rect x="15" y="25" width="70" height="50" rx="8" stroke-width="3" /><line x1="15" y1="40" x2="85" y2="40" stroke-width="3" /><rect x="25" y="55" width="16" height="10" rx="2" fill="var(--accent-clay)" opacity="0.3" /><path d="M 65 35 L 75 45 M 75 35 L 65 45" stroke-linecap="round" stroke-width="2" /></svg>`,
        'physical-reward': `<svg viewBox="0 0 100 100" width="60" height="60" fill="none" stroke="var(--accent-moss)" stroke-width="2"><path d="M15 35 L50 15 L85 35 L50 55 Z" stroke-width="2.5" /><path d="M15 35 V70 L50 90 V55 Z" stroke-width="2.5" /><path d="M85 35 V70 L50 90 V55 Z" stroke-width="2.5" /><path d="M50 15 V55 M15 35 L50 55 L85 35" stroke-opacity="0.5" /><path d="M42 20 L50 24 L58 20" stroke="var(--accent-clay)" stroke-width="1.5" /></svg>`,
        'external-service': `<svg viewBox="0 0 100 100" width="60" height="60" fill="none" stroke="var(--accent-moss)" stroke-width="2"><path d="M25 65 A15 15 0 0 1 35 37 A22 22 0 0 1 73 45 A15 15 0 0 1 75 65 Z" stroke-width="2.5" /><circle cx="50" cy="58" r="4" fill="var(--accent-moss)" /><path d="M50 62 V72 H56 M50 67 H54" stroke-linecap="round" stroke-width="2" /></svg>`,
        'other-reward': `<svg viewBox="0 0 100 100" width="60" height="60" fill="none" stroke="var(--accent-clay)" stroke-width="2"><rect x="22" y="38" width="56" height="42" rx="4" stroke-width="3" /><rect x="18" y="28" width="64" height="10" rx="2" stroke-width="3" /><line x1="50" y1="28" x2="50" y2="80" stroke-width="2.5" /><path d="M50 28 C40 18, 50 10, 50 28 C50 10, 60 18, 50 28 Z" stroke-width="2" /></svg>`
      };
      container.innerHTML = `
        <div class="reward-preview-container" style="display:flex;align-items:center;justify-content:center;height:100%;background:rgba(28,30,29,0.02);border-radius:12px;width:100%;">
          ${rewardSvgs[item.category] || rewardSvgs['other-reward']}
        </div>
      `;
      container.classList.remove('banner-box');
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
      container.classList.remove('banner-box');
    }
  }

  function getFilteredItems() {
    const categoryFilter = document.getElementById('filterCategory').value;
    const rarityFilter = document.getElementById('filterRarity').value;
    const sortBy = document.getElementById('sortItems').value;

    let items = cosmetics.filter(c => c.enabled && c.acquisition === 'Marketplace');

    if (categoryFilter !== 'all') {
      items = items.filter(c => c.category === categoryFilter);
    }
    if (rarityFilter !== 'all') {
      items = items.filter(c => c.rarity === rarityFilter);
    }

    if (sortBy === 'price-asc') {
      items.sort((a, b) => (a.price || 0) - (b.price || 0));
    } else if (sortBy === 'price-desc') {
      items.sort((a, b) => (b.price || 0) - (a.price || 0));
    } else if (sortBy === 'alphabetical') {
      items.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      items.sort((a, b) => new Date(b.releaseDate || 0) - new Date(a.releaseDate || 0));
    }

    return items;
  }

  function renderGrid() {
    const grid = document.getElementById('marketplaceGrid');
    if (!grid) return;
    grid.innerHTML = '';
    const items = getFilteredItems();
    const owned = profile?.ownedCosmetics || [];

    if (items.length === 0) {
      grid.innerHTML = `<div class="span-full" style="text-align:center; padding: 40px; opacity:0.5;">No cosmetics found matching the filters.</div>`;
      return;
    }

    items.forEach(item => {
      const isOwned = owned.includes(item.id);
      const card = document.createElement('div');
      card.className = `market-item-card rarity-${item.rarity.toLowerCase()}`;
      
      card.innerHTML = `
        <div class="item-preview-area" id="preview-${item.id}">
          <div class="item-preview-badge-overlay">${item.rarity}</div>
        </div>
        <div class="item-card-details">
          <div class="item-meta-top">
            <span class="item-category-label">${item.category}</span>
          </div>
          <h3 class="item-name">${esc(item.name)}</h3>
          <p class="item-description">${esc(item.description || '')}</p>
          <div class="item-purchase-footer">
            <div class="item-price-tag">
              <span class="price-lbl">Cost</span>
              <span class="price-val">${item.price} IP</span>
            </div>
            ${isOwned 
              ? `<button class="btn btn-outline btn-sm" disabled style="opacity: 0.6; cursor: not-allowed;">Acquired</button>` 
              : `<button class="btn btn-primary btn-sm btn-buy" data-id="${item.id}">Acquire</button>`
            }
          </div>
        </div>
      `;

      grid.appendChild(card);
      const previewArea = card.querySelector(`#preview-${item.id}`);
      renderPreview(item, previewArea);
    });

    grid.querySelectorAll('.btn-buy').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const cosmetic = cosmetics.find(c => c.id === id);
        if (cosmetic) openPurchaseModal(cosmetic);
      });
    });
  }

  function openPurchaseModal(cosmetic) {
    selectedCosmetic = cosmetic;
    const modal = document.getElementById('purchaseModal');
    if (!modal) return;

    const spendable = Number(profile?.stats?.impactPoints ?? profile?.impactPoints ?? 0);
    const cost = cosmetic.price || 0;
    const newBalance = spendable - cost;

    document.getElementById('purchaseItemName').textContent = cosmetic.name;
    document.getElementById('purchaseItemCategory').textContent = cosmetic.category;
    document.getElementById('purchaseItemRarity').textContent = cosmetic.rarity;
    
    const rarityDiv = document.getElementById('purchaseItemRarity');
    rarityDiv.className = `purchase-rarity rarity-${cosmetic.rarity.toLowerCase()}`;

    document.getElementById('purchaseItemCost').textContent = `${cost} IP`;
    document.getElementById('purchaseUserBalance').textContent = `${spendable} IP`;
    document.getElementById('purchaseNewBalance').textContent = `${newBalance} IP`;

    const nextBtn = document.getElementById('btnConfirmPurchase');
    if (newBalance < 0) {
      nextBtn.disabled = true;
      nextBtn.textContent = 'Insufficient Points';
      document.getElementById('purchaseNewBalance').style.color = 'var(--accent-clay)';
    } else {
      nextBtn.disabled = false;
      nextBtn.textContent = 'Acquire Item';
      document.getElementById('purchaseNewBalance').style.color = 'var(--accent-moss)';
    }

    const previewContainer = document.getElementById('purchaseItemPreviewContainer');
    renderPreview(cosmetic, previewContainer);

    modal.style.display = 'flex';
  }

  let originalModalHTML = '';

  function initEvents() {
    document.getElementById('filterCategory')?.addEventListener('change', renderGrid);
    document.getElementById('filterRarity')?.addEventListener('change', renderGrid);
    document.getElementById('sortItems')?.addEventListener('change', renderGrid);

    const modal = document.getElementById('purchaseModal');
    if (modal && !originalModalHTML) {
      originalModalHTML = modal.querySelector('.modal-card').innerHTML;
    }

    const closeBtn = document.getElementById('btnClosePurchase');
    const cancelBtn = document.getElementById('btnCancelPurchase');
    const confirmBtn = document.getElementById('btnConfirmPurchase');

    const hideModal = () => {
      if (modal) modal.style.display = 'none';
      selectedCosmetic = null;
      restoreModalTemplate();
    };

    function restoreModalTemplate() {
      if (modal && originalModalHTML) {
        modal.querySelector('.modal-card').innerHTML = originalModalHTML;
        const cBtn = document.getElementById('btnClosePurchase');
        const cclBtn = document.getElementById('btnCancelPurchase');
        const cfmBtn = document.getElementById('btnConfirmPurchase');
        cBtn?.addEventListener('click', hideModal);
        cclBtn?.addEventListener('click', hideModal);
        cfmBtn?.addEventListener('click', onConfirmClick);
      }
    }

    const onConfirmClick = async () => {
      const cfmBtn = document.getElementById('btnConfirmPurchase');
      if (!selectedCosmetic || !cfmBtn) return;
      cfmBtn.disabled = true;
      cfmBtn.textContent = 'Processing...';
      try {
        const nextProfile = await window.TWS.purchaseCosmetic(selectedCosmetic.id);
        profile = nextProfile;
        renderBalance();
        renderGrid();

        const card = modal.querySelector('.modal-card');
        const rewardCats = ['ai-credits', 'gift-card', 'physical-reward', 'external-service', 'other-reward'];
        const isExternal = rewardCats.includes(selectedCosmetic.category);

        card.innerHTML = `
          <button type="button" class="modal-close-btn" id="btnSuccessClose">&times;</button>
          <div class="modal-header">
            <span class="modal-eyebrow">Transaction Successful</span>
            <h2 class="modal-title" style="color:var(--accent-moss)">Item Acquired!</h2>
          </div>
          <div class="purchase-confirmation-body" style="text-align: center; padding: 20px 0;">
            <div style="font-size: 40px; margin-bottom: 16px;">🎉</div>
            <p style="font-size: 16px; font-weight: 500; margin-bottom: 8px;">You have successfully acquired <strong>${esc(selectedCosmetic.name)}</strong>!</p>
            ${isExternal ? `
              <div style="background: var(--bg-warm); border: 1px solid var(--border-light); border-radius: 12px; padding: 20px; margin-top: 20px; text-align: left;">
                <h4 style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.6; margin-bottom: 8px; font-family: var(--font-display);">How to Redeem</h4>
                <p style="font-size: 13px; line-height: 1.6; margin-bottom: 16px;">${esc(selectedCosmetic.description || 'No description.')}</p>
                ${selectedCosmetic.redeemInstructions ? `
                  <h4 style="font-size: 12px; font-weight: 600; margin-bottom: 4px; font-family: var(--font-display);">Instructions:</h4>
                  <p style="font-size: 13px; opacity: 0.85; margin-bottom: 16px; white-space: pre-line;">${esc(selectedCosmetic.redeemInstructions)}</p>
                ` : ''}
                ${selectedCosmetic.redeemCode ? `
                  <h4 style="font-size: 12px; font-weight: 600; margin-bottom: 6px; font-family: var(--font-display);">Redemption Code:</h4>
                  <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 16px;">
                    <input type="text" value="${esc(selectedCosmetic.redeemCode)}" readonly id="successRedeemCode" style="flex: 1; padding: 8px 12px; border: 1px solid var(--border-light); border-radius: 6px; font-family: monospace; font-size: 14px; background: #fff;" />
                    <button class="btn btn-outline btn-sm" id="btnCopyCode" style="white-space: nowrap; padding: 6px 12px; font-size: 12px;">Copy</button>
                  </div>
                ` : ''}
                ${selectedCosmetic.externalUrl ? `
                  <a href="${esc(selectedCosmetic.externalUrl)}" target="_blank" rel="noopener" class="btn btn-primary btn-sm" style="display: inline-block; width: 100%; text-align: center; padding: 8px 0;">Go to Redemption Site &nearr;</a>
                ` : ''}
              </div>
            ` : `
              <p style="font-size: 14px; opacity: 0.7; margin-top: 12px;">This cosmetic has been added to your profile. You can equip it in the <strong>Avatar Customizer</strong> on your settings page.</p>
            `}
          </div>
          <div class="modal-action-footer" style="margin-top: 20px;">
            ${isExternal ? `
              <button type="button" class="btn btn-outline" id="btnSuccessCloseOk" style="width: 100%;">Got it</button>
            ` : `
              <div style="display: flex; gap: 12px; width: 100%;">
                <button type="button" class="btn btn-outline" id="btnSuccessCloseOk" style="flex: 1;">Close</button>
                <a href="user-settings.html" class="btn btn-primary" style="flex: 1; text-align: center; display: inline-flex; align-items: center; justify-content: center;">Go to Settings &nearr;</a>
              </div>
            `}
          </div>
        `;

        document.getElementById('btnSuccessClose')?.addEventListener('click', hideModal);
        document.getElementById('btnSuccessCloseOk')?.addEventListener('click', hideModal);
        
        document.getElementById('btnCopyCode')?.addEventListener('click', () => {
          const input = document.getElementById('successRedeemCode');
          if (input) {
            input.select();
            navigator.clipboard.writeText(input.value);
            window.TWS.showToast('Redemption code copied to clipboard!');
          }
        });

      } catch (err) {
        window.TWS.showToast(`Error: ${err.message || 'Transaction failed'}`);
        if (cfmBtn) {
          cfmBtn.disabled = false;
          cfmBtn.textContent = 'Acquire Item';
        }
      }
    };

    closeBtn?.addEventListener('click', hideModal);
    cancelBtn?.addEventListener('click', hideModal);
    confirmBtn?.addEventListener('click', onConfirmClick);

    document.getElementById('signOutBtn')?.addEventListener('click', () => {
      localStorage.removeItem('portal_session');
      window.location.href = 'login.html';
    });
  }

  async function init() {
    await load();
    if (!session || !profile) return;
    renderBalance();
    renderGrid();
    initEvents();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
