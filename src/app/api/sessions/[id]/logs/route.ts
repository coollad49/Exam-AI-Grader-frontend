import { type NextRequest, NextResponse } from "next/server"
import { GradingSessionService } from "@/lib/services/grading-session.service"
import { LogLevel } from "@prisma/client"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const limit = Number.parseInt(searchParams.get("limit") || "100")

    const logs = await GradingSessionService.getSessionLogs(id, limit)

    return NextResponse.json(logs)
  } catch (error) {
    console.error("Error fetching session logs:", error)
    return NextResponse.json({ error: "Failed to fetch session logs" }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    
    const { level, message, context, studentId, metadata } = body
    
    // Validate required fields
    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 })
    }
    
    // Map string level to LogLevel enum
    const logLevel = level?.toUpperCase() as LogLevel || LogLevel.INFO
    
    const log = await GradingSessionService.addLog(
      id,
      logLevel,
      message,
      context,
      undefined, // userId
      studentId,
      metadata
    )
    
    return NextResponse.json(log)
  } catch (error) {
    console.error("Error adding session log:", error)
    return NextResponse.json({ error: "Failed to add session log" }, { status: 500 })
  }
}
