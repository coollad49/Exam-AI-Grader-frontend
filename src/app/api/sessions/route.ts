import { type NextRequest, NextResponse } from "next/server"
import { GradingSessionService } from "@/lib/services/grading-session.service"
import { createGradingSessionSchema } from "@/lib/validations/grading-session"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

export async function GET(request: NextRequest) {
  try {
    // In a real app, get userId from authentication
    // For now, use the default user from the seed
    const defaultUser = await prisma.user.findUnique({
      where: { email: "default@example.com" }
    })

    if (!defaultUser) {
      return NextResponse.json({ error: "Default user not found" }, { status: 404 })
    }

    const sessions = await GradingSessionService.getUserSessions(defaultUser.id)

    return NextResponse.json(sessions)
  } catch (error) {
    console.error("Error fetching sessions:", error)
    return NextResponse.json({ error: "Failed to fetch sessions" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log("Raw request body:", body) // Debug log

    // Validate input
    const validatedData = createGradingSessionSchema.parse(body)
    console.log("Validated data:", validatedData) // Debug log

    // Call createSession with only the validated data (no userId parameter)
    const session = await GradingSessionService.createSession(validatedData)

    return NextResponse.json(session, { status: 201 })
  } catch (error) {
    console.error("Error creating session:", error)

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

    return NextResponse.json({ error: "Failed to create session" }, { status: 500 })
  }
}
