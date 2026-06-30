# Agent Instructions for Together We Solve

Last updated: 2026-06-30 (SEO indexability, robots.txt, and sitemap.xml added)

This file is the required first read for AI agents working in this workspace. Use it to understand the project quickly. Do not scan the whole repository unless the task requires it.

All AI agents, including Codex, Antigravity, and any future agent, must use the shared RAG knowledge base at `.agents/rag-knowledge-base.md` before reading broad source files. The RAG is the compact project memory that agents should consult instead of scanning the entire workspace.

## Project Summary

Together We Solve is a static web app for a community platform where people post problems, evaluate contributions, award points, manage roles, and browse impact/community pages.

The app is built with plain HTML, CSS, and browser JavaScript. It uses Firebase Authentication and Firestore through CDN ES module imports. There is no visible package manifest, bundler, framework, or local test runner in the workspace at the time of this update.

## Workspace Map

- `index.html`: public landing page with Schema JSON-LD structured data including founder profiles.
- `home.html`: signed-in/community home page.
- `signup.html`, `login.html`: authentication pages.
- `post-problem.html`, `open-frictions.html`, `my-frictions.html`: problem posting and browsing flows.
- `tasks.html`: member community task dashboard for available tasks, proof submissions, verification status, and task history.
- `leaderboard.html`, `hall-of-fame.html`, `impact-archive.html`, `members.html`, `core-team.html`: community and impact pages.
- `admin-dashboard.html`: superadmin management surface, including community task creation, categories, referrals auditing, and Cosmetics Manager panel.
- `evaluator-dashboard.html`: evaluator workflow for problem and task-submission verification.
- `referrals.html`: member referrals center and invitations hub.
- `supporting-partner-dashboard.html`: supporting partner workflow.
- `user-profile.html`, `user-settings.html`: account/profile surfaces. `user-settings.html` hosts the Avatar Builder and Banner Picker modals instead of image upload inputs.
- `marketplace.html`: cosmetics marketplace where members spend spendable Impact Points to acquire cosmetic items. Logic in `js/marketplace.js` and styles in `css/marketplace.css`.
- `inventory.html`: member cosmetics collection and progression road. Shows owned items and level-gated unlocks. Logic in `js/inventory.js` and styles in `css/inventory.css`.
- `firestore.rules`: Firestore authorization rules.
- `js/firebase-config.js`: Firebase project config, fixed roles, and collection names (includes `cosmetics` collection).
- `js/firebase-core.js`: shared Firebase CDN app/auth/Firestore initialization used by module scripts and shared data helpers.
- `js/firebase-access.js`: role assignment helper exposed as `window.TWSAccess`.
- `js/utils.js`: shared local data, Firebase access helpers, sessions, permissions, points, moderation, common utilities, avatar SVG rendering (`renderAvatarSVG`, `renderAvatarHTML`), banner rendering (`renderProfileBanner`), and all cosmetics Firestore operations (`loadCosmeticsAsync`, `saveCosmetic`, `deleteCosmetic`, `purchaseCosmetic`, `isCosmeticUnlocked`).
- `js/tasks.js`: member task browsing and proof submission flow.
- `js/*.js`: page-specific behavior. Read only the file matching the page you are changing plus shared files it imports or depends on.
- `css/styles.css`: global site styling.
- `css/ui-polish.css`: shared polish and UI refinements.
- `css/*.css`: page-specific styles.
- `css/tasks.css`: member task dashboard styles.
- `css/avatar-builder.css`: Avatar Builder and Banner Picker modal styles used by `user-settings.html`.
- `css/marketplace.css`: Marketplace page styles.
- `css/inventory.css`: Inventory and progression road styles.
- `assets/avatars/`: generated avatar PNG assets for the initial phase (founder, innovator, steward).
- `robots.txt`, `sitemap.xml`: search engine directives and fully indexable page definitions.
- `.agents/rag-knowledge-base.md`: shared RAG-style project knowledge base for all AI agents.
- `.agents/rag-maintenance.md`: protocol for keeping the RAG current with commits and durable project changes.
- `.agents/hooks/pre-commit.ps1`: optional local Git hook reminder for staged durable changes without staged RAG updates.
- `.agents/`: agent support material.

## Required Reading Order

For every task:

1. Read this `AGENTS.md`.
2. Read `.agents/rag-knowledge-base.md`.
3. Use the RAG fast routes to choose the smallest relevant source files.
4. Read the user-requested page or feature file only.
5. If behavior or data changes are involved, read `js/utils.js`, `js/firebase-config.js`, and relevant sections of `firestore.rules`.
6. If role, permission, dashboard, points, or evaluator logic changes are involved, also read `js/firebase-access.js`, `js/admin-dashboard.js`, and `js/evaluator-dashboard.js` as needed.
7. Read CSS only for the page or shared component you are changing.

