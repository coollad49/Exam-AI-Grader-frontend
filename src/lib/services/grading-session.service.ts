import { prisma } from "@/lib/prisma"
import type {
  CreateGradingSessionInput,
  UpdateStudentInput,
  StudentFeedbackInput,
} from "@/lib/validations/grading-session"
import { SessionStatus, GradingStatus, LogLevel } from "@prisma/client"

export class GradingSessionService {
  static async createSession(data: CreateGradingSessionInput) {
    try {
      // Create or find a default user first
      const defaultUser = await prisma.user.upsert({
        where: { email: 'default@example.com' },
        update: {},
        create: {
          email: 'default@example.com',
          name: 'Default User',
        },
      })

      const session = await prisma.gradingSession.create({
        data: {
          title: data.title,
          subject: data.subject,
          examYear: data.examYear,
          numStudents: data.numStudents,
          gradingRubric: data.gradingRubric,
          userId: defaultUser.id,
        },
      })
      return session
    } catch (error) {
      console.error("Error creating grading session:", error)
      throw new Error("Failed to create grading session")
    }
  }

  static async getSession(sessionId: string, userId?: string) {
    try {
      const session = await prisma.gradingSession.findFirst({
        where: {
          id: sessionId,
          ...(userId && { userId }),
        },
        include: {
          user: true,
          students: {
            include: {
              questionScores: true,
              feedback: true,
            },
            orderBy: {
              name: "asc",
            },
          },
          logs: {
            orderBy: {
              createdAt: "desc",
            },
            take: 100, // Limit recent logs
          },
          _count: {
            select: {
              students: true,
              logs: true,
            },
          },
        },
      })

      if (!session) {
        throw new Error("Session not found")
      }

      return session
    } catch (error) {
      console.error("Error fetching grading session:", error)
      throw new Error("Failed to fetch grading session")
    }
  }

  static async updateSessionStatus(sessionId: string, status: SessionStatus, userId?: string) {
    try {
      const updateData: any = {
        status,
        updatedAt: new Date(),
      }

      if (status === SessionStatus.IN_PROGRESS) {
        updateData.startedAt = new Date()
      } else if (status === SessionStatus.COMPLETED) {
        updateData.completedAt = new Date()
      }

      const session = await prisma.gradingSession.update({
        where: { id: sessionId },
        data: updateData,
      })

      // Log status change
      await this.addLog(sessionId, LogLevel.INFO, `Session status changed to ${status}`, "system", userId)

      return session
    } catch (error) {
      console.error("Error updating session status:", error)
      throw new Error("Failed to update session status")
    }
  }

  static async updateSession(sessionId: string, data: CreateGradingSessionInput) {
    try {
      const session = await prisma.gradingSession.update({
        where: { id: sessionId },
        data: {
          title: data.title,
          subject: data.subject,
          examYear: data.examYear,
          numStudents: data.numStudents,
          gradingRubric: data.gradingRubric,
        },
      })
      return session
    } catch (error) {
      console.error("Error updating grading session:", error)
      throw new Error("Failed to update grading session")
    }
  }

  static async addStudent(sessionId: string, studentData: UpdateStudentInput) {
    try {
      const student = await prisma.student.create({
        data: {
          name: studentData.name,
          studentId: studentData.studentId,
          fileName: studentData.fileName,
          fileSize: studentData.fileSize,
          uploadedAt: studentData.fileName ? new Date() : undefined,
          gradingSessionId: sessionId,
          status: GradingStatus.PENDING,
        },
      })

      // Log student addition
      await this.addLog(
        sessionId,
        LogLevel.INFO,
        `Student ${studentData.name} added to session`,
        "student",
        undefined,
        student.id,
      )

      return student
    } catch (error) {
      console.error("Error adding student:", error)
      throw new Error("Failed to add student")
    }
  }

  static async updateStudentGrading(
    studentId: string,
    taskId: string,
    status: GradingStatus,
    scores?: { questionId: string; score: number; maxScore: number }[],
    feedback?: StudentFeedbackInput[],
  ) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        // Update student status and task ID
        const student = await tx.student.update({
          where: { id: studentId },
          data: {
            taskId,
            status,
            gradedAt: status === GradingStatus.COMPLETED ? new Date() : undefined,
          },
        })

        // Add question scores if provided
        if (scores && scores.length > 0) {
          await tx.questionScore.deleteMany({
            where: { studentId },
          })

          await tx.questionScore.createMany({
            data: scores.map((score) => ({
              studentId,
              questionId: score.questionId,
              score: score.score,
              maxScore: score.maxScore,
            })),
          })

          // Calculate total score
          const totalScore = scores.reduce((sum, score) => sum + score.score, 0)
          const maxScore = scores.reduce((sum, score) => sum + score.maxScore, 0)
          const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0

          await tx.student.update({
            where: { id: studentId },
            data: {
              totalScore,
              maxScore,
              percentage,
            },
          })
        }

