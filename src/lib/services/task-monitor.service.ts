import { prisma } from "@/lib/prisma";
import { StudentGradingStatus, Prisma, LogLevel, Student } from "@prisma/client";
import { GradingSessionService } from "./grading-session.service";

// This interface defines the expected structure of the successful response from the grading server.
interface GradingTaskResult {
  task_id: string;
  status: string; // e.g., 'SUCCESS', 'FAILURE'
  result: {
    status: string; // e.g., 'COMPLETED'
    results: {
      // The key is the question number as a string, e.g., "1a", "2", "3b"
      [key: string]: {
        score: number;
        feedback: string;
        page_source: number;
      };
    };
  };
  error?: string;
}

type StudentWithSession = Student & {
  gradingSession: { id: string; };
};

export class TaskMonitorService {
  private static readonly BATCH_SIZE = 10;
  private static readonly MAX_RETRIES = 3;

  /**
   * Checks and updates status for a batch of all pending grading tasks.
   */
  static async checkAllPendingTasks(): Promise<{
    processed: number;
    updated: number;
    errors: number;
  }> {
    const pendingStudents = await prisma.student.findMany({
      where: {
        taskId: { not: null },
        studentGradingStatus: { in: [StudentGradingStatus.PENDING, StudentGradingStatus.PROCESSING] },
      },
      include: {
        gradingSession: { select: { id: true } },
      },
      take: this.BATCH_SIZE,
    });

    console.log(`[TaskMonitor] Found ${pendingStudents.length} students with pending/processing tasks.`);

    let updated = 0;
    let errors = 0;

    for (const student of pendingStudents) {
      try {
        const result = await this.checkAndUpdateStudentTask(student as StudentWithSession);
        if (result.updated) {
          updated++;
        }
      } catch (error) {
        errors++;
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error(`[TaskMonitor] Error processing student ${student.id} (Task ID: ${student.taskId}):`, error);
        await GradingSessionService.addLog(
          student.gradingSessionId,
          LogLevel.ERROR,
          `Failed to check task status for student ${student.studentName}: ${errorMessage}`,
          'system'
        );
      }
    }
    
    const affectedSessionIds = [...new Set(pendingStudents.map(s => s.gradingSessionId))];
    for (const sessionId of affectedSessionIds) {
      await GradingSessionService.checkAndUpdateSessionStatus(sessionId);
    }

    return { processed: pendingStudents.length, updated, errors };
  }

  
  /**
     * Checks a single student's task status and updates the database.
     */
  private static async checkAndUpdateStudentTask(student: StudentWithSession): Promise<{ updated: boolean , status?: StudentGradingStatus, error?: string }> {
    const oldStatus = student.studentGradingStatus;
    const taskResult = await this.fetchTaskStatus(student.taskId!);

    let newStatus = oldStatus;
    
    if (['SUCCESS', 'COMPLETED'].includes(taskResult.status)) {
      newStatus = StudentGradingStatus.COMPLETED;
    } else if (['FAILURE', 'ERROR'].includes(taskResult.status)) {
      newStatus = StudentGradingStatus.FAILED;
    } else if (['PROGRESS', 'PROCESSING_PDF'].includes(taskResult.status) && oldStatus === StudentGradingStatus.PENDING) {
      newStatus = StudentGradingStatus.PROCESSING;
    }

    if (newStatus !== oldStatus) {
      await prisma.$transaction(async (tx) => {
        // 1. Update the student's status and graded timestamp.
        await tx.student.update({
          where: { id: student.id },
          data: {
            studentGradingStatus: newStatus,
            gradedAt: newStatus === StudentGradingStatus.COMPLETED ? new Date() : undefined,
          },
        });

        // 2. If the task completed successfully, save the raw JSON output.
        if (newStatus === StudentGradingStatus.COMPLETED && taskResult.result) {
          await this.saveRawGradingOutput(tx, student.id, taskResult.result);
        }
      });
      
      console.log(`[TaskMonitor] Student ${student.id} status updated from ${oldStatus} to ${newStatus}.`);
      await GradingSessionService.addLog(
        student.gradingSessionId,
        LogLevel.INFO,
        `Grading for student ${student.studentName} changed from ${oldStatus} to ${newStatus}.`,
        'system'
      );
      return { updated: true };
    }

    return { updated: false };
  }


  

