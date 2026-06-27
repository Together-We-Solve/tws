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
    showToast
  };

  document.addEventListener('DOMContentLoaded', () => {
    enhanceNavigation();
    setTimeout(checkLevelUpProgression, 400);
  });
})();
