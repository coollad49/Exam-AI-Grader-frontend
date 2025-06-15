import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const pdfFile = formData.get("pdf_file") as File
    const gradingGuideJsonStr = formData.get("grading_guide_json_str") as string

    if (!pdfFile || !gradingGuideJsonStr) {
      return NextResponse.json(
        { error: "Missing required fields: pdf_file and grading_guide_json_str" },
        { status: 400 },
      )
    }

    // Validate JSON format
    try {
      JSON.parse(gradingGuideJsonStr)
    } catch (error) {
      return NextResponse.json({ error: "Invalid JSON format in grading_guide_json_str" }, { status: 400 })
    }

    // Forward request to actual grading server
    const gradingServerUrl = process.env.GRADING_SERVER_URL

    const serverFormData = new FormData()
    serverFormData.append("pdf_file", pdfFile)
    serverFormData.append("grading_guide_json_str", gradingGuideJsonStr)

    const response = await fetch(`${gradingServerUrl}/api/grade/upload/`, {
      method: "POST",
      body: serverFormData,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Server error" }))
      return NextResponse.json(errorData, { status: response.status })
    }

    const result = await response.json()
    return NextResponse.json(result)
  } catch (error) {
    console.error("Upload error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
