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