        // Add feedback if provided
        if (feedback && feedback.length > 0) {
          await tx.studentFeedback.deleteMany({
            where: { studentId },
          })

          await tx.studentFeedback.createMany({
            data: feedback.map((fb) => ({
              studentId,
              questionId: fb.questionId,
              feedback: fb.feedback,
              type: fb.type,
              confidence: fb.confidence,
              keywords: fb.keywords,
            })),
          })
        }

        return student
      })

      // Log grading update
      await this.addLog(
        result.gradingSessionId,
        status === GradingStatus.COMPLETED ? LogLevel.SUCCESS : LogLevel.INFO,
        `Student ${result.name} grading status: ${status}`,
        "grading",
        undefined,
        studentId,
      )

      return result
    } catch (error) {
      console.error("Error updating student grading:", error)
      throw new Error("Failed to update student grading")
    }
  }

  static async calculateSessionStatistics(sessionId: string) {
    try {
      const students = await prisma.student.findMany({
        where: {
          gradingSessionId: sessionId,
          status: GradingStatus.COMPLETED,
          percentage: { not: null },
        },
        select: {
          percentage: true,
        },
      })

      if (students.length === 0) {
        return null
      }

      const percentages = students.map((s) => s.percentage!).filter((p) => p !== null)
      const averageScore = percentages.reduce((sum, p) => sum + p, 0) / percentages.length
      const highestScore = Math.max(...percentages)
      const lowestScore = Math.min(...percentages)
      const passingRate = (percentages.filter((p) => p >= 50).length / percentages.length) * 100

      const updatedSession = await prisma.gradingSession.update({
        where: { id: sessionId },
        data: {
          averageScore,
          highestScore,
          lowestScore,
          passingRate,
        },
      })

      return updatedSession
    } catch (error) {
      console.error("Error calculating session statistics:", error)
      throw new Error("Failed to calculate session statistics")
    }
  }

  static async addLog(
    sessionId: string,
    level: LogLevel,
    message: string,
    context?: string,
    userId?: string,
    studentId?: string,
    metadata?: any,
  ) {
    try {
      return await prisma.sessionLog.create({
        data: {
          gradingSessionId: sessionId,
          level,
          message,
          context,
          userId,
          studentId,
          metadata,
        },
      })
    } catch (error) {
      console.error("Error adding log:", error)
      // Don't throw error for logging failures to avoid breaking main functionality
    }
  }

  static async getSessionLogs(sessionId: string, limit = 100) {
    try {
      return await prisma.sessionLog.findMany({
        where: { gradingSessionId: sessionId },
        orderBy: { createdAt: "desc" },
        take: limit,
        include: {
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      })
    } catch (error) {
      console.error("Error fetching session logs:", error)
      throw new Error("Failed to fetch session logs")
    }
  }

  static async getUserSessions(userId: string, limit = 50) {
    try {
      return await prisma.gradingSession.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: limit,
        include: {
          _count: {
            select: {
              students: true,
            },
          },
        },
      })
    } catch (error) {
      console.error("Error fetching user sessions:", error)
      throw new Error("Failed to fetch user sessions")
    }
  }

  static async checkAndUpdateSessionStatus(sessionId: string) {
    try {
      const session = await prisma.gradingSession.findUnique({
        where: { id: sessionId },
        include: {
          students: {
            select: {
              status: true,
            },
          },
        },
      })

      if (!session) {
        throw new Error("Session not found")
      }

      const totalStudents = session.students.length
      const completedStudents = session.students.filter(s => s.status === GradingStatus.COMPLETED).length
      const failedStudents = session.students.filter(s => s.status === GradingStatus.FAILED).length
      const processingStudents = session.students.filter(s => s.status === GradingStatus.PROCESSING).length

      let newStatus = session.status

      // Determine new status based on student completion
      if (completedStudents === totalStudents && totalStudents > 0) {
        // All students completed
        newStatus = SessionStatus.COMPLETED
      } else if (completedStudents + failedStudents === totalStudents && totalStudents > 0) {
        // All students either completed or failed (no pending/in-progress)
        newStatus = SessionStatus.COMPLETED
      } else if (processingStudents > 0 || completedStudents > 0) {
        // Some students are processing or completed
        newStatus = SessionStatus.IN_PROGRESS
      }

      // Update session status if it changed
      if (newStatus !== session.status) {
        const updatedSession = await this.updateSessionStatus(sessionId, newStatus)
        
        // Calculate statistics if session is completed
        if (newStatus === SessionStatus.COMPLETED) {
          await this.calculateSessionStatistics(sessionId)
        }

        return updatedSession
      }

      return session
    } catch (error) {
      console.error("Error checking and updating session status:", error)
      throw new Error("Failed to check and update session status")
    }
  }

  static async getActiveSessionsForStatusCheck() {
    try {
      return await prisma.gradingSession.findMany({
        where: {
          status: {
            in: [SessionStatus.PENDING, SessionStatus.IN_PROGRESS],
          },
        },
        select: {
          id: true,
          status: true,
          updatedAt: true,
        },
      })
    } catch (error) {
      console.error("Error fetching active sessions:", error)
      throw new Error("Failed to fetch active sessions")
    }
  }
}
