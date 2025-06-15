"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Download, X } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"

interface StudentDetailModalProps {
  student: {
    id: string
    name: string
    score: number
    status: string
    feedback: {
      [key: string]: {
        score: number
        feedback: string
      }
    }
  } | null
  onClose: () => void
}

export function StudentDetailModal({ student, onClose }: StudentDetailModalProps) {
  if (!student) return null

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600"
    if (score >= 60) return "text-amber-600"
    return "text-muted-foreground"
  }

  return (
    <Dialog open={!!student} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {student.name}
            <Badge variant="outline" className={getScoreColor(student.score)}>
              {student.score}%
            </Badge>
          </DialogTitle>
          <DialogDescription>Detailed grading results and feedback</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="summary">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="detailed">Detailed Feedback</TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[60vh]">
            <TabsContent value="summary" className="mt-4 space-y-4">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Overall Score:</span>
                  <span className={getScoreColor(student.score)}>{student.score}%</span>
                </div>
                <Progress value={student.score} />
              </div>

              <div className="rounded-md border p-4">
                <h3 className="mb-3 font-medium">Question Breakdown</h3>
                <div className="space-y-3">
                  {Object.entries(student.feedback).map(([question, data]) => (
                    <div key={question} className="flex items-center justify-between">
                      <span>Question {question.replace("q", "")}</span>
                      <div className="flex items-center gap-2">
                        <Progress value={(data.score / 10) * 100} className="w-24" />
                        <span className="w-12 text-right">{data.score}/10</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-md border p-4">
                <h3 className="mb-2 font-medium">Performance Summary</h3>
                <p className="text-sm text-muted-foreground">
                  {student.score >= 80
                    ? "Excellent work! The student demonstrates a strong understanding of the subject matter and has applied concepts correctly across most questions."
                    : student.score >= 60
                      ? "Good effort. The student shows a solid understanding of the concepts but could improve in some areas to achieve a higher score."
                      : "The student has demonstrated some understanding but needs additional support with key concepts to improve their performance."}
                </p>
              </div>
            </TabsContent>

            <TabsContent value="detailed" className="mt-4">
              <div className="space-y-4">
                {Object.entries(student.feedback).map(([question, data]) => (
                  <div key={question} className="rounded-md border p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="font-medium">Question {question.replace("q", "")}</h3>
                      <Badge variant="outline">{data.score}/10</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{data.feedback}</p>

                    <div className="mt-3">
                      <h4 className="text-xs font-medium text-muted-foreground mb-1">Areas of Strength:</h4>
                      <ul className="text-xs text-muted-foreground list-disc list-inside">
                        <li>Clear understanding of core concepts</li>
                        <li>Good application of formulas</li>
                      </ul>
                    </div>

                    <div className="mt-2">
                      <h4 className="text-xs font-medium text-muted-foreground mb-1">Areas for Improvement:</h4>
                      <ul className="text-xs text-muted-foreground list-disc list-inside">
                        <li>More detailed explanations of steps</li>
                        <li>Attention to calculation accuracy</li>
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <DialogFooter className="flex sm:justify-between">
          <Button variant="outline" onClick={onClose}>
            <X className="mr-2 h-4 w-4" />
            Close
          </Button>
          <Button>
            <Download className="mr-2 h-4 w-4" />
            Download Report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
