import { type NextRequest, NextResponse } from "next/server"
import { GradingSessionService } from "@/lib/services/grading-session.service"
import { SessionStatus } from "@prisma/client"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const session = await GradingSessionService.getSession(id)
    
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    return NextResponse.json({
      id: session.id,
      status: session.status,
      completedStudents: session.students.filter(s => s.status === 'COMPLETED').length,
      totalStudents: session.students.length,
      failedStudents: session.students.filter(s => s.status === 'FAILED').length,
      processingStudents: session.students.filter(s => s.status === 'PROCESSING').length,
      pendingStudents: session.students.filter(s => s.status === 'PENDING').length,
    })
  } catch (error) {
    console.error("Error fetching session status:", error)
    return NextResponse.json({ error: "Failed to fetch session status" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { status } = body

    if (!Object.values(SessionStatus).includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    }

    const updatedSession = await GradingSessionService.updateSessionStatus(id, status)
    
    return NextResponse.json({
      id: updatedSession.id,
      status: updatedSession.status,
      updatedAt: updatedSession.updatedAt,
    })
  } catch (error) {
    console.error("Error updating session status:", error)
    return NextResponse.json({ error: "Failed to update session status" }, { status: 500 })
  }
}
