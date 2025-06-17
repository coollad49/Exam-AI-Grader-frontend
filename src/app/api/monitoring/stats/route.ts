import { NextRequest, NextResponse } from "next/server"
import { TaskMonitorService } from "@/lib/services/task-monitor.service"

export async function GET(request: NextRequest) {
  try {
    // Get comprehensive monitoring statistics
    const stats = await TaskMonitorService.getMonitoringStats()
    
    return NextResponse.json({
      message: "Monitoring statistics retrieved",
      timestamp: new Date().toISOString(),
      stats,
    })
  } catch (error) {
    console.error("Error getting monitoring stats:", error)
    return NextResponse.json({ 
      error: "Failed to get monitoring statistics",
      details: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    }, { status: 500 })
  }
}