Do not bulk-read every file. Prefer `rg` and targeted file reads.

## Environment Information

Available in this workspace:

- Windows PowerShell shell.
- Git repository metadata is readable.
- Write access inside `D:\TogetherWeSolve`.
- Static HTML/CSS/JS app files.
- Firebase web configuration in `js/firebase-config.js`.
- Firestore rules in `firestore.rules`.
- Browser-compatible Firebase CDN imports already used by the project.
- Local assets in `assets/`.

Not currently available or not assumed:

- No `package.json` is visible.
- No Node dependency install is assumed.
- No build pipeline is visible.
- No automated test command is visible.
- No Firebase CLI configuration is visible.
- No emulator setup is visible.
- No server-side backend code is visible.
- No private production database credentials beyond the public Firebase web config should be assumed.

Network and live service access may be restricted. If a task requires current external data, verify it with an approved source or ask for access. Do not invent data.

## Non-Negotiable Rules

- Never create placeholder, fake, mock, invented, or guessed data.
- Never hardcode sample users, fake counts, fake testimonials, fake partner details, fake metrics, fake problems, fake awards, or pretend live state.
- If real data is unavailable, show an empty state, loading state, permission message, or clear error state.
- Do not write comments inside code files. This includes JavaScript, CSS, HTML, and Firestore rules. Existing comments may be removed only when directly touching the surrounding code and doing so is safe.
- Keep changes scoped to the requested task.
- Do not rewrite unrelated pages, styles, or utilities.
- Do not revert user changes.
- Do not alter Firebase project config unless the user explicitly asks.
- Do not weaken Firestore security rules to make UI work.
- Preserve real authentication, role, and permission behavior.
- Prefer existing project patterns over new abstractions.
- Use plain browser JavaScript and existing CDN import style unless the project is intentionally migrated.

## Data Freshness Rule

Every agent must leave project context more up to date than they found it.

At the end of any completed task, update `.agents/rag-knowledge-base.md` if the task changes any of the following:

- Project structure.
- Available or unavailable tooling.
- Firebase collections, fields, roles, permissions, or rules.
- Required setup or verification steps.
- Major page responsibilities.
- Known constraints or required workflows.

Update this `AGENTS.md` only when the top-level agent instructions, reading order, or non-negotiable workflow changes. Update the `Last updated` date in any agent knowledge file that you change. If no durable project facts changed, do not edit agent knowledge files just to record activity.

Every commit that changes durable project facts must include the matching RAG knowledge-base update in the same commit. Use `.agents/rag-maintenance.md` for the commit-time checklist. The optional `.agents/hooks/pre-commit.ps1` hook can be installed locally to remind agents when staged durable files lack a staged RAG update.

When a task depends on external facts, current rules, pricing, schedules, APIs, library behavior, or live data, verify those facts at task time and keep any durable project notes current. Do not rely on stale memory.

## Implementation Guidance

- Use `rg` or targeted PowerShell commands for discovery.
- For static page testing, a local static server is usually enough.
- For UI changes, inspect the matching HTML, JS, and CSS together.
- For Firebase data changes, trace both the UI write path and `firestore.rules`.
- For permissions, keep client-side checks and Firestore rules aligned.
- Prefer real Firestore reads and writes where the app already uses them.
- Local storage fallback code must not masquerade as production data.
- Browser local storage fallback is development-only for `file:`, `localhost`, and `127.0.0.1`; deployed production hosts must use Firestore data, empty states, or surfaced errors.
- Keep empty states honest and useful.
- Keep text professional, concise, and user-facing.
- Maintain responsive layouts for desktop and mobile.

## Verification Expectations

Choose verification based on the task:

- HTML/CSS-only change: inspect affected page in a browser when possible.
- JavaScript behavior change: run the page locally and exercise the changed flow when possible.
- Firestore rules change: validate rule logic carefully and test against expected roles when tooling is available.
- Role or permission change: check both allowed and denied paths.
- Data display change: verify empty, loading, error, and populated states without fake content.

If verification cannot be run because tooling or access is unavailable, state exactly what was not verified.

## Current Known Data Model

Known Firestore collections from project config and rules:

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

Known fixed roles:

- `Founder`
- `Co-Founder`
- `Innovator`
- `Evaluator`
- `Steward`
- `Contributor`
- `Member`

Known dashboard access keys:

- `user`
- `evaluator`
- `superadmin`
- `supportingPartner`

Known privilege keys:

- `manage_system`
- `manage_roles`
- `manage_community`
- `manage_dashboards`
- `evaluate_submissions`
- `award_points`
- `close_verified_problems`
- `moderate_community`

