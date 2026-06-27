import { collection, query, where, getDocs, doc, getDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
import { db } from './firebase-core.js';
import { accessCollections } from './firebase-config.js';

(function () {
  'use strict';

  const esc = window.TWS.escapeHTML;
  let session = null;
  let userProfile = null;
  let referrals = [];

  function getSession() {
    return JSON.parse(sessionStorage.getItem('portal_session') || 'null');
  }

  async function load() {
    session = getSession();
    if (!session) {
      window.location.href = 'login.html';
      return;
    }
    const userDocRef = doc(db, accessCollections.users, session.uid);
    const userSnap = await getDoc(userDocRef);
    if (!userSnap.exists()) {
      alert('Member profile not found.');
      return;
    }
    userProfile = userSnap.data();
    if (!userProfile.referralCode) {
      const code = window.TWS.generateReferralCode();
      await updateDoc(userDocRef, {
        referralCode: code
      });
      userProfile.referralCode = code;
    }
  }

  function renderIdentity() {
    const codeVal = document.getElementById('referralCodeVal');
    const linkVal = document.getElementById('referralLinkVal');
    if (codeVal) codeVal.textContent = userProfile.referralCode;
    
    const rootPath = window.location.origin + window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/'));
    const link = `${rootPath}/signup.html?ref=${userProfile.referralCode}`;
    if (linkVal) linkVal.value = link;

    document.getElementById('btnCopyCode')?.addEventListener('click', () => {
      navigator.clipboard.writeText(userProfile.referralCode);
      showCopyConfirm();
    });

    document.getElementById('btnCopyLink')?.addEventListener('click', () => {
      navigator.clipboard.writeText(link);
      showCopyConfirm();
    });

    document.getElementById('shareWA')?.addEventListener('click', () => {
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent('Join me on Together We Solve! ' + link)}`, '_blank');
    });

    document.getElementById('shareLI')?.addEventListener('click', () => {
      window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(link)}`, '_blank');
    });

    document.getElementById('shareTW')?.addEventListener('click', () => {
      window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(link)}&text=${encodeURIComponent('Join me on Together We Solve to help solve real-world problems!')}`, '_blank');
    });

    document.getElementById('shareMail')?.addEventListener('click', () => {
      window.open(`mailto:?subject=${encodeURIComponent('Invitation to Together We Solve')}&body=${encodeURIComponent('Join our community: ' + link)}`, '_self');
    });
  }

  function showCopyConfirm() {
    const hint = document.getElementById('copyConfirmMsg');
    if (!hint) return;
    hint.style.display = 'block';
    setTimeout(() => {
      hint.style.display = 'none';
    }, 2000);
  }

  async function loadReferrals() {
    const refSnap = await getDocs(query(collection(db, 'referrals'), where('inviterUid', '==', session.uid)));
    referrals = refSnap.docs.map(doc => doc.data());
  }

  async function renderStatsAndProgression() {
    const approved = referrals.filter(r => r.status === 'Approved');
    const pending = referrals.filter(r => r.status === 'Pending Verification');
    const rejected = referrals.filter(r => r.status === 'Rejected');
    const revoked = referrals.filter(r => r.status === 'Revoked');

    const totalApproved = approved.length;
    const totalPending = pending.length;
    const totalRejected = rejected.length + revoked.length;

    const settings = await window.TWS.loadSettings({});
    const refSettings = settings.referralSettings || window.TWS.defaultReferralSettings;
    const earnedEXP = window.TWS.calculateReferralEXP(totalApproved, refSettings);
    const earnedIP = totalApproved * 1;

    document.getElementById('statSuccessCount').textContent = totalApproved;
    document.getElementById('statPendingCount').textContent = totalPending;
    document.getElementById('statRejectedCount').textContent = totalRejected;
    document.getElementById('statIpCredited').textContent = `${earnedIP} IP`;
    document.getElementById('statExpEarned').textContent = `${earnedEXP} EXP`;

    const sortedTiers = [...(refSettings.tiers || window.TWS.defaultReferralSettings.tiers)].sort((a, b) => a.threshold - b.threshold);
    let activeTier = sortedTiers[0];
    let nextTier = null;

    for (let i = 0; i < sortedTiers.length; i++) {
      if (totalApproved >= sortedTiers[i].threshold) {
        activeTier = sortedTiers[i];
        nextTier = sortedTiers[i + 1] || null;
      }
    }

    const tierNameEl = document.getElementById('referralTierName');
    if (tierNameEl) tierNameEl.textContent = activeTier.name;

    const milestones = refSettings.milestones || window.TWS.defaultReferralSettings.milestones;
    const sortedMilestones = [...milestones].sort((a, b) => a.count - b.count);
    let nextMilestone = sortedMilestones.find(m => totalApproved < m.count);

    const progressTextLabel = document.getElementById('progressTextLabel');
    const progressPercentLabel = document.getElementById('progressPercentLabel');
    const progressBarFill = document.getElementById('progressBarFill');
    const nextRewardLabel = document.getElementById('nextRewardLabel');

    const activeBadgesList = window.TWS.normalizeBadges([], { stats: { successfulReferrals: totalApproved } });
    const referralBadge = activeBadgesList.find(b => b.id.startsWith('referral-connector-'));
    const badgeNameEl = document.getElementById('referralBadgeName');
    const badgeWrapEl = document.getElementById('referralBadgeWrap');

    if (referralBadge) {
      if (badgeNameEl) badgeNameEl.textContent = referralBadge.name;
      if (badgeWrapEl) badgeWrapEl.textContent = referralBadge.icon;
    } else {
      if (badgeNameEl) badgeNameEl.textContent = 'Connector Level 0';
      if (badgeWrapEl) badgeWrapEl.textContent = '🌱';
    }

    if (nextMilestone) {
      const currentMilestoneStart = 0;
      const range = nextMilestone.count - currentMilestoneStart;
      const progress = totalApproved - currentMilestoneStart;
      const pct = Math.min(100, Math.max(0, Math.round((progress / range) * 100)));

      if (progressTextLabel) progressTextLabel.textContent = `${totalApproved} / ${nextMilestone.count} referrals`;
      if (progressPercentLabel) progressPercentLabel.textContent = `${pct}%`;
      if (progressBarFill) progressBarFill.style.width = `${pct}%`;

      const nextLevelBadge = window.TWS.resolveBadge(`referral-connector-l${sortedMilestones.indexOf(nextMilestone) + 1}`);
      if (nextRewardLabel) {
        nextRewardLabel.textContent = `Invite ${nextMilestone.count - totalApproved} more members to unlock ${nextLevelBadge.name} & +${nextMilestone.bonus} EXP!`;
      }
    } else {
      if (progressTextLabel) progressTextLabel.textContent = `${totalApproved} referrals`;
      if (progressPercentLabel) progressPercentLabel.textContent = '100%';
      if (progressBarFill) progressBarFill.style.width = '100%';
      if (nextRewardLabel) nextRewardLabel.textContent = 'All referral progression milestones achieved!';
    }

    await checkCelebration(totalApproved, refSettings);
  }

  async function checkCelebration(currentApprovedCount, refSettings) {
    const lastCelebrated = Number(userProfile.stats?.lastCelebratedMilestone) || 0;
    if (currentApprovedCount <= lastCelebrated) return;

    const milestones = refSettings.milestones || window.TWS.defaultReferralSettings.milestones;
    const sortedMilestones = [...milestones].sort((a, b) => a.count - b.count);
    
    let newlyCrossed = null;
    for (const m of sortedMilestones) {
      if (currentApprovedCount >= m.count && m.count > lastCelebrated) {
        newlyCrossed = m;
      }
    }

    if (newlyCrossed) {
      const milestoneIndex = sortedMilestones.indexOf(newlyCrossed) + 1;
      const badge = window.TWS.resolveBadge(`referral-connector-l${milestoneIndex}`);
      
      window.TWS.triggerReferralCelebration(newlyCrossed.count, badge.name, badge.icon, newlyCrossed.bonus);
      
      const userDocRef = doc(db, accessCollections.users, session.uid);
      await updateDoc(userDocRef, {
        'stats.lastCelebratedMilestone': newlyCrossed.count
      });
      userProfile.stats.lastCelebratedMilestone = newlyCrossed.count;
    }
  }

  function renderHistory(refSettings) {
    const tableBody = document.querySelector('#referralsHistoryTable tbody');
    if (!tableBody) return;

    if (referrals.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; opacity: 0.6; padding: 32px;">You haven't referred any members yet.</td></tr>`;
      return;
    }

    const sortedHistory = [...referrals].sort((a, b) => {
      return new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0);
    });

    const approvedList = referrals.filter(r => r.status === 'Approved').sort((a, b) => {
      return new Date(a.submittedAt || 0) - new Date(b.submittedAt || 0);
    });

    tableBody.innerHTML = sortedHistory.map((ref) => {
      let statusClass = 'pending';
      if (ref.status === 'Approved') statusClass = 'approved';
      else if (ref.status === 'Rejected') statusClass = 'rejected';
      else if (ref.status === 'Revoked') statusClass = 'revoked';

      let validationDateStr = '—';
      if (ref.validationDate) {
        validationDateStr = new Date(ref.validationDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }

      let rewardsText = 'None';
      if (ref.status === 'Approved') {
        const approvedIndex = approvedList.findIndex(r => r.inviteeUid === ref.inviteeUid) + 1;
        const tiers = refSettings?.tiers || window.TWS.defaultReferralSettings.tiers;
        const sortedTiers = [...tiers].sort((a, b) => a.threshold - b.threshold);
        let rewardEXP = sortedTiers[0].reward;
        for (const tier of sortedTiers) {
          if (approvedIndex - 1 >= tier.threshold) {
            rewardEXP = tier.reward;
          }
        }
        rewardsText = `+1 IP, +${rewardEXP} EXP`;
      }

      const auditNotes = ref.rejectionReason || (ref.status === 'Approved' ? 'Passed community audit' : 'Awaiting verification');

      return `
        <tr>
          <td>
            <div style="font-weight: 500;">${esc(ref.inviteeName)}</div>
            <div style="font-size: 11px; opacity: 0.6;">@${esc(ref.inviteeUsername)}</div>
          </td>
          <td>${new Date(ref.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
          <td><span class="referral-status-pill ${statusClass}">${esc(ref.status)}</span></td>
          <td>${esc(validationDateStr)}</td>
          <td style="font-weight: 500;">${esc(rewardsText)}</td>
          <td style="opacity: 0.8; font-size: 12.5px;">${esc(auditNotes)}</td>
        </tr>
      `;
    }).join('');
  }

  async function renderNotifications() {
    const listContainer = document.getElementById('referralsNotificationsList');
    if (!listContainer) return;

    const notifSnap = await getDocs(query(
      collection(db, accessCollections.notifications),
      where('userId', '==', session.uid),
      where('type', '==', 'referral')
    ));

    const notifications = notifSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => {
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    if (notifications.length === 0) {
      listContainer.innerHTML = `<div style="text-align: center; opacity: 0.6; font-size: 12px; padding: 20px;">No recent referral notifications.</div>`;
      return;
    }

    listContainer.innerHTML = notifications.slice(0, 10).map((notif) => {
      const isUnread = !notif.read ? ' unread' : '';
      const dateStr = new Date(notif.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + new Date(notif.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
      
      return `
        <div class="ref-notification-item${isUnread}" data-id="${notif.id}">
          <span class="ref-notif-title">${esc(notif.title)}</span>
          <p style="margin: 4px 0 0 0;">${esc(notif.message)}</p>
          <span class="ref-notif-time">${esc(dateStr)}</span>
        </div>
      `;
    }).join('');

    listContainer.querySelectorAll('.ref-notification-item.unread').forEach((el) => {
      el.addEventListener('click', async () => {
        const id = el.dataset.id;
        el.classList.remove('unread');
        const docRef = doc(db, accessCollections.notifications, id);
        await updateDoc(docRef, { read: true });
      });
    });
  }

  function initSignOut() {
    document.getElementById('signOutBtn')?.addEventListener('click', () => {
      sessionStorage.removeItem('portal_session');
      window.location.href = 'login.html';
    });
  }

  async function init() {
    gsap.registerPlugin(ScrollTrigger);
    await load();
    renderIdentity();
    await loadReferrals();
    const settings = await window.TWS.loadSettings({});
    const refSettings = settings.referralSettings || window.TWS.defaultReferralSettings;
    await renderStatsAndProgression();
    renderHistory(refSettings);
    await renderNotifications();
    initSignOut();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
