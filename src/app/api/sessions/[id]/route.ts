import { type NextRequest, NextResponse } from "next/server"
import { GradingSessionService } from "@/lib/services/grading-session.service"
import { createGradingSessionSchema } from "@/lib/validations/grading-session"
import { z } from "zod"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // Get the default user from database (same as in the other API route)
    const defaultUser = await prisma.user.findUnique({
      where: { email: 'default@example.com' }
    })

    if (!defaultUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const session = await GradingSessionService.getSession(id, defaultUser.id)

    return NextResponse.json(session)
  } catch (error) {
    console.error("Error fetching session:", error)

    if (error instanceof Error && error.message === "Session not found") {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    return NextResponse.json({ error: "Failed to fetch session" }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    console.log("Raw request body for update:", body) // Debug log

    // Validate input
    const validatedData = createGradingSessionSchema.parse(body)
    console.log("Validated data for update:", validatedData) // Debug log

    // Update the session
    const session = await GradingSessionService.updateSession(id, validatedData)

    return NextResponse.json(session)
  } catch (error) {
    console.error("Error updating session:", error)

    // Handle Zod validation errors specifically
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      )
    }

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ error: "Failed to update session" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: "Session ID is required" }, { status: 400 })
    }

    // Check if session existse
    const session = await prisma.gradingSession.findUnique({
      where: { id },
      include: {
        students: true,
        _count: {
          select: {
            students: true,
            logs: true
          }
        }
      }
    })

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    // Delete all related data in the correct order (respecting foreign key constraints)
    await prisma.$transaction(async (tx) => {
      // Delete student feedback
      // await tx.studentFeedback.deleteMany({
      //   where: {
      //     student: {
      //       gradingSessionId: id
      //     }
      //   }
      // })

      // // Delete question scores
      // await tx.questionScore.deleteMany({
      //   where: {
      //     student: {
      //       gradingSessionId: id
      //     }
      //   }
      // })

      // Delete session logs
      await tx.sessionLog.deleteMany({
        where: {
          gradingSessionId: id
        }
      })

      // Delete students
      await tx.student.deleteMany({
        where: {
          gradingSessionId: id
        }
      })

      // Finally delete the session itself
      await tx.gradingSession.delete({
        where: { id }
      })
    })

    return NextResponse.json({
      message: "Session deleted successfully",
      deletedSession: {
        id: session.id,
        title: session.title,
        studentsCount: session._count.students,
        logsCount: session._count.logs
      }
    })
  } catch (error) {
    console.error("Error deleting session:", error)
    return NextResponse.json(
      { 
        error: "Failed to delete session",
        details: error instanceof Error ? error.message : "Unknown error"
      }, 
      { status: 500 }
    )
  }
}
