# Grading Task Status Monitoring System

This document describes the comprehensive background task monitoring system that automatically checks grading task statuses and updates the database when tasks complete.

## Problem

Previously, when grading sessions were created and tasks were submitted to the backend grading server, there was no automatic mechanism to:

1. Check when individual grading tasks completed
2. Update student statuses in the database
3. Update session statuses when all tasks finish
4. Handle failed tasks appropriately

This resulted in sessions remaining "PENDING" in the database even after all grading was complete.

## Solution Overview

The solution implements a multi-layered monitoring system:

### 1. TaskMonitorService (`/src/lib/services/task-monitor.service.ts`)

A comprehensive service that:
- **Checks individual task statuses** by querying the grading server
- **Updates student records** with completion status and results
- **Handles batch processing** of pending tasks
- **Provides monitoring statistics**
- **Includes error handling and retries**

Key methods:
- `checkAllPendingTasks()` - Processes all pending/processing tasks
- `checkSpecificTask(taskId)` - Checks a single task
- `getMonitoringStats()` - Provides system statistics

### 2. Enhanced API Endpoints

#### `/api/cron/status-check` (Enhanced)
- **Primary background job endpoint**
- Calls `TaskMonitorService.checkAllPendingTasks()`
- Updates both individual tasks and session statuses
- Returns comprehensive statistics

#### `/api/tasks/[taskId]/check` (New)
- **Manual task checking endpoint**
- Allows checking specific tasks on demand
- Updates database if status changed

#### `/api/monitoring/stats` (New)
- **Monitoring dashboard endpoint**
- Returns system statistics (pending tasks, active sessions, etc.)

#### `/api/sessions/status-check` (Enhanced)
- **Comprehensive status checking**
- Now includes individual task checking before session updates

### 3. Background Job Script

**`/scripts/check-task-status.sh`**
- Shell script for cron job execution
- Includes logging and error handling
- Configurable via environment variables

### 4. Enhanced Frontend Integration

The grading progress component now:
- Uses the enhanced task checking endpoint
- Provides better real-time updates
- Shows more accurate status information

## Setup Instructions

### 1. Environment Variables

Ensure these environment variables are set:

```bash
# Required: URL of the grading server
GRADING_SERVER_URL=http://your-grading-server:8000

# Optional: Your app URL (for cron jobs)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 2. Database

The system uses existing Prisma models. Ensure your database includes:
- `Student` model with `taskId`, `status`, `gradedAt` fields
- `GradingSession` model with `status` field
- `SessionLog` model for logging

### 3. Cron Job Setup

#### Option A: System Cron Job (Recommended)

Add to your crontab (`crontab -e`):

```bash
# Check grading task status every 3 minutes
*/3 * * * * /home/coollad49/stuffs/frontend/scripts/check-task-status.sh

# Alternative: Every 2 minutes for faster updates
*/2 * * * * /home/coollad49/stuffs/frontend/scripts/check-task-status.sh
```

#### Option B: Direct HTTP Calls

Set up any external service to call:
```bash
curl -X GET http://your-app.com/api/cron/status-check
```

#### Option C: Application-level Scheduling

Use a service like Vercel Cron, AWS EventBridge, or similar cloud-based schedulers.

### 4. Manual Testing

Test the system manually:

```bash
# Check all pending tasks
curl -X GET http://localhost:3000/api/cron/status-check

# Check specific task
curl -X GET http://localhost:3000/api/tasks/TASK_ID_HERE/check

# Get monitoring statistics
curl -X GET http://localhost:3000/api/monitoring/stats
```

## How It Works

### Automatic Flow

1. **User creates grading session** → Tasks submitted to grading server
2. **Students get PENDING status** in database
3. **Cron job runs every 2-3 minutes** → Calls `/api/cron/status-check`
4. **System checks each pending task** → Queries grading server status
5. **Status updates applied** → Database updated with new statuses
6. **Session status calculated** → Based on all student statuses
7. **Frontend reflects changes** → Via polling or real-time updates

### Status Transitions

```
PENDING → PROCESSING → COMPLETED
       ↘              ↗ FAILED
```

- **PENDING**: Task submitted but not yet processing
- **PROCESSING**: Task is being processed by grading server
- **COMPLETED**: Task finished successfully, results saved
- **FAILED**: Task failed, error logged

### Error Handling

- **Network timeouts**: 30-second timeout on grading server requests
- **Retry logic**: Failed checks are retried on next cron run
- **Error logging**: All errors logged to session logs
- **Graceful degradation**: Frontend polling continues even if background jobs fail

## Monitoring and Logging

### Logs

- **Application logs**: Available via `/api/sessions/[id]/logs`
- **System logs**: Written to `~/grading-status-check.log`
- **Rotation**: Log files automatically rotated when > 10MB

### Statistics

Available via `/api/monitoring/stats`:
- Total pending tasks
- Total processing tasks
- Active sessions count
- Oldest pending task info

### Example Response

```json
{
  "message": "Background task status check completed",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "summary": {
    "tasksProcessed": 12,
    "tasksUpdated": 8,
    "errors": 0,
    "currentStats": {
      "totalPendingTasks": 4,
      "totalProcessingTasks": 2,
      "totalActiveSessions": 3
    }
  }
}
```

## Performance Considerations

### Batch Processing
- Processes up to 10 tasks per run to avoid overwhelming the system
- Configurable via `TaskMonitorService.BATCH_SIZE`

### Frequency
- Recommended: Every 2-3 minutes
- Too frequent: May overwhelm grading server
- Too infrequent: Delays in status updates

### Database Impact
- Minimal: Only updates changed records
- Transaction-safe: Uses Prisma transactions for consistency

## Troubleshooting

### Common Issues

1. **Tasks stay PENDING**
   - Check `GRADING_SERVER_URL` environment variable
   - Verify grading server is accessible
   - Check logs for network errors

2. **Cron job not running**
   - Verify script permissions (`chmod +x`)
   - Check crontab syntax
   - Review system cron logs

3. **Status updates delayed**
   - Increase cron job frequency
   - Check for errors in monitoring stats
   - Verify frontend polling interval

### Debug Commands

```bash
# Test grading server connectivity
curl -X GET $GRADING_SERVER_URL/api/grade/status/test-task-id/

# Check cron job logs
tail -f ~/grading-status-check.log

# Manual status check
curl -X GET http://localhost:3000/api/monitoring/stats
```

## Future Enhancements

1. **Real-time WebSocket updates** from backend when tasks complete
2. **Retry mechanisms** for failed grading tasks
3. **Dashboard interface** for monitoring system health
4. **Alerting system** for stuck or failed tasks
5. **Task priority queuing** for urgent grading requests

## Security Considerations

- Cron endpoints should be secured in production
- Consider rate limiting for manual check endpoints
- Validate task IDs to prevent unauthorized access
- Log security events for monitoring
