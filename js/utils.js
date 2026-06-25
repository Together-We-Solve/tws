(function () {
  'use strict';

  const memory = {
    users: [],
    problems: [],
    partners: [],
    logs: [],
    settings: null
  };

  function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[char]);
  }

  function decodeProfileName(value) {
    return decodeURIComponent(String(value || '').replace(/_/g, ' '));
  }

  function toUsername(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_ -]/g, '')
      .replace(/\s+/g, '_')
      .replace(/-+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  function profileUrl(name) {
    return `user-profile.html?username=${encodeURIComponent(toUsername(name))}`;
  }

  function initialsFromName(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    return (parts[0]?.charAt(0) || 'U').toUpperCase() + (parts[1]?.charAt(0) || 'S').toUpperCase();
  }

  let firebaseDataPromise = null;

  async function getFirebaseDataApi() {
    if (!firebaseDataPromise) {
      firebaseDataPromise = Promise.all([
        import('./firebase-config.js'),
        import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js')
      ]).then(([configModule, appModule, firestoreModule]) => {
        const app = appModule.getApps().length ? appModule.getApps()[0] : appModule.initializeApp(configModule.firebaseConfig);
        const db = firestoreModule.getFirestore(app);
        return { db, configModule, firestoreModule };
      });
    }
    return firebaseDataPromise;
  }

  async function fetchCollection(collectionName) {
    const { db, firestoreModule } = await getFirebaseDataApi();
    const snapshot = await firestoreModule.getDocs(firestoreModule.collection(db, collectionName));
    return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  }

  async function saveDocument(collectionName, id, data, merge = true) {
    const { db, firestoreModule } = await getFirebaseDataApi();
    await firestoreModule.setDoc(firestoreModule.doc(db, collectionName, id), {
      ...data,
      updatedAt: firestoreModule.serverTimestamp()
    }, { merge });
    return { id, ...data };
  }

  async function deleteDocument(collectionName, id) {
    const { db, firestoreModule } = await getFirebaseDataApi();
    await firestoreModule.deleteDoc(firestoreModule.doc(db, collectionName, id));
  }

  async function fetchDocument(collectionName, id) {
    const { db, firestoreModule } = await getFirebaseDataApi();
    const snap = await firestoreModule.getDoc(firestoreModule.doc(db, collectionName, id));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  }

  function normalizeTimestamp(value) {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (typeof value.toDate === 'function') return value.toDate().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    if (value.seconds) return new Date(value.seconds * 1000).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    return String(value);
  }

  function normalizeMember(raw) {
    const stats = raw.stats || {};
    const displayName = raw.displayName || raw.name || raw.username || 'Together We Solve Member';
    const username = toUsername(raw.username || displayName);
    const totalImpactPoints = Number(stats.totalImpactPoints ?? raw.points) || 0;
    const problemsSolved = Number(stats.problemsSolved ?? raw.solved) || 0;

    return {
      ...raw,
      id: raw.id || raw.uid || username,
      uid: raw.uid || raw.id || '',
      displayName,
      name: displayName,
      username,
      avatar: raw.avatar || raw.profilePicture || '',
      banner: raw.banner || '',
      role: raw.role || 'Member',
      specialty: raw.specialty || raw.country || '',
      bio: raw.bio || '',
      points: totalImpactPoints,
      solved: problemsSolved,
      initials: raw.initials || initialsFromName(displayName),
      badges: Array.isArray(raw.badges) ? raw.badges : [],
      stats: { ...stats, totalImpactPoints, problemsSolved }
    };
  }

  function normalizeProblem(raw) {
    return {
      ...raw,
      id: raw.id || `prob_${Date.now()}`,
      title: raw.title || 'Untitled Problem',
      category: raw.category || 'Community',
      friction: raw.friction || '',
      tried: raw.tried || '',
      ripple: raw.ripple || '',
      date: normalizeTimestamp(raw.date || raw.createdAt) || new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      status: raw.status || 'Pending Review',
      solver: raw.solver || raw.ownerUsername || raw.ownerName || 'unknown',
      ownerUsername: toUsername(raw.ownerUsername || raw.solver || raw.ownerName),
      ownerName: raw.ownerName || raw.solver || '',
      ownerUid: raw.ownerUid || '',
      contributors: Array.isArray(raw.contributors) ? raw.contributors : [],
      solvedBy: raw.solvedBy || '',
      complexity: raw.complexity || '',
      ownerReview: raw.ownerReview || '',
      winnerXP: Number(raw.winnerXP) || 0,
      attemptXP: Number(raw.attemptXP) || 0,
      clones: Number(raw.clones) || 0,
      views: Number(raw.views) || 0
    };
  }

  function loadMovementMembers(defaultMembers = []) {
    return (memory.users.length ? memory.users : defaultMembers).map(normalizeMember);
  }

  async function loadMovementMembersAsync(defaultMembers = []) {
    const { configModule } = await getFirebaseDataApi();
    const firestoreUsers = await fetchCollection(configModule.accessCollections.users);
    const roleAssignments = await fetchCollection(configModule.accessCollections.roleAssignments).catch(() => []);
    const roleByEmail = new Map(roleAssignments.map((item) => [String(item.id || item.email || '').toLowerCase(), item]));
    const mergedUsers = firestoreUsers.map((user) => {
      const roleDoc = roleByEmail.get(String(user.email || '').toLowerCase());
      return { ...user, role: roleDoc?.role || user.role || 'Member', privileges: roleDoc?.privileges || user.privileges || [] };
    });

    roleAssignments.forEach((assignment) => {
      const email = String(assignment.email || assignment.id || '').toLowerCase();
      const exists = mergedUsers.some((user) => String(user.email || '').toLowerCase() === email);
      if (!exists) {
        mergedUsers.push({
          id: assignment.id || email,
          email,
          displayName: assignment.displayName || email.split('@')[0],
          username: toUsername(assignment.username || assignment.displayName || email),
          role: assignment.role || 'Member',
          privileges: assignment.privileges || [],
          stats: assignment.stats || {}
        });
      }
    });

    memory.users = mergedUsers;
    return loadMovementMembers(defaultMembers);
  }

  async function loadProblemsAsync(defaultProblems = []) {
    const { configModule } = await getFirebaseDataApi();
    const problems = (await fetchCollection(configModule.accessCollections.problems)).map(normalizeProblem);
    memory.problems = problems.length ? problems : defaultProblems.map(normalizeProblem);
    return memory.problems;
  }

  async function saveProblem(problem) {
    const { configModule } = await getFirebaseDataApi();
    const normalized = normalizeProblem(problem);
    await saveDocument(configModule.accessCollections.problems, normalized.id, normalized);
    memory.problems = memory.problems.filter((item) => item.id !== normalized.id).concat(normalized);
    return normalized;
  }

  async function updateProblem(problemId, patch) {
    const { configModule } = await getFirebaseDataApi();
    const current = memory.problems.find((item) => item.id === problemId)
      || await fetchDocument(configModule.accessCollections.problems, problemId)
      || { id: problemId };
    return saveProblem({ ...current, ...patch, id: problemId });
  }

  async function deleteProblem(problemId) {
    const { configModule } = await getFirebaseDataApi();
    await deleteDocument(configModule.accessCollections.problems, problemId);
    memory.problems = memory.problems.filter((item) => item.id !== problemId);
  }

  async function saveUserProfile(userId, data) {
    const { configModule } = await getFirebaseDataApi();
    await saveDocument(configModule.accessCollections.users, userId, data);
    memory.users = memory.users.filter((item) => item.id !== userId && item.uid !== userId).concat({ id: userId, uid: userId, ...data });
  }

  async function loadPartnersAsync(defaultPartners = []) {
    const { configModule } = await getFirebaseDataApi();
    const partners = await fetchCollection(configModule.accessCollections.partners);
    memory.partners = partners.length ? partners : defaultPartners;
    return memory.partners;
  }

  async function loadSettings(defaultSettings = {}) {
    const { configModule } = await getFirebaseDataApi();
    const settings = await fetchDocument(configModule.accessCollections.settings, 'global');
    memory.settings = settings || defaultSettings;
    return memory.settings;
  }

  async function saveSettings(settings) {
    const { configModule } = await getFirebaseDataApi();
    await saveDocument(configModule.accessCollections.settings, 'global', settings);
    memory.settings = settings;
  }

  function logSystemActivity(type, message) {
    const payload = {
      id: `log_${Date.now()}`,
      timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }) + ' ' + new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      type,
      message
    };
    memory.logs.unshift(payload);
  }

  function loadSystemLogs() {
    return memory.logs;
  }

  function clearSystemLogs() {
    memory.logs = [];
  }

  function dashboardForSession(session) {
    const privileges = Array.isArray(session?.privileges) ? session.privileges : [];
    if (['Founder', 'Co-Founder'].includes(session?.role) || privileges.includes('manage_system')) return 'admin-dashboard.html';
    if (['Evaluator', 'Innovator'].includes(session?.role) || privileges.includes('evaluate_submissions') || privileges.includes('award_points')) return 'evaluator-dashboard.html';
    return '';
  }

  function enhanceNavigation() {
    const session = JSON.parse(sessionStorage.getItem('portal_session') || 'null');
    const navLinks = document.querySelector('.nav-links');
    const logo = document.querySelector('.nav-logo');
    const cta = document.querySelector('.nav-cta');
    if (!session || !navLinks) return;
    if (logo) logo.href = 'home.html';

    const desiredLinks = [
      ['home.html', 'Home'],
      ['members.html', 'Members'],
      ['leaderboard.html', 'Leaderboard'],
      ['impact-archive.html', 'Impact Archive'],
      ['core-team.html', 'Core Team'],
      ['user-settings.html', 'My Frictions'],
      [`user-profile.html?username=${encodeURIComponent(session.username || '')}`, 'My Profile']
    ];
    const dashboard = dashboardForSession(session);
    if (dashboard) desiredLinks.push([dashboard, dashboard === 'admin-dashboard.html' ? 'Founder' : 'Evaluator']);
    const current = window.location.pathname.split('/').pop() || 'index.html';
    navLinks.innerHTML = desiredLinks.map(([href, label]) => {
      const active = href.split('?')[0] === current ? ' active' : '';
      return `<a href="${escapeHTML(href)}" class="nav-link${active}">${escapeHTML(label)}</a>`;
    }).join('');
    if (cta && cta.tagName === 'A') {
      cta.href = 'post-problem.html';
      cta.innerHTML = 'Share a Problem <span class="nav-cta-arrow">&nearr;</span>';
    }
  }

  function ensureSolverProfile(session) {
    if (!session) return null;
    return normalizeMember({
      id: session.uid || session.username,
      uid: session.uid || '',
      email: session.email || '',
      displayName: session.displayName || session.username || session.email || 'Together We Solve Member',
      username: session.username || session.displayName || session.email,
      role: session.role || 'Member',
      stats: {}
    });
  }

  window.TWS = {
    ...(window.TWS || {}),
    memory,
    escapeHTML,
    decodeProfileName,
    profileUrl,
    toUsername,
    initialsFromName,
    normalizeMember,
    normalizeProblem,
    loadMovementMembers,
    loadMovementMembersAsync,
    loadProblemsAsync,
    saveProblem,
    updateProblem,
    deleteProblem,
    saveUserProfile,
    loadPartnersAsync,
    loadSettings,
    saveSettings,
    logSystemActivity,
    loadSystemLogs,
    clearSystemLogs,
    dashboardForSession,
    enhanceNavigation,
    ensureSolverProfile
  };

  document.addEventListener('DOMContentLoaded', enhanceNavigation);
})();
