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
import { Download, X, Clock, CheckCircle, AlertCircle } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface StudentDetailModalProps {
  student: {
    id: string
    name: string
    totalScore: number
    studentGradingStatus: string
    gradedAt?: string
    questionData: {
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

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'processing':
        return <Clock className="h-4 w-4 text-blue-500" />
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      default:
        return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return "default"
      case 'processing':
        return "secondary"
      case 'failed':
        return "destructive"
      default:
        return "outline"
    }
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return "Not completed"
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    })
  }

  const questionEntries = Object.entries(student.questionData)
  const totalQuestions = questionEntries.length

  return (
    <Dialog open={!!student} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>{student.name}</span>
            {getStatusIcon(student.studentGradingStatus)}
            <Badge variant={getStatusVariant(student.studentGradingStatus)}>
              {student.studentGradingStatus}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Detailed grading results and AI feedback • Graded on {formatDate(student.gradedAt)}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="summary" className="flex-1">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="detailed">Question by Question</TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[60vh] mt-4">
            <TabsContent value="summary" className="space-y-6">
              {/* Overall Performance */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Overall Performance</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-primary">{student.totalScore}</p>
                      <p className="text-sm text-muted-foreground">Total Score</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-muted-foreground">{totalQuestions}</p>
                      <p className="text-sm text-muted-foreground">Questions</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Question Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Question Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {questionEntries.map(([questionId, data]) => (
                      <div key={questionId} className="flex items-center justify-between">
                        <span className="font-medium">Question {questionId.replace(/^q/, '')}</span>
                        <div className="flex items-center gap-3">
                          <Badge variant="default">{data.score}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="detailed" className="space-y-4">
              {questionEntries.map(([questionId, data]) => (
                <Card key={questionId}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">Question {questionId.replace(/^q/, '')}</CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge variant="default">{data.score}</Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-2">AI Feedback:</h4>
                      <div className="bg-muted/50 rounded-lg p-4">
                        <p className="text-sm leading-relaxed">{data.feedback}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
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
