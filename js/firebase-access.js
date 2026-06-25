import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import { getFirestore, doc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
import { firebaseConfig, fixedRoles, accessCollections } from './firebase-config.js';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);

const rolePrivileges = {
  Founder: ['manage_system', 'manage_roles', 'manage_community', 'evaluate_submissions', 'award_points', 'close_verified_problems'],
  'Co-Founder': ['manage_system', 'manage_roles', 'manage_community', 'evaluate_submissions', 'award_points', 'close_verified_problems'],
  Innovator: ['evaluate_submissions', 'award_points', 'close_verified_problems'],
  Evaluator: ['evaluate_submissions', 'award_points', 'close_verified_problems'],
  Steward: ['moderate_community'],
  Contributor: [],
  Member: []
};

async function setRoleAssignment({ email, displayName, role }) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanRole = fixedRoles.includes(role) ? role : 'Member';

  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('Enter a valid email address.');
  }

  await setDoc(doc(db, accessCollections.roleAssignments, cleanEmail), {
    displayName: String(displayName || '').trim() || cleanEmail.split('@')[0],
    role: cleanRole,
    privileges: rolePrivileges[cleanRole] || [],
    updatedAt: serverTimestamp()
  }, { merge: true });

  return {
    email: cleanEmail,
    role: cleanRole,
    privileges: rolePrivileges[cleanRole] || []
  };
}

window.TWSAccess = {
  fixedRoles,
  rolePrivileges,
  setRoleAssignment
};
