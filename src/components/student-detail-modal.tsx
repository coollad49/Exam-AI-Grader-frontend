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
    maxScore: number
    percentage: number
    status: string
    gradedAt?: string
    questionData: {
      [key: string]: {
        score: number
        maxScore: number
        feedback: string
      }
    }
  } | null
  onClose: () => void
}

export function StudentDetailModal({ student, onClose }: StudentDetailModalProps) {
  if (!student) return null

  const getScoreColor = (percentage: number) => {
    if (percentage >= 80) return "text-green-600"
    if (percentage >= 60) return "text-amber-600"
    return "text-red-600"
  }

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
            {getStatusIcon(student.status)}
            <Badge variant={getStatusVariant(student.status)}>
              {student.status}
            </Badge>
            <Badge variant="outline" className={getScoreColor(student.percentage)}>
              {student.percentage.toFixed(1)}%
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
                      <p className="text-2xl font-bold text-muted-foreground">{student.maxScore}</p>
                      <p className="text-sm text-muted-foreground">Max Score</p>
                    </div>
                    <div className="text-center">
                      <p className={`text-2xl font-bold ${getScoreColor(student.percentage)}`}>
                        {student.percentage.toFixed(1)}%
                      </p>
                      <p className="text-sm text-muted-foreground">Percentage</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-primary">{totalQuestions}</p>
                      <p className="text-sm text-muted-foreground">Questions</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Progress</span>
                      <span>{student.percentage.toFixed(1)}%</span>
                    </div>
                    <Progress value={student.percentage} className="h-2" />
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
                    {questionEntries.map(([questionId, data]) => {
                      const percentage = (data.score / data.maxScore) * 100
                      return (
                        <div key={questionId} className="flex items-center justify-between">
                          <span className="font-medium">Question {questionId.replace(/^q/, '')}</span>
                          <div className="flex items-center gap-3">
                            <Progress value={percentage} className="w-24" />
                            <span className="w-16 text-right text-sm">
                              {data.score}/{data.maxScore}
                            </span>
                            <Badge variant={percentage >= 80 ? "default" : percentage >= 60 ? "secondary" : "destructive"}>
                              {percentage.toFixed(0)}%
                            </Badge>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Performance Analysis */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Performance Analysis</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm max-w-none">
                    {student.percentage >= 80 ? (
                      <p className="text-green-700">
                        <strong>Excellent Performance:</strong> The student demonstrates exceptional understanding 
                        of the subject matter. Strong analytical skills and comprehensive knowledge are evident 
                        across most questions. This is exemplary work that exceeds expectations.
                      </p>
                    ) : student.percentage >= 60 ? (
                      <p className="text-amber-700">
                        <strong>Good Performance:</strong> The student shows solid understanding of key concepts 
                        with room for improvement in specific areas. With focused study on weaker topics, 
                        the student can achieve even better results.
                      </p>
                    ) : (
                      <p className="text-red-700">
                        <strong>Needs Improvement:</strong> The student requires additional support to master 
                        fundamental concepts. Consider reviewing basic principles and providing extra practice 
                        in areas where performance was below expectations.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="detailed" className="space-y-4">
              {questionEntries.map(([questionId, data]) => {
                const percentage = (data.score / data.maxScore) * 100
                return (
                  <Card key={questionId}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">Question {questionId.replace(/^q/, '')}</CardTitle>
                        <div className="flex items-center gap-2">
                          <Badge variant={percentage >= 80 ? "default" : percentage >= 60 ? "secondary" : "destructive"}>
                            {data.score}/{data.maxScore} ({percentage.toFixed(0)}%)
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Score</span>
                          <span>{data.score} out of {data.maxScore}</span>
                        </div>
                        <Progress value={percentage} className="h-2" />
                      </div>

                      <div>
                        <h4 className="font-medium mb-2">AI Feedback:</h4>
                        <div className="bg-muted/50 rounded-lg p-4">
                          <p className="text-sm leading-relaxed">{data.feedback}</p>
                        </div>
                      </div>

                      {percentage < 100 && (
                        <div className="border-l-4 border-amber-400 pl-4">
                          <h4 className="font-medium text-amber-800 mb-1">Recommendations:</h4>
                          <ul className="text-sm text-amber-700 space-y-1">
                            {percentage < 50 ? (
                              <>
                                <li>• Review fundamental concepts for this question type</li>
                                <li>• Practice similar problems to build confidence</li>
                                <li>• Seek additional help or tutoring if needed</li>
                              </>
                            ) : (
                              <>
                                <li>• Double-check calculations and final answers</li>
                                <li>• Show more detailed working steps</li>
                                <li>• Review any conceptual gaps identified</li>
                              </>
                            )}
                          </ul>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
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
