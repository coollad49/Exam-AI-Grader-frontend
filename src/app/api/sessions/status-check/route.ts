import { type NextRequest, NextResponse } from "next/server"
import { GradingSessionService } from "@/lib/services/grading-session.service"
import { TaskMonitorService } from "@/lib/services/task-monitor.service"

export async function POST(request: NextRequest) {
  try {
    // First, check and update individual task statuses
    const taskResults = await TaskMonitorService.checkAllPendingTasks()
    
    // Then get all active sessions that might need status updates
    const activeSessions = await GradingSessionService.getActiveSessionsForStatusCheck()
    
    const sessionResults = []
    
    for (const session of activeSessions) {
      try {
        const updatedSession = await GradingSessionService.checkAndUpdateSessionStatus(session.id)
        sessionResults.push({
          sessionId: session.id,
          oldStatus: session.status,
          newStatus: updatedSession.status,
          updated: updatedSession.status !== session.status,
        })
      } catch (error) {
        console.error(`Error updating session ${session.id}:`, error)
        sessionResults.push({
          sessionId: session.id,
          error: error instanceof Error ? error.message : "Unknown error",
        })
      }
    }

    return NextResponse.json({
      message: "Comprehensive status check completed",
      timestamp: new Date().toISOString(),
      tasks: {
        processed: taskResults.processed,
        updated: taskResults.updated,
        errors: taskResults.errors,
        details: taskResults.results
      },
      sessions: {
        checked: activeSessions.length,
        results: sessionResults
      }
    })
  } catch (error) {
    console.error("Error in comprehensive status check:", error)
    return NextResponse.json({ error: "Failed to perform status check" }, { status: 500 })
  }
}
