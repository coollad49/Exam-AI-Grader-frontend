import { prisma } from "@/lib/prisma"
import { GradingStatus, LogLevel } from "@prisma/client"
import { GradingSessionService } from "./grading-session.service"

interface GradingTaskResult {
  status: string
  progress?: {
    current_step?: string
    message?: string
  }
  result?: {
    total_score: number
    max_score: number
    feedback: Array<{
      question_id: string
      score: number
      max_score: number
      feedback: string
      confidence?: number
      keywords?: string[]
    }>
  }
  error?: string
}

export class TaskMonitorService {
  private static readonly BATCH_SIZE = 10
  private static readonly MAX_RETRIES = 3

  /**
   * Check and update status for all pending grading tasks
   * This should be called periodically by a background job
   */
  static async checkAllPendingTasks(): Promise<{
    processed: number
    updated: number
    errors: number
    results: Array<{
      studentId: string
      taskId: string
      oldStatus: string
      newStatus: string
      updated: boolean
      error?: string
    }>
  }> {
    try {
      // Get all students with pending/processing tasks
      const pendingStudents = await prisma.student.findMany({
        where: {
          taskId: { not: null },
          status: {
            in: [GradingStatus.PENDING, GradingStatus.PROCESSING]
          }
        },
        include: {
          gradingSession: {
            select: {
              id: true,
              title: true,
              status: true
            }
          }
        },
        take: this.BATCH_SIZE
      })

      console.log(`Found ${pendingStudents.length} students with pending/processing tasks`)

      const results = []
      let updated = 0
      let errors = 0

      for (const student of pendingStudents) {
        try {
          const result = await this.checkAndUpdateStudentTask(student)
          results.push(result)
          
          if (result.updated) {
            updated++
            
            // Log the update
            await GradingSessionService.addLog(
              student.gradingSessionId,
              LogLevel.INFO,
              `Student ${student.name} status updated from ${result.oldStatus} to ${result.newStatus}`,
              'system'
            )
          }
        } catch (error) {
          errors++
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          console.error(`Error checking student ${student.id} task ${student.taskId}:`, error)
          
          results.push({
            studentId: student.id,
            taskId: student.taskId!,
            oldStatus: student.status,
            newStatus: student.status,
            updated: false,
            error: errorMessage
          })

          // Log the error
          await GradingSessionService.addLog(
            student.gradingSessionId,
            LogLevel.ERROR,
            `Failed to check task status for student ${student.name}: ${errorMessage}`,
            'system'
          )
        }
      }

      // Check and update session statuses for affected sessions
      const affectedSessionIds = new Set(
        pendingStudents.map(s => s.gradingSessionId)
      )

      for (const sessionId of affectedSessionIds) {
        try {
          await GradingSessionService.checkAndUpdateSessionStatus(sessionId)
        } catch (error) {
          console.error(`Error updating session ${sessionId} status:`, error)
        }
      }

      return {
        processed: pendingStudents.length,
        updated,
        errors,
        results
      }
    } catch (error) {
      console.error('Error in checkAllPendingTasks:', error)
      throw error
    }
  }

  /**
   * Check and update a specific student's task status
   */
  private static async checkAndUpdateStudentTask(student: any): Promise<{
    studentId: string
    taskId: string
    oldStatus: string
    newStatus: string
    updated: boolean
    error?: string
  }> {
    const oldStatus = student.status
    
    try {
      // Fetch task status from grading server
      const taskResult = await this.fetchTaskStatus(student.taskId!)
      
      let newStatus = oldStatus
      let shouldUpdate = false
      
      // Determine new status based on task result
      if (taskResult.status === 'SUCCESS' || taskResult.status === 'COMPLETED') {
        newStatus = GradingStatus.COMPLETED
        shouldUpdate = true
        
        // Update student with grading results
        if (taskResult.result) {
          await this.updateStudentWithResults(student.id, taskResult.result)
        }
      } else if (taskResult.status === 'FAILURE' || taskResult.status === 'ERROR') {
        newStatus = GradingStatus.FAILED
        shouldUpdate = true
      } else if (taskResult.status === 'PROGRESS' || taskResult.status === 'PROCESSING_PDF') {
        if (oldStatus === GradingStatus.PENDING) {
          newStatus = GradingStatus.PROCESSING
          shouldUpdate = true
        }
      }

      // Update status if changed
      if (shouldUpdate && newStatus !== oldStatus) {
        await prisma.student.update({
          where: { id: student.id },
          data: {
            status: newStatus,
            gradedAt: newStatus === GradingStatus.COMPLETED ? new Date() : undefined
          }
        })
      }

      return {
        studentId: student.id,
        taskId: student.taskId!,
        oldStatus,
        newStatus,
        updated: shouldUpdate && newStatus !== oldStatus
      }
    } catch (error) {
      console.error(`Error checking task ${student.taskId} for student ${student.id}:`, error)
      throw error
    }
  }

