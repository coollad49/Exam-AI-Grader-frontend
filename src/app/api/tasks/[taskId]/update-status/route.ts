import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { StudentGradingStatus } from "@prisma/client"
import { GradingSessionService } from "@/lib/services/grading-session.service"

export async function POST(request: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const { taskId } = await params
    const body = await request.json()
    
    const { status, result, error } = body
    
    // Find the student with this taskId
    const student = await prisma.student.findFirst({
      where: { taskId },
      include: {
        gradingSession: {
          select: { id: true }
        }
      }
    })

    if (!student) {
      return NextResponse.json({ error: "Student not found for this task" }, { status: 404 })
    }

    // Map status to StudentGradingStatus
    let newStatus: StudentGradingStatus
    switch (status) {
      case 'COMPLETED':
      case 'SUCCESS':
        newStatus = StudentGradingStatus.COMPLETED
        break
      case 'FAILED':
      case 'ERROR':
        newStatus = StudentGradingStatus.FAILED
        break
      case 'PROCESSING':
      case 'PROCESSING_PDF':
        newStatus = StudentGradingStatus.PROCESSING
        break
      default:
        newStatus = StudentGradingStatus.PENDING
    }

    // Only update if status actually changed
    if (student.studentGradingStatus !== newStatus) {
      await prisma.$transaction(async (tx) => {
        // Update student status
        await tx.student.update({
          where: { id: student.id },
          data: {
            studentGradingStatus: newStatus,
            gradedAt: newStatus === StudentGradingStatus.COMPLETED ? new Date() : undefined,
          },
        })

        // Save grading results if completed
        if (newStatus === StudentGradingStatus.COMPLETED && result) {
          console.log(`[TaskUpdate] Saving rawGradingOutput for task ${taskId}:`, JSON.stringify(result, null, 2))
          
          // Handle different result formats
          let gradingOutput = result
          
          // If result has a nested structure like { result: { status: 'COMPLETED', results: {...} } }
          if (result.result && result.result.results) {
            gradingOutput = result.result
          }
          // If result has a nested structure like { results: {...} }
          else if (result.results) {
            gradingOutput = result
          }
          
          await tx.student.update({
            where: { id: student.id },
            data: {
              rawGradingOutput: gradingOutput,
            },
          })
          
          console.log(`[TaskUpdate] Successfully saved rawGradingOutput for student ${student.studentName}`)
        }
      })

      // Log the status change
      await GradingSessionService.addLog(
        student.gradingSessionId,
        newStatus === StudentGradingStatus.COMPLETED ? 'SUCCESS' : 
        newStatus === StudentGradingStatus.FAILED ? 'ERROR' : 'INFO',
        `Task ${taskId} status updated to ${newStatus} via real-time update`,
        'grading',
        undefined,
        student.id
      )

      // Check and update session status
      await GradingSessionService.checkAndUpdateSessionStatus(student.gradingSessionId)

      console.log(`[TaskUpdate] Student ${student.studentName} (${taskId}) status updated from ${student.studentGradingStatus} to ${newStatus}`)
    }

    return NextResponse.json({ 
      success: true, 
      taskId, 
      studentId: student.id,
      oldStatus: student.studentGradingStatus,
      newStatus,
      updated: student.studentGradingStatus !== newStatus
    })
  } catch (error) {
    console.error("Error updating task status:", error)
    return NextResponse.json({ error: "Failed to update task status" }, { status: 500 })
  }
} 