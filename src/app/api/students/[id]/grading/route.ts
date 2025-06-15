import { type NextRequest, NextResponse } from "next/server"
import { GradingSessionService } from "@/lib/services/grading-session.service"
import { studentFeedbackSchema } from "@/lib/validations/grading-session"
import { GradingStatus } from "@prisma/client"

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()

    const { taskId, status, scores, feedback } = body

    // Validate feedback if provided
    let validatedFeedback
    if (feedback) {
      validatedFeedback = feedback.map((fb: any) => studentFeedbackSchema.parse(fb))
    }

    const student = await GradingSessionService.updateStudentGrading(
      id,
      taskId,
      status as GradingStatus,
      scores,
      validatedFeedback,
    )

    // Calculate session statistics if student is completed
    if (status === GradingStatus.COMPLETED) {
      await GradingSessionService.calculateSessionStatistics(student.gradingSessionId)
    }

    return NextResponse.json(student)
  } catch (error) {
    console.error("Error updating student grading:", error)

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ error: "Failed to update student grading" }, { status: 500 })
  }
}
