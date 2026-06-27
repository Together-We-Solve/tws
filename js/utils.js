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
    return Number(stats.impactPoints ?? raw.impactPoints ?? stats.totalImpactPoints ?? raw.points) || 0;
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
      impactPoints: totalImpactPoints,
      points: totalImpactPoints,
      solved: problemsSolved,
      initials: raw.initials || initialsFromName(displayName),
      badges: normalizeBadges(raw.badges, raw),
      stats: { ...stats, experience, impactPoints: totalImpactPoints, totalImpactPoints, problemsSolved }
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
    const currentPoints = impactPointsFromStats(member);
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
        totalImpactPoints: currentPoints + points,
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
        menuBtn.setAttribute('aria-label', 'Toggle Navigation Menu');
        menuBtn.innerHTML = '<span></span><span></span><span></span>';
        const inner = nav.querySelector('.nav-inner');
        if (inner) {
          inner.appendChild(menuBtn);
        }
      }

      menuBtn.onclick = (e) => {
        e.stopPropagation();
        nav.classList.toggle('menu-open');
        if (nav.classList.contains('menu-open')) {
          document.body.style.overflow = 'hidden';
        } else {
          document.body.style.overflow = '';
        }
      };

      nav.querySelectorAll('.nav-link, .nav-cta').forEach(link => {
        link.addEventListener('click', () => {
          nav.classList.remove('menu-open');
          document.body.style.overflow = '';
        });
      });

      document.addEventListener('click', (e) => {
        if (nav.classList.contains('menu-open') && !nav.contains(e.target)) {
          nav.classList.remove('menu-open');
          document.body.style.overflow = '';
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
      { id: 'eyes-classic', name: 'Classic Eyes', category: 'eyes', rarity: 'Common', acquisition: 'Level', reqLevel: 1, description: 'Simple expressive eyes.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'eyes-happy', name: 'Happy Eyes', category: 'eyes', rarity: 'Common', acquisition: 'Level', reqLevel: 1, description: 'Cheerful squinting eyes.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'eyes-serious', name: 'Serious Eyes', category: 'eyes', rarity: 'Uncommon', acquisition: 'Level', reqLevel: 2, description: 'Determined focused gaze.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'eyes-winking', name: 'Winking Eye', category: 'eyes', rarity: 'Uncommon', acquisition: 'Level', reqLevel: 3, description: 'A friendly winking face.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'eyes-visor', name: 'Tech Visor', category: 'eyes', rarity: 'Legendary', acquisition: 'Achievement', reqAchievement: 'evidence-keeper', description: 'Analytical heads-up display.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'eye-brown', name: 'Brown Eyes', category: 'eyeColor', rarity: 'Common', acquisition: 'Level', reqLevel: 1, description: 'Classic brown eyes.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'eye-blue', name: 'Blue Eyes', category: 'eyeColor', rarity: 'Common', acquisition: 'Level', reqLevel: 1, description: 'Cool blue eyes.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'eye-green', name: 'Green Eyes', category: 'eyeColor', rarity: 'Uncommon', acquisition: 'Level', reqLevel: 2, description: 'Rich green eyes.', enabled: true, releaseDate: '2026-06-27' },
      { id: 'eye-purple', name: 'Purple Glow', category: 'eyeColor', rarity: 'Epic', acquisition: 'Marketplace', price: 8, description: 'Mystical purple glowing eyes.', enabled: true, releaseDate: '2026-06-27' },
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
    return false;
  }

  function renderAvatarSVG(config) {
    const skinColorMap = {
      'skin-peach': '#ffdbac',
      'skin-tan': '#f1c27d',
      'skin-olive': '#e0ac69',
      'skin-bronze': '#c68642',
      'skin-dark': '#8d5524',
      'skin-cyan': '#06b6d4',
      'skin-obsidian': '#1e293b',
      'skin-gold': '#fbbf24'
    };
    const hairColorMap = {
      'hair-black': '#1a1a1a',
      'hair-brown': '#624a3e',
      'hair-blonde': '#fcd34d',
      'hair-red': '#ef4444',
      'hair-silver': '#cbd5e1',
      'hair-green': '#22c55e',
      'hair-rainbow': 'url(#rainbow-hair)'
    };
    const eyeColorMap = {
      'eye-brown': '#451a03',
      'eye-blue': '#2563eb',
      'eye-green': '#16a34a',
      'eye-purple': '#8b5cf6'
    };
    const clothingColorMap = {
      'clothing-gray': '#6b7280',
      'clothing-moss': '#3d5a45',
      'clothing-clay': '#b85c37',
      'clothing-ocean': '#2c5e7a',
      'clothing-royal': '#4338ca',
      'clothing-orange': '#ea580c'
    };
    const bgColorMap = {
      'color-gray': '#4b5563',
      'color-teal': '#0d9488',
      'color-clay': '#c2410c',
      'color-violet': '#7c3aed',
      'color-gold': '#d97706',
      'color-slate': '#334155',
      'color-blue': '#2563eb',
      'color-green': '#16a34a',
      'color-rose': '#e11d48'
    };
    const skinTone = config.skinTone || 'skin-peach';
    const skinColor = skinColorMap[skinTone] || '#ffdbac';
    const neckColor = skinColor === '#ffdbac' ? '#e8c49a' : (skinColor === '#fbbf24' ? '#d97706' : 'rgba(0,0,0,0.15)');
    const hairColor = hairColorMap[config.hairColor] || '#1a1a1a';
    const eyeColor = eyeColorMap[config.eyeColor] || '#451a03';
    const clothingColor = clothingColorMap[config.clothingColor] || '#6b7280';
    const bgColor = bgColorMap[config.backgroundColor] || '#4b5563';
    let svg = `<svg viewBox="0 0 200 200" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">`;
    svg += `<defs>`;
    svg += `<linearGradient id="rainbow-hair" x1="0%" y1="0%" x2="100%" y2="100%">`;
    svg += `<stop offset="0%" stop-color="#ff0000"/><stop offset="20%" stop-color="#ff7f00"/><stop offset="40%" stop-color="#ffff00"/><stop offset="60%" stop-color="#00ff00"/><stop offset="80%" stop-color="#0000ff"/><stop offset="100%" stop-color="#8b00ff"/>`;
    svg += `</linearGradient>`;
    svg += `<radialGradient id="bg-radial-grad" cx="50%" cy="50%" r="50%">`;
    svg += `<stop offset="0%" stop-color="#ffffff" stop-opacity="0.3"/><stop offset="100%" stop-color="#000000" stop-opacity="0.2"/>`;
    svg += `</radialGradient>`;
    svg += `<pattern id="grid-pattern" width="20" height="20" patternUnits="userSpaceOnUse">`;
    svg += `<path d="M 20 0 L 0 0 0 20" fill="none" stroke="#ffffff" stroke-width="0.5" opacity="0.15"/>`;
    svg += `</pattern>`;
    svg += `</defs>`;
    const bgMap = {
      'bg-solid': `<rect width="200" height="200" fill="${bgColor}" />`,
      'bg-radial': `<rect width="200" height="200" fill="${bgColor}" /><rect width="200" height="200" fill="url(#bg-radial-grad)" />`,
      'bg-grid': `<rect width="200" height="200" fill="${bgColor}" /><rect width="200" height="200" fill="url(#grid-pattern)" />`,
      'bg-starfield': `<rect width="200" height="200" fill="${bgColor}" /><g fill="#ffffff" opacity="0.8"><circle cx="20" cy="30" r="1.5"/><circle cx="160" cy="40" r="1"/><circle cx="100" cy="20" r="1.2"/><circle cx="45" cy="90" r="1.5"/><circle cx="180" cy="120" r="1"/><circle cx="30" cy="150" r="1.2"/><circle cx="150" cy="160" r="1.5"/></g>`,
      'bg-matrix': `<rect width="200" height="200" fill="#020617" /><g fill="#22c55e" font-family="monospace" font-size="10" opacity="0.3"><text x="10" y="20">0</text><text x="30" y="40">1</text><text x="50" y="30">0</text><text x="70" y="50">1</text><text x="90" y="20">0</text><text x="110" y="60">1</text></g>`
    };
    svg += bgMap[config.background] || `<rect width="200" height="200" fill="${bgColor}" />`;
    const bpMap = {
      'canvas-straps': `<path d="M55 135 L60 170 M145 135 L140 170" stroke="#78350f" stroke-width="6" stroke-linecap="round" />`,
      'angel-wings': `<path d="M50 110 C20 70, 0 100, 20 140 C35 155, 60 145, 60 145 M150 110 C180 70, 200 100, 180 140 C165 155, 140 145, 140 145" fill="#f8fafc" stroke="#e2e8f0" stroke-width="2" />`,
      'jetpack-boosters': `<rect x="35" y="110" width="20" height="60" rx="5" fill="#64748b" /><rect x="145" y="110" width="20" height="60" rx="5" fill="#64748b" /><path d="M45 170 L40 190 L50 190 Z" fill="#f97316" /><path d="M155 170 L150 190 L160 190 Z" fill="#f97316" />`
    };
    svg += bpMap[config.backpack] || '';
    svg += `<rect x="90" y="110" width="20" height="30" fill="${skinColor}" /><rect x="90" y="110" width="20" height="15" fill="#000000" opacity="0.15" />`;
    const faceMap = {
      'face-round': `<ellipse cx="100" cy="85" rx="35" ry="38" fill="${skinColor}" />`,
      'face-oval': `<ellipse cx="100" cy="85" rx="32" ry="42" fill="${skinColor}" />`,
      'face-square': `<rect x="68" y="47" width="64" height="74" rx="14" fill="${skinColor}" />`,
      'face-heart': `<path d="M100 125 C68 102 60 70 70 56 C80 42 95 50 100 62 C105 50 120 42 130 56 C140 70 132 102 100 125 Z" fill="${skinColor}" />`,
      'face-chiseled': `<path d="M100 127 L68 90 L68 60 C68 45, 132 45, 132 60 L132 90 Z" fill="${skinColor}" />`,
      'face-cyborg': `<ellipse cx="100" cy="85" rx="35" ry="38" fill="#94a3b8" /><rect x="100" y="47" width="35" height="76" fill="#64748b" opacity="0.3" /><path d="M100 55 L133 80 L100 105 Z" fill="#ef4444" opacity="0.15" />`
    };
    svg += faceMap[config.face] || `<ellipse cx="100" cy="85" rx="35" ry="38" fill="${skinColor}" />`;
    const clothingMap = {
      'clothing-tshirt': `<path d="M50 135 C50 135, 60 135, 75 135 L125 135 C140 135, 150 135, 150 135 C170 145, 180 170, 180 200 L20 200 C20 170, 30 145, 50 135 Z" fill="${clothingColor}" /><path d="M85 135 A15 15 0 0 0 115 135 Z" fill="${skinColor}" />`,
      'clothing-polo': `<path d="M50 135 C50 135, 60 135, 75 135 L125 135 C140 135, 150 135, 150 135 C170 145, 180 170, 180 200 L20 200 C20 170, 30 145, 50 135 Z" fill="${clothingColor}" /><path d="M85 135 L100 155 L115 135 Z" fill="#ffffff" /><path d="M78 135 L100 150 L100 135 Z" fill="${clothingColor}" /><path d="M122 135 L100 150 L100 135 Z" fill="${clothingColor}" />`,
      'clothing-hoodie': `<path d="M50 135 C50 135, 60 135, 75 135 L125 135 C140 135, 150 135, 150 135 C170 145, 180 170, 180 200 L20 200 C20 170, 30 145, 50 135 Z" fill="${clothingColor}" /><path d="M70 135 Q100 160 130 135 Z" fill="#334155" /><circle cx="95" cy="165" r="2" fill="#e2e8f0" /><circle cx="105" cy="165" r="2" fill="#e2e8f0" /><path d="M95 165 L95 185 M105 165 L105 185" stroke="#e2e8f0" stroke-width="1.5" />`,
      'clothing-suit': `<path d="M50 135 C50 135, 60 135, 75 135 L125 135 C140 135, 150 135, 150 135 C170 145, 180 170, 180 200 L20 200 C20 170, 30 145, 50 135 Z" fill="#1e293b" /><path d="M85 135 L100 170 L115 135 Z" fill="#ffffff" /><path d="M97 140 L103 140 L100 170 Z" fill="#991b1b" /><path d="M50 135 L90 180 L90 135 Z" fill="#0f172a" /><path d="M150 135 L110 180 L110 135 Z" fill="#0f172a" />`,
      'clothing-space': `<path d="M50 135 C50 135, 60 135, 75 135 L125 135 C140 135, 150 135, 150 135 C170 145, 180 170, 180 200 L20 200 C20 170, 30 145, 50 135 Z" fill="#e2e8f0" /><rect x="80" y="145" width="40" height="30" rx="3" fill="#0284c7" /><circle cx="90" cy="160" r="4" fill="#ef4444" /><circle cx="105" cy="160" r="4" fill="#22c55e" /><path d="M50 135 L70 160 M150 135 L130 160" stroke="#94a3b8" stroke-width="4" />`
    };
    svg += clothingMap[config.clothing] || `<path d="M50 135 C50 135, 60 135, 75 135 L125 135 C140 135, 150 135, 150 135 C170 145, 180 170, 180 200 L20 200 C20 170, 30 145, 50 135 Z" fill="${clothingColor}" />`;
    const jacketMap = {
      'jacket-denim': `<path d="M50 135 L70 200 L40 200 C40 170, 30 145, 50 135 Z" fill="#1d4ed8" /><path d="M150 135 L130 200 L160 200 C160 170, 170 145, 150 135 Z" fill="#1d4ed8" /><path d="M50 135 L75 165 L75 135 Z" fill="#1e40af" /><path d="M150 135 L125 165 L125 135 Z" fill="#1e40af" />`,
      'jacket-leather': `<path d="M50 135 L70 200 L40 200 C40 170, 30 145, 50 135 Z" fill="#1e1b4b" /><path d="M150 135 L130 200 L160 200 C160 170, 170 145, 150 135 Z" fill="#1e1b4b" /><path d="M50 135 L75 165 L75 135 Z" fill="#0f0e30" /><path d="M150 135 L125 165 L125 135 Z" fill="#0f0e30" />`,
      'jacket-cape': `<path d="M48 135 C30 145, 15 170, 15 200 L185 200 C185 170, 170 145, 152 135 Z" fill="#7f1d1d" /><circle cx="100" cy="136" r="4" fill="#fbbf24" />`
    };
    svg += jacketMap[config.jacket] || '';
    const eyesMap = {
      'eyes-classic': `<circle cx="86" cy="82" r="5" fill="#ffffff" /><circle cx="114" cy="82" r="5" fill="#ffffff" /><circle cx="86" cy="82" r="2.5" fill="${eyeColor}" /><circle cx="114" cy="82" r="2.5" fill="${eyeColor}" />`,
      'eyes-happy': `<path d="M78 85 Q86 74 94 85" stroke="#333" stroke-width="4.5" fill="none" stroke-linecap="round" /><path d="M106 85 Q114 74 122 85" stroke="#333" stroke-width="4.5" fill="none" stroke-linecap="round" />`,
      'eyes-serious': `<path d="M78 78 L94 80" stroke="#333" stroke-width="3" stroke-linecap="round" /><path d="M122 78 L106 80" stroke="#333" stroke-width="3" stroke-linecap="round" /><circle cx="86" cy="85" r="4" fill="#ffffff" /><circle cx="114" cy="85" r="4" fill="#ffffff" /><circle cx="86" cy="85" r="2" fill="${eyeColor}" /><circle cx="114" cy="85" r="2" fill="${eyeColor}" />`,
      'eyes-winking': `<circle cx="86" cy="82" r="5" fill="#ffffff" /><circle cx="86" cy="82" r="2.5" fill="${eyeColor}" /><path d="M106 82 Q114 88 122 82" stroke="#333" stroke-width="4.5" fill="none" stroke-linecap="round" />`,
      'eyes-visor': `<rect x="70" y="72" width="60" height="18" rx="4" fill="#06b6d4" opacity="0.9" /><line x1="70" y1="81" x2="130" y2="81" stroke="#ffffff" stroke-width="2" opacity="0.6" />`
    };
    svg += eyesMap[config.eyes] || `<circle cx="86" cy="82" r="5" fill="#ffffff" /><circle cx="114" cy="82" r="5" fill="#ffffff" /><circle cx="86" cy="82" r="2.5" fill="${eyeColor}" /><circle cx="114" cy="82" r="2.5" fill="${eyeColor}" />`;
    const eyebrowsMap = {
      'eyebrows-flat': `<line x1="76" y1="71" x2="94" y2="71" stroke="#333" stroke-width="3.5" stroke-linecap="round" /><line x1="106" y1="71" x2="124" y2="71" stroke="#333" stroke-width="3.5" stroke-linecap="round" />`,
      'eyebrows-curved': `<path d="M76 73 Q85 66 94 71" stroke="#333" stroke-width="3.5" fill="none" stroke-linecap="round" /><path d="M106 71 Q115 66 124 73" stroke="#333" stroke-width="3.5" fill="none" stroke-linecap="round" />`,
      'eyebrows-angry': `<line x1="76" y1="67" x2="94" y2="73" stroke="#333" stroke-width="4" stroke-linecap="round" /><line x1="106" y1="73" x2="124" y2="67" stroke="#333" stroke-width="4" stroke-linecap="round" />`
    };
    svg += eyebrowsMap[config.eyebrows] || '';
    const mouthMap = {
      'mouth-neutral': `<line x1="92" y1="106" x2="108" y2="106" stroke="#333" stroke-width="3" stroke-linecap="round" />`,
      'mouth-smile': `<path d="M90 102 Q100 115 110 102" stroke="#333" stroke-width="3.5" fill="none" stroke-linecap="round" />`,
      'mouth-grin': `<path d="M88 102 Q100 118 112 102 Z" fill="#333" /><path d="M90 103 Q100 110 110 103" stroke="#ffffff" stroke-width="2.5" fill="none" />`,
      'mouth-smirk': `<path d="M90 105 Q95 108 108 103" stroke="#333" stroke-width="3.5" fill="none" stroke-linecap="round" />`,
      'mouth-frown': `<path d="M92 110 Q100 101 108 110" stroke="#333" stroke-width="3" fill="none" stroke-linecap="round" />`
    };
    svg += mouthMap[config.mouth] || `<line x1="92" y1="106" x2="108" y2="106" stroke="#333" stroke-width="3" stroke-linecap="round" />`;
    const facialHairMap = {
      'facialHair-stubble': `<path d="M70 95 C70 120, 130 120, 130 95 C130 130, 70 130, 70 95 Z" fill="#333" opacity="0.15" />`,
      'facialHair-mustache': `<path d="M88 102 Q100 96 112 102 C108 107, 92 107, 88 102 Z" fill="#1a1a1a" />`,
      'facialHair-beard': `<path d="M68 85 C68 128, 132 128, 132 85 C132 140, 68 140, 68 85 Z" fill="#1a1a1a" /><path d="M88 102 Q100 96 112 102 C108 107, 92 107, 88 102 Z" fill="#000" />`
    };
    svg += facialHairMap[config.facialHair] || '';
    const hairMap = {
      'hair-buzzcut': `<path d="M67 76 C65 42, 135 42, 133 76 C120 74, 80 74, 67 76 Z" fill="${hairColor}" opacity="0.75" />`,
      'hair-sidepart': `<path d="M65 74 C60 38, 140 38, 135 74 C110 52, 90 54, 65 74 Z" fill="${hairColor}" />`,
      'hair-spikes': `<path d="M65 72 C60 38, 140 38, 135 72 L125 45 L115 55 L100 35 L88 52 L78 40 Z" fill="${hairColor}" />`,
      'hair-afro': `<circle cx="100" cy="65" r="42" fill="${hairColor}" /><circle cx="70" cy="75" r="18" fill="${hairColor}" /><circle cx="130" cy="75" r="18" fill="${hairColor}" />`,
      'hair-longwaves': `<path d="M66 70 C60 35, 140 35, 134 70 C145 95, 148 130, 144 150 C130 110, 132 80, 130 75 C110 65, 90 65, 70 75 C68 80, 70 110, 56 150 C52 130, 55 95, 66 70 Z" fill="${hairColor}" />`,
      'hair-topknot': `<path d="M65 74 C60 38, 140 38, 135 74 C110 52, 90 54, 65 74 Z" fill="${hairColor}" /><circle cx="100" cy="30" r="14" fill="${hairColor}" /><rect x="96" y="38" width="8" height="6" fill="#f59e0b" />`,
      'hair-mohawk': `<path d="M92 40 Q100 15 108 40 L108 80 L92 80 Z" fill="${hairColor}" />`,
      'hair-wizard': `<path d="M60 90 L100 20 L140 90 Z" fill="#312e81" /><path d="M50 90 L150 90 L140 105 L60 105 Z" fill="#1e1b4b" /><circle cx="100" cy="45" r="3" fill="#f59e0b" />`
    };
    let activeHair = config.hair || 'hair-none';
    if (memory.cosmetics) {
      const dbCosmetic = memory.cosmetics.find(c => c.id === activeHair);
      if (dbCosmetic && dbCosmetic.svgContent) {
        let injected = dbCosmetic.svgContent.replace(/{hairColor}/g, hairColor);
        svg += injected;
      } else {
        svg += hairMap[activeHair] || '';
      }
    } else {
      svg += hairMap[activeHair] || '';
    }
    const glassesMap = {
      'glasses-round': `<circle cx="84" cy="82" r="14" fill="none" stroke="#000000" stroke-width="3" /><circle cx="116" cy="82" r="14" fill="none" stroke="#000000" stroke-width="3" /><line x1="98" y1="82" x2="102" y2="82" stroke="#000000" stroke-width="3" />`,
      'glasses-square': `<rect x="70" y="70" width="24" height="20" rx="3" fill="none" stroke="#333" stroke-width="3" /><rect x="106" y="70" width="24" height="20" rx="3" fill="none" stroke="#333" stroke-width="3" /><line x1="94" y1="78" x2="106" y2="78" stroke="#333" stroke-width="3" />`,
      'glasses-aviators': `<path d="M70 72 L94 76 L94 88 C94 94, 76 96, 70 88 Z" fill="rgba(30,41,59,0.7)" stroke="#d97706" stroke-width="2" /><path d="M130 72 L106 76 L106 88 C106 94, 124 96, 130 88 Z" fill="rgba(30,41,59,0.7)" stroke="#d97706" stroke-width="2" /><line x1="94" y1="75" x2="106" y2="75" stroke="#d97706" stroke-width="2.5" />`,
      'glasses-visor': `<rect x="68" y="72" width="64" height="18" rx="2" fill="#ec4899" opacity="0.8" /><line x1="68" y1="81" x2="132" y2="81" stroke="#ffffff" stroke-width="2" />`
    };
    svg += glassesMap[config.glasses] || '';
    const hatMap = {
      'hat-beanie': `<path d="M63 60 C63 35, 137 35, 137 60 Z" fill="#991b1b" /><rect x="58" y="55" width="84" height="12" rx="4" fill="#7f1d1d" /><circle cx="100" cy="30" r="6" fill="#ffffff" />`,
      'hat-cap': `<path d="M64 60 C64 35, 136 35, 136 60 Z" fill="#0369a1" /><path d="M125 55 L175 55 C175 55, 170 65, 125 65 Z" fill="#0284c7" />`,
      'hat-fedora': `<path d="M68 55 C70 30, 130 30, 132 55 Z" fill="#27272a" /><rect x="72" y="47" width="56" height="8" fill="#991b1b" /><ellipse cx="100" cy="55" rx="55" ry="6" fill="#18181b" />`,
      'hat-crown': `<path d="M68 62 L80 40 L92 55 L100 35 L108 55 L120 40 L132 62 Z" fill="#fbbf24" stroke="#d97706" stroke-width="2" /><circle cx="80" cy="38" r="3" fill="#ef4444" /><circle cx="100" cy="33" r="3" fill="#3b82f6" /><circle cx="120" cy="38" r="3" fill="#10b981" />`
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
      'accessories-earbuds': `<circle cx="65" cy="90" r="4" fill="#ffffff" /><circle cx="135" cy="90" r="4" fill="#ffffff" />`,
      'accessories-scar': `<path d="M72 90 L80 102 M76 96 L82 94" stroke="#991b1b" stroke-width="2" stroke-linecap="round" />`,
      'accessories-headphones': `<rect x="58" y="78" width="10" height="24" rx="3" fill="#1e293b" /><rect x="132" y="78" width="10" height="24" rx="3" fill="#1e293b" /><path d="M63 78 C63 35, 137 35, 137 78" fill="none" stroke="#1e293b" stroke-width="6" />`
    };
    svg += accessoriesMap[config.accessories] || '';
    const effectMap = {
      'effect-leaves': `<g fill="#10b981" opacity="0.6"><path d="M30 40 Q40 35 35 48 Z"/><path d="M170 60 Q160 55 165 68 Z"/><path d="M25 120 Q35 115 30 128 Z"/><path d="M175 140 Q165 135 170 148 Z"/></g>`,
      'effect-sparkles': `<g fill="#eab308" opacity="0.85"><path d="M20 50 L23 43 L30 40 L23 37 L20 30 L17 37 L10 40 L17 43 Z"/><path d="M180 80 L182 75 L188 73 L182 71 L180 66 L178 71 L172 73 L178 75 Z"/><path d="M35 150 L37 145 L43 143 L37 141 L35 136 L33 141 L27 143 L33 145 Z"/></g>`,
      'effect-glitch': `<g fill="#f43f5e" opacity="0.7"><rect x="15" y="45" width="20" height="4" /><rect x="165" y="95" width="20" height="4" fill="#06b6d4" /><rect x="45" y="15" width="12" height="3" /><rect x="135" y="165" width="15" height="3" fill="#eab308" /></g>`,
      'effect-fire': `<path d="M30 180 Q10 140 35 110 Q45 135 35 180" fill="#f97316" opacity="0.4" /><path d="M170 180 Q190 140 165 110 Q155 135 165 180" fill="#f97316" opacity="0.4" />`
    };
    svg += effectMap[config.effect] || '';
    const frameMap = {
      'frame-silver': `<circle cx="100" cy="100" r="97" fill="none" stroke="#94a3b8" stroke-width="5" />`,
      'frame-laurel': `<circle cx="100" cy="100" r="97" fill="none" stroke="#fbbf24" stroke-width="4" /><g fill="#fbbf24"><path d="M15 100 Q5 80 15 60 A97 97 0 0 1 15 100 Z"/><path d="M185 100 Q195 80 185 60 A97 97 0 0 0 185 100 Z"/></g>`,
      'frame-neon': `<circle cx="100" cy="100" r="97" fill="none" stroke="#06b6d4" stroke-width="5" stroke-linecap="round" stroke-dasharray="60 30" />`,
      'frame-diamond': `<circle cx="100" cy="100" r="97" fill="none" stroke="#a855f7" stroke-width="4" /><g fill="#c084fc"><polygon points="100,2 104,8 100,14 96,8" /><polygon points="100,198 104,192 100,186 96,192" /><polygon points="2,100 8,104 14,100 8,96" /><polygon points="198,100 192,104 186,100 192,96" /></g>`
    };
    svg += frameMap[config.frame] || '';
    svg += `</svg>`;
    return svg;
  }

  function renderAvatarHTML(user) {
    if (!user) return `<div class="avatar-initials">TW</div>`;
    const avatarStr = user.avatar || user.profilePicture || '';
    if (avatarStr.startsWith('avatar:config:')) {
      try {
        const config = JSON.parse(avatarStr.slice('avatar:config:'.length));
        return renderAvatarSVG(config);
      } catch (e) {
        console.warn('Error parsing avatar config', e);
      }
    } else if (avatarStr.startsWith('http://') || avatarStr.startsWith('https://') || avatarStr.startsWith('data:')) {
      return `<img src="${escapeHTML(avatarStr)}" alt="${escapeHTML(user.displayName || 'Avatar')}" style="width: 100%; height: 100%; object-fit: cover;" />`;
    }
    const initials = user.initials || initialsFromName(user.displayName || user.name || 'TW');
    return `<div class="avatar-initials" style="display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; font-family: var(--font-display); font-weight: 500;">${escapeHTML(initials)}</div>`;
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
        bg: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        svg: `<svg style="position:absolute;width:100%;height:100%;left:0;top:0" xmlns="http://www.w3.org/2000/svg"><pattern id="techPattern" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M0 40 L40 0 M0 0 L40 40" fill="none" stroke="#38bdf8" stroke-width="0.5" opacity="0.1"/><circle cx="20" cy="20" r="4" fill="#38bdf8" opacity="0.15"/></pattern><rect width="100%" height="100%" fill="url(#techPattern)"/></svg>`
      },
      'banner-nature': {
        bg: 'linear-gradient(135deg, #065f46 0%, #047857 100%)',
        svg: `<svg style="position:absolute;width:100%;height:100%;left:0;top:0" xmlns="http://www.w3.org/2000/svg"><g fill="#34d399" opacity="0.1"><path d="M20 40 C10 60, 40 80, 50 60 C60 40, 30 20, 20 40 Z"/><path d="M220 50 C210 70, 240 90, 250 70 C260 50, 230 30, 220 50 Z"/></g></svg>`
      },
      'banner-space': {
        bg: 'radial-gradient(circle, #1e1b4b 0%, #020617 100%)',
        svg: `<svg style="position:absolute;width:100%;height:100%;left:0;top:0" xmlns="http://www.w3.org/2000/svg"><g fill="#ffffff" opacity="0.3"><circle cx="40" cy="50" r="1.5"/><circle cx="120" cy="30" r="1"/><circle cx="280" cy="80" r="2"/><circle cx="340" cy="40" r="1"/><circle cx="460" cy="70" r="1.5"/><circle cx="580" cy="30" r="1"/></g></svg>`
      },
      'banner-sea': {
        bg: 'linear-gradient(135deg, #0c4a6e 0%, #0369a1 100%)',
        svg: `<svg style="position:absolute;width:100%;height:100%;left:0;top:0" xmlns="http://www.w3.org/2000/svg"><path d="M0 60 Q150 40, 300 60 T600 60 L600 120 L0 120 Z" fill="#38bdf8" opacity="0.08"/></svg>`
      },
      'banner-abstract': {
        bg: 'linear-gradient(135deg, #581c87 0%, #4338ca 100%)',
        svg: `<svg style="position:absolute;width:100%;height:100%;left:0;top:0" xmlns="http://www.w3.org/2000/svg"><circle cx="10%" cy="50%" r="80" fill="#a855f7" opacity="0.15" filter="blur(20px)"/><circle cx="80%" cy="30%" r="100" fill="#6366f1" opacity="0.2" filter="blur(30px)"/></svg>`
      },
      'banner-founder': {
        bg: 'linear-gradient(135deg, #78350f 0%, #b45309 100%)',
        svg: `<svg style="position:absolute;width:100%;height:100%;left:0;top:0" xmlns="http://www.w3.org/2000/svg"><g fill="#fbbf24" opacity="0.1"><polygon points="0,0 50,0 25,50"/><polygon points="200,0 250,0 225,50"/></g></svg>`
      },
      'banner-referrals': {
        bg: 'linear-gradient(135deg, #115e59 0%, #0f766e 100%)',
        svg: `<svg style="position:absolute;width:100%;height:100%;left:0;top:0" xmlns="http://www.w3.org/2000/svg"><pattern id="refPattern" width="30" height="30" patternUnits="userSpaceOnUse"><circle cx="15" cy="15" r="3" fill="#2dd4bf" stroke="none" opacity="0.15"/></pattern><rect width="100%" height="100%" fill="url(#refPattern)"/></svg>`
      },
      'banner-community': {
        bg: 'linear-gradient(135deg, #881337 0%, #9f1239 100%)',
        svg: `<svg style="position:absolute;width:100%;height:100%;left:0;top:0" xmlns="http://www.w3.org/2000/svg"><g stroke="#f43f5e" stroke-width="1" fill="none" opacity="0.15"><circle cx="100" cy="50" r="30"/><circle cx="130" cy="50" r="30"/><circle cx="160" cy="50" r="30"/></g></svg>`
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
    renderAvatarSVG,
    renderAvatarHTML,
    renderProfileBanner
  };

  document.addEventListener('DOMContentLoaded', () => {
    enhanceNavigation();
    setTimeout(checkLevelUpProgression, 400);
  });
})();
