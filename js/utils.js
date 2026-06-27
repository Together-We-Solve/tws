(function () {
  'use strict';

  const memory = {
    users: [],
    problems: [],
    partners: [],
    logs: [],
    settings: null
  };

  const STORAGE_KEY = 'tws_local_data_v1';

  function readLocalStore() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return {
        users: Array.isArray(parsed.users) ? parsed.users : [],
        problems: Array.isArray(parsed.problems) ? parsed.problems : [],
        partners: Array.isArray(parsed.partners) ? parsed.partners : [],
        logs: Array.isArray(parsed.logs) ? parsed.logs : [],
        settings: parsed.settings || null
      };
    } catch (_) {
      return { users: [], problems: [], partners: [], logs: [], settings: null };
    }
  }

  function writeLocalStore(patch) {
    const next = { ...readLocalStore(), ...patch };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return next;
  }

  function replaceById(list, item) {
    const id = item.id || item.uid;
    const filtered = list.filter((entry) => (entry.id || entry.uid) !== id);
    return filtered.concat(item);
  }

  function identityKeys(value) {
    return [
      value?.id,
      value?.uid,
      value?.email
    ].map((item) => String(item || '').trim().toLowerCase()).filter(Boolean);
  }

  function normalizeIdentity(identity = {}) {
    return {
      uid: String(identity.uid || identity.id || '').trim().toLowerCase(),
      email: String(identity.email || '').trim().toLowerCase(),
      username: toUsername(identity.username || identity.usernameLower || '')
    };
  }

  function sameAccount(user, identity) {
    const normalized = normalizeIdentity(identity);
    const userUid = String(user.uid || user.id || '').trim().toLowerCase();
    const userEmail = String(user.email || '').trim().toLowerCase();
    return Boolean(
      (normalized.uid && userUid && userUid === normalized.uid) ||
      (normalized.email && userEmail && userEmail === normalized.email)
    );
  }

  function getPortalSession() {
    try {
      return JSON.parse(sessionStorage.getItem('portal_session') || 'null');
    } catch (_) {
      return null;
    }
  }

  function hasPrivilege(session, privilege) {
    const privileges = Array.isArray(session?.privileges) ? session.privileges : [];
    return privileges.includes(privilege);
  }

  function hasDashboard(session, dashboard) {
    const explicit = Array.isArray(session?.dashboardAccess) ? session.dashboardAccess : [];
    return explicit.includes(dashboard);
  }

  function canAwardPoints(session = getPortalSession()) {
    return Boolean(
      hasPrivilege(session, 'award_points') ||
      hasPrivilege(session, 'manage_system') ||
      hasPrivilege(session, 'manage_community') ||
      hasDashboard(session, 'superadmin') ||
      ['Founder', 'Co-Founder', 'Evaluator', 'Innovator'].includes(session?.role)
    );
  }

  function canManageSystem(session = getPortalSession()) {
    return Boolean(
      hasPrivilege(session, 'manage_system') ||
      hasDashboard(session, 'superadmin') ||
      ['Founder', 'Co-Founder'].includes(session?.role)
    );
  }

  function canEvaluate(session = getPortalSession()) {
    return Boolean(
      canAwardPoints(session) ||
      hasPrivilege(session, 'evaluate_submissions') ||
      hasPrivilege(session, 'close_verified_problems') ||
      hasDashboard(session, 'evaluator')
    );
  }

  function sessionOwnsUser(userId, data, session = getPortalSession()) {
    const identities = identityKeys({ id: userId, uid: data?.uid, email: data?.email });
    return Boolean(
      (session?.uid && identities.includes(String(session.uid).toLowerCase())) ||
      (session?.email && identities.includes(String(session.email).toLowerCase()))
    );
  }

  function protectedUserFieldsChanged(current = {}, next = {}) {
    const currentStats = current.stats || {};
    const nextStats = next.stats || {};
    const checks = [
      ['points', current.points, next.points],
      ['solved', current.solved, next.solved],
      ['role', current.role, next.role],
      ['privileges', current.privileges || [], next.privileges || []],
      ['dashboardAccess', current.dashboardAccess || [], next.dashboardAccess || []],
      ['isSupportingPartner', Boolean(current.isSupportingPartner), Boolean(next.isSupportingPartner)],
      ['badges', current.badges || [], next.badges || []],
      ['stats.totalImpactPoints', currentStats.totalImpactPoints, nextStats.totalImpactPoints],
      ['stats.problemsSolved', currentStats.problemsSolved, nextStats.problemsSolved],
      ['stats.problemsIdentified', currentStats.problemsIdentified, nextStats.problemsIdentified],
      ['stats.helpfulResponses', currentStats.helpfulResponses, nextStats.helpfulResponses],
      ['stats.knowledgeContributions', currentStats.knowledgeContributions, nextStats.knowledgeContributions]
    ];
    return checks.some(([, before, after]) => (
      after !== undefined && JSON.stringify(before ?? null) !== JSON.stringify(after ?? null)
    ));
  }

  function findCachedUser(userId, data = {}) {
    const users = memory.users.length ? memory.users : readLocalStore().users;
    const identities = identityKeys({ id: userId, uid: data.uid, email: data.email });
    return users.map(normalizeMember).find((user) => identityKeys(user).some((key) => identities.includes(key))) || null;
  }

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

  function withTimeout(promise, ms, label) {
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`${label} timed out`)), ms);
      })
    ]);
  }

  async function getFirebaseDataApiSafe() {
    return withTimeout(getFirebaseDataApi(), 2500, 'Firebase connection');
  }

  async function fetchCollection(collectionName) {
    const { db, firestoreModule } = await getFirebaseDataApiSafe();
    const snapshot = await firestoreModule.getDocs(firestoreModule.collection(db, collectionName));
    return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  }

  async function fetchCollectionSafe(collectionName, fallback = []) {
    try {
      return await fetchCollection(collectionName);
    } catch (err) {
      console.warn(`Using local ${collectionName} data because Firebase is unavailable.`, err);
      return fallback;
    }
  }

  async function saveDocument(collectionName, id, data, merge = true) {
    const { db, firestoreModule } = await getFirebaseDataApiSafe();
    await firestoreModule.setDoc(firestoreModule.doc(db, collectionName, id), {
      ...data,
      updatedAt: firestoreModule.serverTimestamp()
    }, { merge });
    return { id, ...data };
  }

  async function deleteDocument(collectionName, id) {
    const { db, firestoreModule } = await getFirebaseDataApiSafe();
    await firestoreModule.deleteDoc(firestoreModule.doc(db, collectionName, id));
  }

  async function fetchDocument(collectionName, id) {
    const { db, firestoreModule } = await getFirebaseDataApiSafe();
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
      usernameLower: toUsername(raw.usernameLower || username),
      avatar: raw.avatar || raw.profilePicture || '',
      profilePicture: raw.profilePicture || raw.avatar || '',
      banner: raw.banner || '',
      role: raw.role || 'Member',
      isSupportingPartner: Boolean(raw.isSupportingPartner || raw.supportingPartner),
      dashboardAccess: Array.isArray(raw.dashboardAccess) ? raw.dashboardAccess : [],
      specialty: raw.specialty || raw.country || '',
      bio: raw.bio || '',
      country: raw.country || '',
      website: raw.website || '',
      linkedin: raw.linkedin || '',
      github: raw.github || '',
      portfolio: raw.portfolio || '',
      profileAccent: raw.profileAccent || 'moss',
      availability: raw.availability || '',
      points: totalImpactPoints,
      solved: problemsSolved,
      initials: raw.initials || initialsFromName(displayName),
      badges: Array.isArray(raw.badges) ? raw.badges : [],
      stats: { ...stats, totalImpactPoints, problemsSolved }
    };
  }

  function normalizeProblem(raw) {
    const contributorReviews = Array.isArray(raw.contributorReviews) ? raw.contributorReviews : [];
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
      contributorReviews,
      suggestedRemovals: Array.isArray(raw.suggestedRemovals) ? raw.suggestedRemovals : [],
      evaluatorAwards: Array.isArray(raw.evaluatorAwards) ? raw.evaluatorAwards : [],
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
    const local = readLocalStore();
    let configModule = null;
    try {
      ({ configModule } = await getFirebaseDataApiSafe());
    } catch (err) {
      console.warn('Firebase member API unavailable; loading local members.', err);
      memory.users = memory.users.length ? memory.users : local.users.length ? local.users : defaultMembers;
      writeLocalStore({ users: memory.users });
      return loadMovementMembers(defaultMembers);
    }

    const firestoreUsers = await fetchCollectionSafe(configModule.accessCollections.users, local.users);
    const roleAssignments = await fetchCollectionSafe(configModule.accessCollections.roleAssignments, []);
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

    memory.users = mergedUsers.length ? mergedUsers : local.users.length ? local.users : defaultMembers;
    writeLocalStore({ users: memory.users });
    return loadMovementMembers(defaultMembers);
  }

  async function loadProblemsAsync(defaultProblems = []) {
    const local = readLocalStore();
    let problems = [];
    try {
      const { configModule } = await getFirebaseDataApiSafe();
      problems = (await fetchCollectionSafe(configModule.accessCollections.problems, local.problems)).map(normalizeProblem);
    } catch (err) {
      console.warn('Firebase problem API unavailable; loading local problems.', err);
      problems = local.problems.map(normalizeProblem);
    }
    memory.problems = problems.length ? problems : defaultProblems.map(normalizeProblem);
    writeLocalStore({ problems: memory.problems });
    return memory.problems;
  }

  async function saveProblem(problem) {
    const normalized = normalizeProblem(problem);
    const session = getPortalSession();
    const existing = (memory.problems.length ? memory.problems : readLocalStore().problems).find((item) => item.id === normalized.id);
    if (!existing && !session) {
      throw new Error('auth-required');
    }
    try {
      const { configModule } = await getFirebaseDataApiSafe();
      await saveDocument(configModule.accessCollections.problems, normalized.id, normalized);
    } catch (err) {
      console.warn('Saved problem locally because Firebase write failed.', err);
    }
    memory.problems = replaceById(memory.problems.length ? memory.problems : readLocalStore().problems, normalized);
    writeLocalStore({ problems: memory.problems });
    return normalized;
  }

  async function updateProblem(problemId, patch) {
    const session = getPortalSession();
    let remoteProblem = null;
    try {
      const { configModule } = await getFirebaseDataApiSafe();
      remoteProblem = await fetchDocument(configModule.accessCollections.problems, problemId);
    } catch (err) {
      console.warn('Loaded problem update target locally because Firebase read failed.', err);
    }
    const current = memory.problems.find((item) => item.id === problemId)
      || readLocalStore().problems.find((item) => item.id === problemId)
      || remoteProblem
      || { id: problemId };
    const awardFields = ['evaluatorAwards', 'winnerXP', 'attemptXP', 'solvedBy'];
    const adminStatuses = ['Open', 'Needs Revision', 'Rejected'];
    const nextStatus = patch.status;
    const ownerMatch = Boolean(
      session &&
      (current.ownerUid === session.uid || current.ownerUsername === toUsername(session.username || session.displayName || session.email))
    );
    const participantPatch = Object.keys(patch).every((key) => key === 'contributors');
    const ownerReviewPatch = Object.keys(patch).every((key) => ['status', 'ownerReview', 'contributorReviews', 'suggestedRemovals'].includes(key));
    const touchesAwardFields = awardFields.some((field) => Object.prototype.hasOwnProperty.call(patch, field));
    if (touchesAwardFields || nextStatus === 'Solved') {
      if (!canAwardPoints(session)) throw new Error('permission-denied');
    } else if (nextStatus && adminStatuses.includes(nextStatus)) {
      if (!canEvaluate(session)) throw new Error('permission-denied');
    } else if (nextStatus === 'Pending Evaluation' || ownerReviewPatch) {
      if (!ownerMatch && !canEvaluate(session)) throw new Error('permission-denied');
    } else if (participantPatch) {
      if (!session) throw new Error('auth-required');
    } else if (!ownerMatch && !canEvaluate(session)) {
      throw new Error('permission-denied');
    }
    return saveProblem({ ...current, ...patch, id: problemId });
  }

  async function deleteProblem(problemId) {
    try {
      const { configModule } = await getFirebaseDataApiSafe();
      await deleteDocument(configModule.accessCollections.problems, problemId);
    } catch (err) {
      console.warn('Deleted problem locally because Firebase delete failed.', err);
    }
    memory.problems = memory.problems.filter((item) => item.id !== problemId);
    writeLocalStore({ problems: memory.problems });
  }

  async function saveUserProfile(userId, data) {
    const normalizedUsername = toUsername(data.username || data.displayName);
    const payload = {
      ...data,
      username: normalizedUsername,
      usernameLower: normalizedUsername
    };
    const session = getPortalSession();
    const currentUser = findCachedUser(userId, payload);
    const isCreate = !currentUser;
    const ownProfile = sessionOwnsUser(userId, payload, session);
    if (!isCreate && !ownProfile && !canManageSystem(session) && !canAwardPoints(session)) {
      throw new Error('permission-denied');
    }
    if (!isCreate && protectedUserFieldsChanged(currentUser, payload) && !canAwardPoints(session)) {
      throw new Error('permission-denied');
    }
    if (isCreate && !ownProfile && !canManageSystem(session)) {
      throw new Error('permission-denied');
    }
    try {
      const { configModule } = await getFirebaseDataApiSafe();
      await saveDocument(configModule.accessCollections.users, userId, payload);
    } catch (err) {
      console.warn('Saved user locally because Firebase write failed.', err);
    }
    memory.users = replaceById(memory.users.length ? memory.users : readLocalStore().users, { id: userId, uid: userId, ...payload });
    writeLocalStore({ users: memory.users });
  }

  async function usernameAvailable(username, currentUserId = '') {
    const normalized = toUsername(username);
    const current = String(currentUserId || '').trim().toLowerCase();
    if (!normalized) return false;
    const users = await loadMovementMembersAsync([]);
    return !users.some((user) => {
      const userName = toUsername(user.usernameLower || user.username);
      const ids = identityKeys(user);
      return userName === normalized && !ids.includes(current);
    });
  }

  async function identityAvailable(identity = {}) {
    const normalized = normalizeIdentity(identity);
    if (!normalized.username || !normalized.email) return false;
    const users = await loadMovementMembersAsync([]);
    return !users.some((user) => {
      if (sameAccount(user, normalized)) return false;
      const userName = toUsername(user.usernameLower || user.username);
      const userEmail = String(user.email || '').trim().toLowerCase();
      const userUid = String(user.uid || user.id || '').trim().toLowerCase();
      return (
        userName === normalized.username ||
        userEmail === normalized.email ||
        (normalized.uid && userUid === normalized.uid)
      );
    });
  }

  async function deleteUserProfile(userId) {
    try {
      const { configModule } = await getFirebaseDataApiSafe();
      await deleteDocument(configModule.accessCollections.users, userId);
    } catch (err) {
      console.warn('Deleted user locally because Firebase delete failed.', err);
    }
    memory.users = (memory.users.length ? memory.users : readLocalStore().users)
      .filter((item) => item.id !== userId && item.uid !== userId);
    writeLocalStore({ users: memory.users });
  }

  async function loadPartnersAsync(defaultPartners = []) {
    const local = readLocalStore();
    let partners = [];
    try {
      const { configModule } = await getFirebaseDataApiSafe();
      partners = await fetchCollectionSafe(configModule.accessCollections.partners, local.partners);
    } catch (err) {
      console.warn('Firebase partner API unavailable; loading local partners.', err);
      partners = local.partners;
    }
    memory.partners = partners.length ? partners : defaultPartners;
    writeLocalStore({ partners: memory.partners });
    return memory.partners;
  }

  async function savePartnerProfile(partnerId, data) {
    try {
      const { configModule } = await getFirebaseDataApiSafe();
      await saveDocument(configModule.accessCollections.partners, partnerId, data);
    } catch (err) {
      console.warn('Saved partner locally because Firebase write failed.', err);
    }
    memory.partners = replaceById(memory.partners.length ? memory.partners : readLocalStore().partners, { id: partnerId, ...data });
    writeLocalStore({ partners: memory.partners });
  }

  async function loadSettings(defaultSettings = {}) {
    const local = readLocalStore();
    let settings = null;
    try {
      const { configModule } = await getFirebaseDataApiSafe();
      settings = await fetchDocument(configModule.accessCollections.settings, 'global');
    } catch (err) {
      console.warn('Firebase settings API unavailable; loading local settings.', err);
      settings = local.settings;
    }
    memory.settings = settings || defaultSettings;
    writeLocalStore({ settings: memory.settings });
    return memory.settings;
  }

  async function saveSettings(settings) {
    try {
      const { configModule } = await getFirebaseDataApiSafe();
      await saveDocument(configModule.accessCollections.settings, 'global', settings);
    } catch (err) {
      console.warn('Saved settings locally because Firebase write failed.', err);
    }
    memory.settings = settings;
    writeLocalStore({ settings });
  }

  function logSystemActivity(type, message) {
    if (!memory.logs.length) memory.logs = readLocalStore().logs;
    const payload = {
      id: `log_${Date.now()}`,
      timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }) + ' ' + new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      type,
      message
    };
    memory.logs.unshift(payload);
    writeLocalStore({ logs: memory.logs });
  }

  function loadSystemLogs() {
    if (!memory.logs.length) memory.logs = readLocalStore().logs;
    return memory.logs;
  }

  function clearSystemLogs() {
    memory.logs = [];
    writeLocalStore({ logs: [] });
  }

  function dashboardForSession(session) {
    const privileges = Array.isArray(session?.privileges) ? session.privileges : [];
    const explicit = Array.isArray(session?.dashboardAccess) ? session.dashboardAccess : [];
    if (['Founder', 'Co-Founder'].includes(session?.role) || privileges.includes('manage_system') || explicit.includes('superadmin')) return 'admin-dashboard.html';
    if (['Evaluator', 'Innovator'].includes(session?.role) || privileges.includes('evaluate_submissions') || privileges.includes('award_points') || explicit.includes('evaluator')) return 'evaluator-dashboard.html';
    if (session?.isSupportingPartner || explicit.includes('supportingPartner')) return 'supporting-partner-dashboard.html';
    return 'user-settings.html';
  }

  function dashboardsForSession(session) {
    const privileges = Array.isArray(session?.privileges) ? session.privileges : [];
    const explicit = Array.isArray(session?.dashboardAccess) ? session.dashboardAccess : [];
    const dashboards = new Set(['user']);
    if (['Founder', 'Co-Founder'].includes(session?.role) || privileges.includes('manage_system') || explicit.includes('superadmin')) {
      dashboards.add('superadmin');
      dashboards.add('evaluator');
      dashboards.add('supportingPartner');
    }
    if (['Evaluator', 'Innovator'].includes(session?.role) || privileges.includes('evaluate_submissions') || explicit.includes('evaluator')) dashboards.add('evaluator');
    if (session?.isSupportingPartner || explicit.includes('supportingPartner')) dashboards.add('supportingPartner');
    return Array.from(dashboards);
  }

  function memberPrefix(points) {
    const score = Number(points) || 0;
    if (score >= 10000) return 'Contributor';
    if (score >= 5000) return 'Pro';
    if (score >= 1500) return 'Regular';
    if (score >= 250) return 'Rising';
    return 'Newbie';
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
      ['open-frictions.html', 'Open Frictions'],
      ['members.html', 'Members'],
      ['impact-archive.html', 'Impact Archive'],
      ['core-team.html', 'Partners']
    ];
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
    usernameAvailable,
    identityAvailable,
    deleteUserProfile,
    loadPartnersAsync,
    savePartnerProfile,
    loadSettings,
    saveSettings,
    logSystemActivity,
    loadSystemLogs,
    clearSystemLogs,
    dashboardForSession,
    dashboardsForSession,
    memberPrefix,
    enhanceNavigation,
    ensureSolverProfile
  };

  document.addEventListener('DOMContentLoaded', enhanceNavigation);
})();
