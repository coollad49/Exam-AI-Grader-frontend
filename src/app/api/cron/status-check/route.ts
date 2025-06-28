import { NextRequest, NextResponse } from "next/server"
import { TaskMonitorService } from "@/lib/services/task-monitor.service"

// Comprehensive background task status checking endpoint
// This endpoint should be called by a cron job or background service every few minutes
export async function GET(request: NextRequest) {
  try {
    console.log("Starting background task status check...")
    
    // Check all pending tasks and update their statuses
    const taskResults = await TaskMonitorService.checkAllPendingTasks()
    
    // Get monitoring statistics
    const stats = await TaskMonitorService.getMonitoringStats()
    
    console.log(`Background check completed:`, {
      processed: taskResults.processed,
      updated: taskResults.updated,
      errors: taskResults.errors,
      stats
    })
    
    return NextResponse.json({
      message: "Background task status check completed",
      timestamp: new Date().toISOString(),
      summary: {
        tasksProcessed: taskResults.processed,
        tasksUpdated: taskResults.updated,
        errors: taskResults.errors,
        currentStats: stats
      },
    })
  } catch (error) {
    console.error("Background task status check error:", error)
    return NextResponse.json({ 
      error: "Background task status check failed",
      details: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    }, { status: 500 })
  }
}

// Allow manual triggering via POST as well
export async function POST(request: NextRequest) {
  return GET(request)
}
