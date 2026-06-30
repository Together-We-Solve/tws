# Together We Solve Agent RAG Knowledge Base

Last updated: 2026-06-30

Use this file as the shared retrieval knowledge base for Codex, Antigravity, and every other AI agent working in this repository. Read this before opening broad source files. Treat it as a compact map of stable project facts, retrieval routes, and update obligations.

## Retrieval Contract

- Start with `AGENTS.md`, then this file, then the smallest matching source files.
- Do not scan the whole workspace unless a task explicitly needs a repo-wide audit.
- Prefer `rg` for exact symbol, field, collection, page, and CSS selector lookup.
- Read only the page, script, stylesheet, shared utility, and rules sections that are directly related to the task.
- If this knowledge base conflicts with source code, trust the source code and update this file before finishing.
- If durable project facts change, update this file in the same commit or completed task.

## Fast Routes

| Task area | Start here | Then read |
| --- | --- | --- |
| Landing or public content | `index.html` | `css/styles.css`, matching `js/*.js` if present |
| Authentication | `signup.html`, `login.html` | `js/utils.js`, `js/firebase-core.js`, `js/firebase-config.js`, `firestore.rules` |
| Problem posting or browsing | `post-problem.html`, `open-frictions.html`, `my-frictions.html` | matching `js/*.js`, `js/utils.js`, `firestore.rules` |
| Community tasks | `tasks.html`, `js/tasks.js` | `css/tasks.css`, `js/utils.js`, `firestore.rules` |
| Evaluator workflow | `evaluator-dashboard.html`, `js/evaluator-dashboard.js` | `js/firebase-access.js`, `js/utils.js`, `firestore.rules` |
| Admin workflow | `admin-dashboard.html`, `js/admin-dashboard.js` | `js/firebase-access.js`, `js/utils.js`, `firestore.rules` |
| Supporting partner workflow | `supporting-partner-dashboard.html` | matching `js/*.js`, `js/firebase-access.js`, `firestore.rules` |
| Referrals | `referrals.html` | matching `js/*.js`, `js/utils.js`, `firestore.rules` |
| Members, leaderboard, impact pages | `members.html`, `leaderboard.html`, `hall-of-fame.html`, `impact-archive.html`, `core-team.html` | matching `js/*.js`, page CSS, `js/utils.js` for shared render/data helpers |
| Profile and settings | `user-profile.html`, `user-settings.html` | `css/avatar-builder.css`, matching `js/*.js`, `js/utils.js` |
| Marketplace and inventory | `marketplace.html`, `inventory.html` | `js/marketplace.js`, `js/inventory.js`, `css/marketplace.css`, `css/inventory.css`, `js/utils.js`, `firestore.rules` |
| Firebase config or roles | `js/firebase-config.js` | `js/firebase-access.js`, `js/utils.js`, `firestore.rules` |
| Firestore rules | `firestore.rules` | UI write paths in matching `js/*.js` and shared helpers |

## Architecture Snapshot

- Static browser app with plain HTML, CSS, and JavaScript.
- Firebase Authentication and Firestore are imported from CDN ES modules.
- No visible `package.json`, bundler, framework, local test runner, Firebase CLI config, emulator config, or server backend is assumed.
- Shared Firebase initialization lives in `js/firebase-core.js`.
- Fixed roles, collection names, and Firebase web config live in `js/firebase-config.js`.
- Shared auth/session/data helpers, avatar rendering, banner rendering, points logic, moderation helpers, badges, and cosmetics operations live in `js/utils.js`.
- Role assignment and dashboard access helpers are exposed through `window.TWSAccess` in `js/firebase-access.js`.
- Page-specific behavior should stay in the matching `js/*.js` file.
- Global styles live in `css/styles.css`; shared refinements live in `css/ui-polish.css`; page/component styles live in matching CSS files.

## Data Integrity Rules

- Never invent sample users, counts, partner records, testimonials, metrics, problems, awards, or live state.
- Use real Firestore reads and writes where the app already uses Firestore.
- Empty data should render as an honest empty state, loading state, permission message, or error state.
- Local storage fallback is development-only for `file:`, `localhost`, and `127.0.0.1`.
- Production hosts must use Firestore data, empty states, or surfaced errors.
- Do not weaken Firestore rules to make client UI pass.
- Keep client-side permission checks aligned with `firestore.rules`.

## Known Collections

- `users`
- `usernames`
- `roleAssignments`
- `problems`
- `supportingPartners`
- `settings`
- `communityTasks`
- `taskSubmissions`
- `taskCategories`
- `notifications`
- `referrals`
- `cosmetics`

## Roles, Dashboards, Privileges

Fixed roles:

- `Founder`
- `Co-Founder`
- `Innovator`
- `Evaluator`
- `Steward`
- `Contributor`
- `Member`

Dashboard access keys:

- `user`
- `evaluator`
- `superadmin`
- `supportingPartner`

Privilege keys:

- `manage_system`
- `manage_roles`
- `manage_community`
- `manage_dashboards`
- `evaluate_submissions`
- `award_points`
- `close_verified_problems`
- `moderate_community`

## Current Data Model Notes