  /**
   * Fetch task status from grading server
   */
  private static async fetchTaskStatus(taskId: string): Promise<GradingTaskResult> {
    const gradingServerUrl = process.env.GRADING_SERVER_URL
    if (!gradingServerUrl) {
      throw new Error('GRADING_SERVER_URL is not configured')
    }

    try {
      const response = await fetch(`${gradingServerUrl}/api/grade/status/${taskId}/`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        // Add timeout to prevent hanging
        signal: AbortSignal.timeout(30000) // 30 seconds
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      return data
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout while checking task status')
      }
      throw error
    }
  }

  /**
   * Update student record with grading results
   */
  private static async updateStudentWithResults(
    studentId: string, 
    results: GradingTaskResult['result']
  ): Promise<void> {
    if (!results) return

    try {
      await prisma.$transaction(async (tx) => {
        // Update student scores
        await tx.student.update({
          where: { id: studentId },
          data: {
            totalScore: results.total_score,
            maxScore: results.max_score,
            percentage: results.max_score > 0 ? (results.total_score / results.max_score) * 100 : 0
          }
        })

        // Delete existing scores and feedback
        await tx.questionScore.deleteMany({
          where: { studentId }
        })
        
        await tx.studentFeedback.deleteMany({
          where: { studentId }
        })

        // Add new question scores and feedback
        if (results.feedback && results.feedback.length > 0) {
          await tx.questionScore.createMany({
            data: results.feedback.map(item => ({
              studentId,
              questionId: item.question_id,
              score: item.score,
              maxScore: item.max_score
            }))
          })

          await tx.studentFeedback.createMany({
            data: results.feedback.map(item => ({
              studentId,
              questionId: item.question_id,
              feedback: item.feedback,
              type: 'GENERAL',
              confidence: item.confidence || null,
              keywords: item.keywords || null
            }))
          })
        }
      })
    } catch (error) {
      console.error(`Error updating student ${studentId} with results:`, error)
      throw error
    }
  }

  /**
   * Check status for a specific task ID
   */
  static async checkSpecificTask(taskId: string): Promise<{
    taskId: string
    status: string
    updated: boolean
    error?: string
  }> {
    try {
      // Find student with this task ID
      const student = await prisma.student.findFirst({
        where: { taskId },
        include: {
          gradingSession: {
            select: { id: true }
          }
        }
      })

      if (!student) {
        throw new Error(`No student found with task ID: ${taskId}`)
      }

      const result = await this.checkAndUpdateStudentTask(student)
      
      // Update session status if student was updated
      if (result.updated) {
        await GradingSessionService.checkAndUpdateSessionStatus(student.gradingSessionId)
      }

      return {
        taskId,
        status: result.newStatus,
        updated: result.updated,
        error: result.error
      }
    } catch (error) {
      console.error(`Error checking specific task ${taskId}:`, error)
      return {
        taskId,
        status: 'ERROR',
        updated: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Get monitoring statistics
   */
  static async getMonitoringStats(): Promise<{
    totalPendingTasks: number
    totalProcessingTasks: number
    totalActiveSessions: number
    oldestPendingTask?: {
      taskId: string
      studentName: string
      createdAt: Date
    }
  }> {
    try {
      const [pendingCount, processingCount, activeSessionsCount, oldestTask] = await Promise.all([
        // Count pending tasks
        prisma.student.count({
          where: {
            taskId: { not: null },
            status: GradingStatus.PENDING
          }
        }),
        
        // Count processing tasks
        prisma.student.count({
          where: {
            taskId: { not: null },
            status: GradingStatus.PROCESSING
          }
        }),
        
        // Count active sessions
        prisma.gradingSession.count({
          where: {
            status: {
              in: ['PENDING', 'IN_PROGRESS']
            }
          }
        }),
        
        // Find oldest pending task
        prisma.student.findFirst({
          where: {
            taskId: { not: null },
            status: GradingStatus.PENDING
          },
          orderBy: {
            createdAt: 'asc'
          },
          select: {
            taskId: true,
            name: true,
            createdAt: true
          }
        })
      ])

      return {
        totalPendingTasks: pendingCount,
        totalProcessingTasks: processingCount,
        totalActiveSessions: activeSessionsCount,
        oldestPendingTask: oldestTask ? {
          taskId: oldestTask.taskId!,
          studentName: oldestTask.name,
          createdAt: oldestTask.createdAt
        } : undefined
      }
    } catch (error) {
      console.error('Error getting monitoring stats:', error)
      throw error
    }
  }
}
