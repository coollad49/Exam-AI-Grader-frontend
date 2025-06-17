import { NextRequest, NextResponse } from "next/server"
import { TaskMonitorService } from "@/lib/services/task-monitor.service"

export async function GET(request: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const { taskId } = await params

    if (!taskId) {
      return NextResponse.json({ error: "Task ID is required" }, { status: 400 })
    }

    // Check the specific task and update if needed
    const result = await TaskMonitorService.checkSpecificTask(taskId)
    
    return NextResponse.json({
      message: "Task status checked",
      timestamp: new Date().toISOString(),
      result,
    })
  } catch (error) {
    console.error("Error checking task status:", error)
    return NextResponse.json({ 
      error: "Failed to check task status",
      details: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    }, { status: 500 })
  }
}

// Allow manual task status refresh via POST
export async function POST(request: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  return GET(request, { params })
}