- `communityTasks`: `title`, `description`, `category`, `difficulty`, `estimatedTime`, `expReward`, `impactPointReward`, `verificationRequirement`, `startDate`, `endDate`, `status`, `cadence`, `instructions`, `submissionGuidelines`, `createdBy`, `createdAt`, `updatedAt`
- `taskSubmissions`: `taskId`, `taskTitle`, `category`, `memberUid`, `memberEmail`, `memberName`, `memberUsername`, `description`, `reflection`, `attachments`, `links`, `proofHash`, `status`, `expReward`, `impactPointReward`, `evaluatorComments`, `evaluatorUid`, `evaluatorName`, `submittedAt`, `reviewedAt`, `history`
- `taskCategories`: `name`
- `notifications`: `userId`, `email`, `type`, `title`, `message`, `read`, `createdBy`, `createdAt`
- `referrals`: `id`, `inviterUid`, `inviterName`, `inviterUsername`, `inviteeUid`, `inviteeName`, `inviteeUsername`, `inviteeEmail`, `status`, `submittedAt`, `validationDate`, `rejectionReason`, `verifiedAt`, `inviteeIp`, `inviteeUserAgent`, `validationEvidence`, `fraudScore`, `history`
- `users`: `referralCode`, `referralTier`, `referralBadgeLevel`, `referredBy`, `referredByCode`, `stats.successfulReferrals`, `stats.pendingReferrals`, `stats.rejectedReferrals`, `stats.referralImpactPoints`, `stats.referralExperience`, `stats.lastCelebratedMilestone`
- `users.badges`: array of badge IDs. Badge metadata is defined in `js/utils.js` as `badgeCatalog`; use `window.TWS.normalizeBadges`, `window.TWS.resolveBadge`, and `window.TWS.badgeStorageValues`.
- `usernames`: username reservation documents keyed by normalized username. Fields: `uid`, `email`, `username`, `createdAt`, `updatedAt`. Keep `users.username` and `users.usernameLower` equal to the reservation document ID for that user's UID.
- `problems` archive display fields: `archiveSummary`, `archiveOutcome`, `archiveHoursSaved`, `archiveRippleReach`, `archiveClones`, `archiveViews`, `archiveEditedBy`, `archiveEditedAt`.

## Badges

Automatic badge IDs:

- `first-step`
- `friction-spotter`
- `verified-impact`
- `task-finisher`
- `solution-builder`
- `impact-100`
- `impact-500`
- `impact-1000`
- `referral-connector-l1`
- `referral-connector-l2`
- `referral-connector-l3`
- `referral-connector-l4`
- `referral-connector-l5`

Admin-awarded badge IDs:

- `golden-heart`
- `deep-thinker`
- `root-sprouter`
- `constant-beacon`
- `sudden-light`
- `dignity-guard`
- `mentor-signal`
- `evidence-keeper`

## Task and Reward Statuses

Known task statuses:

- `Draft`
- `Published`
- `Archived`

Known task submission statuses:

- `In Progress`
- `Pending Verification`
- `Approved`
- `Rejected`
- `Information Requested`
- `Flagged`

Community Task EXP and Impact Points are awarded only after an evaluator approves a `taskSubmissions` document. Automatic platform EXP uses `platformExperienceHistory` and `lastPlatformExperienceAward` (restricted to max 500 EXP and whitelisted actions: `profile_completion`, `first_login`, `daily_visit`, `problem_post`, `referral_milestone`); verified task rewards use `taskSubmissionHistory` and `lastTaskAward`.

## Cosmetics

Known `cosmetics` collection fields:

- `id`
- `name`
- `category`
- `rarity`
- `acquisition`
- `reqLevel`
- `reqAchievement`
- `price`
- `description`
- `enabled`
- `releaseDate`

Acquisition types:

- `Level`
- `Achievement`
- `Marketplace`
- `Role`

Rarity values:

- `Common`
- `Uncommon`
- `Rare`
- `Epic`
- `Legendary`
- `Mythic`

Categories:

- `face`
- `skinTone`
- `hair`
- `hairColor`
- `eyebrows`
- `eyes`
- `eyeColor`
- `mouth`
- `facialHair`
- `glasses`
- `hat`
- `accessories`
- `clothing`
- `clothingColor`
- `jacket`
- `backpack`
- `background`
- `backgroundColor`
- `effect`
- `frame`
- `banner`
- `premiumAvatar`
- `adminRoleAvatar`

Premium profile-picture avatars and admin role-based avatars use `category: premiumAvatar` or `category: adminRoleAvatar`, equip as `avatar:premium:{cosmeticId}`, and use `assetPath` or `imageUrl`. Local premium and role avatar images live under `assets/avatars/`. Role-gated cosmetics use `acquisition: Role` and `reqRole` with one of the fixed roles.

## Impact Points

- `users.stats.totalImpactPoints` is lifetime accumulated impact and is never decreased.
- `users.stats.totalImpactPoints` controls leaderboard ranking.
- `users.stats.impactPoints` and `users.points` are spendable balances.
- Marketplace purchases decrease spendable balance only.
- Marketplace Firestore rules validate exact deduction and ownership recording in `users.ownedCosmetics`.

## Verification Defaults

- HTML/CSS-only change: inspect the affected page in a browser when possible.
- JavaScript behavior change: run the page locally and exercise the changed flow when possible.
- Firestore rules change: validate rule logic carefully and test expected allowed and denied paths when tooling exists.
- Role or permission change: check both client checks and Firestore rules.
- Data display change: verify loading, empty, error, and populated paths without fake content.

## RAG Maintenance Checklist

Update this file when a task changes:

- Project structure or file responsibilities.
- Available or unavailable tooling.
- Firebase collections, fields, rules, roles, dashboards, privileges, statuses, rewards, or permissions.
- Shared helper APIs or page ownership.
- Required setup, verification, or deployment workflow.
- Durable constraints that future agents need before reading source code.

When updating:

1. Change `Last updated` to the current date.
2. Add or revise the smallest relevant fact.
3. Remove stale facts instead of keeping competing versions.
4. Keep this file compact enough to read before source files.
5. Include the update in the same commit as the code or rule change that made it necessary.
