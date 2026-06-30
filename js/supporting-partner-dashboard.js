(function () {
  'use strict';

  let session = null;
  let partner = null;

  function getSession() {
    return JSON.parse(localStorage.getItem('portal_session') || 'null');
  }

  function canAccess() {
    return window.TWS.dashboardsForSession(session).includes('supportingPartner');
  }

  function partnerId() {
    return session.uid || window.TWS.toUsername(session.email || session.displayName || 'partner');
  }

  async function load() {
    session = getSession();
    if (!session) {
      window.location.href = 'login.html';
      return false;
    }
    if (!canAccess()) {
      window.location.href = 'user-settings.html';
      return false;
    }
    const partners = await window.TWS.loadPartnersAsync([]);
    partner = partners.find((item) => item.ownerUid === session.uid || item.email === session.email || item.id === partnerId()) || {};
    return true;
  }

  function render() {
    document.getElementById('partnerName').value = partner.name || session.displayName || '';
    document.getElementById('partnerWebsite').value = partner.website || '';
    document.getElementById('partnerLogo').value = partner.logo || '';
    document.getElementById('partnerFocus').value = partner.focus || '';
    document.getElementById('partnerBio').value = partner.bio || '';
  }

  function initForm() {
    document.getElementById('partnerForm')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const payload = {
        id: partnerId(),
        ownerUid: session.uid || '',
        email: session.email || '',
        name: document.getElementById('partnerName').value.trim(),
        website: document.getElementById('partnerWebsite').value.trim(),
        logo: document.getElementById('partnerLogo').value.trim(),
        focus: document.getElementById('partnerFocus').value.trim(),
        bio: document.getElementById('partnerBio').value.trim()
      };
      await window.TWS.savePartnerProfile(payload.id, payload);
      alert('Supporting partner profile saved.');
    });
    document.getElementById('signOutBtn')?.addEventListener('click', () => {
      localStorage.removeItem('portal_session');
      window.location.href = 'login.html';
    });
  }

  async function init() {
    if (!(await load())) return;
    render();
    initForm();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