Known community task fields:

- `communityTasks`: `title`, `description`, `category`, `difficulty`, `estimatedTime`, `expReward`, `impactPointReward`, `verificationRequirement`, `startDate`, `endDate`, `status`, `cadence`, `instructions`, `submissionGuidelines`, `createdBy`, `createdAt`, `updatedAt`
- `taskSubmissions`: `taskId`, `taskTitle`, `category`, `memberUid`, `memberEmail`, `memberName`, `memberUsername`, `description`, `reflection`, `attachments`, `links`, `proofHash`, `status`, `expReward`, `impactPointReward`, `evaluatorComments`, `evaluatorUid`, `evaluatorName`, `submittedAt`, `reviewedAt`, `history`
- `taskCategories`: `name`
- `notifications`: `userId`, `email`, `type`, `title`, `message`, `read`, `createdBy`, `createdAt`
- `referrals`: `id`, `inviterUid`, `inviterName`, `inviterUsername`, `inviteeUid`, `inviteeName`, `inviteeUsername`, `inviteeEmail`, `status`, `submittedAt`, `validationDate`, `rejectionReason`, `verifiedAt`, `inviteeIp`, `inviteeUserAgent`, `validationEvidence`, `fraudScore`, `history`
- `users`: `referralCode`, `referralTier`, `referralBadgeLevel`, `referredBy`, `referredByCode`, `stats.successfulReferrals`, `stats.pendingReferrals`, `stats.rejectedReferrals`, `stats.referralImpactPoints`, `stats.referralExperience`, `stats.lastCelebratedMilestone`
- `users.badges`: array of badge IDs. Badge metadata is defined in `js/utils.js` as `badgeCatalog`; use `window.TWS.normalizeBadges`, `window.TWS.resolveBadge`, and `window.TWS.badgeStorageValues` instead of hardcoding badge display details.
- `usernames`: username reservation documents keyed by normalized username. Fields: `uid`, `email`, `username`, `createdAt`, `updatedAt`. Keep `users.username` and `users.usernameLower` equal to the reservation document ID for that user's UID.
- `problems` archive display fields: `archiveSummary`, `archiveOutcome`, `archiveHoursSaved`, `archiveRippleReach`, `archiveClones`, `archiveViews`, `archiveEditedBy`, `archiveEditedAt`. These are edited from the superadmin Impact Archive panel and used by `impact-archive.html`; do not hardcode public archive counts.

Known automatic badge IDs:

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

Known admin-awarded badge IDs:

- `golden-heart`
- `deep-thinker`
- `root-sprouter`
- `constant-beacon`
- `sudden-light`
- `dignity-guard`
- `mentor-signal`
- `evidence-keeper`

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

Task rewards are verification-first: Community Task EXP and Impact Points are awarded only after an evaluator approves a `taskSubmissions` document. Automatic platform EXP uses `platformExperienceHistory` and `lastPlatformExperienceAward`; verified task rewards use `taskSubmissionHistory` and `lastTaskAward`.

Known `cosmetics` collection fields: `id`, `name`, `category`, `rarity`, `acquisition`, `reqLevel`, `reqAchievement`, `price`, `description`, `enabled`, `releaseDate`.

Known cosmetic acquisition types: `Level`, `Achievement`, `Marketplace`, `Role`.

Known cosmetic rarity values: `Common`, `Uncommon`, `Rare`, `Epic`, `Legendary`, `Mythic`.

Known cosmetic categories: `face`, `skinTone`, `hair`, `hairColor`, `eyebrows`, `eyes`, `eyeColor`, `mouth`, `facialHair`, `glasses`, `hat`, `accessories`, `clothing`, `clothingColor`, `jacket`, `backpack`, `background`, `backgroundColor`, `effect`, `frame`, `banner`, `premiumAvatar`.

Premium profile-picture avatars are cosmetics with `category: premiumAvatar`. They are equipped as `avatar:premium:{cosmeticId}` instead of layered avatar config strings. Use `assetPath` or `imageUrl` for the image source; local premium avatar images must live under `assets/avatars/`. Role-gated cosmetics use `acquisition: Role` and `reqRole` with one of the fixed roles.

Dual Impact Points model: `users.stats.totalImpactPoints` is the lifetime accumulated value and is never decreased — it controls leaderboard ranking. `users.stats.impactPoints` (and `users.points`) is the spendable balance, which decreases on marketplace purchases. The marketplace Firestore rules validate that a purchase deducts exactly the cost of the purchased cosmetic from the spendable balance and records the purchase in `users.ownedCosmetics`. Leaderboard sorting uses `totalImpactPoints`, not the spendable balance.

Keep this section updated if the schema changes.
