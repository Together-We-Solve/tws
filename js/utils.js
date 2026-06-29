(function () {
  'use strict';

  const urlParams = new URLSearchParams(window.location.search);
  const refParam = urlParams.get('ref');
  if (refParam) {
    localStorage.setItem('tws_referral_ref', refParam.trim());
  }

  const memory = {
    users: [],
    problems: [],
    partners: [],
    tasks: [],
    taskSubmissions: [],
    taskCategories: [],
    notifications: [],
    logs: [],
    settings: null
  };

  const STORAGE_KEY = 'tws_local_data_v1';

  function localFallbackEnabled() {
    const host = window.location.hostname;
    return window.location.protocol === 'file:' || host === 'localhost' || host === '127.0.0.1';
  }

  function localFallbackOrThrow(err) {
    if (isPermissionDeniedError(err) || !localFallbackEnabled()) throw err;
  }

  function localFallbackOrEmpty(err, fallback = []) {
    if (isPermissionDeniedError(err)) throw err;
    return localFallbackEnabled() ? fallback : [];
  }

  function readLocalStore() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return {
        users: Array.isArray(parsed.users) ? parsed.users : [],
        problems: Array.isArray(parsed.problems) ? parsed.problems : [],
        partners: Array.isArray(parsed.partners) ? parsed.partners : [],
        tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
        taskSubmissions: Array.isArray(parsed.taskSubmissions) ? parsed.taskSubmissions : [],
        taskCategories: Array.isArray(parsed.taskCategories) ? parsed.taskCategories : [],
        notifications: Array.isArray(parsed.notifications) ? parsed.notifications : [],
        logs: Array.isArray(parsed.logs) ? parsed.logs : [],
        settings: parsed.settings || null
      };
    } catch (_) {
      return { users: [], problems: [], partners: [], tasks: [], taskSubmissions: [], taskCategories: [], notifications: [], logs: [], settings: null };
    }
  }

  function writeLocalStore(patch) {
    if (!localFallbackEnabled()) return readLocalStore();
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
      ['experience', current.experience, next.experience],
      ['role', current.role, next.role],
      ['privileges', current.privileges || [], next.privileges || []],
      ['dashboardAccess', current.dashboardAccess || [], next.dashboardAccess || []],
      ['isSupportingPartner', Boolean(current.isSupportingPartner), Boolean(next.isSupportingPartner)],
      ['stats.experience', currentStats.experience, nextStats.experience],
      ['stats.impactPoints', currentStats.impactPoints, nextStats.impactPoints],
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

  function systemUserFieldsChanged(current = {}, next = {}) {
    const checks = [
      ['role', current.role, next.role],
      ['adminRole', current.adminRole, next.adminRole],
      ['privileges', current.privileges || [], next.privileges || []],
      ['dashboardAccess', current.dashboardAccess || [], next.dashboardAccess || []],
      ['isSupportingPartner', Boolean(current.isSupportingPartner), Boolean(next.isSupportingPartner)]
    ];
    return checks.some(([, before, after]) => (
      after !== undefined && JSON.stringify(before ?? null) !== JSON.stringify(after ?? null)
    ));
  }

  function progressionUserFieldsChanged(current = {}, next = {}) {
    const currentStats = current.stats || {};
    const nextStats = next.stats || {};
    const checks = [
      ['points', current.points, next.points],
      ['impactPoints', current.impactPoints, next.impactPoints],
      ['solved', current.solved, next.solved],
      ['experience', current.experience, next.experience],
      ['stats.experience', currentStats.experience, nextStats.experience],
      ['stats.impactPoints', currentStats.impactPoints, nextStats.impactPoints],
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

  function platformExperienceFieldsOnly(current = {}, next = {}) {
    const currentStats = current.stats || {};
    const nextStats = next.stats || {};
    const checks = [
      ['points', current.points, next.points],
      ['impactPoints', current.impactPoints, next.impactPoints],
      ['solved', current.solved, next.solved],
      ['stats.impactPoints', currentStats.impactPoints, nextStats.impactPoints],
      ['stats.totalImpactPoints', currentStats.totalImpactPoints, nextStats.totalImpactPoints],
      ['stats.problemsSolved', currentStats.problemsSolved, nextStats.problemsSolved],
      ['stats.helpfulResponses', currentStats.helpfulResponses, nextStats.helpfulResponses],
      ['stats.knowledgeContributions', currentStats.knowledgeContributions, nextStats.knowledgeContributions]
    ];
    return !checks.some(([, before, after]) => (
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

  function validUsername(value) {
    return /^[a-z0-9_]{3,30}$/.test(toUsername(value));
  }

  function profileUrl(name) {
    return `user-profile.html?username=${encodeURIComponent(toUsername(name))}`;
  }

  function safeExternalUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    try {
      const url = new URL(raw, window.location.href);
      return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? url.href : '';
    } catch (_) {
      return '';
    }
  }

  function initialsFromName(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    return (parts[0]?.charAt(0) || 'U').toUpperCase() + (parts[1]?.charAt(0) || 'S').toUpperCase();
  }

  const progressionRanks = [
    'Newbie',
    'Explorer',
    'Learner',
    'Collaborator',
    'Problem Solver',
    'Researcher',
    'Changemaker',
    'Community Leader',
    'Expert',
    'Contributor'
  ];

  const administrativeRoles = ['Founder', 'Co-Founder', 'Innovator', 'Evaluator', 'Steward', 'Supporting Partner'];

  const defaultImpactRewards = {
    verifiedProblem: 3,
    engagedProblem: 2,
    solvedProblem: 5,
    measurableImpact: 10,
    usefulSuggestion: 1,
    adoptedSuggestion: 3,
    exceptionalInsight: 5,
    partialSolution: 3,
    workingSolution: 5,
    verifiedSolution: 8,
    implementedSolution: 12,
    exceptionalLongTermImpact: 20,
    documentationImprovement: 1,
    researchContribution: 2,
    factVerification: 2,
    mentoringMembers: 3,
    organizingInitiative: 5
  };

  const defaultExperienceRewards = {
    voicedFriction: 50,
    verifiedProblem: 40,
    engagedProblem: 25,
    solvedProblem: 120,
    measurableImpact: 180,
    usefulSuggestion: 15,
    adoptedSuggestion: 45,
    exceptionalInsight: 80,
    partialSolution: 45,
    workingSolution: 90,
    verifiedSolution: 150,
    implementedSolution: 240,
    exceptionalLongTermImpact: 360,
    documentationImprovement: 20,
    researchContribution: 35,
    factVerification: 30,
    mentoringMembers: 60,
    organizingInitiative: 100
  };

  const badgeCatalog = [
    { id: 'first-step', name: 'First Step', icon: '01', level: 'Automatic', description: 'Earned when a member creates a Together We Solve account.', source: 'automatic' },
    { id: 'friction-spotter', name: 'Friction Spotter', icon: 'FS', level: 'Automatic', description: 'Earned after posting a first problem for review.', source: 'automatic' },
    { id: 'verified-impact', name: 'Verified Impact', icon: 'VI', level: 'Automatic', description: 'Earned after receiving verified Impact Points from a contribution.', source: 'automatic' },
    { id: 'task-finisher', name: 'Task Finisher', icon: 'TF', level: 'Automatic', description: 'Earned when an evaluator approves a first community task submission.', source: 'automatic' },
    { id: 'solution-builder', name: 'Solution Builder', icon: 'SB', level: 'Automatic', description: 'Earned after a first verified solved contribution.', source: 'automatic' },
    { id: 'impact-100', name: 'Impact 100', icon: '100', level: 'Automatic', description: 'Earned by reaching 100 verified Impact Points.', source: 'automatic' },
    { id: 'impact-500', name: 'Impact 500', icon: '500', level: 'Automatic', description: 'Earned by reaching 500 verified Impact Points.', source: 'automatic' },
    { id: 'impact-1000', name: 'Impact 1000', icon: '1K', level: 'Automatic', description: 'Earned by reaching 1,000 verified Impact Points.', source: 'automatic' },
    { id: 'golden-heart', name: 'Golden Heart', icon: 'GH', level: 'Admin Award', description: 'Awarded by admins for sustained care, generosity, and community-first conduct.', source: 'admin' },
    { id: 'deep-thinker', name: 'Deep Thinker', icon: 'DT', level: 'Admin Award', description: 'Awarded by admins for unusually thoughtful analysis or problem framing.', source: 'admin' },
    { id: 'root-sprouter', name: 'Root Sprouter', icon: 'RS', level: 'Admin Award', description: 'Awarded by admins for helping ideas grow into practical action.', source: 'admin' },
    { id: 'constant-beacon', name: 'Constant Beacon', icon: 'CB', level: 'Admin Award', description: 'Awarded by admins for reliable, steady participation over time.', source: 'admin' },
    { id: 'sudden-light', name: 'Sudden Light', icon: 'SL', level: 'Admin Award', description: 'Awarded by admins for a breakthrough insight that unlocks progress.', source: 'admin' },
    { id: 'dignity-guard', name: 'Dignity Guard', icon: 'DG', level: 'Admin Award', description: 'Awarded by admins for protecting respectful, humane collaboration.', source: 'admin' },
    { id: 'mentor-signal', name: 'Mentor Signal', icon: 'MS', level: 'Admin Award', description: 'Awarded by admins for guiding other members with patience and clarity.', source: 'admin' },
    { id: 'evidence-keeper', name: 'Evidence Keeper', icon: 'EK', level: 'Admin Award', description: 'Awarded by admins for careful verification, research, or documentation.', source: 'admin' },
    { id: 'referral-connector-l1', name: 'Referral Connector (Level 1)', icon: '🌱', level: 'Milestone', description: 'Reaching 10 successful referrals. Helping our community grow organically.', source: 'automatic' },
    { id: 'referral-connector-l2', name: 'Referral Connector (Level 2)', icon: '🌿', level: 'Milestone', description: 'Reaching 50 successful referrals. A trusted connector of solutions and people.', source: 'automatic' },
    { id: 'referral-connector-l3', name: 'Referral Connector (Level 3)', icon: '🌳', level: 'Milestone', description: 'Reaching 100 successful referrals. An impactful pillar of community development.', source: 'automatic' },
    { id: 'referral-connector-l4', name: 'Referral Connector (Level 4)', icon: '👑', level: 'Milestone', description: 'Reaching 500 successful referrals. A masterful architect of community growth.', source: 'automatic' },
    { id: 'referral-connector-l5', name: 'Referral Connector (Level 5)', icon: '⭐', level: 'Milestone', description: 'Reaching 1,000 successful referrals. An legendary guide of Together We Solve.', source: 'automatic' }
  ];

  const badgeById = new Map(badgeCatalog.map((badge) => [badge.id, badge]));
  const badgeIdByName = new Map(badgeCatalog.map((badge) => [badge.name.toLowerCase(), badge.id]));

  function badgeId(value) {
    const raw = typeof value === 'string' ? value : (value?.id || value?.name || '');
    const clean = String(raw || '').trim();
    if (!clean) return '';
    const lower = clean.toLowerCase();
    return badgeById.has(clean) ? clean : (badgeIdByName.get(lower) || toUsername(clean).replace(/_/g, '-'));
  }

  function resolveBadge(value) {
    if (typeof value === 'object' && value) {
      const id = badgeId(value);
      return { ...(badgeById.get(id) || {}), ...value, id, name: value.name || badgeById.get(id)?.name || id };
    }
    const id = badgeId(value);
    const known = badgeById.get(id);
    return known ? { ...known } : { id, name: String(value || id), icon: '**', level: 'Community Badge', description: 'Awarded for meaningful cooperative participation.', source: 'legacy' };
  }

  function automaticBadgeIdsFor(raw = {}) {
    const stats = raw.stats || {};
    const points = impactPointsFromStats(raw);
    const solved = Number(stats.problemsSolved ?? raw.solved) || 0;
    const posted = Number(stats.problemsIdentified ?? raw.problemsPosted) || 0;
    const completedTasks = Number(stats.communityTasksCompleted) || 0;
    const referrals = Number(stats.successfulReferrals) || 0;
    const ids = [];
    if (raw.uid || raw.email || raw.createdAt || raw.joinedDate) ids.push('first-step');
    if (posted > 0) ids.push('friction-spotter');
    if (points > 0) ids.push('verified-impact');
    if (completedTasks > 0) ids.push('task-finisher');
    if (solved > 0) ids.push('solution-builder');
    if (points >= 100) ids.push('impact-100');
    if (points >= 500) ids.push('impact-500');
    if (points >= 1000) ids.push('impact-1000');
    if (referrals >= 1000) ids.push('referral-connector-l5');
    else if (referrals >= 500) ids.push('referral-connector-l4');
    else if (referrals >= 100) ids.push('referral-connector-l3');
    else if (referrals >= 50) ids.push('referral-connector-l2');
    else if (referrals >= 10) ids.push('referral-connector-l1');
    return ids;
  }

  function normalizeBadges(badges = [], raw = {}) {
    const ids = new Set();
    const normalized = [];
    [...(Array.isArray(badges) ? badges : []), ...automaticBadgeIdsFor(raw)].forEach((badge) => {
      const item = resolveBadge(badge);
      if (!item.id || ids.has(item.id)) return;
      ids.add(item.id);
      normalized.push(item);
    });
    return normalized;
  }

  function badgeStorageValues(badges = [], raw = {}) {
    return normalizeBadges(badges, raw).map((badge) => badge.id);
  }

  function levelRequirement(level) {
    return Math.round(100 * Math.pow(1.38, Math.max(0, Number(level) - 1)));
  }

  function progressionFromExperience(experience = 0) {
    let remaining = Math.max(0, Number(experience) || 0);
    let rankIndex = 0;
    let level = 1;

    while (rankIndex < progressionRanks.length - 1 || level < 10) {
      const required = levelRequirement(level);
      if (remaining < required) break;
      remaining -= required;
      if (level < 10) {
        level += 1;
      } else {
        rankIndex += 1;
        level = 1;
      }
    }

    const isComplete = rankIndex === progressionRanks.length - 1 && level === 10;
    const requiredForNext = isComplete ? 0 : levelRequirement(level);
    const rank = progressionRanks[rankIndex];
    return {
      rank,
      level,
      label: `${rank} Level ${level}`,
      experience: Math.max(0, Number(experience) || 0),
      experienceIntoLevel: isComplete ? requiredForNext : remaining,
      experienceForNextLevel: requiredForNext,
      progressPercent: isComplete ? 100 : Math.min(100, Math.round((remaining / requiredForNext) * 100)),
      role: rank === 'Contributor' ? 'Contributor' : 'Member',
      hallOfFame: isComplete
    };
  }

  function experienceForProgression(rank, level) {
    const rankIndex = Math.max(0, progressionRanks.indexOf(rank));
    const targetLevel = Math.min(10, Math.max(1, Number(level) || 1));
    let total = 0;
    for (let index = 0; index < rankIndex; index += 1) {
      for (let levelIndex = 1; levelIndex <= 10; levelIndex += 1) total += levelRequirement(levelIndex);
    }
    for (let levelIndex = 1; levelIndex < targetLevel; levelIndex += 1) total += levelRequirement(levelIndex);
    return total;
  }

  function impactPointsFromStats(raw = {}) {
    const stats = raw.stats || {};
    return Number(stats.totalImpactPoints ?? stats.impactPoints ?? raw.points ?? raw.impactPoints ?? 0) || 0;
  }

  function spendablePointsFromStats(raw = {}) {
    const stats = raw.stats || {};
    return Number(stats.impactPoints ?? raw.points ?? raw.impactPoints ?? stats.totalImpactPoints ?? 0) || 0;
  }

  function experienceFromStats(raw = {}) {
    const stats = raw.stats || {};
    return Number(stats.experience ?? raw.experience ?? 0) || 0;
  }

  function adminRoleFor(raw = {}) {
    const role = raw.adminRole || raw.role || '';
    if (administrativeRoles.includes(role)) return role;
    if (raw.isSupportingPartner || raw.supportingPartner) return 'Supporting Partner';
    return '';
  }

  let firebaseDataPromise = null;

  async function getFirebaseDataApi() {
    if (!firebaseDataPromise) {
      firebaseDataPromise = Promise.all([
        import('./firebase-config.js'),
        import('./firebase-core.js'),
        import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js')
      ]).then(([configModule, coreModule, firestoreModule]) => {
        return { db: coreModule.db, configModule, firestoreModule };
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
      const localFallback = localFallbackOrEmpty(err, fallback);
      if (localFallbackEnabled()) console.warn(`Using local ${collectionName} data because Firebase is unavailable.`, err);
      return localFallback;
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

  function isPermissionDeniedError(err) {
    const code = String(err?.code || '').toLowerCase();
    const message = String(err?.message || '').toLowerCase();
    return code.includes('permission-denied') || message.includes('permission-denied') || message.includes('missing or insufficient permissions');
  }

  async function fetchDocument(collectionName, id) {
    const { db, firestoreModule } = await getFirebaseDataApiSafe();
    const snap = await firestoreModule.getDoc(firestoreModule.doc(db, collectionName, id));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  }

  async function usernameReservation(username) {
    const normalized = toUsername(username);
    if (!validUsername(normalized)) return null;
    const { configModule } = await getFirebaseDataApiSafe();
    if (!configModule.accessCollections.usernames) return null;
    return fetchDocument(configModule.accessCollections.usernames, normalized);
  }

  function reservationMatchesIdentity(reservation, identity = {}) {
    if (!reservation) return false;
    const normalized = normalizeIdentity(identity);
    const reservationUid = String(reservation.uid || '').trim().toLowerCase();
    const reservationEmail = String(reservation.email || '').trim().toLowerCase();
    return Boolean(
      (normalized.uid && reservationUid === normalized.uid) ||
      (normalized.email && reservationEmail === normalized.email)
    );
  }

  async function reserveUsername(username, identity = {}) {
    const normalized = toUsername(username);
    if (!validUsername(normalized)) throw new Error('invalid-username');
    const uid = String(identity.uid || identity.id || '').trim();
    if (!uid) throw new Error('missing-uid');
    const email = String(identity.email || '').trim().toLowerCase();
    const { configModule } = await getFirebaseDataApiSafe();
    if (!configModule.accessCollections.usernames) return null;
    const current = await fetchDocument(configModule.accessCollections.usernames, normalized);
    if (current && !reservationMatchesIdentity(current, { uid, email })) throw new Error('username-taken');
    await saveDocument(configModule.accessCollections.usernames, normalized, {
      uid,
      email,
      username: normalized
    });
    return normalized;
  }

  async function releaseUsername(username, identity = {}) {
    const normalized = toUsername(username);
    if (!validUsername(normalized)) return;
    try {
      const { configModule } = await getFirebaseDataApiSafe();
      if (!configModule.accessCollections.usernames) return;
      const current = await fetchDocument(configModule.accessCollections.usernames, normalized);
      if (current && reservationMatchesIdentity(current, identity)) {
        await deleteDocument(configModule.accessCollections.usernames, normalized);
      }
    } catch (err) {
      if (!isPermissionDeniedError(err)) console.warn('Could not release old username reservation.', err);
    }
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
    const totalImpactPoints = impactPointsFromStats(raw);
    const spendablePoints = spendablePointsFromStats(raw);
    const experience = experienceFromStats(raw);
    const progression = raw.progression || progressionFromExperience(experience);
    const adminRole = adminRoleFor(raw);
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
      role: adminRole || raw.role || 'Member',
      adminRole,
      progressionRole: progression.role,
      progressionRank: progression.rank,
      progressionLevel: progression.level,
      progression,
      hallOfFame: Boolean(raw.hallOfFame || progression.hallOfFame),
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
      experience,
      impactPoints: spendablePoints,
      points: spendablePoints,
      totalImpactPoints: totalImpactPoints,
      solved: problemsSolved,
      initials: raw.initials || initialsFromName(displayName),
      badges: normalizeBadges(raw.badges, raw),
      stats: { ...stats, experience, impactPoints: spendablePoints, totalImpactPoints, problemsSolved }
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
      winnerEXP: Number(raw.winnerEXP) || 0,
      attemptEXP: Number(raw.attemptEXP) || 0,
      clones: Number(raw.clones) || 0,
      views: Number(raw.views) || 0,
      archiveHoursSaved: Math.max(0, Number(raw.archiveHoursSaved) || 0),
      archiveRippleReach: Math.max(0, Number(raw.archiveRippleReach) || 0),
      archiveClones: Math.max(0, Number(raw.archiveClones ?? raw.clones) || 0),
      archiveViews: Math.max(0, Number(raw.archiveViews ?? raw.views) || 0),
      archiveSummary: raw.archiveSummary || '',
      archiveOutcome: raw.archiveOutcome || '',
      archiveEditedBy: raw.archiveEditedBy || '',
      archiveEditedAt: raw.archiveEditedAt || ''
    };
  }

  const defaultTaskCategories = [
    'Community Service',
    'Helping Others',
    'Environment',
    'Education',
    'Knowledge Sharing',
    'Research',
    'Innovation',
    'Social Welfare',
    'Volunteering',
    'Special Campaigns',
    'Seasonal Events'
  ];

  const taskStatuses = ['Draft', 'Published', 'Archived'];
  const submissionStatuses = ['In Progress', 'Pending Verification', 'Approved', 'Rejected', 'Information Requested', 'Flagged'];

  function normalizeTask(raw = {}) {
    const status = taskStatuses.includes(raw.status) ? raw.status : 'Draft';
    const difficulty = ['Easy', 'Medium', 'Hard', 'Expert'].includes(raw.difficulty) ? raw.difficulty : 'Easy';
    const cadence = ['One-time', 'Weekly', 'Monthly', 'Seasonal', 'Event-based'].includes(raw.cadence) ? raw.cadence : 'One-time';
    return {
      ...raw,
      id: raw.id || `task_${Date.now()}`,
      title: String(raw.title || 'Untitled Task').trim(),
      description: String(raw.description || '').trim(),
      category: String(raw.category || 'Community Service').trim(),
      difficulty,
      estimatedTime: String(raw.estimatedTime || '').trim(),
      expReward: Math.max(0, Number(raw.expReward) || 0),
      impactPointReward: Math.max(0, Number(raw.impactPointReward) || 0),
      verificationRequirement: String(raw.verificationRequirement || 'Evaluator review required').trim(),
      startDate: raw.startDate || '',
      endDate: raw.endDate || '',
      status,
      cadence,
      instructions: String(raw.instructions || '').trim(),
      submissionGuidelines: String(raw.submissionGuidelines || '').trim(),
      createdBy: raw.createdBy || '',
      createdAt: raw.createdAt || '',
      updatedAt: raw.updatedAt || ''
    };
  }

  function normalizeTaskSubmission(raw = {}) {
    const status = submissionStatuses.includes(raw.status) ? raw.status : 'Pending Verification';
    const attachments = Array.isArray(raw.attachments) ? raw.attachments : [];
    const links = Array.isArray(raw.links) ? raw.links : [];
    return {
      ...raw,
      id: raw.id || `submission_${Date.now()}`,
      taskId: raw.taskId || '',
      taskTitle: raw.taskTitle || '',
      category: raw.category || '',
      memberUid: raw.memberUid || raw.userId || '',
      memberEmail: String(raw.memberEmail || raw.email || '').trim().toLowerCase(),
      memberName: raw.memberName || raw.displayName || 'Together We Solve Member',
      memberUsername: toUsername(raw.memberUsername || raw.username || raw.memberName),
      description: String(raw.description || '').trim(),
      reflection: String(raw.reflection || '').trim(),
      attachments,
      links,
      proofHash: raw.proofHash || '',
      status,
      expReward: Math.max(0, Number(raw.expReward) || 0),
      impactPointReward: Math.max(0, Number(raw.impactPointReward) || 0),
      evaluatorComments: String(raw.evaluatorComments || '').trim(),
      evaluatorUid: raw.evaluatorUid || '',
      evaluatorName: raw.evaluatorName || '',
      submittedAt: raw.submittedAt || '',
      reviewedAt: raw.reviewedAt || '',
      updatedAt: raw.updatedAt || '',
      history: Array.isArray(raw.history) ? raw.history : []
    };
  }

  function taskProofHash(payload = {}) {
    const source = JSON.stringify({
      taskId: payload.taskId || '',
      description: payload.description || '',
      reflection: payload.reflection || '',
      attachments: (payload.attachments || []).map((item) => `${item.name || ''}:${item.size || ''}:${item.url || ''}`).sort(),
      links: (payload.links || []).slice().sort()
    });
    let hash = 2166136261;
    for (let index = 0; index < source.length; index += 1) {
      hash ^= source.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `proof_${(hash >>> 0).toString(16)}`;
  }

  function isOwnTaskSubmission(submission, currentSession = getPortalSession()) {
    return Boolean(currentSession && (
      submission.memberUid === currentSession.uid ||
      String(submission.memberEmail || '').toLowerCase() === String(currentSession.email || '').toLowerCase()
    ));
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
      if (localFallbackEnabled()) console.warn('Firebase member API unavailable; loading local members.', err);
      memory.users = localFallbackEnabled() ? (memory.users.length ? memory.users : local.users.length ? local.users : defaultMembers) : defaultMembers;
      writeLocalStore({ users: memory.users });
      return loadMovementMembers(defaultMembers);
    }

    let firestoreUsers = [];
    try {
      firestoreUsers = await fetchCollectionSafe(configModule.accessCollections.users, local.users);
    } catch (err) {
      if (localFallbackEnabled()) console.warn('Firebase users collection is not readable for this session; loading local members.', err);
      firestoreUsers = localFallbackOrEmpty(err, local.users);
    }
    const session = getPortalSession();
    let roleAssignments = [];
    if (canManageSystem(session)) {
      try {
        roleAssignments = await fetchCollectionSafe(configModule.accessCollections.roleAssignments, []);
      } catch (err) {
        console.warn('Role assignments are not listable for this session; continuing with public user roles.', err);
      }
    }
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

    memory.users = mergedUsers.length ? mergedUsers : localFallbackEnabled() && local.users.length ? local.users : defaultMembers;
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
      if (localFallbackEnabled()) console.warn('Firebase problem API unavailable; loading local problems.', err);
      problems = localFallbackOrEmpty(err, local.problems).map(normalizeProblem);
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
      localFallbackOrThrow(err);
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
      localFallbackOrThrow(err);
      console.warn('Deleted problem locally because Firebase delete failed.', err);
    }
    memory.problems = memory.problems.filter((item) => item.id !== problemId);
    writeLocalStore({ problems: memory.problems });
  }

  async function loadTaskCategoriesAsync(defaultCategories = defaultTaskCategories) {
    const local = readLocalStore();
    let categories = [];
    try {
      const { configModule } = await getFirebaseDataApiSafe();
      categories = await fetchCollectionSafe(configModule.accessCollections.taskCategories, local.taskCategories);
    } catch (err) {
      if (localFallbackEnabled()) console.warn('Firebase task category API unavailable; loading local categories.', err);
      categories = localFallbackOrEmpty(err, local.taskCategories);
    }
    const names = categories.map((item) => item.name || item.id || item).filter(Boolean);
    memory.taskCategories = Array.from(new Set((names.length ? names : defaultCategories).map((item) => String(item).trim()).filter(Boolean)))
      .map((name) => ({ id: toUsername(name), name }));
    writeLocalStore({ taskCategories: memory.taskCategories });
    return memory.taskCategories;
  }

  async function saveTaskCategory(name) {
    const cleanName = String(name || '').trim();
    if (!cleanName) throw new Error('category-required');
    const session = getPortalSession();
    if (!canManageSystem(session)) throw new Error('permission-denied');
    const id = toUsername(cleanName);
    const payload = { id, name: cleanName };
    try {
      const { configModule } = await getFirebaseDataApiSafe();
      await saveDocument(configModule.accessCollections.taskCategories, id, payload);
    } catch (err) {
      localFallbackOrThrow(err);
      console.warn('Saved task category locally because Firebase write failed.', err);
    }
    memory.taskCategories = replaceById(memory.taskCategories.length ? memory.taskCategories : readLocalStore().taskCategories, payload);
    writeLocalStore({ taskCategories: memory.taskCategories });
    return payload;
  }

  async function loadCommunityTasksAsync(defaultTasks = []) {
    const local = readLocalStore();
    let tasks = [];
    try {
      const { configModule } = await getFirebaseDataApiSafe();
      tasks = await fetchCollectionSafe(configModule.accessCollections.communityTasks, local.tasks);
    } catch (err) {
      if (localFallbackEnabled()) console.warn('Firebase community task API unavailable; loading local tasks.', err);
      tasks = localFallbackOrEmpty(err, local.tasks);
    }
    memory.tasks = (tasks.length ? tasks : defaultTasks).map(normalizeTask);
    writeLocalStore({ tasks: memory.tasks });
    return memory.tasks;
  }

  async function saveCommunityTask(task) {
    const session = getPortalSession();
    if (!canManageSystem(session)) throw new Error('permission-denied');
    const normalized = normalizeTask({
      ...task,
      createdBy: task.createdBy || session?.uid || session?.email || '',
      createdAt: task.createdAt || new Date().toISOString()
    });
    try {
      const { configModule } = await getFirebaseDataApiSafe();
      await saveDocument(configModule.accessCollections.communityTasks, normalized.id, normalized);
    } catch (err) {
      localFallbackOrThrow(err);
      console.warn('Saved community task locally because Firebase write failed.', err);
    }
    memory.tasks = replaceById(memory.tasks.length ? memory.tasks : readLocalStore().tasks, normalized);
    writeLocalStore({ tasks: memory.tasks });
    return normalized;
  }

  async function deleteCommunityTask(taskId) {
    const session = getPortalSession();
    if (!canManageSystem(session)) throw new Error('permission-denied');
    try {
      const { configModule } = await getFirebaseDataApiSafe();
      await deleteDocument(configModule.accessCollections.communityTasks, taskId);
    } catch (err) {
      localFallbackOrThrow(err);
      console.warn('Deleted community task locally because Firebase delete failed.', err);
    }
    memory.tasks = (memory.tasks.length ? memory.tasks : readLocalStore().tasks).filter((item) => item.id !== taskId);
    writeLocalStore({ tasks: memory.tasks });
  }

  async function loadTaskSubmissionsAsync(defaultSubmissions = []) {
    const local = readLocalStore();
    let submissions = [];
    const session = getPortalSession();
    try {
      const { configModule } = await getFirebaseDataApiSafe();
      if (canEvaluate(session) || canManageSystem(session)) {
        submissions = await fetchCollectionSafe(configModule.accessCollections.taskSubmissions, local.taskSubmissions);
      } else if (session?.uid || session?.email) {
        const { db, firestoreModule } = await getFirebaseDataApiSafe();
        const constraints = session.uid
          ? [firestoreModule.where('memberUid', '==', session.uid)]
          : [firestoreModule.where('memberEmail', '==', String(session.email || '').toLowerCase())];
        const snapshot = await firestoreModule.getDocs(firestoreModule.query(
          firestoreModule.collection(db, configModule.accessCollections.taskSubmissions),
          ...constraints
        ));
        submissions = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      }
    } catch (err) {
      if (localFallbackEnabled()) console.warn('Firebase task submission API unavailable; loading local submissions.', err);
      submissions = localFallbackOrEmpty(err, local.taskSubmissions);
    }
    const visible = canEvaluate(session) || canManageSystem(session)
      ? submissions
      : submissions.filter((item) => isOwnTaskSubmission(normalizeTaskSubmission(item), session));
    memory.taskSubmissions = (visible.length ? visible : defaultSubmissions).map(normalizeTaskSubmission);
    writeLocalStore({ taskSubmissions: submissions.length ? submissions.map(normalizeTaskSubmission) : memory.taskSubmissions });
    return memory.taskSubmissions;
  }

  async function saveTaskSubmission(submission) {
    const session = getPortalSession();
    if (!session) throw new Error('auth-required');
    const allSubmissions = readLocalStore().taskSubmissions.map(normalizeTaskSubmission);
    const current = allSubmissions.find((item) => item.id === submission.id);
    if (current && !isOwnTaskSubmission(current, session) && !canEvaluate(session)) throw new Error('permission-denied');
    if (current && !['Information Requested', 'In Progress', 'Pending Verification'].includes(current.status) && !canEvaluate(session)) {
      throw new Error('permission-denied');
    }
    const normalized = normalizeTaskSubmission({
      ...current,
      ...submission,
      memberUid: submission.memberUid || current?.memberUid || session.uid || '',
      memberEmail: submission.memberEmail || current?.memberEmail || session.email || '',
      memberName: submission.memberName || current?.memberName || session.displayName || session.username || session.email || '',
      memberUsername: submission.memberUsername || current?.memberUsername || session.username || session.displayName || session.email || '',
      status: submission.status || 'Pending Verification',
      submittedAt: submission.submittedAt || current?.submittedAt || new Date().toISOString()
    });
    normalized.proofHash = taskProofHash(normalized);
    const duplicate = allSubmissions.find((item) => item.id !== normalized.id && item.proofHash && item.proofHash === normalized.proofHash);
    if (duplicate) throw new Error('duplicate-proof');
    const history = Array.isArray(normalized.history) ? normalized.history : [];
    normalized.history = history.concat({
      status: normalized.status,
      by: session.uid || session.email || '',
      at: new Date().toISOString(),
      note: submission.historyNote || ''
    });
    try {
      const { configModule } = await getFirebaseDataApiSafe();
      await saveDocument(configModule.accessCollections.taskSubmissions, normalized.id, normalized);
    } catch (err) {
      localFallbackOrThrow(err);
      console.warn('Saved task submission locally because Firebase write failed.', err);
    }
    const stored = replaceById(allSubmissions, normalized);
    memory.taskSubmissions = stored;
    writeLocalStore({ taskSubmissions: stored });
    await createNotification({
      userId: normalized.memberUid,
      email: normalized.memberEmail,
      type: 'task_submitted',
      title: 'Task submitted',
      message: `${normalized.taskTitle || 'Your task'} is pending evaluator verification.`
    });
    return normalized;
  }

  async function reviewTaskSubmission(submissionId, action, comments = '') {
    const session = getPortalSession();
    if (!canEvaluate(session)) throw new Error('permission-denied');
    const allSubmissions = readLocalStore().taskSubmissions.map(normalizeTaskSubmission);
    const current = allSubmissions.find((item) => item.id === submissionId) || memory.taskSubmissions.find((item) => item.id === submissionId);
    if (!current) throw new Error('not-found');
    const statusByAction = {
      approve: 'Approved',
      reject: 'Rejected',
      request_info: 'Information Requested',
      flag: 'Flagged'
    };
    const nextStatus = statusByAction[action] || action;
    const reviewed = normalizeTaskSubmission({
      ...current,
      status: nextStatus,
      evaluatorComments: comments,
      evaluatorUid: session.uid || session.email || '',
      evaluatorName: session.displayName || session.username || session.email || '',
      reviewedAt: new Date().toISOString(),
      history: (current.history || []).concat({
        status: nextStatus,
        by: session.uid || session.email || '',
        at: new Date().toISOString(),
        note: comments
      })
    });
    try {
      const { configModule } = await getFirebaseDataApiSafe();
      await saveDocument(configModule.accessCollections.taskSubmissions, reviewed.id, reviewed);
    } catch (err) {
      localFallbackOrThrow(err);
      console.warn('Reviewed task submission locally because Firebase write failed.', err);
    }
    const stored = replaceById(allSubmissions, reviewed);
    memory.taskSubmissions = stored;
    writeLocalStore({ taskSubmissions: stored });
    if (nextStatus !== 'Approved') {
      await createNotification({
        userId: reviewed.memberUid,
        email: reviewed.memberEmail,
        type: nextStatus === 'Rejected' ? 'task_rejected' : nextStatus === 'Information Requested' ? 'task_info_requested' : 'task_flagged',
        title: nextStatus === 'Rejected' ? 'Task rejected' : nextStatus === 'Information Requested' ? 'More information requested' : 'Task flagged for review',
        message: comments || `${reviewed.taskTitle || 'Your task'} status changed to ${nextStatus}.`
      });
    }
    if (nextStatus === 'Approved') await awardTaskSubmission(reviewed);
    return reviewed;
  }

  async function awardTaskSubmission(submission) {
    const session = getPortalSession();
    if (!canAwardPoints(session)) throw new Error('permission-denied');
    const members = await loadMovementMembersAsync([]);
    const member = members.find((item) => (
      item.uid === submission.memberUid ||
      item.id === submission.memberUid ||
      String(item.email || '').toLowerCase() === String(submission.memberEmail || '').toLowerCase()
    ));
    if (!member) return null;
    const history = Array.isArray(member.taskSubmissionHistory) ? member.taskSubmissionHistory : [];
    if (history.includes(submission.id)) return member;
    const points = Number(submission.impactPointReward) || 0;
    const experience = Number(submission.expReward) || 0;
    const currentPoints = spendablePointsFromStats(member);
    const previousTotalPoints = impactPointsFromStats(member);
    const currentExperience = experienceFromStats(member);
    const completedTasks = Number(member.stats?.communityTasksCompleted || 0) + 1;
    const nextProfile = {
      ...member,
      taskSubmissionHistory: history.concat(submission.id),
      lastTaskAward: {
        submissionId: submission.id,
        taskId: submission.taskId,
        points,
        experience,
        awardedBy: session.uid || session.email || '',
        awardedAt: new Date().toISOString()
      },
      points: currentPoints + points,
      impactPoints: currentPoints + points,
      experience: currentExperience + experience,
      stats: {
        ...(member.stats || {}),
        experience: currentExperience + experience,
        impactPoints: currentPoints + points,
        totalImpactPoints: previousTotalPoints + points,
        communityTasksCompleted: completedTasks
      }
    };
    nextProfile.badges = badgeStorageValues(member.badges, nextProfile);
    await saveUserProfile(member.uid || member.id || member.username, nextProfile);
    await createNotification({
      userId: member.uid || member.id || '',
      email: member.email || submission.memberEmail || '',
      type: 'task_approved',
      title: 'Task approved',
      message: `${submission.taskTitle || 'Your task'} was approved. ${experience.toLocaleString()} EXP${points ? ` and ${points.toLocaleString()} IP` : ''} awarded.`
    });
    return member;
  }

  async function createNotification(notification) {
    const session = getPortalSession();
    const id = notification.id || `notification_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const payload = {
      id,
      userId: notification.userId || '',
      email: String(notification.email || '').trim().toLowerCase(),
      type: notification.type || 'system',
      title: String(notification.title || '').trim(),
      message: String(notification.message || '').trim(),
      read: Boolean(notification.read),
      createdBy: notification.createdBy || session?.uid || session?.email || '',
      createdAt: notification.createdAt || new Date().toISOString()
    };
    try {
      const { configModule } = await getFirebaseDataApiSafe();
      await saveDocument(configModule.accessCollections.notifications, id, payload);
    } catch (err) {
      localFallbackOrThrow(err);
      console.warn('Saved notification locally because Firebase write failed.', err);
    }
    const local = readLocalStore().notifications;
    memory.notifications = replaceById(local, payload);
    writeLocalStore({ notifications: memory.notifications });
    return payload;
  }

  async function loadNotificationsAsync(defaultNotifications = []) {
    const local = readLocalStore();
    const session = getPortalSession();
    let notifications = [];
    try {
      const { configModule } = await getFirebaseDataApiSafe();
      if (canManageSystem(session)) {
        notifications = await fetchCollectionSafe(configModule.accessCollections.notifications, local.notifications);
      } else if (session?.uid || session?.email) {
        const { db, firestoreModule } = await getFirebaseDataApiSafe();
        const constraints = session.uid
          ? [firestoreModule.where('userId', '==', session.uid)]
          : [firestoreModule.where('email', '==', String(session.email || '').toLowerCase())];
        const snapshot = await firestoreModule.getDocs(firestoreModule.query(
          firestoreModule.collection(db, configModule.accessCollections.notifications),
          ...constraints
        ));
        notifications = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      }
    } catch (err) {
      if (localFallbackEnabled()) console.warn('Firebase notifications API unavailable; loading local notifications.', err);
      notifications = localFallbackOrEmpty(err, local.notifications);
    }
    memory.notifications = (notifications.length ? notifications : defaultNotifications)
      .filter((item) => canManageSystem(session) || item.userId === session?.uid || String(item.email || '').toLowerCase() === String(session?.email || '').toLowerCase());
    writeLocalStore({ notifications });
    return memory.notifications;
  }

  async function awardPlatformExperience(userId, action, amount, details = {}) {
    const session = getPortalSession();
    if (!canAwardPoints(session) && session?.uid !== userId) throw new Error('permission-denied');
    const members = await loadMovementMembersAsync([]);
    const member = members.find((item) => [item.uid, item.id, item.username].includes(userId));
    if (!member) throw new Error('not-found');
    const experience = Math.max(0, Number(amount) || 0);
    const currentExperience = experienceFromStats(member);
    const history = Array.isArray(member.platformExperienceHistory) ? member.platformExperienceHistory : [];
    const historyKey = action;
    if (history.includes(historyKey)) return member;
    const nextProfile = {
      ...member,
      platformExperienceHistory: history.concat(historyKey),
      lastPlatformExperienceAward: {
        action,
        experience,
        awardedAt: new Date().toISOString()
      },
      experience: currentExperience + experience,
      stats: {
        ...(member.stats || {}),
        experience: currentExperience + experience
      }
    };
    nextProfile.badges = badgeStorageValues(member.badges, nextProfile);
    await saveUserProfile(member.uid || member.id || member.username, nextProfile);
    await createNotification({
      userId: member.uid || member.id || '',
      email: member.email || '',
      type: 'experience_awarded',
      title: 'Experience awarded',
      message: `${experience.toLocaleString()} EXP awarded for ${action}.`
    });
    return member;
  }

  async function saveUserProfile(userId, data) {
    const normalizedUsername = toUsername(data.username || data.displayName);
    if (!validUsername(normalizedUsername)) throw new Error('invalid-username');
    const payload = {
      ...data,
      username: normalizedUsername,
      usernameLower: normalizedUsername
    };
    const session = getPortalSession();
    const currentUser = findCachedUser(userId, payload);
    const isCreate = !currentUser;
    const ownProfile = sessionOwnsUser(userId, payload, session);
    const platformExperienceSelfAward = Boolean(
      ownProfile &&
      payload.lastPlatformExperienceAward &&
      !systemUserFieldsChanged(currentUser || {}, payload) &&
      platformExperienceFieldsOnly(currentUser || {}, payload)
    );
    const rewardOrAdminBadgeUpdate = Boolean(
      isCreate ||
      canManageSystem(session) ||
      canAwardPoints(session) ||
      payload.lastContributionAward ||
      payload.lastTaskAward ||
      payload.lastPlatformExperienceAward
    );
    if (rewardOrAdminBadgeUpdate) {
      payload.badges = badgeStorageValues(data.badges, data);
    } else {
      delete payload.badges;
    }
    if (!isCreate && !ownProfile && !canManageSystem(session) && !canAwardPoints(session)) {
      throw new Error('permission-denied');
    }
    if (!isCreate && systemUserFieldsChanged(currentUser, payload) && !canManageSystem(session)) {
      throw new Error('permission-denied');
    }
    if (!isCreate && progressionUserFieldsChanged(currentUser, payload) && !canAwardPoints(session) && !platformExperienceSelfAward) {
      throw new Error('permission-denied');
    }
    if (isCreate && !ownProfile && !canManageSystem(session)) {
      throw new Error('permission-denied');
    }
    const reservationIdentity = {
      uid: payload.uid || userId,
      email: payload.email || session?.email || ''
    };
    const previousUsername = toUsername(currentUser?.usernameLower || currentUser?.username || '');
    try {
      const { configModule } = await getFirebaseDataApiSafe();
      await reserveUsername(normalizedUsername, reservationIdentity);
      await saveDocument(configModule.accessCollections.users, userId, payload);
      if (previousUsername && previousUsername !== normalizedUsername) {
        await releaseUsername(previousUsername, reservationIdentity);
      }
    } catch (err) {
      if (['invalid-username', 'missing-uid', 'username-taken'].includes(err?.message)) throw err;
      localFallbackOrThrow(err);
      console.warn('Saved user locally because Firebase write failed.', err);
    }
    memory.users = replaceById(memory.users.length ? memory.users : readLocalStore().users, { id: userId, uid: userId, ...payload });
    writeLocalStore({ users: memory.users });
  }

  async function usernameAvailable(username, currentUserId = '') {
    const normalized = toUsername(username);
    const current = String(currentUserId || '').trim().toLowerCase();
    if (!validUsername(normalized)) return false;
    try {
      const reservation = await usernameReservation(normalized);
      if (reservation) {
        const ids = identityKeys(reservation);
        if (!ids.includes(current)) return false;
      }
    } catch (err) {
      localFallbackOrThrow(err);
    }
    const users = await loadMovementMembersAsync([]);
    return !users.some((user) => {
      const userName = toUsername(user.usernameLower || user.username);
      const ids = identityKeys(user);
      return userName === normalized && !ids.includes(current);
    });
  }

  async function identityAvailable(identity = {}) {
    const normalized = normalizeIdentity(identity);
    if (!validUsername(normalized.username) || !normalized.email) return false;
    try {
      const reservation = await usernameReservation(normalized.username);
      if (reservation && !reservationMatchesIdentity(reservation, normalized)) return false;
    } catch (err) {
      localFallbackOrThrow(err);
    }
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
    const session = getPortalSession();
    if (!canManageSystem(session)) {
      throw new Error('permission-denied');
    }
    try {
      const { configModule } = await getFirebaseDataApiSafe();
      await deleteDocument(configModule.accessCollections.users, userId);
    } catch (err) {
      localFallbackOrThrow(err);
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
      if (localFallbackEnabled()) console.warn('Firebase partner API unavailable; loading local partners.', err);
      partners = localFallbackOrEmpty(err, local.partners);
    }
    memory.partners = partners.length ? partners : defaultPartners;
    writeLocalStore({ partners: memory.partners });
    return memory.partners;
  }

  async function savePartnerProfile(partnerId, data) {
    const session = getPortalSession();
    const ownsPartner = session && (data.ownerUid === session.uid || data.email === String(session.email || '').toLowerCase());
    if (!canManageSystem(session) && !ownsPartner) {
      throw new Error('permission-denied');
    }
    try {
      const { configModule } = await getFirebaseDataApiSafe();
      await saveDocument(configModule.accessCollections.partners, partnerId, data);
    } catch (err) {
      localFallbackOrThrow(err);
      console.warn('Saved partner locally because Firebase write failed.', err);
    }
    memory.partners = replaceById(memory.partners.length ? memory.partners : readLocalStore().partners, { id: partnerId, ...data });
    writeLocalStore({ partners: memory.partners });
  }

  async function deletePartnerProfile(partnerId) {
    const session = getPortalSession();
    if (!canManageSystem(session)) {
      throw new Error('permission-denied');
    }
    try {
      const { configModule } = await getFirebaseDataApiSafe();
      await deleteDocument(configModule.accessCollections.partners, partnerId);
    } catch (err) {
      localFallbackOrThrow(err);
      console.warn('Deleted partner locally because Firebase delete failed.', err);
    }
    memory.partners = (memory.partners.length ? memory.partners : readLocalStore().partners)
      .filter((item) => item.id !== partnerId);
    writeLocalStore({ partners: memory.partners });
  }

  async function loadSettings(defaultSettings = {}) {
    const local = readLocalStore();
    let settings = null;
    try {
      const { configModule } = await getFirebaseDataApiSafe();
      settings = await fetchDocument(configModule.accessCollections.settings, 'global');
    } catch (err) {
      if (localFallbackEnabled()) console.warn('Firebase settings API unavailable; loading local settings.', err);
      settings = localFallbackEnabled() ? local.settings : null;
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
      localFallbackOrThrow(err);
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

  function memberPrefix(pointsOrMember) {
    if (typeof pointsOrMember === 'object' && pointsOrMember) {
      return pointsOrMember.progression?.label || progressionFromExperience(experienceFromStats(pointsOrMember)).label;
    }
    return progressionFromExperience(0).label;
  }

  const defaultReferralSettings = {
    validation: {
      requireEmailVerified: true,
      minAccountAgeDays: 0,
      requireProfileCompletion: true,
      minActivityCount: 1,
      enableFraudCheck: true
    },
    tiers: [
      { name: 'Bronze Connector', threshold: 0, reward: 100 },
      { name: 'Silver Connector', threshold: 5, reward: 150 },
      { name: 'Gold Connector', threshold: 15, reward: 220 },
      { name: 'Platinum Builder', threshold: 35, reward: 300 },
      { name: 'Diamond Catalyst', threshold: 75, reward: 400 },
      { name: 'Apex Ambassador', threshold: 150, reward: 500 }
    ],
    milestones: [
      { count: 10, bonus: 500 },
      { count: 50, bonus: 2500 },
      { count: 100, bonus: 6000 },
      { count: 500, bonus: 35000 },
      { count: 1000, bonus: 80000 }
    ]
  };

  function generateReferralCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'TWS-';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  function calculateReferralEXP(successfulCount, refSettings) {
    const tiers = refSettings?.tiers || defaultReferralSettings.tiers;
    const sortedTiers = [...tiers].sort((a, b) => a.threshold - b.threshold);
    let totalEXP = 0;
    for (let i = 1; i <= successfulCount; i++) {
      const prevCount = i - 1;
      let activeTier = sortedTiers[0];
      for (const tier of sortedTiers) {
        if (prevCount >= tier.threshold) {
          activeTier = tier;
        } else {
          break;
        }
      }
      totalEXP += Number(activeTier.reward) || 0;
    }
    const milestones = refSettings?.milestones || defaultReferralSettings.milestones;
    let bonusEXP = 0;
    for (const m of milestones) {
      if (successfulCount >= m.count) {
        bonusEXP += Number(m.bonus) || 0;
      }
    }
    return totalEXP + bonusEXP;
  }

  async function recalculateUserReferralProgression(userId) {
    const { configModule, db, firestoreModule } = await getFirebaseDataApiSafe();
    const queryConstraints = [
      firestoreModule.where('inviterUid', '==', userId)
    ];
    const q = firestoreModule.query(
      firestoreModule.collection(db, configModule.accessCollections.referrals),
      ...queryConstraints
    );
    const snap = await firestoreModule.getDocs(q);
    const referrals = snap.docs.map(doc => doc.data());
    const approved = referrals.filter(r => r.status === 'Approved');
    const pending = referrals.filter(r => r.status === 'Pending Verification');
    const rejected = referrals.filter(r => r.status === 'Rejected');
    const settings = await loadSettings({});
    const refSettings = settings.referralSettings || defaultReferralSettings;
    const N = approved.length;
    const pendingCount = pending.length;
    const rejectedCount = rejected.length;
    const newReferralIP = N * 1;
    const newReferralEXP = calculateReferralEXP(N, refSettings);
    const userDoc = await fetchDocument(configModule.accessCollections.users, userId);
    if (!userDoc) return;
    const stats = userDoc.stats || {};
    const oldReferralIP = Number(stats.referralImpactPoints) || 0;
    const oldReferralEXP = Number(stats.referralExperience) || 0;
    const ipDiff = newReferralIP - oldReferralIP;
    const expDiff = newReferralEXP - oldReferralEXP;
    const newStats = {
      ...stats,
      successfulReferrals: N,
      pendingReferrals: pendingCount,
      rejectedReferrals: rejectedCount,
      referralImpactPoints: newReferralIP,
      referralExperience: newReferralEXP,
      impactPoints: (Number(stats.impactPoints) || 0) + ipDiff,
      totalImpactPoints: (Number(stats.totalImpactPoints) || 0) + ipDiff,
      experience: (Number(stats.experience) || 0) + expDiff
    };
    const updatedUser = {
      ...userDoc,
      stats: newStats,
      points: newStats.impactPoints,
      impactPoints: newStats.impactPoints,
      experience: newStats.experience,
      updatedAt: new Date().toISOString()
    };
    const sortedTiers = [...(refSettings.tiers || defaultReferralSettings.tiers)].sort((a, b) => a.threshold - b.threshold);
    let activeTierName = sortedTiers[0].name;
    for (const tier of sortedTiers) {
      if (N >= tier.threshold) {
        activeTierName = tier.name;
      } else {
        break;
      }
    }
    updatedUser.referralTier = activeTierName;
    const progression = progressionFromExperience(updatedUser.experience);
    updatedUser.role = progression.role;
    await saveDocument(configModule.accessCollections.users, userId, updatedUser);
    memory.users = replaceById(memory.users.length ? memory.users : readLocalStore().users, { id: userId, uid: userId, ...updatedUser });
    writeLocalStore({ users: memory.users });
    const session = getPortalSession();
    if (session && (session.uid === userId || session.username === updatedUser.username)) {
      session.role = updatedUser.role;
      sessionStorage.setItem('portal_session', JSON.stringify(session));
    }
  }

  function triggerReferralCelebration(milestone, badgeName, badgeIcon, bonusExp) {
    const existing = document.querySelector('.level-up-overlay');
    if (existing) existing.remove();
    const overlay = document.createElement('div');
    overlay.className = 'level-up-overlay';
    overlay.innerHTML = `
      <div class="level-up-card">
        <div class="level-up-glow" style="background: radial-gradient(circle, rgba(200, 125, 85, 0.4) 0%, transparent 70%);"></div>
        <div class="level-up-celebration-particles"></div>
        <div class="level-up-badge-container">
          <div class="level-up-badge" style="background: #c87d55; border-color: #385e4a;">
            <span class="level-up-badge-num" style="font-size: 32px;">${badgeIcon}</span>
          </div>
        </div>
        <h2 class="level-up-title" style="color: #c87d55;">Milestone Unlocked!</h2>
        <p class="level-up-subtitle">Incredible! You have reached the milestone of <strong>${milestone} successful referrals</strong>.</p>
        <p class="level-up-subtitle">Your referral badge has evolved to <strong>${badgeName}</strong>! ${bonusExp ? `You've also been awarded a one-time bonus of <strong>${bonusExp.toLocaleString()} EXP</strong>!` : ''}</p>
        <button class="btn btn-primary btn-level-up-dismiss" style="background: #c87d55; border-color: #c87d55;">Phenomenal! &nearr;</button>
      </div>
    `;
    document.body.appendChild(overlay);
    const particleContainer = overlay.querySelector('.level-up-celebration-particles');
    const colors = ['#C87D55', '#23382B', '#3D5A6C', '#FAF6F0', '#E8A885'];
    for (let index = 0; index < 45; index += 1) {
      const particle = document.createElement('div');
      particle.className = 'level-up-particle';
      const angle = Math.random() * Math.PI * 2;
      const distance = 80 + Math.random() * 160;
      const x = Math.cos(angle) * distance;
      const y = Math.sin(angle) * distance;
      const size = 6 + Math.random() * 10;
      const rotation = 90 + Math.random() * 360;
      const delay = Math.random() * 0.2;
      const color = colors[Math.floor(Math.random() * colors.length)];
      const br = Math.random() > 0.5 ? '50%' : '0%';
      particle.style.setProperty('--x', `${x}px`);
      particle.style.setProperty('--y', `${y}px`);
      particle.style.setProperty('--size', `${size}px`);
      particle.style.setProperty('--r', `${rotation}deg`);
      particle.style.setProperty('--bg', color);
      particle.style.setProperty('--br', br);
      particle.style.animationDelay = `${delay}s`;
      particleContainer.appendChild(particle);
    }
    requestAnimationFrame(() => {
      overlay.classList.add('active');
    });
    const dismissBtn = overlay.querySelector('.btn-level-up-dismiss');
    dismissBtn.onclick = () => {
      overlay.classList.remove('active');
      setTimeout(() => overlay.remove(), 600);
    };
  }

  function enhanceNavigation() {
    const session = JSON.parse(sessionStorage.getItem('portal_session') || 'null');
    const navLinks = document.querySelector('.nav-links');
    const logo = document.querySelector('.nav-logo');
    const cta = document.querySelector('.nav-cta');
    const nav = document.getElementById('nav');

    if (logo && session) logo.href = 'home.html';

    if (session && navLinks) {
      const desiredLinks = [
        ['home.html', 'Home'],
        ['open-frictions.html', 'Open Frictions'],
        ['tasks.html', 'Tasks'],
        ['referrals.html', 'Referrals'],
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

    if (nav) {
      let menuBtn = nav.querySelector('.nav-mobile-toggle');
      if (!menuBtn) {
        menuBtn = document.createElement('button');
        menuBtn.className = 'nav-mobile-toggle';
        menuBtn.type = 'button';
        menuBtn.setAttribute('aria-label', 'Toggle Navigation Menu');
        menuBtn.setAttribute('aria-expanded', 'false');
        menuBtn.setAttribute('aria-controls', 'primary-navigation');
        menuBtn.innerHTML = '<span></span><span></span><span></span>';
        const inner = nav.querySelector('.nav-inner');
        if (inner) {
          inner.appendChild(menuBtn);
        }
      }

      if (navLinks && !navLinks.id) {
        navLinks.id = 'primary-navigation';
      }

      const closeMenu = () => {
        nav.classList.remove('menu-open');
        menuBtn.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      };

      const openMenu = () => {
        nav.classList.add('menu-open');
        menuBtn.setAttribute('aria-expanded', 'true');
        document.body.style.overflow = 'hidden';
      };

      menuBtn.onclick = (e) => {
        e.stopPropagation();
        if (nav.classList.contains('menu-open')) closeMenu();
        else openMenu();
      };

      nav.querySelectorAll('.nav-link, .nav-cta').forEach(link => {
        link.addEventListener('click', () => {
          closeMenu();
        });
      });

      document.addEventListener('click', (e) => {
        if (nav.classList.contains('menu-open') && !nav.contains(e.target)) {
          closeMenu();
        }
      });

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && nav.classList.contains('menu-open')) {
          closeMenu();
        }
      });

      window.addEventListener('resize', () => {
        if (window.innerWidth > 1150 && nav.classList.contains('menu-open')) {
          closeMenu();
        }
      });
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

  function triggerLevelUpAnimation(rank, level, requiredExp) {
    const existing = document.querySelector('.level-up-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'level-up-overlay';
    overlay.innerHTML = `
      <div class="level-up-card">
        <div class="level-up-glow"></div>
        <div class="level-up-celebration-particles"></div>
        <div class="level-up-badge-container">
          <div class="level-up-badge">
            <span class="level-up-badge-num">${level}</span>
            <span class="level-up-badge-lbl">${rank === 'Contributor' ? 'LVL' : 'RANK'}</span>
          </div>
        </div>
        <h2 class="level-up-title">Level Up!</h2>
        <p class="level-up-subtitle">Outstanding work! You have progressed to <strong>${rank} Level ${level}</strong>. Keep sharing frictions and solving problems!</p>
        <button class="btn btn-primary btn-level-up-dismiss">Magnificent! &nearr;</button>
      </div>
    `;

    document.body.appendChild(overlay);

    const particleContainer = overlay.querySelector('.level-up-celebration-particles');
    const colors = ['#C87D55', '#23382B', '#3D5A6C', '#FAF6F0', '#E8A885'];

    for (let index = 0; index < 45; index += 1) {
      const particle = document.createElement('div');
      particle.className = 'level-up-particle';
      const angle = Math.random() * Math.PI * 2;
      const distance = 80 + Math.random() * 160;
      const x = Math.cos(angle) * distance;
      const y = Math.sin(angle) * distance;
      const size = 6 + Math.random() * 10;
      const rotation = 90 + Math.random() * 360;
      const delay = Math.random() * 0.2;
      const color = colors[Math.floor(Math.random() * colors.length)];
      const br = Math.random() > 0.5 ? '50%' : '0%';

      particle.style.setProperty('--x', `${x}px`);
      particle.style.setProperty('--y', `${y}px`);
      particle.style.setProperty('--size', `${size}px`);
      particle.style.setProperty('--r', `${rotation}deg`);
      particle.style.setProperty('--bg', color);
      particle.style.setProperty('--br', br);
      particle.style.animationDelay = `${delay}s`;

      particleContainer.appendChild(particle);
    }

    requestAnimationFrame(() => {
      overlay.classList.add('active');
    });

    const dismissBtn = overlay.querySelector('.btn-level-up-dismiss');
    dismissBtn.onclick = () => {
      overlay.classList.remove('active');
      setTimeout(() => overlay.remove(), 600);
    };
  }

  async function checkLevelUpProgression() {
    const session = getPortalSession();
    if (!session) return;
    const uid = session.uid || session.username;
    if (!uid) return;

    try {
      const members = await loadMovementMembersAsync([]);
      const member = members.find((item) => (
        (session.uid && (item.uid === session.uid || item.id === session.uid)) ||
        (session.email && String(item.email || '').toLowerCase() === String(session.email).toLowerCase())
      ));
      if (!member) return;

      const exp = experienceFromStats(member);
      const progression = progressionFromExperience(exp);
      const currentLevel = progression.level;
      const currentRank = progression.rank;

      const levelKey = `tws_level_${uid}`;
      const lastLevelVal = localStorage.getItem(levelKey);

      if (lastLevelVal !== null) {
        const lastLevel = parseInt(lastLevelVal, 10);
        if (!isNaN(lastLevel) && currentLevel > lastLevel) {
          triggerLevelUpAnimation(currentRank, currentLevel, progression.experienceForNextLevel);
        }
      }
      localStorage.setItem(levelKey, currentLevel.toString());
      localStorage.setItem(`tws_rank_${uid}`, currentRank);
    } catch (err) {
      console.warn('Level progression check failed:', err);
    }
  }

  function showToast(message, type) {
    let container = document.querySelector('.tws-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'tws-toast-container';
      document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    let toastType = type;
    if (!toastType) {
      const lower = String(message || '').toLowerCase();
      if (lower.includes('success') || lower.includes('saved') || lower.includes('approved') || lower.includes('updated') || lower.includes('sent') || lower.includes('completed') || lower.includes('welcomed')) {
        toastType = 'success';
      } else if (lower.includes('fail') || lower.includes('error') || lower.includes('invalid') || lower.includes('unable') || lower.includes('could not') || lower.includes('rejection') || lower.includes('revoked') || lower.includes('rejected')) {
        toastType = 'error';
      } else if (lower.includes('warn') || lower.includes('already') || lower.includes('require') || lower.includes('limit') || lower.includes('must') || lower.includes('please')) {
        toastType = 'warning';
      } else {
        toastType = 'info';
      }
    }
    toast.className = `tws-toast ${toastType}`;
    let icon = 'ℹ';
    if (toastType === 'success') icon = '✓';
    else if (toastType === 'error') icon = '✕';
    else if (toastType === 'warning') icon = '⚠';
    toast.innerHTML = `
      <span class="tws-toast-icon">${icon}</span>
      <span class="tws-toast-message">${escapeHTML(message)}</span>
      <button class="tws-toast-close">&times;</button>
    `;
    container.appendChild(toast);
    const closeBtn = toast.querySelector('.tws-toast-close');
    closeBtn.addEventListener('click', () => {
      toast.classList.add('hide');
      setTimeout(() => toast.remove(), 400);
    });
    setTimeout(() => {
      toast.classList.add('hide');
      setTimeout(() => toast.remove(), 400);
    }, 4500);
  }

  function getSeedCosmeticsList() {
    return [
      { id: 'face-round', name: 'Round Face', category: 'face', rarity: 'Common', acquisition: 'Level', reqLevel: 1, description: 'A classic round face shape.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'face-oval', name: 'Oval Face', category: 'face', rarity: 'Common', acquisition: 'Level', reqLevel: 1, description: 'An elegant oval face shape.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'face-square', name: 'Square Face', category: 'face', rarity: 'Uncommon', acquisition: 'Level', reqLevel: 3, description: 'A solid, chiseled square face.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'face-heart', name: 'Heart Face', category: 'face', rarity: 'Uncommon', acquisition: 'Level', reqLevel: 5, description: 'A cute heart-shaped face.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'face-chiseled', name: 'Chiseled Jaw', category: 'face', rarity: 'Epic', acquisition: 'Marketplace', price: 15, description: 'A premium jawline for a sharp look.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'face-cyborg', name: 'Cyborg Plates', category: 'face', rarity: 'Legendary', acquisition: 'Achievement', reqAchievement: 'deep-thinker', description: 'Cybernetic face plates for analytical minds.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'skin-peach', name: 'Peach Tone', category: 'skinTone', rarity: 'Common', acquisition: 'Level', reqLevel: 1, description: 'A light peach skin color.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'skin-tan', name: 'Tan Tone', category: 'skinTone', rarity: 'Common', acquisition: 'Level', reqLevel: 1, description: 'A warm tan skin color.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'skin-olive', name: 'Olive Tone', category: 'skinTone', rarity: 'Common', acquisition: 'Level', reqLevel: 1, description: 'A golden olive skin color.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'skin-bronze', name: 'Bronze Tone', category: 'skinTone', rarity: 'Common', acquisition: 'Level', reqLevel: 1, description: 'A deep bronze skin color.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'skin-dark', name: 'Dark Tone', category: 'skinTone', rarity: 'Common', acquisition: 'Level', reqLevel: 1, description: 'A rich dark skin color.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'skin-cyan', name: 'Neon Cyan', category: 'skinTone', rarity: 'Rare', acquisition: 'Marketplace', price: 10, description: 'An exotic neon cyan skin tone.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'skin-obsidian', name: 'Obsidian', category: 'skinTone', rarity: 'Epic', acquisition: 'Level', reqLevel: 8, description: 'A sleek deep dark gray skin tone.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'skin-gold', name: 'Solid Gold', category: 'skinTone', rarity: 'Legendary', acquisition: 'Achievement', reqAchievement: 'impact-1000', description: 'A prestigious pure gold skin tone.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'hair-none', name: 'Bald', category: 'hair', rarity: 'Common', acquisition: 'Level', reqLevel: 1, description: 'No hair.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'hair-buzzcut', name: 'Buzzcut', category: 'hair', rarity: 'Common', acquisition: 'Level', reqLevel: 1, description: 'A clean short haircut.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'hair-sidepart', name: 'Side Part', category: 'hair', rarity: 'Common', acquisition: 'Level', reqLevel: 1, description: 'A professional side parted look.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'hair-spikes', name: 'Spikes', category: 'hair', rarity: 'Uncommon', acquisition: 'Level', reqLevel: 2, description: 'Energetic spiky hairstyle.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'hair-afro', name: 'Afro', category: 'hair', rarity: 'Uncommon', acquisition: 'Level', reqLevel: 3, description: 'A classic curly afro style.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'hair-longwaves', name: 'Long Waves', category: 'hair', rarity: 'Rare', acquisition: 'Level', reqLevel: 4, description: 'Long flowing wavy hair.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'hair-topknot', name: 'Top Knot', category: 'hair', rarity: 'Rare', acquisition: 'Marketplace', price: 8, description: 'A sleek top knot hair collection.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'hair-mohawk', name: 'Mohawk', category: 'hair', rarity: 'Epic', acquisition: 'Marketplace', price: 12, description: 'A rebellious punk mohawk look.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'hair-wizard', name: 'Wizard Hood', category: 'hair', rarity: 'Legendary', acquisition: 'Achievement', reqAchievement: 'constant-beacon', description: 'A mysterious deep hood of dedication.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'hair-black', name: 'Black Hair', category: 'hairColor', rarity: 'Common', acquisition: 'Level', reqLevel: 1, description: 'Black hair color.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'hair-brown', name: 'Brown Hair', category: 'hairColor', rarity: 'Common', acquisition: 'Level', reqLevel: 1, description: 'Brown hair color.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'hair-blonde', name: 'Blonde Hair', category: 'hairColor', rarity: 'Common', acquisition: 'Level', reqLevel: 1, description: 'Blonde hair color.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'hair-red', name: 'Red Hair', category: 'hairColor', rarity: 'Uncommon', acquisition: 'Level', reqLevel: 2, description: 'Vibrant red hair color.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'hair-silver', name: 'Silver Hair', category: 'hairColor', rarity: 'Rare', acquisition: 'Level', reqLevel: 4, description: 'Sleek silver hair color.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'hair-green', name: 'Neon Green', category: 'hairColor', rarity: 'Epic', acquisition: 'Marketplace', price: 5, description: 'Glow in the dark neon green hair color.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'hair-rainbow', name: 'Rainbow Glow', category: 'hairColor', rarity: 'Mythic', acquisition: 'Achievement', reqAchievement: 'golden-heart', description: 'An animated rainbow color palette.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'hair-purple', name: 'Plum Purple', category: 'hairColor', rarity: 'Uncommon', acquisition: 'Level', reqLevel: 2, description: 'A rich plum purple hair color.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'hair-pink', name: 'Bubblegum Pink', category: 'hairColor', rarity: 'Rare', acquisition: 'Level', reqLevel: 3, description: 'A cute bubblegum pink hair color.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'hair-cyan', name: 'Cyber Cyan', category: 'hairColor', rarity: 'Epic', acquisition: 'Marketplace', price: 6, description: 'A glowing cybernetic cyan hair color.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'eyes-classic', name: 'Classic Eyes', category: 'eyes', rarity: 'Common', acquisition: 'Level', reqLevel: 1, description: 'Simple expressive eyes.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'eyes-happy', name: 'Happy Eyes', category: 'eyes', rarity: 'Common', acquisition: 'Level', reqLevel: 1, description: 'Cheerful squinting eyes.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'eyes-serious', name: 'Serious Eyes', category: 'eyes', rarity: 'Uncommon', acquisition: 'Level', reqLevel: 2, description: 'Determined focused gaze.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'eyes-winking', name: 'Winking Eye', category: 'eyes', rarity: 'Uncommon', acquisition: 'Level', reqLevel: 3, description: 'A friendly winking face.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'eyes-visor', name: 'Tech Visor', category: 'eyes', rarity: 'Legendary', acquisition: 'Achievement', reqAchievement: 'evidence-keeper', description: 'Analytical heads-up display.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'eye-brown', name: 'Brown Eyes', category: 'eyeColor', rarity: 'Common', acquisition: 'Level', reqLevel: 1, description: 'Classic brown eyes.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'eye-blue', name: 'Blue Eyes', category: 'eyeColor', rarity: 'Common', acquisition: 'Level', reqLevel: 1, description: 'Cool blue eyes.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'eye-green', name: 'Green Eyes', category: 'eyeColor', rarity: 'Uncommon', acquisition: 'Level', reqLevel: 2, description: 'Rich green eyes.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'eye-purple', name: 'Purple Glow', category: 'eyeColor', rarity: 'Epic', acquisition: 'Marketplace', price: 8, description: 'Mystical purple glowing eyes.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'eye-amber', name: 'Amber Gold', category: 'eyeColor', rarity: 'Uncommon', acquisition: 'Level', reqLevel: 2, description: 'Warm amber gold eyes.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'eye-gray', name: 'Steel Gray', category: 'eyeColor', rarity: 'Common', acquisition: 'Level', reqLevel: 1, description: 'Cool steel gray eyes.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'eye-pink', name: 'Rose Pink', category: 'eyeColor', rarity: 'Rare', acquisition: 'Marketplace', price: 5, description: 'Glowing rose pink eyes.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'eyebrows-flat', name: 'Flat Eyebrows', category: 'eyebrows', rarity: 'Common', acquisition: 'Level', reqLevel: 1, description: 'Simple flat eyebrows.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'eyebrows-curved', name: 'Curved Eyebrows', category: 'eyebrows', rarity: 'Common', acquisition: 'Level', reqLevel: 1, description: 'Arched eyebrows.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'eyebrows-angry', name: 'Angry Eyebrows', category: 'eyebrows', rarity: 'Uncommon', acquisition: 'Level', reqLevel: 2, description: 'Slanted angry eyebrows.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'mouth-neutral', name: 'Neutral Mouth', category: 'mouth', rarity: 'Common', acquisition: 'Level', reqLevel: 1, description: 'A straight expression.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'mouth-smile', name: 'Smiling Mouth', category: 'mouth', rarity: 'Common', acquisition: 'Level', reqLevel: 1, description: 'A warm friendly smile.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'mouth-grin', name: 'Wide Grin', category: 'mouth', rarity: 'Common', acquisition: 'Level', reqLevel: 1, description: 'A happy laughing mouth.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'mouth-smirk', name: 'Smirk', category: 'mouth', rarity: 'Uncommon', acquisition: 'Level', reqLevel: 2, description: 'A playful smirk.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'mouth-frown', name: 'Frown', category: 'mouth', rarity: 'Uncommon', acquisition: 'Level', reqLevel: 2, description: 'A sad frown.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'facialHair-none', name: 'Clean Shaven', category: 'facialHair', rarity: 'Common', acquisition: 'Level', reqLevel: 1, description: 'No facial hair.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'facialHair-stubble', name: 'Stubble', category: 'facialHair', rarity: 'Common', acquisition: 'Level', reqLevel: 2, description: 'Slight shadow stubble.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'facialHair-mustache', name: 'Mustache', category: 'facialHair', rarity: 'Uncommon', acquisition: 'Level', reqLevel: 3, description: 'A neat mustache.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'facialHair-beard', name: 'Full Beard', category: 'facialHair', rarity: 'Rare', acquisition: 'Marketplace', price: 10, description: 'A rich full beard.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'glasses-none', name: 'No Glasses', category: 'glasses', rarity: 'Common', acquisition: 'Level', reqLevel: 1, description: 'No eyewear.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'glasses-round', name: 'Round Glasses', category: 'glasses', rarity: 'Common', acquisition: 'Level', reqLevel: 2, description: 'Classic circular frames.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'glasses-square', name: 'Square Glasses', category: 'glasses', rarity: 'Uncommon', acquisition: 'Level', reqLevel: 3, description: 'Sleek black rectangular frames.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'glasses-aviators', name: 'Aviators', category: 'glasses', rarity: 'Rare', acquisition: 'Marketplace', price: 8, description: 'Retro golden-rimmed aviator shades.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'glasses-visor', name: 'Cyber Visor', category: 'glasses', rarity: 'Legendary', acquisition: 'Marketplace', price: 20, description: 'Glow neon visor overlay.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'hat-none', name: 'No Hat', category: 'hat', rarity: 'Common', acquisition: 'Level', reqLevel: 1, description: 'No headwear.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'hat-beanie', name: 'Beanie', category: 'hat', rarity: 'Common', acquisition: 'Level', reqLevel: 2, description: 'A warm woolen beanie.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'hat-cap', name: 'Baseball Cap', category: 'hat', rarity: 'Common', acquisition: 'Level', reqLevel: 2, description: 'A casual sports cap.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'hat-fedora', name: 'Fedora', category: 'hat', rarity: 'Uncommon', acquisition: 'Level', reqLevel: 4, description: 'A classy dark fedora hat.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'hat-crown', name: 'Crown of Light', category: 'hat', rarity: 'Legendary', acquisition: 'Achievement', reqAchievement: 'referral-connector-l3', description: 'A golden crown of organic outreach.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'accessories-none', name: 'No Accessories', category: 'accessories', rarity: 'Common', acquisition: 'Level', reqLevel: 1, description: 'No accessories.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'accessories-earbuds', name: 'Earbuds', category: 'accessories', rarity: 'Uncommon', acquisition: 'Level', reqLevel: 3, description: 'Sleek wireless earbuds.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'accessories-scar', name: 'Survival Scar', category: 'accessories', rarity: 'Rare', acquisition: 'Achievement', reqAchievement: 'first-step', description: 'A veteran scar of initial action.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'accessories-headphones', name: 'Headphones', category: 'accessories', rarity: 'Epic', acquisition: 'Marketplace', price: 15, description: 'Premium noise-canceling headphones.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'clothing-tshirt', name: 'T-Shirt', category: 'clothing', rarity: 'Common', acquisition: 'Level', reqLevel: 1, description: 'A comfortable cotton t-shirt.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'clothing-polo', name: 'Polo Shirt', category: 'clothing', rarity: 'Common', acquisition: 'Level', reqLevel: 1, description: 'A smart-casual polo shirt.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'clothing-hoodie', name: 'Hoodie', category: 'clothing', rarity: 'Uncommon', acquisition: 'Level', reqLevel: 2, description: 'A cozy cotton hoodie.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'clothing-suit', name: 'Suit & Tie', category: 'clothing', rarity: 'Rare', acquisition: 'Level', reqLevel: 5, description: 'A sharp professional suit.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'clothing-space', name: 'Spacesuit', category: 'clothing', rarity: 'Epic', acquisition: 'Marketplace', price: 18, description: 'A heavy duty EVA protective suit.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'clothing-gray', name: 'Gray Clothing', category: 'clothingColor', rarity: 'Common', acquisition: 'Level', reqLevel: 1, description: 'Slate gray clothing color.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'clothing-moss', name: 'Moss Green', category: 'clothingColor', rarity: 'Common', acquisition: 'Level', reqLevel: 1, description: 'Moss green clothing color.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'clothing-clay', name: 'Clay Red', category: 'clothingColor', rarity: 'Common', acquisition: 'Level', reqLevel: 1, description: 'Clay red clothing color.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'clothing-ocean', name: 'Ocean Blue', category: 'clothingColor', rarity: 'Common', acquisition: 'Level', reqLevel: 1, description: 'Ocean blue clothing color.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'clothing-royal', name: 'Royal Indigo', category: 'clothingColor', rarity: 'Rare', acquisition: 'Level', reqLevel: 4, description: 'Deep royal blue clothing color.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'clothing-orange', name: 'Neon Orange', category: 'clothingColor', rarity: 'Epic', acquisition: 'Marketplace', price: 6, description: 'Glowing orange clothing color.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'clothing-gold', name: 'Golden Thread', category: 'clothingColor', rarity: 'Uncommon', acquisition: 'Level', reqLevel: 3, description: 'An elegant golden thread clothing color.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'clothing-purple', name: 'Plum Velvet', category: 'clothingColor', rarity: 'Uncommon', acquisition: 'Level', reqLevel: 2, description: 'A cozy plum velvet clothing color.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'clothing-emerald', name: 'Emerald Satin', category: 'clothingColor', rarity: 'Rare', acquisition: 'Level', reqLevel: 4, description: 'A rich emerald satin clothing color.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'clothing-crimson', name: 'Crimson Wool', category: 'clothingColor', rarity: 'Rare', acquisition: 'Marketplace', price: 4, description: 'A classic crimson wool clothing color.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'jacket-none', name: 'No Jacket', category: 'jacket', rarity: 'Common', acquisition: 'Level', reqLevel: 1, description: 'No jacket.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'jacket-denim', name: 'Denim Vest', category: 'jacket', rarity: 'Uncommon', acquisition: 'Level', reqLevel: 3, description: 'A rugged denim outer vest.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'jacket-leather', name: 'Bomber Jacket', category: 'jacket', rarity: 'Rare', acquisition: 'Marketplace', price: 12, description: 'A premium leather bomber jacket.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'jacket-cape', name: 'Cape of Wisdom', category: 'jacket', rarity: 'Legendary', acquisition: 'Achievement', reqAchievement: 'mentor-signal', description: 'Flowing red cape awarded to mentors.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'backpack-none', name: 'No Backpack', category: 'backpack', rarity: 'Common', acquisition: 'Level', reqLevel: 1, description: 'No backpack.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'backpack-straps', name: 'Canvas Straps', category: 'backpack', rarity: 'Uncommon', acquisition: 'Level', reqLevel: 2, description: 'Simple backpack shoulder straps.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'backpack-wings', name: 'Angel Wings', category: 'backpack', rarity: 'Epic', acquisition: 'Achievement', reqAchievement: 'golden-heart', description: 'Luminous white wings representing compassion.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'backpack-jetpack', name: 'Jetpack', category: 'backpack', rarity: 'Legendary', acquisition: 'Marketplace', price: 25, description: 'High-tech jetpack thruster nozzle straps.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'bg-solid', name: 'Solid Style', category: 'background', rarity: 'Common', acquisition: 'Level', reqLevel: 1, description: 'A clean solid background.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'bg-radial', name: 'Radial Glow', category: 'background', rarity: 'Uncommon', acquisition: 'Level', reqLevel: 2, description: 'A background with a radial center light.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'bg-grid', name: 'Grid Pattern', category: 'background', rarity: 'Rare', acquisition: 'Level', reqLevel: 5, description: 'A technological blueprint grid layout.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'bg-starfield', name: 'Starfield', category: 'background', rarity: 'Epic', acquisition: 'Marketplace', price: 10, description: 'A background field of glowing stars.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'bg-matrix', name: 'Matrix Code', category: 'background', rarity: 'Legendary', acquisition: 'Marketplace', price: 20, description: 'A digital cascading binary stream.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'color-gray', name: 'Slate Gray', category: 'backgroundColor', rarity: 'Common', acquisition: 'Level', reqLevel: 1, description: 'Slate gray background color.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'color-teal', name: 'Soft Teal', category: 'backgroundColor', rarity: 'Common', acquisition: 'Level', reqLevel: 1, description: 'Teal background color.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'color-clay', name: 'Soft Clay', category: 'backgroundColor', rarity: 'Common', acquisition: 'Level', reqLevel: 1, description: 'Clay background color.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'color-violet', name: 'Neon Violet', category: 'backgroundColor', rarity: 'Epic', acquisition: 'Marketplace', price: 5, description: 'Vibrant neon purple background color.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'color-slate', name: 'Midnight Slate', category: 'backgroundColor', rarity: 'Common', acquisition: 'Level', reqLevel: 1, description: 'A deep midnight slate background color.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'color-blue', name: 'Ocean Blue', category: 'backgroundColor', rarity: 'Common', acquisition: 'Level', reqLevel: 2, description: 'A cool ocean blue background color.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'color-green', name: 'Forest Green', category: 'backgroundColor', rarity: 'Common', acquisition: 'Level', reqLevel: 3, description: 'A deep forest green background color.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'color-rose', name: 'Rose Red', category: 'backgroundColor', rarity: 'Uncommon', acquisition: 'Level', reqLevel: 4, description: 'A soft rose red background color.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'color-gold', name: 'Golden Glow', category: 'backgroundColor', rarity: 'Rare', acquisition: 'Marketplace', price: 5, description: 'A premium golden glow background color.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'effect-none', name: 'No Effect', category: 'effect', rarity: 'Common', acquisition: 'Level', reqLevel: 1, description: 'No screen overlays.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'effect-leaves', name: 'Falling Leaves', category: 'effect', rarity: 'Uncommon', acquisition: 'Level', reqLevel: 3, description: 'Serene leaves floating down.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'effect-sparkles', name: 'Sparkles', category: 'effect', rarity: 'Rare', acquisition: 'Level', reqLevel: 6, description: 'Golden sparkles floating around.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'effect-glitch', name: 'Digital Glitch', category: 'effect', rarity: 'Epic', acquisition: 'Marketplace', price: 15, description: 'Cascading digital artifact glitch lines.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'effect-fire', name: 'Fire Aura', category: 'effect', rarity: 'Legendary', acquisition: 'Marketplace', price: 30, description: 'Blazing flame borders of inspiration.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'frame-none', name: 'No Frame', category: 'frame', rarity: 'Common', acquisition: 'Level', reqLevel: 1, description: 'No border frame.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'frame-silver', name: 'Sleek Silver', category: 'frame', rarity: 'Uncommon', acquisition: 'Level', reqLevel: 3, description: 'A sleek silver border ring.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'frame-laurel', name: 'Golden Laurel', category: 'frame', rarity: 'Rare', acquisition: 'Level', reqLevel: 7, description: 'A traditional laurel wreath outline.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'frame-neon', name: 'Neon Ring', category: 'frame', rarity: 'Epic', acquisition: 'Marketplace', price: 15, description: 'A glowing cyan dash-bordered ring.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'frame-diamond', name: 'Diamond Glow', category: 'frame', rarity: 'Mythic', acquisition: 'Achievement', reqAchievement: 'impact-1000', description: 'A purple glowing border with corner diamonds.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'banner-tech', name: 'Tech Blueprint', category: 'banner', rarity: 'Common', acquisition: 'Level', reqLevel: 1, description: 'A blueprint design banner.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'banner-nature', name: 'Nature Greenery', category: 'banner', rarity: 'Common', acquisition: 'Level', reqLevel: 2, description: 'A fresh green leaves themed banner.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'banner-space', name: 'Space Nebula', category: 'banner', rarity: 'Rare', acquisition: 'Marketplace', price: 12, description: 'A deep space nebula banner.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'banner-sea', name: 'Deep Sea', category: 'banner', rarity: 'Uncommon', acquisition: 'Level', reqLevel: 3, description: 'A deep sea wave pattern banner.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'banner-abstract', name: 'Abstract Waves', category: 'banner', rarity: 'Epic', acquisition: 'Marketplace', price: 15, description: 'Smooth gradient wave shapes banner.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'banner-founder', name: 'Founder Pride', category: 'banner', rarity: 'Legendary', acquisition: 'Achievement', reqAchievement: 'founder', description: 'An elegant golden geometry banner.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'banner-referrals', name: 'Referral Connector', category: 'banner', rarity: 'Legendary', acquisition: 'Achievement', reqAchievement: 'referral-connector-l1', description: 'A glowing teal referral milestone banner.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'banner-community', name: 'TWS Community', category: 'banner', rarity: 'Common', acquisition: 'Level', reqLevel: 1, description: 'A classic community-red theme banner.', enabled: true, releaseDate: '2026-06-27' }
    ];
  }

  async function loadCosmeticsAsync() {
    const local = readLocalStore();
    let list = [];
    try {
      const { configModule } = await getFirebaseDataApiSafe();
      list = await fetchCollectionSafe(configModule.accessCollections.cosmetics, local.cosmetics || []);
    } catch (err) {
      list = localFallbackOrEmpty(err, local.cosmetics || []);
    }
    if (!list || list.length === 0) {
      const seed = getSeedCosmeticsList();
      list = seed;
      local.cosmetics = seed;
      writeLocalStore(local);
      const session = getPortalSession();
      if (session && (session.role === 'Founder' || session.role === 'Co-Founder')) {
        try {
          const { configModule } = await getFirebaseDataApiSafe();
          for (const item of seed) {
            await saveDocument(configModule.accessCollections.cosmetics, item.id, item);
          }
        } catch (e) {}
      }
    }
    memory.cosmetics = list;
    return list;
  }

  async function saveCosmetic(cosmeticId, data) {
    const session = getPortalSession();
    if (!canManageSystem(session)) throw new Error('permission-denied');
    const payload = {
      ...data,
      id: cosmeticId
    };
    try {
      const { configModule } = await getFirebaseDataApiSafe();
      await saveDocument(configModule.accessCollections.cosmetics, cosmeticId, payload);
    } catch (err) {
      localFallbackOrThrow(err);
    }
    const local = readLocalStore();
    local.cosmetics = replaceById(local.cosmetics || [], payload);
    writeLocalStore(local);
    memory.cosmetics = local.cosmetics;
    return payload;
  }

  async function deleteCosmetic(cosmeticId) {
    const session = getPortalSession();
    if (!canManageSystem(session)) throw new Error('permission-denied');
    try {
      const { configModule } = await getFirebaseDataApiSafe();
      await deleteDocument(configModule.accessCollections.cosmetics, cosmeticId);
    } catch (err) {
      localFallbackOrThrow(err);
    }
    const local = readLocalStore();
    local.cosmetics = (local.cosmetics || []).filter(item => item.id !== cosmeticId);
    writeLocalStore(local);
    memory.cosmetics = local.cosmetics;
  }

  async function purchaseCosmetic(cosmeticId) {
    const session = getPortalSession();
    if (!session) throw new Error('permission-denied');
    const members = await loadMovementMembersAsync([]);
    const member = members.find((item) => item.uid === session.uid || item.id === session.uid || item.email === session.email);
    if (!member) throw new Error('permission-denied');
    const cosmetics = await loadCosmeticsAsync();
    const cosmetic = cosmetics.find((item) => item.id === cosmeticId);
    if (!cosmetic || !cosmetic.enabled || cosmetic.acquisition !== 'Marketplace') {
      throw new Error('invalid-cosmetic');
    }
    const owned = Array.isArray(member.ownedCosmetics) ? member.ownedCosmetics : [];
    if (owned.includes(cosmeticId)) {
      throw new Error('already-owned');
    }
    const spendable = Number(member.stats?.impactPoints ?? member.impactPoints ?? 0);
    if (spendable < cosmetic.price) {
      throw new Error('insufficient-points');
    }
    const nextOwned = owned.concat(cosmeticId);
    const nextPoints = spendable - cosmetic.price;
    const nextProfile = {
      ...member,
      ownedCosmetics: nextOwned,
      points: nextPoints,
      impactPoints: nextPoints,
      lastCosmeticPurchase: {
        cosmeticId: cosmeticId,
        price: cosmetic.price,
        purchasedAt: new Date().toISOString()
      },
      stats: {
        ...(member.stats || {}),
        impactPoints: nextPoints
      }
    };
    nextProfile.badges = badgeStorageValues(member.badges, nextProfile);
    try {
      const { configModule } = await getFirebaseDataApiSafe();
      await saveDocument(configModule.accessCollections.users, member.uid || member.id || member.username, nextProfile);
    } catch (err) {
      localFallbackOrThrow(err);
      console.warn('Saved purchase locally because Firebase write failed.', err);
    }
    memory.users = replaceById(memory.users.length ? memory.users : readLocalStore().users, { id: member.uid || member.id || member.username, uid: member.uid || member.id || member.username, ...nextProfile });
    writeLocalStore({ users: memory.users });
    return nextProfile;
  }

  function isCosmeticUnlocked(cosmetic, user) {
    if (!cosmetic.enabled) return false;
    if (cosmetic.acquisition === 'Level') {
      const userLevel = user.progressionLevel || 1;
      return userLevel >= (cosmetic.reqLevel || 1);
    }
    if (cosmetic.acquisition === 'Achievement') {
      const badges = user.badges || [];
      const role = user.role || 'Member';
      const adminRole = user.adminRole || '';
      const stats = user.stats || {};
      const req = String(cosmetic.reqAchievement || '').trim().toLowerCase();
      if (!req) return true;
      if (req === 'founder' || req === 'co-founder') {
        return role === 'Founder' || role === 'Co-Founder' || adminRole === 'Founder' || adminRole === 'Co-Founder';
      }
      if (req === 'contributor') {
        return role === 'Contributor' || adminRole === 'Contributor';
      }
      if (badges.some(b => String(b.id || b || '').toLowerCase() === req)) {
        return true;
      }
      if (req.startsWith('referrals_')) {
        const count = parseInt(req.split('_')[1]) || 0;
        return (Number(stats.successfulReferrals) || 0) >= count;
      }
      if (req.startsWith('solved_')) {
        const count = parseInt(req.split('_')[1]) || 0;
        return (Number(stats.problemsSolved) || 0) >= count;
      }
      return false;
    }
    if (cosmetic.acquisition === 'Marketplace') {
      if (cosmetic.price === 0) return true;
      const owned = user.ownedCosmetics || [];
      return owned.includes(cosmetic.id);
    }
    if (cosmetic.acquisition === 'Role') {
      const requiredRole = String(cosmetic.reqRole || '').trim().toLowerCase();
      if (!requiredRole) return false;
      const userRoles = [user.role, user.adminRole].map(role => String(role || '').trim().toLowerCase());
      return userRoles.includes(requiredRole);
    }
    return false;
  }

  function cosmeticImageSource(cosmetic) {
    if (!cosmetic) return '';
    const imagePath = String(cosmetic.assetPath || cosmetic.imageUrl || '').trim();
    if (!imagePath) return '';
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://') || imagePath.startsWith('data:')) return imagePath;
    if (imagePath.startsWith('assets/avatars/')) return imagePath;
    return '';
  }

  function renderPremiumAvatarHTML(cosmetic, user) {
    const imagePath = cosmeticImageSource(cosmetic);
    if (imagePath) {
      return `<img src="${escapeHTML(imagePath)}" alt="${escapeHTML(cosmetic.name || user?.displayName || 'Avatar')}" style="width: 100%; height: 100%; object-fit: cover;" />`;
    }
    const initials = initialsFromName(cosmetic?.name || user?.displayName || 'TW');
    return `<div class="avatar-initials" style="display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; font-family: var(--font-display); font-weight: 500; background: linear-gradient(135deg, var(--accent-moss) 0%, var(--accent-ocean) 100%); color: var(--bg-warm); font-size: 1.25rem; text-transform: uppercase; letter-spacing: 0.05em; border-radius: 16px;">${escapeHTML(initials)}</div>`;
  }

  function avatarImageValue(value) {
    const imageValue = String(value || '').trim();
    return imageValue.startsWith('http://') || imageValue.startsWith('https://') || imageValue.startsWith('data:') || imageValue.startsWith('assets/avatars/') ? imageValue : '';
  }

  function renderAvatarSVG(config) {
    const skinColorMap = {
      'skin-peach': 'url(#grad-skin-peach)',
      'skin-tan': 'url(#grad-skin-tan)',
      'skin-olive': 'url(#grad-skin-olive)',
      'skin-bronze': 'url(#grad-skin-bronze)',
      'skin-dark': 'url(#grad-skin-dark)',
      'skin-cyan': 'url(#grad-skin-cyan)',
      'skin-obsidian': 'url(#grad-skin-obsidian)',
      'skin-gold': 'url(#grad-skin-gold)'
    };
    const hairColorMap = {
      'hair-black': 'url(#grad-hair-black)',
      'hair-brown': 'url(#grad-hair-brown)',
      'hair-blonde': 'url(#grad-hair-blonde)',
      'hair-red': 'url(#grad-hair-red)',
      'hair-silver': 'url(#grad-hair-silver)',
      'hair-green': 'url(#grad-hair-green)',
      'hair-purple': 'url(#grad-hair-purple)',
      'hair-pink': 'url(#grad-hair-pink)',
      'hair-cyan': 'url(#grad-hair-cyan)',
      'hair-rainbow': 'url(#rainbow-hair)'
    };
    const eyeColorMap = {
      'eye-brown': 'url(#grad-eye-brown)',
      'eye-blue': 'url(#grad-eye-blue)',
      'eye-green': 'url(#grad-eye-green)',
      'eye-purple': 'url(#grad-eye-purple)',
      'eye-amber': 'url(#grad-eye-amber)',
      'eye-gray': 'url(#grad-eye-gray)',
      'eye-pink': 'url(#grad-eye-pink)'
    };
    const clothingColorMap = {
      'clothing-gray': '#4b5563',
      'clothing-moss': '#23382b',
      'clothing-clay': '#c87d55',
      'clothing-ocean': '#3d5a6c',
      'clothing-royal': '#312e81',
      'clothing-orange': '#ea580c',
      'clothing-gold': '#d97706',
      'clothing-purple': '#581c87',
      'clothing-emerald': '#059669',
      'clothing-crimson': '#be123c'
    };
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
    const skinTone = config.skinTone || 'skin-peach';
    const skinColor = skinColorMap[skinTone] || 'url(#grad-skin-peach)';
    const neckColor = 'url(#grad-neck-shadow)';
    const hairColor = hairColorMap[config.hairColor] || 'url(#grad-hair-black)';
    const eyeColor = eyeColorMap[config.eyeColor] || 'url(#grad-eye-brown)';
    const clothingColor = clothingColorMap[config.clothingColor] || '#4b5563';
    const bgColor = bgColorMap[config.backgroundColor] || '#1e293b';

    let svg = `<svg viewBox="0 0 200 200" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">`;
    svg += `<defs>`;
    svg += `<clipPath id="avatar-clip"><rect width="200" height="200" rx="20" /></clipPath>`;
    
    svg += `<linearGradient id="grad-skin-peach" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#fff5eb"/><stop offset="40%" stop-color="#ffd8b3"/><stop offset="100%" stop-color="#f2b280"/></linearGradient>`;
    svg += `<linearGradient id="grad-skin-tan" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#ffe3cc"/><stop offset="50%" stop-color="#e0a96d"/><stop offset="100%" stop-color="#bc7c41"/></linearGradient>`;
    svg += `<linearGradient id="grad-skin-olive" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#fdf4e7"/><stop offset="50%" stop-color="#d4b285"/><stop offset="100%" stop-color="#a47b4c"/></linearGradient>`;
    svg += `<linearGradient id="grad-skin-bronze" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#ecd6c3"/><stop offset="50%" stop-color="#ba825a"/><stop offset="100%" stop-color="#7c4e2b"/></linearGradient>`;
    svg += `<linearGradient id="grad-skin-dark" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#9a7257"/><stop offset="50%" stop-color="#6b462b"/><stop offset="100%" stop-color="#3d220f"/></linearGradient>`;
    svg += `<linearGradient id="grad-skin-cyan" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#e0f7fa"/><stop offset="50%" stop-color="#00bcd4"/><stop offset="100%" stop-color="#006064"/></linearGradient>`;
    svg += `<linearGradient id="grad-skin-obsidian" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#475569"/><stop offset="50%" stop-color="#1e293b"/><stop offset="100%" stop-color="#0f172a"/></linearGradient>`;
    svg += `<linearGradient id="grad-skin-gold" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#fef08a"/><stop offset="30%" stop-color="#eab308"/><stop offset="70%" stop-color="#ca8a04"/><stop offset="100%" stop-color="#854d0e"/></linearGradient>`;
    
    svg += `<linearGradient id="grad-hair-black" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#454545"/><stop offset="100%" stop-color="#0f0f0f"/></linearGradient>`;
    svg += `<linearGradient id="grad-hair-brown" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#8c6239"/><stop offset="100%" stop-color="#4a311b"/></linearGradient>`;
    svg += `<linearGradient id="grad-hair-blonde" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#fef08a"/><stop offset="100%" stop-color="#ca8a04"/></linearGradient>`;
    svg += `<linearGradient id="grad-hair-red" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#f87171"/><stop offset="100%" stop-color="#991b1b"/></linearGradient>`;
    svg += `<linearGradient id="grad-hair-silver" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#f1f5f9"/><stop offset="100%" stop-color="#94a3b8"/></linearGradient>`;
    svg += `<linearGradient id="grad-hair-green" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#4ade80"/><stop offset="100%" stop-color="#166534"/></linearGradient>`;
    svg += `<linearGradient id="grad-hair-purple" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#a855f7"/><stop offset="100%" stop-color="#581c87"/></linearGradient>`;
    svg += `<linearGradient id="grad-hair-pink" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#f472b6"/><stop offset="100%" stop-color="#be123c"/></linearGradient>`;
    svg += `<linearGradient id="grad-hair-cyan" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#22d3ee"/><stop offset="100%" stop-color="#0891b2"/></linearGradient>`;
    
    svg += `<linearGradient id="grad-eye-brown" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#b45309"/><stop offset="100%" stop-color="#451a03"/></linearGradient>`;
    svg += `<linearGradient id="grad-eye-blue" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#60a5fa"/><stop offset="100%" stop-color="#1d4ed8"/></linearGradient>`;
    svg += `<linearGradient id="grad-eye-green" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#34d399"/><stop offset="100%" stop-color="#065f46"/></linearGradient>`;
    svg += `<linearGradient id="grad-eye-purple" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#c084fc"/><stop offset="100%" stop-color="#6b21a8"/></linearGradient>`;
    svg += `<linearGradient id="grad-eye-amber" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#facc15"/><stop offset="100%" stop-color="#ca8a04"/></linearGradient>`;
    svg += `<linearGradient id="grad-eye-gray" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#94a3b8"/><stop offset="100%" stop-color="#475569"/></linearGradient>`;
    svg += `<linearGradient id="grad-eye-pink" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#f472b6"/><stop offset="100%" stop-color="#9d174d"/></linearGradient>`;

    svg += `<linearGradient id="rainbow-hair" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#ef4444"/><stop offset="20%" stop-color="#f97316"/><stop offset="40%" stop-color="#eab308"/><stop offset="60%" stop-color="#22c55e"/><stop offset="80%" stop-color="#3b82f6"/><stop offset="100%" stop-color="#a855f7"/></linearGradient>`;
    svg += `<linearGradient id="grad-neck-shadow" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="rgba(0,0,0,0.25)"/><stop offset="100%" stop-color="rgba(0,0,0,0)"/></linearGradient>`;
    svg += `<linearGradient id="grad-cyborg-plating" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#cbd5e1"/><stop offset="50%" stop-color="#64748b"/><stop offset="100%" stop-color="#334155"/></linearGradient>`;
    svg += `<linearGradient id="grad-wing-gold" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#fbbf24"/><stop offset="100%" stop-color="#b45309"/></linearGradient>`;
    svg += `<linearGradient id="grad-jetpack-body" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#94a3b8"/><stop offset="50%" stop-color="#475569"/><stop offset="100%" stop-color="#334155"/></linearGradient>`;
    svg += `<linearGradient id="grad-thrust-fire" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#facc15"/><stop offset="40%" stop-color="#f97316"/><stop offset="100%" stop-color="#ef4444" stop-opacity="0"/></linearGradient>`;
    svg += `<linearGradient id="grad-space-suit" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#ffffff"/><stop offset="100%" stop-color="#e2e8f0"/></linearGradient>`;
    svg += `<linearGradient id="grad-crown-gold" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#fbbf24"/><stop offset="50%" stop-color="#f59e0b"/><stop offset="100%" stop-color="#d97706"/></linearGradient>`;
    svg += `<radialGradient id="grad-crown-velvet" cx="50%" cy="40%" r="60%"><stop offset="0%" stop-color="#b91c1c"/><stop offset="100%" stop-color="#450a0a"/></radialGradient>`;
    
    svg += `<radialGradient id="bg-radial-grad" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#ffffff" stop-opacity="0.25"/><stop offset="100%" stop-color="#000000" stop-opacity="0.4"/></radialGradient>`;
    svg += `<pattern id="grid-pattern" width="16" height="16" patternUnits="userSpaceOnUse"><path d="M 16 0 L 0 0 0 16" fill="none" stroke="#ffffff" stroke-width="0.5" opacity="0.12"/></pattern>`;
    svg += `<pattern id="matrix-pattern" width="20" height="20" patternUnits="userSpaceOnUse"><text x="2" y="12" fill="#22c55e" font-family="monospace" font-size="8" opacity="0.25">0</text><text x="12" y="18" fill="#22c55e" font-family="monospace" font-size="8" opacity="0.2">1</text></pattern>`;
    svg += `</defs>`;
    svg += `<g clip-path="url(#avatar-clip)">`;

    const bgMap = {
      'bg-solid': `<rect width="200" height="200" rx="20" fill="${bgColor}" />`,
      'bg-radial': `<rect width="200" height="200" rx="20" fill="${bgColor}" /><rect width="200" height="200" rx="20" fill="url(#bg-radial-grad)" />`,
      'bg-grid': `<rect width="200" height="200" rx="20" fill="${bgColor}" /><rect width="200" height="200" rx="20" fill="url(#grid-pattern)" />`,
      'bg-starfield': `<rect width="200" height="200" rx="20" fill="${bgColor}" /><g fill="#ffffff"><circle cx="25" cy="35" r="1.5" opacity="0.8"/><circle cx="170" cy="45" r="1.2" opacity="0.9"/><circle cx="100" cy="25" r="1" opacity="0.7"/><circle cx="45" cy="95" r="1.8" opacity="0.8"/><circle cx="185" cy="125" r="1.2" opacity="0.6"/><circle cx="35" cy="155" r="1.5" opacity="0.9"/><circle cx="155" cy="165" r="2" opacity="0.8"/></g>`,
      'bg-matrix': `<rect width="200" height="200" rx="20" fill="#020617" /><rect width="200" height="200" rx="20" fill="url(#matrix-pattern)" />`
    };
    svg += bgMap[config.background] || `<rect width="200" height="200" rx="20" fill="${bgColor}" />`;

    const bpMap = {
      'canvas-straps': `<path d="M55 135 L60 175 M145 135 L140 175" stroke="#451a03" stroke-width="7" stroke-linecap="round" /><path d="M55 135 L60 175 M145 135 L140 175" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-dasharray="3 3" />`,
      'angel-wings': `
        <filter id="wing-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <!-- Left Wing -->
        <g filter="url(#wing-glow)">
          <path d="M 60 140 C 40 100, -5 60, 10 35 C 20 20, 50 40, 60 80 C 65 95, 60 140, 60 140" fill="url(#grad-wing-gold)" opacity="0.65" />
          <path d="M 60 140 C 45 105, 5 70, 18 50 C 30 35, 55 55, 60 95 C 62 105, 60 140, 60 140" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5" />
          <path d="M 58 135 C 48 110, 20 85, 28 70 C 36 58, 52 75, 56 105" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1.2" />
          <path d="M 56 130 C 50 115, 35 95, 38 85 C 42 77, 50 88, 52 110" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="1" />
          <path d="M 18 50 C 30 35, 55 55, 60 95" fill="none" stroke="#fbbf24" stroke-width="1.5" opacity="0.85" />
        </g>
        <!-- Right Wing -->
        <g filter="url(#wing-glow)">
          <path d="M 140 140 C 160 100, 205 60, 190 35 C 180 20, 150 40, 140 80 C 135 95, 140 140, 140 140" fill="url(#grad-wing-gold)" opacity="0.65" />
          <path d="M 140 140 C 155 105, 195 70, 182 50 C 170 35, 145 55, 140 95 C 138 105, 140 140, 140 140" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5" />
          <path d="M 142 135 C 152 110, 180 85, 172 70 C 164 58, 148 75, 144 105" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1.2" />
          <path d="M 144 130 C 150 115, 165 95, 162 85 C 158 77, 150 88, 148 110" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="1" />
          <path d="M 182 50 C 170 35, 145 55, 140 95" fill="none" stroke="#fbbf24" stroke-width="1.5" opacity="0.85" />
        </g>
      `,
      'jetpack-boosters': `
        <!-- Left Rocket -->
        <rect x="28" y="105" width="26" height="70" rx="8" fill="url(#grad-jetpack-body)" stroke="#1e293b" stroke-width="2" />
        <rect x="28" y="118" width="26" height="6" fill="#94a3b8" />
        <rect x="28" y="148" width="26" height="6" fill="#94a3b8" />
        <line x1="54" y1="125" x2="62" y2="135" stroke="#cbd5e1" stroke-width="1.5" />
        <circle cx="41" cy="133" r="5" fill="#f1f5f9" stroke="#0f172a" stroke-width="1" />
        <line x1="41" y1="133" x2="44" y2="130" stroke="#ef4444" stroke-width="1" />
        <path d="M33 175 L49 175 L52 183 L30 183 Z" fill="#334155" stroke="#1e293b" stroke-width="1.5" />
        <path d="M41 183 L28 205 L54 205 Z" fill="url(#grad-thrust-fire)" opacity="0.95" />
        <path d="M41 183 L34 198 L48 198 Z" fill="#fde047" />

        <!-- Right Rocket -->
        <rect x="146" y="105" width="26" height="70" rx="8" fill="url(#grad-jetpack-body)" stroke="#1e293b" stroke-width="2" />
        <rect x="146" y="118" width="26" height="6" fill="#94a3b8" />
        <rect x="146" y="148" width="26" height="6" fill="#94a3b8" />
        <line x1="146" y1="125" x2="138" y2="135" stroke="#cbd5e1" stroke-width="1.5" />
        <circle cx="159" cy="133" r="5" fill="#f1f5f9" stroke="#0f172a" stroke-width="1" />
        <line x1="159" y1="133" x2="162" y2="130" stroke="#ef4444" stroke-width="1" />
        <path d="M151 175 L167 175 L170 183 L148 183 Z" fill="#334155" stroke="#1e293b" stroke-width="1.5" />
        <path d="M159 183 L146 205 L172 205 Z" fill="url(#grad-thrust-fire)" opacity="0.95" />
        <path d="M159 183 L152 198 L166 198 Z" fill="#fde047" />
      `
    };
    svg += bpMap[config.backpack] || '';

    svg += `<rect x="90" y="110" width="20" height="30" fill="${skinColor}" />`;
    svg += `<rect x="90" y="110" width="20" height="15" fill="url(#grad-neck-shadow)" />`;

    const faceMap = {
      'face-round': `<ellipse cx="100" cy="85" rx="36" ry="39" fill="${skinColor}" /><ellipse cx="100" cy="95" rx="30" ry="12" fill="url(#grad-neck-shadow)" opacity="0.3"/><circle cx="76" cy="94" r="5" fill="#f87171" opacity="0.2" /><circle cx="124" cy="94" r="5" fill="#f87171" opacity="0.2" />`,
      'face-oval': `<ellipse cx="100" cy="85" rx="33" ry="43" fill="${skinColor}" /><ellipse cx="100" cy="98" rx="27" ry="12" fill="url(#grad-neck-shadow)" opacity="0.3"/><circle cx="78" cy="95" r="4.5" fill="#f87171" opacity="0.25" /><circle cx="122" cy="95" r="4.5" fill="#f87171" opacity="0.25" />`,
      'face-square': `<rect x="66" y="46" width="68" height="76" rx="16" fill="${skinColor}" /><rect x="72" y="98" width="56" height="18" fill="url(#grad-neck-shadow)" opacity="0.3"/><circle cx="78" cy="96" r="4.5" fill="#f87171" opacity="0.2" /><circle cx="122" cy="96" r="4.5" fill="#f87171" opacity="0.2" />`,
      'face-heart': `<path d="M100 126 C66 103 58 71 68 56 C78 41 95 49 100 61 C105 49 122 41 132 56 C142 71 134 103 100 126 Z" fill="${skinColor}" /><circle cx="80" cy="90" r="4.5" fill="#f87171" opacity="0.2" /><circle cx="120" cy="90" r="4.5" fill="#f87171" opacity="0.2" />`,
      'face-chiseled': `<path d="M100 128 L66 90 L66 58 C66 43, 134 43, 134 58 L134 90 Z" fill="${skinColor}" /><path d="M100 128 L66 90 L100 85 Z" fill="url(#grad-neck-shadow)" opacity="0.15"/><circle cx="78" cy="93" r="4" fill="#f87171" opacity="0.2" /><circle cx="122" cy="93" r="4" fill="#f87171" opacity="0.2" />`,
      'face-cyborg': `
        <ellipse cx="100" cy="85" rx="36" ry="39" fill="${skinColor}" />
        <path d="M100 46 C120 46, 136 63, 136 85 C136 107, 120 124, 100 124 Z" fill="url(#grad-cyborg-plating)" stroke="#1e293b" stroke-width="1.5" />
        <path d="M100 46 Q108 85 100 124" fill="none" stroke="#1e293b" stroke-width="2" />
        <path d="M108 60 H124" stroke="#00f2fe" stroke-width="2.5" stroke-linecap="round" />
        <path d="M106 95 H128" stroke="#00f2fe" stroke-width="2.5" stroke-linecap="round" />
        <circle cx="120" cy="74" r="2.5" fill="#f43f5e" />
        <circle cx="114" cy="110" r="2.5" fill="#10b981" />
        <circle cx="122" cy="94" r="3.5" fill="#00f2fe" opacity="0.5" />
        <path d="M120 74 L128 78" stroke="#1e293b" stroke-width="1" />
        <rect x="131" y="76" width="6" height="12" rx="2" fill="#475569" stroke="#1e293b" stroke-width="1" />
      `
    };
    svg += faceMap[config.face] || `<ellipse cx="100" cy="85" rx="36" ry="39" fill="${skinColor}" />`;

    const clothingMap = {
      'clothing-tshirt': `<path d="M45 135 C45 135, 58 133, 75 133 L125 133 C142 133, 155 135, 155 135 C172 143, 182 168, 182 200 L18 200 C18 168, 28 143, 45 135 Z" fill="${clothingColor}" /><path d="M85 133 A15 15 0 0 0 115 133 Z" fill="${skinColor}" /><path d="M45 135 L60 170" stroke="rgba(0,0,0,0.15)" stroke-width="1.5" /><path d="M155 135 L140 170" stroke="rgba(0,0,0,0.15)" stroke-width="1.5" />`,
      'clothing-polo': `<path d="M45 135 C45 135, 58 133, 75 133 L125 133 C142 133, 155 135, 155 135 C172 143, 182 168, 182 200 L18 200 C18 168, 28 143, 45 135 Z" fill="${clothingColor}" /><path d="M85 133 L100 158 L115 133 Z" fill="#ffffff" /><path d="M76 133 L100 152 L100 133 Z" fill="${clothingColor}" /><path d="M124 133 L100 152 L100 133 Z" fill="${clothingColor}" /><circle cx="100" cy="165" r="1.5" fill="#1e293b" />`,
      'clothing-hoodie': `<path d="M45 135 C45 135, 58 133, 75 133 L125 133 C142 133, 155 135, 155 135 C172 143, 182 168, 182 200 L18 200 C18 168, 28 143, 45 135 Z" fill="${clothingColor}" /><path d="M72 133 Q100 162 128 133 Z" fill="#1e293b" /><path d="M96 160 L96 182 M104 160 L104 182" stroke="#e2e8f0" stroke-width="1.5" stroke-linecap="round" />`,
      'clothing-suit': `<path d="M45 135 C45 135, 58 133, 75 133 L125 133 C142 133, 155 135, 155 135 C172 143, 182 168, 182 200 L18 200 C18 168, 28 143, 45 135 Z" fill="#0f172a" /><path d="M85 133 L100 172 L115 133 Z" fill="#ffffff" /><path d="M96 137 L104 137 L100 170 Z" fill="#991b1b" /><path d="M45 135 L90 185 L90 133 Z" fill="#1e293b" /><path d="M155 135 L110 185 L110 133 Z" fill="#1e293b" />`,
      'clothing-space': `
        <path d="M45 135 C45 135, 58 133, 75 133 L125 133 C142 133, 155 135, 155 135 C172 143, 182 168, 182 200 L18 200 C18 168, 28 143, 45 135 Z" fill="url(#grad-space-suit)" stroke="#cbd5e1" stroke-width="2.5" />
        <path d="M80 133 A20 20 0 0 0 120 133 Z" fill="#0f172a" />
        <path d="M83 133 A17 17 0 0 0 117 133 Z" fill="${skinColor}" />
        <rect x="74" y="145" width="52" height="34" rx="6" fill="#1e293b" stroke="#cbd5e1" stroke-width="2" />
        <circle cx="86" cy="155" r="3" fill="#f43f5e" />
        <circle cx="100" cy="155" r="3" fill="#10b981" />
        <circle cx="114" cy="155" r="3" fill="#3b82f6" />
        <rect x="83" y="165" width="34" height="8" rx="2" fill="#020617" />
        <line x1="86" y1="169" x2="114" y2="169" stroke="#22c55e" stroke-width="1.5" stroke-dasharray="2 1" />
        <path d="M48 136 L68 178" stroke="#334155" stroke-width="4.5" stroke-linecap="round" />
        <path d="M152 136 L132 178" stroke="#334155" stroke-width="4.5" stroke-linecap="round" />
        <circle cx="68" cy="178" r="4.5" fill="#94a3b8" stroke="#1e293b" stroke-width="1.5" />
        <circle cx="132" cy="178" r="4.5" fill="#94a3b8" stroke="#1e293b" stroke-width="1.5" />
        <path d="M50 190 Q70 195 74 175" fill="none" stroke="#cbd5e1" stroke-width="3" stroke-linecap="round" />
        <path d="M150 190 Q130 195 126 175" fill="none" stroke="#cbd5e1" stroke-width="3" stroke-linecap="round" />
      `
    };
    svg += clothingMap[config.clothing] || `<path d="M45 135 C45 135, 58 133, 75 133 L125 133 C142 133, 155 135, 155 135 C172 143, 182 168, 182 200 L18 200 C18 168, 28 143, 45 135 Z" fill="${clothingColor}" />;`;
    const jacketMap = {
      'jacket-denim': `<path d="M45 135 L68 200 L38 200 C38 168, 28 143, 45 135 Z" fill="#2563eb" /><path d="M155 135 L132 200 L162 200 C162 168, 172 143, 155 135 Z" fill="#2563eb" /><path d="M45 135 L72 168 L72 133 Z" fill="#1d4ed8" /><path d="M155 135 L128 168 L128 133 Z" fill="#1d4ed8" />`,
      'jacket-leather': `
        <path d="M45 135 L68 200 L38 200 C38 168, 28 143, 45 135 Z" fill="#1e1b4b" stroke="#0f172a" stroke-width="1.5" />
        <path d="M155 135 L132 200 L162 200 C162 168, 172 143, 155 135 Z" fill="#1e1b4b" stroke="#0f172a" stroke-width="1.5" />
        <path d="M45 135 L72 168 L72 133 Z" fill="#312e81" stroke="#0f172a" stroke-width="1" />
        <path d="M155 135 L128 168 L128 133 Z" fill="#312e81" stroke="#0f172a" stroke-width="1" />
        <circle cx="56" cy="144" r="2.5" fill="#e2e8f0" stroke="#0f172a" stroke-width="1" />
        <circle cx="144" cy="144" r="2.5" fill="#e2e8f0" stroke="#0f172a" stroke-width="1" />
        <path d="M72 155 L75 168 M75 168 L71 168" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" />
        <path d="M128 155 L125 168 M125 168 L129 168" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" />
        <path d="M38 170 C38 170, 48 185, 68 190" fill="none" stroke="#4338ca" stroke-width="1" stroke-dasharray="2 2" />
        <path d="M162 170 C162 170, 152 185, 132 190" fill="none" stroke="#4338ca" stroke-width="1" stroke-dasharray="2 2" />
      `,
      'jacket-cape': `<path d="M42 135 C25 145, 10 170, 10 200 L190 200 C190 170, 175 145, 158 135 Z" fill="#991b1b" /><path d="M42 135 C35 150, 30 180, 25 200" fill="none" stroke="#7f1d1d" stroke-width="2" /><path d="M158 135 C165 150, 170 180, 175 200" fill="none" stroke="#7f1d1d" stroke-width="2" /><circle cx="100" cy="136" r="4.5" fill="#f59e0b" />`
    };
    svg += jacketMap[config.jacket] || '';
    const eyesMap = {
      'eyes-classic': `<circle cx="85" cy="82" r="6" fill="#ffffff" stroke="#1e293b" stroke-width="1" /><circle cx="115" cy="82" r="6" fill="#ffffff" stroke="#1e293b" stroke-width="1" /><circle cx="85" cy="82" r="3.5" fill="${eyeColor}" /><circle cx="115" cy="82" r="3.5" fill="${eyeColor}" /><circle cx="83.5" cy="80.5" r="1.2" fill="#ffffff" /><circle cx="113.5" cy="80.5" r="1.2" fill="#ffffff" /><circle cx="86.5" cy="83.5" r="0.6" fill="#ffffff" /><circle cx="116.5" cy="83.5" r="0.6" fill="#ffffff" />`,
      'eyes-happy': `<path d="M76 86 Q85 71 94 86" stroke="#1e293b" stroke-width="4.5" fill="none" stroke-linecap="round" /><path d="M106 86 Q115 71 124 86" stroke="#1e293b" stroke-width="4.5" fill="none" stroke-linecap="round" />`,
      'eyes-serious': `<path d="M75 77 L95 80" stroke="#1e293b" stroke-width="3" stroke-linecap="round" /><path d="M125 77 L105 80" stroke="#1e293b" stroke-width="3" stroke-linecap="round" /><circle cx="85" cy="85" r="5" fill="#ffffff" stroke="#1e293b" stroke-width="1" /><circle cx="115" cy="85" r="5" fill="#ffffff" stroke="#1e293b" stroke-width="1" /><circle cx="85" cy="85" r="2.5" fill="${eyeColor}" /><circle cx="115" cy="85" r="2.5" fill="${eyeColor}" /><circle cx="83.5" cy="83.5" r="1" fill="#ffffff" /><circle cx="113.5" cy="83.5" r="1" fill="#ffffff" />`,
      'eyes-winking': `<circle cx="85" cy="82" r="6" fill="#ffffff" stroke="#1e293b" stroke-width="1" /><circle cx="85" cy="82" r="3.5" fill="${eyeColor}" /><circle cx="83.5" cy="80.5" r="1.2" fill="#ffffff" /><path d="M106 82 Q115 90 124 82" stroke="#1e293b" stroke-width="4.5" fill="none" stroke-linecap="round" />`,
      'eyes-visor': `<rect x="68" y="71" width="64" height="20" rx="5" fill="#00f2fe" opacity="0.95" stroke="#00c6ff" stroke-width="1" /><line x1="68" y1="81" x2="132" y2="81" stroke="#ffffff" stroke-width="2.5" opacity="0.75" />`
    };
    svg += eyesMap[config.eyes] || `<circle cx="85" cy="82" r="6" fill="#ffffff" stroke="#1e293b" stroke-width="1" /><circle cx="115" cy="82" r="6" fill="#ffffff" stroke="#1e293b" stroke-width="1" /><circle cx="85" cy="82" r="3.5" fill="${eyeColor}" /><circle cx="115" cy="82" r="3.5" fill="${eyeColor}" /><circle cx="83.5" cy="80.5" r="1.2" fill="#ffffff" /><circle cx="113.5" cy="80.5" r="1.2" fill="#ffffff" />`;
    const eyebrowsMap = {
      'eyebrows-flat': `<line x1="74" y1="70" x2="94" y2="70" stroke="#1e293b" stroke-width="4" stroke-linecap="round" /><line x1="106" y1="70" x2="126" y2="70" stroke="#1e293b" stroke-width="4" stroke-linecap="round" />`,
      'eyebrows-curved': `<path d="M74 72 Q85 64 94 70" stroke="#1e293b" stroke-width="4" fill="none" stroke-linecap="round" /><path d="M106 70 Q115 64 126 72" stroke="#1e293b" stroke-width="4" fill="none" stroke-linecap="round" />`,
      'eyebrows-angry': `<line x1="74" y1="66" x2="94" y2="72" stroke="#1e293b" stroke-width="4.5" stroke-linecap="round" /><line x1="106" y1="72" x2="126" y2="66" stroke="#1e293b" stroke-width="4.5" stroke-linecap="round" />`
    };
    svg += eyebrowsMap[config.eyebrows] || '';
    const mouthMap = {
      'mouth-neutral': `<line x1="90" y1="107" x2="110" y2="107" stroke="#1e293b" stroke-width="3" stroke-linecap="round" />`,
      'mouth-smile': `<path d="M88 103 Q100 118 112 103" stroke="#1e293b" stroke-width="3.5" fill="none" stroke-linecap="round" />`,
      'mouth-grin': `<path d="M86 103 Q100 120 114 103 Z" fill="#1e293b" /><path d="M88 104 Q100 112 112 104" stroke="#ffffff" stroke-width="3" fill="none" />`,
      'mouth-smirk': `<path d="M88 106 Q94 110 110 104" stroke="#1e293b" stroke-width="3.5" fill="none" stroke-linecap="round" />`,
      'mouth-frown': `<path d="M90 111 Q100 100 110 111" stroke="#1e293b" stroke-width="3" fill="none" stroke-linecap="round" />`
    };
    svg += mouthMap[config.mouth] || `<line x1="90" y1="107" x2="110" y2="107" stroke="#1e293b" stroke-width="3" stroke-linecap="round" />`;
    const facialHairMap = {
      'facialHair-stubble': `<path d="M68 95 C68 124, 132 124, 132 95 C132 134, 68 134, 68 95 Z" fill="#1e293b" opacity="0.18" />`,
      'facialHair-mustache': `<path d="M86 103 Q100 96 114 103 C110 109, 90 109, 86 103 Z" fill="#0f172a" />`,
      'facialHair-beard': `<path d="M66 83 C66 128, 134 128, 134 83 C134 142, 66 142, 66 83 Z" fill="#0f172a" /><path d="M86 103 Q100 96 114 103 C110 109, 90 109, 86 103 Z" fill="#020617" />`
    };
    svg += facialHairMap[config.facialHair] || '';
    const hairMap = {
      'hair-buzzcut': `<path d="M65 74 C63 38, 137 38, 135 74 C120 71, 80 71, 65 74 Z" fill="${hairColor}" opacity="0.8" /><path d="M72 50 Q100 45 128 50" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1" />`,
      'hair-sidepart': `<path d="M63 72 C58 35, 142 35, 137 72 C110 49, 90 51, 63 72 Z" fill="${hairColor}" /><path d="M96 42 L94 70" stroke="rgba(0,0,0,0.25)" stroke-width="1.5" />`,
      'hair-spikes': `<path d="M63 70 C58 35, 142 35, 137 70 L128 43 L116 52 L100 30 L84 50 L72 38 Z" fill="${hairColor}" /><path d="M84 50 L80 65" stroke="rgba(255,255,255,0.1)" stroke-width="1" />`,
      'hair-afro': `<circle cx="100" cy="62" r="44" fill="${hairColor}" /><circle cx="68" cy="73" r="20" fill="${hairColor}" /><circle cx="132" cy="73" r="20" fill="${hairColor}" /><circle cx="100" cy="45" r="16" fill="rgba(255,255,255,0.06)" />`,
      'hair-longwaves': `<path d="M64 68 C58 33, 142 33, 136 68 C148 93, 150 130, 146 155 C132 112, 134 81, 132 76 C110 65, 90 65, 68 76 C66 81, 68 112, 54 155 C50 130, 52 93, 64 68 Z" fill="${hairColor}" />`,
      'hair-topknot': `<path d="M63 72 C58 35, 142 35, 137 72 C110 49, 90 51, 63 72 Z" fill="${hairColor}" /><circle cx="100" cy="27" r="14" fill="${hairColor}" /><rect x="95" y="35" width="10" height="7" fill="#fbbf24" rx="2" />`,
      'hair-mohawk': `<path d="M90 38 Q100 12 110 38 L110 82 L90 82 Z" fill="${hairColor}" /><path d="M96 28 Q100 20 104 28" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1" />`,
      'hair-wizard': `<path d="M58 88 L100 15 L142 88 Z" fill="#312e81" stroke="#1e1b4b" stroke-width="1" /><path d="M46 88 L154 88 L142 103 L58 103 Z" fill="#1e1b4b" /><circle cx="100" cy="40" r="3.5" fill="#eab308" />`
    };
    let activeHair = config.hair || 'hair-none';
    if (memory.cosmetics) {
      const dbCosmetic = memory.cosmetics.find(c => c.id === activeHair);
      if (dbCosmetic && dbCosmetic.svgContent) {
        svg += dbCosmetic.svgContent.replace(/{hairColor}/g, hairColor);
      } else {
        svg += hairMap[activeHair] || '';
      }
    } else {
      svg += hairMap[activeHair] || '';
    }
    const glassesMap = {
      'glasses-round': `<circle cx="82" cy="82" r="15" fill="rgba(255,255,255,0.15)" stroke="#0f172a" stroke-width="3.5" /><circle cx="118" cy="82" r="15" fill="rgba(255,255,255,0.15)" stroke="#0f172a" stroke-width="3.5" /><line x1="97" y1="82" x2="103" y2="82" stroke="#0f172a" stroke-width="3.5" /><line x1="72" y1="74" x2="80" y2="80" stroke="#ffffff" stroke-width="2" opacity="0.6" /><line x1="108" y1="74" x2="116" y2="80" stroke="#ffffff" stroke-width="2" opacity="0.6" />`,
      'glasses-square': `<rect x="68" y="69" width="26" height="22" rx="4" fill="rgba(255,255,255,0.15)" stroke="#1e293b" stroke-width="3.5" /><rect x="106" y="69" width="26" height="22" rx="4" fill="rgba(255,255,255,0.15)" stroke="#1e293b" stroke-width="3.5" /><line x1="94" y1="78" x2="106" y2="78" stroke="#1e293b" stroke-width="3.5" /><line x1="72" y1="72" x2="80" y2="80" stroke="#ffffff" stroke-width="2" opacity="0.5" />`,
      'glasses-aviators': `<path d="M68 70 L94 75 L94 88 C94 96, 74 98, 68 88 Z" fill="rgba(15,23,42,0.75)" stroke="#fbbf24" stroke-width="2" /><path d="M132 70 L106 75 L106 88 C106 96, 126 98, 132 88 Z" fill="rgba(15,23,42,0.75)" stroke="#fbbf24" stroke-width="2" /><line x1="94" y1="74" x2="106" y2="74" stroke="#fbbf24" stroke-width="2.5" />`,
      'glasses-visor': `<rect x="66" y="71" width="68" height="20" rx="3" fill="rgba(244,63,94,0.85)" stroke="#e11d48" stroke-width="1.5" /><line x1="66" y1="81" x2="134" y2="81" stroke="#ffffff" stroke-width="2" /><line x1="72" y1="74" x2="80" y2="80" stroke="#ffffff" stroke-width="1.5" opacity="0.6" />`
    };
    svg += glassesMap[config.glasses] || '';
    const hatMap = {
      'hat-beanie': `<path d="M61 58 C61 31, 139 31, 139 58 Z" fill="#b91c1c" /><rect x="55" y="53" width="90" height="14" rx="5" fill="#991b1b" /><circle cx="100" cy="27" r="7" fill="#ffffff" /><path d="M70 45 L70 53 M100 40 L100 53 M130 45 L130 53" stroke="rgba(0,0,0,0.15)" stroke-width="1" />`,
      'hat-cap': `<path d="M62 58 C62 31, 138 31, 138 58 Z" fill="#1d4ed8" /><path d="M125 53 L178 53 C178 53, 172 65, 125 65 Z" fill="#1e40af" /><ellipse cx="100" cy="30" rx="3" ry="1.5" fill="#f59e0b" />`,
      'hat-fedora': `<path d="M66 53 C68 26, 132 26, 134 53 Z" fill="#18181b" /><rect x="70" y="45" width="60" height="8" fill="#b91c1c" /><ellipse cx="100" cy="53" rx="58" ry="7" fill="#09090b" /><line x1="70" y1="49" x2="130" y2="49" stroke="#ef4444" stroke-width="0.5" />`,
      'hat-crown': `
        <path d="M65 60 L78 32 L92 50 L100 25 L108 50 L122 32 L135 60 Z" fill="url(#grad-crown-gold)" stroke="#b45309" stroke-width="2" />
        <path d="M71 58 Q100 38 129 58 Z" fill="url(#grad-crown-velvet)" />
        <path d="M65 60 L78 32 L92 50 L100 25 L108 50 L122 32 L135 60 Z" fill="none" stroke="#fef08a" stroke-width="1.2" />
        <rect x="68" y="55" width="64" height="6" fill="#d97706" rx="2" />
        <circle cx="78" cy="32" r="4.5" fill="#ef4444" stroke="#7f1d1d" stroke-width="1" />
        <circle cx="100" cy="25" r="5" fill="#3b82f6" stroke="#1e3a8a" stroke-width="1" />
        <circle cx="122" cy="32" r="4.5" fill="#10b981" stroke="#064e3b" stroke-width="1" />
        <rect x="76" y="56" width="4" height="4" transform="rotate(45 78 58)" fill="#ffffff" />
        <rect x="100" y="56" width="4" height="4" transform="rotate(45 102 58)" fill="#ffffff" />
        <rect x="120" y="56" width="4" height="4" transform="rotate(45 122 58)" fill="#ffffff" />
      `
    };
    let activeHat = config.hat || 'none';
    if (memory.cosmetics) {
      const dbCosmetic = memory.cosmetics.find(c => c.id === activeHat);
      if (dbCosmetic && dbCosmetic.svgContent) {
        svg += dbCosmetic.svgContent;
      } else {
        svg += hatMap[activeHat] || '';
      }
    } else {
      svg += hatMap[activeHat] || '';
    }
    const accessoriesMap = {
      'accessories-earbuds': `<path d="M65 82 C65 82, 60 84, 60 88 M140 82 C140 82, 145 84, 145 88" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" fill="none" /><circle cx="60" cy="88" r="3.5" fill="#f8fafc" /><circle cx="145" cy="88" r="3.5" fill="#f8fafc" />`,
      'accessories-scar': `<path d="M72 88 L82 102 M76 96 L84 94" stroke="#dc2626" stroke-width="2.5" stroke-linecap="round" />`,
      'accessories-headphones': `<rect x="56" y="75" width="12" height="26" rx="4" fill="#0f172a" stroke="#1e293b" stroke-width="1.5" /><rect x="132" y="75" width="12" height="26" rx="4" fill="#0f172a" stroke="#1e293b" stroke-width="1.5" /><path d="M62 75 C62 30, 138 30, 138 75" fill="none" stroke="#0f172a" stroke-width="6.5" />`
    };
    svg += accessoriesMap[config.accessories] || '';
    const effectMap = {
      'effect-leaves': `<g fill="#34d399"><path d="M30 40 Q40 33 34 46 Z" opacity="0.6"/><path d="M170 60 Q158 53 164 66 Z" opacity="0.5"/><path d="M25 120 Q35 113 28 126 Z" opacity="0.6"/><path d="M175 140 Q163 133 169 146 Z" opacity="0.5"/></g>`,
      'effect-sparkles': `<g fill="#facc15" opacity="0.95"><path d="M20 50 L24 43 L32 40 L24 37 L20 30 L16 37 L8 40 L16 43 Z"/><path d="M180 80 L182 75 L188 73 L182 71 L180 66 L178 71 L172 73 L178 75 Z"/><path d="M35 150 L38 144 L44 142 L38 140 L35 134 L32 140 L26 142 L32 144 Z"/></g>`,
      'effect-glitch': `<g fill="#f43f5e" opacity="0.65"><rect x="10" y="45" width="25" height="3" /><rect x="165" y="95" width="25" height="3" fill="#06b6d4" /><rect x="40" y="20" width="15" height="2" /><rect x="145" y="160" width="20" height="2" fill="#eab308" /></g>`,
      'effect-fire': `<path d="M32 180 Q8 135 34 105 Q44 130 32 180" fill="#ea580c" opacity="0.45" /><path d="M34 180 Q18 145 34 125" fill="#facc15" opacity="0.5" /><path d="M168 180 Q192 135 166 105 Q156 130 166 180" fill="#ea580c" opacity="0.45" /><path d="M166 180 Q182 145 166 125" fill="#facc15" opacity="0.5" />`
    };
    svg += effectMap[config.effect] || '';
    const frameMap = {
      'frame-silver': `<rect x="4" y="4" width="192" height="192" rx="20" fill="none" stroke="#cbd5e1" stroke-width="5" /><rect x="5.5" y="5.5" width="189" height="189" rx="18.5" fill="none" stroke="#94a3b8" stroke-width="1.5" />`,
      'frame-laurel': `<rect x="4" y="4" width="192" height="192" rx="20" fill="none" stroke="#fbbf24" stroke-width="4" /><g fill="#fbbf24"><path d="M14 60 Q4 52 14 44 Z"/><path d="M14 100 Q4 92 14 84 Z"/><path d="M14 140 Q4 132 14 124 Z"/><path d="M186 60 Q196 52 186 44 Z"/><path d="M186 100 Q196 92 186 84 Z"/><path d="M186 140 Q196 132 186 124 Z"/></g>`,
      'frame-neon': `<rect x="4" y="4" width="192" height="192" rx="20" fill="none" stroke="#06b6d4" stroke-width="5" stroke-linecap="round" stroke-dasharray="60 30" /><rect x="4" y="4" width="192" height="192" rx="20" fill="none" stroke="#3b82f6" stroke-width="5" stroke-linecap="round" stroke-dasharray="30 60" opacity="0.6"/>`,
      'frame-diamond': `<rect x="4" y="4" width="192" height="192" rx="20" fill="none" stroke="#c084fc" stroke-width="4.5" /><g fill="#a855f7"><polygon points="100,2 106,8 100,14 94,8" /><polygon points="100,198 106,192 100,186 94,192" /><polygon points="2,100 8,106 14,100 8,94" /><polygon points="198,100 192,106 186,100 192,94" /></g>`
    };
    svg += frameMap[config.frame] || '';
    svg += `</g>`;
    svg += `</svg>`;
    return svg;
  }

  function renderAvatarHTML(user) {
    if (!user) return `<div class="avatar-initials" style="display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; font-family: var(--font-display); font-weight: 500; background: linear-gradient(135deg, var(--accent-moss) 0%, var(--accent-ocean) 100%); color: var(--bg-warm); font-size: 1.25rem; text-transform: uppercase; letter-spacing: 0.05em; border-radius: 16px;">TW</div>`;
    const avatarStr = user.avatar || user.profilePicture || '';
    if (avatarStr.startsWith('avatar:config:')) {
      try {
        const config = JSON.parse(avatarStr.slice('avatar:config:'.length));
        return renderAvatarSVG(config);
      } catch (e) {
        console.warn('Error parsing avatar config', e);
      }
    } else if (avatarStr.startsWith('avatar:premium:')) {
      const premiumId = avatarStr.slice('avatar:premium:'.length);
      const cosmetic = (memory.cosmetics || []).find(item => item.id === premiumId && item.category === 'premiumAvatar');
      if (cosmetic) return renderPremiumAvatarHTML(cosmetic, user);
      const fallbackImage = avatarImageValue(user.profilePicture);
      if (fallbackImage) return `<img src="${escapeHTML(fallbackImage)}" alt="${escapeHTML(user.displayName || 'Avatar')}" style="width: 100%; height: 100%; object-fit: cover;" />`;
    } else if (avatarImageValue(avatarStr)) {
      return `<img src="${escapeHTML(avatarImageValue(avatarStr))}" alt="${escapeHTML(user.displayName || 'Avatar')}" style="width: 100%; height: 100%; object-fit: cover;" />`;
    }
    const initials = user.initials || initialsFromName(user.displayName || user.name || 'TW');
    return `<div class="avatar-initials" style="display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; font-family: var(--font-display); font-weight: 500; background: linear-gradient(135deg, var(--accent-moss) 0%, var(--accent-ocean) 100%); color: var(--bg-warm); font-size: 1.25rem; text-transform: uppercase; letter-spacing: 0.05em; border-radius: 16px;">${escapeHTML(initials)}</div>`;
  }

  function renderProfileBanner(bannerValue, bannerElement) {
    if (!bannerElement) return;
    bannerElement.innerHTML = '';
    bannerElement.style.position = 'relative';
    bannerElement.style.overflow = 'hidden';
    if (!bannerValue) {
      bannerElement.style.backgroundImage = 'none';
      bannerElement.style.background = 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)';
      return;
    }
    if (bannerValue.startsWith('http://') || bannerValue.startsWith('https://') || bannerValue.startsWith('data:')) {
      bannerElement.style.background = 'none';
      bannerElement.style.backgroundImage = `url("${bannerValue}")`;
      bannerElement.style.backgroundSize = 'cover';
      bannerElement.style.backgroundPosition = 'center';
      return;
    }
    const bannerThemes = {
      'banner-tech': {
        bg: 'linear-gradient(135deg, #090d16 0%, #111827 100%)',
        svg: `<svg style="position:absolute;width:100%;height:100%;left:0;top:0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 200" preserveAspectRatio="none"><defs><linearGradient id="glow-cyan" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#06b6d4" stop-opacity="0.8"/><stop offset="100%" stop-color="#3b82f6" stop-opacity="0.1"/></linearGradient><pattern id="gridPattern" width="30" height="30" patternUnits="userSpaceOnUse"><path d="M 30 0 L 0 0 0 30" fill="none" stroke="#0891b2" stroke-width="0.5" opacity="0.08"/></pattern></defs><rect width="100%" height="100%" fill="url(#gridPattern)"/><path d="M 50 100 H 150 L 180 130 H 300 L 320 110 H 450" fill="none" stroke="url(#glow-cyan)" stroke-width="1.5"/><path d="M 200 40 H 350 L 380 70 H 500 L 530 40 H 680" fill="none" stroke="url(#glow-cyan)" stroke-width="1" opacity="0.6"/><circle cx="150" cy="100" r="3" fill="#22d55e"/><circle cx="180" cy="130" r="2.5" fill="#06b6d4"/><circle cx="300" cy="130" r="3" fill="#3b82f6"/><circle cx="350" cy="40" r="2" fill="#06b6d4"/><circle cx="530" cy="40" r="3" fill="#a855f7"/><rect x="50" y="40" width="40" height="15" fill="none" stroke="#0891b2" stroke-width="1" opacity="0.3"/><line x1="55" y1="47" x2="85" y2="47" stroke="#06b6d4" stroke-width="2" opacity="0.5"/><line x1="55" y1="52" x2="75" y2="52" stroke="#06b6d4" stroke-width="2" opacity="0.5"/><text x="790" y="25" fill="#0891b2" font-family="monospace" font-size="9" opacity="0.4" text-anchor="end">SYS.STATUS: ACTIVE</text></svg>`
      },
      'banner-nature': {
        bg: 'linear-gradient(135deg, #022c22 0%, #064e3b 100%)',
        svg: `<svg style="position:absolute;width:100%;height:100%;left:0;top:0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 200" preserveAspectRatio="none"><defs><linearGradient id="leafGrad1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#10b981"/><stop offset="100%" stop-color="#047857"/></linearGradient><linearGradient id="leafGrad2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#34d399"/><stop offset="100%" stop-color="#065f46"/></linearGradient><linearGradient id="sunRay" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#fef08a" stop-opacity="0.15"/><stop offset="100%" stop-color="#fef08a" stop-opacity="0"/></linearGradient></defs><polygon points="100,-20 200,-20 450,220 300,220" fill="url(#sunRay)"/><polygon points="400,-20 500,-20 700,220 550,220" fill="url(#sunRay)"/><g transform="translate(-20, 40) scale(1.2)"><path d="M 0 160 C 20 120, 60 110, 100 130 C 90 90, 70 50, 40 40 C 20 60, 10 110, 0 160 Z" fill="url(#leafGrad1)" opacity="0.85"/><path d="M 0 160 C 40 140, 90 120, 120 160 C 100 110, 60 70, 30 70 C 15 90, 5 130, 0 160 Z" fill="url(#leafGrad2)" opacity="0.7"/></g><g transform="translate(680, 20) scale(1.3)"><path d="M 120 160 C 100 120, 60 110, 20 130 C 30 90, 50 50, 80 40 C 100 60, 110 110, 120 160 Z" fill="url(#leafGrad1)" opacity="0.85"/><path d="M 120 160 C 80 140, 30 120, 0 160 C 20 110, 60 70, 90 70 C 105 90, 115 130, 120 160 Z" fill="url(#leafGrad2)" opacity="0.75"/></g><g fill="#eab308"><circle cx="200" cy="80" r="2.5" opacity="0.8"/><circle cx="205" cy="82" r="6" fill="#fef08a" opacity="0.2"/><circle cx="480" cy="140" r="1.5" opacity="0.7"/><circle cx="610" cy="60" r="3" opacity="0.9"/><circle cx="613" cy="62" r="7" fill="#fef08a" opacity="0.25"/></g></svg>`
      },
      'banner-space': {
        bg: 'radial-gradient(circle, #0c0a24 0%, #030008 100%)',
        svg: `<svg style="position:absolute;width:100%;height:100%;left:0;top:0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 200" preserveAspectRatio="none"><defs><radialGradient id="nebulaGrad" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#7c3aed" stop-opacity="0.35"/><stop offset="50%" stop-color="#2563eb" stop-opacity="0.15"/><stop offset="100%" stop-color="#000000" stop-opacity="0"/></radialGradient><radialGradient id="nebulaGrad2" cx="30%" cy="40%" r="40%"><stop offset="0%" stop-color="#db2777" stop-opacity="0.25"/><stop offset="100%" stop-color="#000000" stop-opacity="0"/></radialGradient></defs><rect width="100%" height="100%" fill="url(#nebulaGrad)"/><rect width="100%" height="100%" fill="url(#nebulaGrad2)"/><g fill="#ffffff"><circle cx="40" cy="50" r="1" opacity="0.8"/><circle cx="120" cy="30" r="1.2" opacity="0.6"/><circle cx="122" cy="32" r="4" fill="#6366f1" opacity="0.3"/><circle cx="280" cy="80" r="1.5" opacity="0.7"/><circle cx="340" cy="40" r="1" opacity="0.9"/><circle cx="420" cy="150" r="1.2" opacity="0.5"/><circle cx="510" cy="25" r="1.8" opacity="0.9"/><circle cx="580" cy="110" r="1" opacity="0.6"/><circle cx="690" cy="70" r="2" opacity="0.8"/><circle cx="730" cy="130" r="1" opacity="0.5"/></g><line x1="120" y1="30" x2="280" y2="80" stroke="#818cf8" stroke-width="0.5" opacity="0.25"/><line x1="280" y1="80" x2="340" y2="40" stroke="#818cf8" stroke-width="0.5" opacity="0.2"/><line x1="510" y1="25" x2="580" y2="110" stroke="#c084fc" stroke-width="0.5" opacity="0.2"/><circle cx="720" cy="40" r="24" fill="#1e1b4b"/><path d="M 720 16 A 24 24 0 0 1 720 64 A 20 24 0 0 0 720 16" fill="#f43f5e" opacity="0.6"/></svg>`
      },
      'banner-sea': {
        bg: 'linear-gradient(135deg, #0c4a6e 0%, #0369a1 100%)',
        svg: `<svg style="position:absolute;width:100%;height:100%;left:0;top:0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 200" preserveAspectRatio="none"><path d="M0 120 Q160 85, 360 130 T800 110 L800 200 L0 200 Z" fill="#0284c7" opacity="0.4"/><path d="M0 150 Q200 125, 450 160 T800 145 L800 200 L0 200 Z" fill="#38bdf8" opacity="0.2"/><path d="M0 170 Q240 155, 520 180 T800 170 L800 200 L0 200 Z" fill="#e0f2fe" opacity="0.1"/><g fill="#38bdf8"><circle cx="120" cy="150" r="2" opacity="0.7"/><circle cx="340" cy="170" r="1.5" opacity="0.6"/><circle cx="560" cy="130" r="2.5" opacity="0.8"/><circle cx="680" cy="160" r="1" opacity="0.5"/></g></svg>`
      },
      'banner-abstract': {
        bg: 'linear-gradient(135deg, #2e1065 0%, #1e1b4b 100%)',
        svg: `<svg style="position:absolute;width:100%;height:100%;left:0;top:0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 200" preserveAspectRatio="none"><defs><radialGradient id="abstractGrad1" cx="30%" cy="30%" r="50%"><stop offset="0%" stop-color="#a855f7" stop-opacity="0.4"/><stop offset="100%" stop-color="#000000" stop-opacity="0"/></radialGradient><radialGradient id="abstractGrad2" cx="70%" cy="60%" r="50%"><stop offset="0%" stop-color="#ec4899" stop-opacity="0.3"/><stop offset="100%" stop-color="#000000" stop-opacity="0"/></radialGradient></defs><rect width="100%" height="100%" fill="url(#abstractGrad1)"/><rect width="100%" height="100%" fill="url(#abstractGrad2)"/><path d="M -50 80 C 150 140, 250 -20, 500 80 C 650 140, 750 20, 850 80" fill="none" stroke="#f472b6" stroke-width="6" opacity="0.3" stroke-linecap="round"/><path d="M -50 100 C 180 160, 220 0, 480 100 C 620 160, 780 0, 850 100" fill="none" stroke="#c084fc" stroke-width="4" opacity="0.35" stroke-linecap="round"/><rect x="500" y="30" width="180" height="70" rx="12" fill="#ffffff" fill-opacity="0.04" stroke="#ffffff" stroke-opacity="0.1" stroke-width="1.5" style="backdrop-filter: blur(10px);"/></svg>`
      },
      'banner-founder': {
        bg: 'linear-gradient(135deg, #271406 0%, #451a03 100%)',
        svg: `<svg style="position:absolute;width:100%;height:100%;left:0;top:0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 200" preserveAspectRatio="none"><defs><linearGradient id="goldCrest" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#fbbf24" stop-opacity="0.15"/><stop offset="100%" stop-color="#d97706" stop-opacity="0.03"/></linearGradient></defs><polygon points="0,0 200,0 100,160" fill="url(#goldCrest)" stroke="#fbbf24" stroke-width="0.5" opacity="0.3"/><polygon points="800,0 600,0 700,160" fill="url(#goldCrest)" stroke="#fbbf24" stroke-width="0.5" opacity="0.3"/><path d="M 300 40 L 302 48 L 310 50 L 302 52 L 300 60 L 298 52 L 290 50 L 298 48 Z" fill="#fbbf24" opacity="0.6"/><path d="M 500 120 L 501 125 L 506 126 L 501 127 L 500 132 L 499 127 L 494 126 L 499 125 Z" fill="#fbbf24" opacity="0.5"/><path d="M 120 100 L 121 104 L 125 105 L 121 106 L 120 110 L 119 106 L 115 105 L 119 104 Z" fill="#fef08a" opacity="0.7"/></svg>`
      },
      'banner-referrals': {
        bg: 'linear-gradient(135deg, #042f2e 0%, #115e59 100%)',
        svg: `<svg style="position:absolute;width:100%;height:100%;left:0;top:0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 200" preserveAspectRatio="none"><defs><linearGradient id="networkLine" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#2dd4bf" stop-opacity="0.3"/><stop offset="100%" stop-color="#0f766e" stop-opacity="0.05"/></linearGradient></defs><line x1="80" y1="100" x2="220" y2="60" stroke="url(#networkLine)" stroke-width="1.5"/><line x1="220" y1="60" x2="360" y2="120" stroke="url(#networkLine)" stroke-width="1.5"/><line x1="360" y1="120" x2="480" y2="50" stroke="url(#networkLine)" stroke-width="1.5"/><line x1="480" y1="50" x2="620" y2="140" stroke="url(#networkLine)" stroke-width="1.5"/><line x1="620" y1="140" x2="740" y2="80" stroke="url(#networkLine)" stroke-width="1.5"/><line x1="220" y1="60" x2="480" y2="50" stroke="url(#networkLine)" stroke-width="1" opacity="0.3"/><line x1="360" y1="120" x2="620" y2="140" stroke="url(#networkLine)" stroke-width="1" opacity="0.3"/><g fill="#2dd4bf"><circle cx="80" cy="100" r="6" stroke="#115e59" stroke-width="2"/><circle cx="220" cy="60" r="7" stroke="#115e59" stroke-width="2"/><circle cx="360" cy="120" r="9" stroke="#115e59" stroke-width="3"/><circle cx="360" cy="120" r="18" fill="none" stroke="#2dd4bf" stroke-width="1" opacity="0.2"/><circle cx="480" cy="50" r="8" stroke="#115e59" stroke-width="2"/><circle cx="620" cy="140" r="7" stroke="#115e59" stroke-width="2"/><circle cx="740" cy="80" r="6" stroke="#115e59" stroke-width="2"/></g></svg>`
      },
      'banner-community': {
        bg: 'linear-gradient(135deg, #450a0a 0%, #881337 100%)',
        svg: `<svg style="position:absolute;width:100%;height:100%;left:0;top:0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 200" preserveAspectRatio="none"><defs><radialGradient id="fireGlow" cx="50%" cy="90%" r="50%"><stop offset="0%" stop-color="#f59e0b" stop-opacity="0.45"/><stop offset="60%" stop-color="#b91c1c" stop-opacity="0.15"/><stop offset="100%" stop-color="#000000" stop-opacity="0"/></radialGradient></defs><rect width="100%" height="100%" fill="url(#fireGlow)"/><path d="M 390 200 Q 400 160 410 200" fill="#f59e0b" opacity="0.8"/><path d="M 395 200 Q 400 175 405 200" fill="#fde047"/><g fill="#1e1b4b" opacity="0.85"><circle cx="280" cy="165" r="9"/><path d="M 270 178 Q 280 185 290 178 L 292 200 H 268 Z"/><circle cx="320" cy="155" r="10"/><path d="M 308 170 Q 320 178 332 170 L 335 200 H 305 Z"/><circle cx="360" cy="150" r="11"/><path d="M 346 166 Q 360 175 374 166 L 378 200 H 342 Z"/><circle cx="440" cy="150" r="11"/><path d="M 426 166 Q 440 175 454 166 L 458 200 H 422 Z"/><circle cx="480" cy="155" r="10"/><path d="M 468 170 Q 480 178 492 170 L 495 200 H 465 Z"/><circle cx="520" cy="165" r="9"/><path d="M 510 178 Q 520 185 530 178 L 532 200 H 508 Z"/></g><path d="M 288 185 Q 300 190 312 181" stroke="#f43f5e" stroke-width="1.5" fill="none" opacity="0.3"/><path d="M 328 179 Q 340 183 352 175" stroke="#f43f5e" stroke-width="1.5" fill="none" opacity="0.3"/><path d="M 448 175 Q 460 183 472 179" stroke="#f43f5e" stroke-width="1.5" fill="none" opacity="0.3"/><path d="M 488 181 Q 500 190 512 185" stroke="#f43f5e" stroke-width="1.5" fill="none" opacity="0.3"/></svg>`
      }
    };
    const theme = bannerThemes[bannerValue] || {
      bg: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
      svg: ''
    };
    bannerElement.style.background = 'none';
    bannerElement.style.backgroundImage = 'none';
    bannerElement.style.background = theme.bg;
    if (theme.svg) {
      bannerElement.innerHTML = theme.svg;
    }
  }

  window.alert = function (message) {
    showToast(message);
  };

  window.TWS = {
    ...(window.TWS || {}),
    memory,
    getFirebaseDataApiSafe,
    escapeHTML,
    decodeProfileName,
    profileUrl,
    safeExternalUrl,
    toUsername,
    initialsFromName,
    progressionRanks,
    administrativeRoles,
    defaultImpactRewards,
    defaultExperienceRewards,
    badgeCatalog,
    resolveBadge,
    normalizeBadges,
    badgeStorageValues,
    levelRequirement,
    progressionFromExperience,
    experienceForProgression,
    impactPointsFromStats,
    spendablePointsFromStats,
    experienceFromStats,
    validUsername,
    normalizeMember,
    normalizeProblem,
    defaultTaskCategories,
    taskStatuses,
    submissionStatuses,
    normalizeTask,
    normalizeTaskSubmission,
    taskProofHash,
    loadMovementMembers,
    loadMovementMembersAsync,
    loadProblemsAsync,
    saveProblem,
    updateProblem,
    deleteProblem,
    loadTaskCategoriesAsync,
    saveTaskCategory,
    loadCommunityTasksAsync,
    saveCommunityTask,
    deleteCommunityTask,
    loadTaskSubmissionsAsync,
    saveTaskSubmission,
    reviewTaskSubmission,
    awardTaskSubmission,
    createNotification,
    loadNotificationsAsync,
    awardPlatformExperience,
    saveUserProfile,
    usernameAvailable,
    identityAvailable,
    deleteUserProfile,
    loadPartnersAsync,
    savePartnerProfile,
    deletePartnerProfile,
    loadSettings,
    saveSettings,
    logSystemActivity,
    loadSystemLogs,
    clearSystemLogs,
    dashboardForSession,
    dashboardsForSession,
    memberPrefix,
    enhanceNavigation,
    defaultReferralSettings,
    generateReferralCode,
    calculateReferralEXP,
    recalculateUserReferralProgression,
    triggerReferralCelebration,
    ensureSolverProfile,
    triggerLevelUpAnimation,
    checkLevelUpProgression,
    showToast,
    getSeedCosmeticsList,
    loadCosmeticsAsync,
    saveCosmetic,
    deleteCosmetic,
    purchaseCosmetic,
    isCosmeticUnlocked,
    cosmeticImageSource,
    renderPremiumAvatarHTML,
    renderAvatarSVG,
    renderAvatarHTML,
    renderProfileBanner
  };

  document.addEventListener('DOMContentLoaded', () => {
    enhanceNavigation();
    setTimeout(checkLevelUpProgression, 400);
  });
})();
