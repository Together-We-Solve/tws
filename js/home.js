(function () {
  'use strict';

  const esc = window.TWS.escapeHTML;
  const session = JSON.parse(localStorage.getItem('portal_session') || 'null');
  const communityInviteUrl = 'https://chat.whatsapp.com/E2X7hTCxEZjB4MczNIeHFG';

  if (!session) {
    window.location.href = 'index.html';
    return;
  }

  const greeting = document.getElementById('homeGreeting');
  if (greeting) greeting.textContent = `Welcome back, ${session.displayName || session.username || 'member'}.`;

  async function renderActivity() {
    const grid = document.getElementById('homeActivityGrid');
    if (!grid) return;

    const [problems, members] = await Promise.all([
      window.TWS.loadProblemsAsync([]),
      window.TWS.loadMovementMembersAsync([])
    ]);
    const profile = members.find((member) => (
      (session.uid && (member.uid === session.uid || member.id === session.uid)) ||
      (session.email && String(member.email || '').toLowerCase() === String(session.email).toLowerCase())
    ))
      || window.TWS.ensureSolverProfile(session);
    const points = window.TWS.impactPointsFromStats(profile);
    const mine = problems.filter((problem) => (
      problem.ownerUid === session.uid ||
      problem.ownerUsername === session.username ||
      window.TWS.toUsername(problem.solver) === session.username
    ));
    const solvedMine = mine.filter((problem) => problem.status === 'Solved').length;
    const dashboards = window.TWS.dashboardsForSession(session);

    const cards = [
      {
        title: `${points.toLocaleString()} IP`,
        body: 'Total impact points credited to your member profile.',
        href: `user-profile.html?username=${encodeURIComponent(profile?.username || session.username || '')}`,
        meta: 'Impact score'
      },
      {
        title: `${mine.length} friction${mine.length === 1 ? '' : 's'}`,
        body: 'Problems connected to your account as owner or solver.',
        href: 'my-frictions.html',
        meta: 'Your frictions'
      },
      {
        title: `${solvedMine} solved`,
        body: 'Your frictions that have reached solved status.',
        href: 'impact-archive.html',
        meta: 'Resolved work'
      },
      {
        title: 'Cosmetics Marketplace',
        body: 'Spend your Impact Points to unlock high-quality avatar items and banners.',
        href: 'marketplace.html',
        meta: 'Rewards Store'
      },
      {
        title: 'Profile Settings',
        body: 'Update your public identity, username, specialty, and avatar initials.',
        href: 'user-settings.html',
        meta: 'User dashboard'
      },
      {
        title: 'Enter the Community',
        body: 'Join the WhatsApp community for member discussions and coordination.',
        href: communityInviteUrl,
        meta: 'WhatsApp discussions',
        external: true
      }
    ];

    if (dashboards.includes('evaluator')) {
      cards.splice(1, 0, {
        title: 'Evaluator Dashboard',
        body: 'Verify friction posts, review solved submissions, remove participants, and finalize points.',
        href: 'evaluator-dashboard.html',
        meta: 'Evaluator access'
      });
    }

    if (dashboards.includes('superadmin')) {
      cards.splice(1, 0, {
        title: 'Superadmin Dashboard',
        body: 'Assign roles, manage community access, and grant dashboard permissions.',
        href: 'admin-dashboard.html',
        meta: 'Founder access'
      });
    }

    if (dashboards.includes('supportingPartner')) {
      cards.splice(1, 0, {
        title: 'Partner Dashboard',
        body: 'Edit only your supporting partner listing.',
        href: 'supporting-partner-dashboard.html',
        meta: 'Partner listing'
      });
    }

    grid.innerHTML = cards.map((card) => `
      <a class="member-card" href="${esc(card.href)}" ${card.external ? 'target="_blank" rel="noopener"' : ''}>
        <h3>${esc(card.title)}</h3>
        <span class="member-role">${esc(card.meta)}</span>
        <p class="member-bio">${esc(card.body)}</p>
      </a>
    `).join('');
  }

  document.addEventListener('DOMContentLoaded', () => {
    gsap.registerPlugin(ScrollTrigger);
    renderActivity();
  });
})();
