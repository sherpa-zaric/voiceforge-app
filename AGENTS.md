# AGENTS.md

## Quick Start

```bash
pnpm dev          # Dev server (Turbopack)
pnpm build        # Production build
pnpm db:push      # Push schema changes
pnpm db:studio    # Open Drizzle Studio
```

## Project

TTS SaaS built on ShipAny template (v1.8.3). Uses MiMo TTS API (Xiaomi) for speech synthesis.

**Stack**: Next.js 16, React 19, TypeScript, TailwindCSS 4, Drizzle ORM, better-auth, pnpm

## Rules

### MiMo API

- Base URL: `https://token-plan-sgp.xiaomimimo.com/v1` (NOT token-plan-cn)
- Auth header: `api-key` (not `Bearer`)
- Endpoint: `{baseUrl}/chat/completions`
- Env vars: `MIMO_API_KEY`, `MIMO_BASE_URL`

### TTS Models

| Model | Use Case | Credits/char |
|-------|----------|--------------|
| `mimo-v2.5-tts` | Preset voices | 1 |
| `mimo-v2.5-tts-voicedesign` | Text-described voices | 2 |
| `mimo-v2.5-tts-voiceclone` | Voice cloning | 3 |

### Audio Format

- WAV: 24kHz, 16-bit, mono
- Style injection: `<style>...</style>` prefix in assistant content

### SQLite

- `consumeCredits` must set `createdAt` and `updatedAt` explicitly to `new Date()`
- SQLite has no `now()` function (that's PostgreSQL)

## Architecture

```
src/
├── app/api/
│   ├── tts/route.ts           # Preset voice TTS
│   ├── voice-design/route.ts  # Voice design
│   ├── voice-clone/route.ts   # Voice cloning
│   └── ai/
│       ├── generate/route.ts  # Task creation
│       └── query/route.ts     # Task status query
├── shared/
│   ├── lib/tts.ts             # Core TTS functions
│   └── models/
│       ├── ai_task.ts         # Task model (create/update/query)
│       └── credit.ts          # Credit system
└── config/db/
    └── schema.sqlite.ts       # Database schema
```

## AI Task System

Uses ShipAny's built-in task system for background processing.

**Key functions** (all in `src/shared/models/ai_task.ts`):
- `createAITask()` - Creates task + consumes credits in transaction
- `updateAITaskById()` - Updates status, revokes credits on failure
- `getAITasks()` / `getAITasksCount()` - Query with filters

**Status flow**:
```
PENDING → PROCESSING → SUCCESS
                    → FAILED (credits revoked)
                    → PAUSED (partial progress saved)
```

**Activity page**: `/activity/ai-tasks` with tabs: all, music, image, video, audio, text

**Important**: `mediaType` must match tab names (use `'audio'` for TTS, not `'speech'`)

## Conventions

- Use `getUuid()` for task IDs
- Always check `getRemainingCredits()` before processing
- Pass `userEmail` to `consumeCredits()`
- Store task options as JSON string: `JSON.stringify({ voice, style })`
