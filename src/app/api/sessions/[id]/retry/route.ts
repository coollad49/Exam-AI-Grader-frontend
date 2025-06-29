import { type NextRequest, NextResponse } from "next/server"
import { GradingSessionService } from "@/lib/services/grading-session.service"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    // Optionally, get userId from auth/session if needed
    const updatedSession = await GradingSessionService.retryFailedStudents(id)
    return NextResponse.json({
      id: updatedSession.id,
      status: updatedSession.sessionStatus,
      updatedAt: updatedSession.updatedAt,
    })
  } catch (error) {
    console.error("Error retrying failed students:", error)
    return NextResponse.json({ error: "Failed to retry failed students" }, { status: 500 })
  }
} 