import { z } from "zod"

export const createGradingSessionSchema = z.object({
  title: z.string().min(1, "Title is required").max(255, "Title too long"),
  subject: z.string().min(1, "Subject is required").max(100, "Subject too long"),
  examYear: z.string().min(4, "Invalid year").max(4, "Invalid year"),
  numStudents: z.number().min(1, "At least 1 student required").max(1000, "Too many students"),
  gradingRubric: z.string().refine((val) => {
    try {
      JSON.parse(val)
      return true
    } catch {
      return false
    }
  }, "Invalid JSON format"),
})

export const updateStudentSchema = z.object({
  studentName: z.string().min(1, "Name is required").max(255, "Name too long"),
  studentId: z.string(),
  fileName: z.string().optional(),
  fileSize: z.number().optional(),
  tempId: z.string(), // For tracking client-side IDs
})

export const studentFeedbackSchema = z.object({
  questionId: z.string().min(1, "Question ID is required"),
  feedback: z.string().min(1, "Feedback is required"),
  score: z.number().min(0, "Score cannot be negative"),
  maxScore: z.number().min(1, "Max score must be positive"),
  type: z.enum(["GENERAL", "STRENGTH", "IMPROVEMENT", "SUGGESTION"]).default("GENERAL"),
  confidence: z.number().min(0).max(1).optional(),
  keywords: z.array(z.string()).default([]),
})

export type CreateGradingSessionInput = z.infer<typeof createGradingSessionSchema>
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>
export type StudentFeedbackInput = z.infer<typeof studentFeedbackSchema>
