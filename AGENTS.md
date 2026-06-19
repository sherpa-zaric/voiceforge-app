# AGENTS.md

## Quick Start

```bash
pnpm dev          # Dev server (webpack; clears .next/dev first)
pnpm dev:turbo    # Optional Turbopack dev server
pnpm build        # Production build
pnpm db:push      # Push schema changes
pnpm db:studio    # Open Drizzle Studio
```

## Project

FieldBrief AI built on ShipAny template (v1.8.3). It turns voice notes, voicemails, and field memos into structured professional reports.

**Stack**: Next.js 16, React 19, TypeScript, TailwindCSS 4, Drizzle ORM, better-auth, pnpm

## Product

Primary workflows live under `/tools`:

| Tool                   | Route                           | Cost             |
| ---------------------- | ------------------------------- | ---------------- |
| Construction Daily Log | `/tools/construction-daily-log` | 5 credits/report |
| Voicemail to Job Brief | `/tools/voicemail-to-job-brief` | 5 credits/report |
| Punch List             | `/tools/punch-list`             | 5 credits/report |

New users receive `300` trial credits for `7` days unless overridden in admin settings or environment config.

## Architecture

```
src/
├── app/api/
│   └── workflow/
│       └── report/route.ts    # FieldBrief report generation
├── app/[locale]/(landing)/
│   ├── components/
│   │   └── fieldbrief-workspace.tsx
│   └── tools/                 # Tool listing and per-tool pages
├── shared/
│   ├── lib/fieldbrief.ts      # FieldBrief templates and report formatter
│   └── models/
│       ├── ai_task.ts         # Task model (create/update/query)
│       └── credit.ts          # Credit system and trial credits
└── config/db/
    └── schema.sqlite.ts       # Database schema
```

## AI Task System

Uses ShipAny's built-in task system for report history and credit consumption.

**Key functions**:

- `createAITask()` in `src/shared/models/ai_task.ts` creates task records and consumes credits in a transaction.
- `getAITasks()` / `getAITasksCount()` power activity history.
- `grantCreditsForNewUser()` in `src/shared/models/credit.ts` grants free trial credits.

**FieldBrief conventions**:

- Use `mediaType: 'text'` for FieldBrief reports.
- Use provider `fieldbrief`.
- Store report output in `taskResult` as JSON: `JSON.stringify({ report })`.
- Store task options as JSON: `JSON.stringify({ templateId, sourceType, context })`.

## SQLite

- `consumeCredits` and credit grants must set `createdAt` and `updatedAt` explicitly to `new Date()`.
- SQLite has no PostgreSQL-style `now()` function.

## Conventions

- Use `getUuid()` for task IDs.
- Always check `getRemainingCredits()` before processing.
- Pass `userEmail` to `createAITask()` so credit records stay auditable.
- Keep legacy audio generation code out of the product; FieldBrief is the active workflow surface.