  /**
 * Saves the raw, unprocessed JSON results from the grading server
 * to the student's `rawGradingOutput` field.
 * @param tx - The Prisma transaction client.
 * @param studentId - The ID of the student to update.
 * @param result - The 'result' object from the GradingTaskResult.
 */
  private static async saveRawGradingOutput(
    tx: Prisma.TransactionClient,
    studentId: string,
    result: GradingTaskResult['result']
  ): Promise<void> {
    if (!result) return;

    await tx.student.update({
      where: { id: studentId },
      data: {
        // Directly store the entire result object into the Json field.
        // Your application logic can then parse this field as needed.
        rawGradingOutput: result,
      },
    });
  }

  /**
   * Checks the status of a single, specific task ID.
   */
  static async checkSpecificTask(taskId: string): Promise<{
    taskId: string;
    updated: boolean;
    error?: string;
  }> {
    try {
      const student = await prisma.student.findFirst({
        where: { taskId },
        include: {
          gradingSession: {
            select: { id: true },
          },
        },
      });

      if (!student) {
        throw new Error(`No student found with task ID: ${taskId}`);
      }

      const result = await this.checkAndUpdateStudentTask(student as Student & { gradingSession: { id: string } });

      // If the student's status was updated, refresh the overall session status.
      if (result.updated) {
        await GradingSessionService.checkAndUpdateSessionStatus(student.gradingSessionId);
      }

      return {
        taskId,
        updated: result.updated,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Error checking specific task ${taskId}:`, error);
      return {
        taskId,
        updated: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Fetches the grading task status from the external grading server.
   */
  private static async fetchTaskStatus(taskId: string): Promise<GradingTaskResult> {
    const gradingServerUrl = process.env.GRADING_SERVER_URL;
    if (!gradingServerUrl) {
      throw new Error("GRADING_SERVER_URL is not configured");
    }

    try {
      const response = await fetch(`${gradingServerUrl}/api/grade/status/${taskId}/`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(90000), // 90-second timeout
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.json();
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout while checking task status');
      }
      throw error;
    }
  }

  /**
   * Retrieves monitoring statistics for ongoing grading tasks and sessions.
   */
  static async getMonitoringStats(): Promise<{
    totalPendingTasks: number;
    totalProcessingTasks: number;
    totalActiveSessions: number;
    oldestPendingTask?: {
      taskId: string;
      studentName: string;
      createdAt: Date;
    };
  }> {
    try {
      const [pendingCount, processingCount, activeSessionsCount, oldestTask] = await prisma.$transaction([
        prisma.student.count({
          where: {
            taskId: { not: null },
            studentGradingStatus: StudentGradingStatus.PENDING,
          },
        }),
        prisma.student.count({
          where: {
            taskId: { not: null },
            studentGradingStatus: StudentGradingStatus.PROCESSING,
          },
        }),
        prisma.gradingSession.count({
          where: {
            sessionStatus: {
              in: [StudentGradingStatus.PENDING, StudentGradingStatus.PROCESSING],
            },
          },
        }),
        prisma.student.findFirst({
          where: {
            taskId: { not: null },
            studentGradingStatus: StudentGradingStatus.PENDING,
          },
          orderBy: {
            createdAt: 'asc',
          },
          select: {
            taskId: true,
            studentName: true,
            createdAt: true,
          },
        }),
      ]);

      return {
        totalPendingTasks: pendingCount,
        totalProcessingTasks: processingCount,
        totalActiveSessions: activeSessionsCount,
        oldestPendingTask: oldestTask ? {
          taskId: oldestTask.taskId!,
          studentName: oldestTask.studentName,
          createdAt: oldestTask.createdAt,
        } : undefined,
      };
    } catch (error) {
      console.error('Error getting monitoring stats:', error);
      throw error;
    }
  }
}