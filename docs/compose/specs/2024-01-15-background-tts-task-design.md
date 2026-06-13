# Background TTS Task System Design

## [S1] Problem

Currently, TTS generation is synchronous - users must wait for the API to complete before navigating away. For long texts, this can take 30+ seconds. If users navigate away, the request is interrupted and they lose their work.

**Goal**: Implement background task processing so TTS jobs continue even if users leave the page. Users can check results later in the task history.

## [S2] Solution Overview

Extend the existing AI task system to support TTS as a new media type (`speech`). The architecture:

1. **Task Creation**: `/api/tts` creates an AI task record and returns immediately
2. **Background Execution**: Server continues TTS processing in the background
3. **Status Polling**: Frontend polls `/api/tts/query` for task completion
4. **Result Retrieval**: Completed tasks store audio data, viewable in task list

### Key Changes

| Component | Change |
|-----------|--------|
| `/api/tts` | Create task + return immediately |
| `/api/tts/query` | New endpoint for status polling |
| `ai_task` table | Add `audio_data` column for TTS results |
| TTS page | Add modal for task status + polling |
| AI tasks page | Display TTS tasks with audio player |

## [S3] Data Model

### Database Schema

**Table**: `ai_task` (existing)

**New Column**:
```sql
ALTER TABLE ai_task ADD COLUMN audio_data TEXT;
```

**Task Record Example**:
```json
{
  "id": "uuid",
  "user_id": "user-123",
  "media_type": "speech",
  "provider": "mimo",
  "model": "mimo-v2.5-tts",
  "prompt": "Hello world",
  "options": "{\"voice\":\"Mia\",\"style\":\"happy\"}",
  "status": "success",
  "cost_credits": 13,
  "task_id": "task-uuid",
  "task_info": "{\"duration\": 2.5}",
  "task_result": "{\"audio\": \"base64...\"}",
  "audio_data": "base64...",
  "created_at": "2024-01-15T10:30:00Z"
}
```

### Status Flow

```
pending → processing → success
                   → failed (with error message)
```

### Credit Handling

- **On Creation**: Deduct credits based on text length
- **On Failure**: Auto-refund credits (existing logic)
- **On Success**: No additional action

## [S4] API Design

### POST `/api/tts` (Modified)

**Request**:
```json
{
  "text": "Hello, this is a test.",
  "voice": "Mia",
  "style": "happy",
  "scene": "preset"
}
```

**Response** (immediate):
```json
{
  "code": 0,
  "data": {
    "taskId": "550e8400-e29b-41d4-a716-446655440000",
    "status": "pending"
  }
}
```

**Behavior**:
1. Validate input and check credits
2. Create AI task record with status `pending`
3. Deduct credits
4. Start background TTS execution (non-blocking)
5. Return task ID immediately

### POST `/api/tts/query` (New)

**Request**:
```json
{
  "taskId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response** (varies by status):

**Pending/Processing**:
```json
{
  "code": 0,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "processing",
    "progress": "Generating audio..."
  }
}
```

**Success**:
```json
{
  "code": 0,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "success",
    "audio": "base64...",
    "duration": 2.5
  }
}
```

**Failed**:
```json
{
  "code": 0,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "failed",
    "errorMessage": "MiMo API error: 500"
  }
}
```

## [S5] Frontend Implementation

### TTS Page Changes

**Current Flow**:
```
Click Generate → Wait → Show Audio Player
```

**New Flow**:
```
Click Generate → Show Modal → Poll Status → Show Result
                              ↓
                     User can close modal
                              ↓
                     Check later in /activity/ai-tasks
```

### Task Status Modal

**Component**: `TTS Task Status Modal`

**States**:
1. **Pending**: Loading spinner + "Preparing to generate..."
2. **Processing**: Loading spinner + "Generating audio..."
3. **Success**: Audio player + Download button + "View in history" link
4. **Failed**: Error message + Retry button

**Polling Logic**:
```typescript
// Poll every 2 seconds until complete
const pollInterval = setInterval(async () => {
  const result = await fetch('/api/tts/query', { 
    method: 'POST', 
    body: JSON.stringify({ taskId }) 
  });
  const data = await result.json();
  
  if (data.status === 'success' || data.status === 'failed') {
    clearInterval(pollInterval);
    // Update UI with result
  }
}, 2000);
```

### AI Tasks Page Integration

**Location**: `/activity/ai-tasks`

**Display**:
- Show TTS tasks alongside image/video/music tasks
- Filter by media type (add "Speech" option)
- Each task shows:
  - Text snippet (first 50 chars)
  - Voice name
  - Status badge
  - Created time
  - Audio player (if success)
  - Download button (if success)

## [S6] Error Handling

### API Errors

| Error | Handling |
|-------|----------|
| Invalid input | Return error immediately |
| Insufficient credits | Return error immediately |
| MiMo API error | Update task to `failed`, refund credits |
| Timeout (5 min) | Update task to `failed`, refund credits |
| Network error | Retry 3 times, then fail |

### Frontend Errors

| Error | Handling |
|-------|----------|
| Polling fails | Show error, allow retry |
| Modal closed | Task continues in background |
| Page refresh | Task continues, check in history |

## [S7] Testing Plan

### Unit Tests

1. **Task Creation**: Verify task record created correctly
2. **Credit Deduction**: Verify credits deducted on creation
3. **Credit Refund**: Verify credits refunded on failure
4. **Status Updates**: Verify status transitions

### Integration Tests

1. **Full Flow**: Create task → Poll → Get result
2. **Error Flow**: Create task → API fails → Verify refund
3. **Concurrent Tasks**: Multiple users generating simultaneously

### Manual Testing

1. Generate short text → Verify immediate response
2. Generate long text → Verify background processing
3. Navigate away → Return → Verify task visible in history
4. Close modal → Reopen → Verify status updated

## [S8] Implementation Tasks

### Phase 1: Backend (3 tasks)

1. **T1.1**: Add `audio_data` column to `ai_task` table
2. **T1.2**: Modify `/api/tts` to create async task
3. **T1.3**: Create `/api/tts/query` endpoint

### Phase 2: Frontend (3 tasks)

4. **T2.1**: Create TTS task status modal component
5. **T2.2**: Integrate modal into TTS page
6. **T2.3**: Add TTS task display to AI tasks page

### Phase 3: Testing (2 tasks)

7. **T3.1**: Write unit tests
8. **T3.2**: Manual testing and bug fixes

## [S9] Open Questions

1. **Audio Storage**: Should we store audio in database or file storage?
   - **Decision**: Store in database (TEXT field) for simplicity
   - **Tradeoff**: Larger database, but simpler implementation

2. **Task Expiration**: How long should we keep completed tasks?
   - **Decision**: 30 days, then auto-delete
   - **Implementation**: Add cleanup cron job later

3. **Concurrent Limit**: Max concurrent TTS tasks per user?
   - **Decision**: 3 concurrent tasks
   - **Implementation**: Check before creating new task

## [S10] Success Criteria

- [ ] Users can generate TTS without waiting
- [ ] Tasks continue when users navigate away
- [ ] Users can view task history with audio playback
- [ ] Failed tasks auto-refund credits
- [ ] No regression in existing functionality
