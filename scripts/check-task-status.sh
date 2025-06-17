#!/bin/bash

# Background task status checker script
# This script should be called by a cron job every 2-5 minutes to check grading task statuses

# Configuration
APP_URL="${NEXT_PUBLIC_APP_URL:-http://localhost:3000}"
LOG_FILE="${HOME}/grading-status-check.log"
MAX_LOG_SIZE=10485760  # 10MB

# Function to log with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# Function to rotate log if it gets too large
rotate_log() {
    if [ -f "$LOG_FILE" ] && [ $(stat -f%z "$LOG_FILE" 2>/dev/null || stat -c%s "$LOG_FILE" 2>/dev/null || echo 0) -gt $MAX_LOG_SIZE ]; then
        mv "$LOG_FILE" "${LOG_FILE}.old"
        log "Log rotated"
    fi
}

# Main execution
main() {
    rotate_log
    log "Starting background task status check..."
    
    # Make the HTTP request to trigger status checking
    response=$(curl -s -w "\n%{http_code}" \
        -X GET \
        -H "Content-Type: application/json" \
        --max-time 120 \
        "$APP_URL/api/cron/status-check")
    
    # Extract HTTP status code (last line)
    http_code=$(echo "$response" | tail -n1)
    # Extract response body (all but last line)  
    body=$(echo "$response" | head -n -1)
    
    if [ "$http_code" = "200" ]; then
        # Parse the response to get summary info
        processed=$(echo "$body" | grep -o '"tasksProcessed":[0-9]*' | cut -d':' -f2 || echo "0")
        updated=$(echo "$body" | grep -o '"tasksUpdated":[0-9]*' | cut -d':' -f2 || echo "0")
        errors=$(echo "$body" | grep -o '"errors":[0-9]*' | cut -d':' -f2 || echo "0")
        
        log "SUCCESS: Processed $processed tasks, updated $updated, errors $errors"
        
        # Log any errors if present
        if [ "$errors" != "0" ]; then
            log "WARNING: There were $errors errors during processing"
        fi
    else
        log "ERROR: HTTP $http_code - $body"
        exit 1
    fi
}

# Error handling
set -e
trap 'log "ERROR: Script failed at line $LINENO"' ERR

# Run main function
main

log "Background task status check completed"
