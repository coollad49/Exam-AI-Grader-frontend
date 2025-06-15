"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
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

export default function GradingSessionDetail({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null)
  const [session, setSession] = useState<GradingSessionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchSessionDetails()
  }, [params.id])

  const fetchSessionDetails = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch(`/api/sessions/${params.id}`)
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
    
    // Convert feedback array to object format expected by modal
    const feedbackObj: { [key: string]: { score: number; feedback: string } } = {}
    student.questionScores?.forEach((score: any) => {
      const feedback = student.feedback?.find((f: any) => f.questionId === score.questionId)
      feedbackObj[score.questionId] = {
        score: score.score,
        feedback: feedback?.feedback || "No feedback available"
      }
    })

    return {
      id: student.id,
      name: student.name,
      score: student.percentage || 0,
      status: student.status,
      feedback: feedbackObj
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
    <div className="flex flex-col gap-6 p-6">
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
          {transformedSession && <SessionOverview session={transformedSession} />}
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
            sessionId={params.id} 
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
