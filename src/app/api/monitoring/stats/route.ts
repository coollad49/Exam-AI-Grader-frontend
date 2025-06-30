import { NextRequest, NextResponse } from "next/server"
import { TaskMonitorService } from "@/lib/services/task-monitor.service"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    // Get comprehensive monitoring statistics
    const stats = await TaskMonitorService.getMonitoringStats()

    // Additional dashboard stats
    const [totalSessions, totalStudentsGraded, avgScoreResult] = await Promise.all([
      prisma.gradingSession.count(),
      prisma.student.count({
        where: { studentGradingStatus: "COMPLETED" },
      }),
      prisma.student.aggregate({
        _avg: { percentage: true },
        where: { studentGradingStatus: "COMPLETED", percentage: { not: null } },
      }),
    ])
    const averageScore = avgScoreResult._avg.percentage || 0

    return NextResponse.json({
      message: "Monitoring statistics retrieved",
      timestamp: new Date().toISOString(),
      stats: {
        ...stats,
        totalSessions,
        totalStudentsGraded,
        averageScore,
      },
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
