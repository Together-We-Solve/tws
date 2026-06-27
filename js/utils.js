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
      ['badges', current.badges || [], next.badges || []],
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
      ['badges', current.badges || [], next.badges || []],
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
      if (isPermissionDeniedError(err)) throw err;
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
      badges: Array.isArray(raw.badges) ? raw.badges : [],
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

    let firestoreUsers = [];
    try {
      firestoreUsers = await fetchCollectionSafe(configModule.accessCollections.users, local.users);
    } catch (err) {
      console.warn('Firebase users collection is not readable for this session; loading local members.', err);
      firestoreUsers = local.users;
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
      if (isPermissionDeniedError(err)) throw err;
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
      if (isPermissionDeniedError(err)) throw err;
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
    if (!isCreate && systemUserFieldsChanged(currentUser, payload) && !canManageSystem(session)) {
      throw new Error('permission-denied');
    }
    if (!isCreate && progressionUserFieldsChanged(currentUser, payload) && !canAwardPoints(session)) {
      throw new Error('permission-denied');
    }
    if (isCreate && !ownProfile && !canManageSystem(session)) {
      throw new Error('permission-denied');
    }
    try {
      const { configModule } = await getFirebaseDataApiSafe();
      await saveDocument(configModule.accessCollections.users, userId, payload);
    } catch (err) {
      if (isPermissionDeniedError(err)) throw err;
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
    const session = getPortalSession();
    if (!canManageSystem(session)) {
      throw new Error('permission-denied');
    }
    try {
      const { configModule } = await getFirebaseDataApiSafe();
      await deleteDocument(configModule.accessCollections.users, userId);
    } catch (err) {
      if (isPermissionDeniedError(err)) throw err;
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
    const session = getPortalSession();
    const ownsPartner = session && (data.ownerUid === session.uid || data.email === String(session.email || '').toLowerCase());
    if (!canManageSystem(session) && !ownsPartner) {
      throw new Error('permission-denied');
    }
    try {
      const { configModule } = await getFirebaseDataApiSafe();
      await saveDocument(configModule.accessCollections.partners, partnerId, data);
    } catch (err) {
      if (isPermissionDeniedError(err)) throw err;
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
      if (isPermissionDeniedError(err)) throw err;
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

  function memberPrefix(pointsOrMember) {
    if (typeof pointsOrMember === 'object' && pointsOrMember) {
      return pointsOrMember.progression?.label || progressionFromExperience(experienceFromStats(pointsOrMember)).label;
    }
    return progressionFromExperience(0).label;
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
    safeExternalUrl,
    toUsername,
    initialsFromName,
    progressionRanks,
    administrativeRoles,
    defaultImpactRewards,
    levelRequirement,
    progressionFromExperience,
    experienceForProgression,
    impactPointsFromStats,
    experienceFromStats,
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
    ensureSolverProfile
  };

  document.addEventListener('DOMContentLoaded', enhanceNavigation);
})();
