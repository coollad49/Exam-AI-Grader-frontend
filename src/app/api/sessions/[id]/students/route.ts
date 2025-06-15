import { type NextRequest, NextResponse } from "next/server"
import { GradingSessionService } from "@/lib/services/grading-session.service"
import { updateStudentSchema } from "@/lib/validations/grading-session"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const formData = await request.formData();
    
    // Extract session ID from formData
    const sessionId = formData.get("sessionId") as string;
    if (!sessionId || sessionId !== id) {
      return NextResponse.json({ error: "Session ID mismatch" }, { status: 400 });
    }
    
    // Extract student data from the JSON string
    const studentsJson = formData.get("students") as string;
    if (!studentsJson) {
      return NextResponse.json({ error: "Missing students data" }, { status: 400 });
    }
    
    let studentData;
    try {
      studentData = JSON.parse(studentsJson);
    } catch (error) {
      return NextResponse.json({ error: "Invalid JSON format for students data" }, { status: 400 });
    }
    
    // Create student records and store files
    const createdStudents = [];
    
    for (const student of studentData) {
      const { name, tempId } = student;
      
      // Get the file for this student
      const file = formData.get(`file_${tempId}`) as File;
      
      if (!file) {
        return NextResponse.json({ error: `File missing for student ${name}` }, { status: 400 });
      }
      
      // Create the student record in the database
      const createdStudent = await GradingSessionService.addStudent(id, {
        name,
        fileName: file.name,
        fileSize: file.size,
        tempId, // Pass along the temporary ID for matching
      });
      
      // Store file in appropriate storage (this would depend on your storage solution)
      // This is a placeholder for actual file storage logic
      // const storagePath = await storeFile(file, createdStudent.id);
      
      // Return the created student with the temp ID for matching on the client
      createdStudents.push({
        ...createdStudent,
        tempId,
      });
    }

    return NextResponse.json(createdStudents, { status: 201 });
  } catch (error) {
    console.error("Error adding students:", error);
    
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    
    return NextResponse.json({ error: "Failed to add students" }, { status: 500 });
  }
}
