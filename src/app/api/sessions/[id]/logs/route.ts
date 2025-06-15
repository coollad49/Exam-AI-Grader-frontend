import { type NextRequest, NextResponse } from "next/server"
import { GradingSessionService } from "@/lib/services/grading-session.service"

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
