"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ChevronLeft, Download, Search, Loader2, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { SessionOverview } from "@/components/session-overview"
import { StudentResults } from "@/components/student-results"
import { StudentDetailModal } from "@/components/student-detail-modal"
import { SessionLogStream } from "@/components/session-log-stream"
import { useSessionStatusPolling } from "@/hooks/use-session-status-polling"

import { toast } from "sonner"
interface GradingSessionDetail {
  id: string
  title: string
  subject: string
  examYear: string
  status: string
  numStudents: number
  averageScore?: number
  highestScore?: number
  lowestScore?: number
  passingRate?: number
  createdAt: string
  updatedAt: string
  startedAt?: string
  completedAt?: string
  user: {
    id: string
    name: string
    email: string
  }
  students: Array<{
    id: string
    name: string
    studentId?: string
    fileName?: string
    totalScore?: number
    maxScore?: number
    percentage?: number
    status: string
    gradedAt?: string
    questionScores: Array<{
      questionId: string
      score: number
      maxScore: number
    }>
    feedback: Array<{
      questionId: string
      feedback: string
      type: string
    }>
  }>
  _count: {
    students: number
    logs: number
  }
}

export default function GradingSessionDetail() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null)
  const [session, setSession] = useState<GradingSessionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const paramsId = params.id as string
  // Poll session status to keep data fresh
  useSessionStatusPolling({
    sessionId: paramsId,
    enabled: !!session && (session.status === "PENDING" || session.status === "IN_PROGRESS"),
    interval: 10000, // Poll every 10 seconds for session detail page
    onStatusChange: (statusData) => {
      if (statusData.status !== session?.status) {
        // Refresh session data when status changes
        fetchSessionDetails()
      }
    },
    onCompleted: () => {
      // Refresh data when session completes
      fetchSessionDetails()
      toast.success("Grading completed!", {
        description: "All students have been graded successfully.",
      })
    },
  })

  useEffect(() => {
    fetchSessionDetails()
  }, [paramsId])

  const fetchSessionDetails = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch(`/api/sessions/${paramsId}`)
      if (!response.ok) {
        throw new Error(`Failed to fetch session: ${response.status}`)
      }
      
      const data = await response.json()
      setSession(data)
    } catch (err) {
      console.error("Error fetching session details:", err)
      setError(err instanceof Error ? err.message : "Failed to load session details")
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric"
    })
  }

  const formatStatus = (status: string) => {
    switch (status.toLowerCase()) {
      case "in_progress":
        return "In Progress"
      case "completed":
        return "Completed"
      case "pending":
        return "Pending"
      case "failed":
        return "Failed"
      case "cancelled":
        return "Cancelled"
      default:
        return status
    }
  }

  const filteredStudents = session?.students?.filter((student) => 
    student.name.toLowerCase().includes(searchQuery.toLowerCase())
  ) || []

  // Transform session data for SessionOverview component
  const transformedSession = session ? {
    id: session.id,
    title: session.title,
    subject: session.subject,
    year: session.examYear,
    date: formatDate(session.createdAt),
    students: session._count.students,
    status: session.status,
    averageScore: session.averageScore || 0,
    highestScore: session.highestScore || 0,
    lowestScore: session.lowestScore || 0,
    passingRate: session.passingRate || 0,
  } : null

  // Transform students data for StudentResults component
  const transformedStudents = filteredStudents.map(student => ({
    id: student.id,
    name: student.name,
    score: student.percentage || 0,
    status: student.status,
  }))

  // Transform student data for StudentDetailModal
  const transformStudentForModal = (student: any) => {
    if (!student) return null
    
    // Convert feedback and scores to a more detailed format
    const questionData: { [key: string]: { score: number; maxScore: number; feedback: string } } = {}
    
    // First, populate with question scores
    student.questionScores?.forEach((score: any) => {
      questionData[score.questionId] = {
        score: score.score,
        maxScore: score.maxScore,
        feedback: "No feedback available"
      }
    })
    
    // Then, add feedback data
    student.feedback?.forEach((feedback: any) => {
      if (questionData[feedback.questionId]) {
        questionData[feedback.questionId].feedback = feedback.feedback
      } else {
        // If we have feedback but no score, create an entry
        questionData[feedback.questionId] = {
          score: 0,
          maxScore: 10, // Default max score
          feedback: feedback.feedback
        }
      }
    })

    return {
      id: student.id,
      name: student.name,
      totalScore: student.totalScore || 0,
      maxScore: student.maxScore || 0,
      percentage: student.percentage || 0,
      status: student.status,
      gradedAt: student.gradedAt,
      questionData: questionData
    }
  }

  const handleOpenStudentDetail = (studentId: string) => {
    setSelectedStudent(studentId)
  }

  const handleCloseStudentDetail = () => {
    setSelectedStudent(null)
  }

  const getStudentById = (id: string) => {
    return session?.students?.find((student) => student.id === id) || null
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-col gap-2">
          <Button variant="ghost" onClick={() => router.push("/grading-sessions")} className="w-fit">
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back to Sessions
          </Button>
        </div>
        
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="flex items-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span>Loading session details...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-col gap-2">
          <Button variant="ghost" onClick={() => router.push("/grading-sessions")} className="w-fit">
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back to Sessions
          </Button>
        </div>
        
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error}
          </AlertDescription>
        </Alert>
        
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Button onClick={fetchSessionDetails} variant="outline">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-col gap-2">
          <Button variant="ghost" onClick={() => router.push("/grading-sessions")} className="w-fit">
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back to Sessions
          </Button>
        </div>
        
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Session not found
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6  border-2 p-6">
      <div className="flex flex-col gap-2">
        <Button variant="ghost" onClick={() => router.push("/grading-sessions")} className="w-fit">
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back to Sessions
        </Button>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{session?.title}</h1>
            <div className="flex items-center gap-2">
              <Badge>{session?.subject}</Badge>
              <Badge variant="outline">{session?.examYear}</Badge>
              <Badge variant="secondary">{session?.status === "COMPLETED" ? "Completed" : "In Progress"}</Badge>
            </div>
          </div>
          <div className="flex gap-2 mt-2 sm:mt-0">
            <Button>
              <Download className="mr-2 h-4 w-4" />
              Download All Reports
            </Button>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="students">Students</TabsTrigger>
          <TabsTrigger value="logs">Session Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Session Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Subject</Label>
                    <p className="text-sm font-medium">{session.subject}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Exam Year</Label>
                    <p className="text-sm font-medium">{session.examYear}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Total Students</Label>
                    <p className="text-sm font-medium">{session._count.students}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Status</Label>
                    <Badge variant={session.status === "COMPLETED" ? "default" : "secondary"}>
                      {formatStatus(session.status)}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Created</Label>
                    <p className="text-sm font-medium">{formatDate(session.createdAt)}</p>
                  </div>
                  {session.completedAt && (
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Completed</Label>
                      <p className="text-sm font-medium">{formatDate(session.completedAt)}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Student Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Progress by status */}
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Completed</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {session.students.filter(s => s.status === 'COMPLETED').length}
                      </span>
                      <Badge variant="default" className="bg-green-500">
                        {Math.round((session.students.filter(s => s.status === 'COMPLETED').length / session.students.length) * 100)}%
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Processing</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {session.students.filter(s => s.status === 'PROCESSING').length}
                      </span>
                      <Badge variant="secondary">
                        {Math.round((session.students.filter(s => s.status === 'PROCESSING').length / session.students.length) * 100)}%
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Pending</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {session.students.filter(s => s.status === 'PENDING').length}
                      </span>
                      <Badge variant="outline">
                        {Math.round((session.students.filter(s => s.status === 'PENDING').length / session.students.length) * 100)}%
                      </Badge>
                    </div>
                  </div>
                  
                  {session.students.some(s => s.status === 'FAILED') && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Failed</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {session.students.filter(s => s.status === 'FAILED').length}
                        </span>
                        <Badge variant="destructive">
                          {Math.round((session.students.filter(s => s.status === 'FAILED').length / session.students.length) * 100)}%
                        </Badge>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="students" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Student Results</CardTitle>
              <CardDescription>View and manage individual student results and feedback</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search students..."
                    className="pl-8"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <Label htmlFor="performance-filter" className="flex items-center">
                    Filter:
                  </Label>
                  <select
                    id="performance-filter"
                    className="rounded-md border border-input bg-background px-3 py-1 text-sm"
                    defaultValue="all"
                  >
                    <option value="all">All Students</option>
                    <option value="excellent">Excellent</option>
                    <option value="good">Good</option>
                    <option value="needs-improvement">Needs Improvement</option>
                  </select>
                </div>
              </div>

              <StudentResults students={transformedStudents} onViewDetails={handleOpenStudentDetail} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="mt-6">
          <SessionLogStream 
            sessionId={paramsId} 
            sessionStatus={session.status.toLowerCase() as "completed" | "in-progress" | "pending" | "failed"} 
          />
        </TabsContent>
      </Tabs>

      {selectedStudent && (
        <StudentDetailModal 
          student={transformStudentForModal(getStudentById(selectedStudent))} 
          onClose={handleCloseStudentDetail} 
        />
      )}
    </div>
  )
}
