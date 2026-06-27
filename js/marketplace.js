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

  function renderBalance() {
    const spendable = Number(profile?.stats?.impactPoints ?? profile?.impactPoints ?? 0);
    const balanceText = document.getElementById('userBalanceText');
    if (balanceText) {
      balanceText.textContent = `${spendable.toLocaleString()} IP`;
    }
  }

  function renderPreview(item, container) {
    container.innerHTML = '';
    if (item.category === 'banner') {
      const wrapper = document.createElement('div');
      wrapper.className = 'preview-banner-wrapper';
      container.appendChild(wrapper);
      window.TWS.renderProfileBanner(item.id, wrapper);
      container.classList.add('banner-box');
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
    const owned = profile.ownedCosmetics || [];

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

  function initEvents() {
    document.getElementById('filterCategory')?.addEventListener('change', renderGrid);
    document.getElementById('filterRarity')?.addEventListener('change', renderGrid);
    document.getElementById('sortItems')?.addEventListener('change', renderGrid);

    const modal = document.getElementById('purchaseModal');
    const closeBtn = document.getElementById('btnClosePurchase');
    const cancelBtn = document.getElementById('btnCancelPurchase');
    const confirmBtn = document.getElementById('btnConfirmPurchase');

    const hideModal = () => {
      if (modal) modal.style.display = 'none';
      selectedCosmetic = null;
    };

    closeBtn?.addEventListener('click', hideModal);
    cancelBtn?.addEventListener('click', hideModal);
    
    confirmBtn?.addEventListener('click', async () => {
      if (!selectedCosmetic) return;
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Processing...';
      try {
        const nextProfile = await window.TWS.purchaseCosmetic(selectedCosmetic.id);
        profile = nextProfile;
        renderBalance();
        renderGrid();
        window.TWS.showToast(`Successfully acquired "${selectedCosmetic.name}"!`);
        hideModal();
      } catch (err) {
        window.TWS.showToast(`Error: ${err.message || 'Transaction failed'}`);
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Acquire Item';
      }
    });

    document.getElementById('signOutBtn')?.addEventListener('click', () => {
      sessionStorage.removeItem('portal_session');
      window.location.href = 'login.html';
    });
  }

  async function init() {
    await load();
    renderBalance();
    renderGrid();
    initEvents();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
