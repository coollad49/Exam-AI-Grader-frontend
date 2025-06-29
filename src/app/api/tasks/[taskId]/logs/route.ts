import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const { taskId } = await params
    const { searchParams } = new URL(request.url)
    const limit = Number.parseInt(searchParams.get("limit") || "100")

    // Find the student with this taskId
    const student = await prisma.student.findFirst({
      where: { taskId },
      include: {
        gradingSession: {
          include: {
            logs: {
              where: {
                studentId: { not: null }
              },
              orderBy: { createdAt: "desc" },
              take: limit,
            }
          }
        }
      }
    })

    if (!student) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    // Filter logs for this specific student/task
    const taskLogs = student.gradingSession.logs.filter(log => log.studentId === student.id)

    return NextResponse.json(taskLogs)
  } catch (error) {
    console.error("Error fetching task logs:", error)
    return NextResponse.json({ error: "Failed to fetch task logs" }, { status: 500 })
  }
} 