import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const { taskId } = await params

    // Find the student with this taskId
    const student = await prisma.student.findFirst({
      where: { taskId },
      select: {
        id: true,
        studentName: true,
        studentId: true,
        studentGradingStatus: true,
        rawGradingOutput: true,
        gradedAt: true,
        gradingSessionId: true,
      }
    })

    if (!student) {
      return NextResponse.json({ error: "Student not found for this task" }, { status: 404 })
    }

    return NextResponse.json({
      taskId,
      student: {
        id: student.id,
        studentName: student.studentName,
        studentId: student.studentId,
        status: student.studentGradingStatus,
        gradedAt: student.gradedAt,
        sessionId: student.gradingSessionId,
        hasRawGradingOutput: !!student.rawGradingOutput,
        rawGradingOutput: student.rawGradingOutput,
      }
    })
  } catch (error) {
    console.error("Error verifying task results:", error)
    return NextResponse.json({ error: "Failed to verify task results" }, { status: 500 })
  }
} 