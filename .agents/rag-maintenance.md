# RAG Maintenance Protocol

Last updated: 2026-06-29

This protocol keeps the shared agent knowledge base current across Codex, Antigravity, and any other AI agent working in this repository.

## Required Agent Flow

1. Read `AGENTS.md`.
2. Read `.agents/rag-knowledge-base.md`.
3. Use the knowledge base to choose the smallest set of source files needed for the task.
4. Make the requested changes.
5. Before finishing, decide whether durable project knowledge changed.
6. If durable knowledge changed, update `.agents/rag-knowledge-base.md` and `AGENTS.md` if the top-level agent instructions also need to change.

## Commit Rule

Every commit that changes durable project facts must include the matching RAG update. Durable facts include:

- New, renamed, or removed pages, scripts, stylesheets, assets directories, config files, rules files, or agent-support files.
- Firebase collection, field, role, privilege, dashboard, status, permission, points, rewards, or rules changes.
- New setup, verification, local server, deployment, or tooling requirements.
- Changed ownership of page behavior or shared helper APIs.
- New constraints that future agents must know before reading source code.

Commits that only change copy, visual polish, or narrow implementation internals do not need a RAG update unless they alter one of the durable facts above.

## Pre-Commit Self Check

Before committing, run this mental check:

- Did I add, remove, or rename a file that future agents need to know exists?
- Did I change data shape, permissions, roles, rewards, statuses, or Firestore rules?
- Did I add tooling, scripts, local setup, dependencies, or verification steps?
- Did I change where a major feature lives?
- Would a future agent make a bad assumption if the RAG stayed as-is?

If any answer is yes, update `.agents/rag-knowledge-base.md` in the same commit.

## Suggested Git Hook

Git hooks are local and are not tracked by default. To enforce a reminder locally, copy the tracked hook template from `.agents/hooks/pre-commit.ps1` into your local Git hook setup, or invoke it from `.git/hooks/pre-commit`.

The hook only reminds agents when staged durable files change without a staged RAG update. It does not replace human judgment.
