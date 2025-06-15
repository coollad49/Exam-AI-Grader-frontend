import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const { taskId } = await params

    if (!taskId) {
      return NextResponse.json({ error: "Task ID is required" }, { status: 400 })
    }

    const gradingServerUrl = process.env.GRADING_SERVER_URL
    if (!gradingServerUrl) {
      console.error("GRADING_SERVER_URL is not set")
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
    }

    const response = await fetch(`${gradingServerUrl}/api/grade/status/${taskId}/`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error(`Error from grading server: ${response.status}`, errorData)
      return NextResponse.json({ error: `Failed to fetch status from grading server: ${errorData}` }, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Error in status API route:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
