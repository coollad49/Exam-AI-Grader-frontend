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
        studentId: true,
        studentName: true,
        gradingSessionId: true,
      }
    })

    if (!student) {
      return NextResponse.json({ error: "Student not found for this task" }, { status: 404 })
    }

    return NextResponse.json({
      studentId: student.id,
      sessionId: student.gradingSessionId,
      studentName: student.studentName,
    })
  } catch (error) {
    console.error("Error fetching student by taskId:", error)
    return NextResponse.json({ error: "Failed to fetch student" }, { status: 500 })
  }
} 