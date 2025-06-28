"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Eye, Download, MoreHorizontal, PlusCircle, Search, Loader2, AlertCircle } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import Link from "next/link"
import { toast } from "sonner"

interface GradingSession {
  id: string
  title: string
  subject: string
  examYear: string
  sessionStatus: string
  numStudents: number
  averageScore?: number
  highestScore?: number
  lowestScore?: number
  passingRate?: number
  createdAt: string
  updatedAt: string
  startedAt?: string
  completedAt?: string
  _count: {
    students: number
  }
}

export default function GradingSessions() {
  const router = useRouter()
  const [sessions, setSessions] = useState<GradingSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [subjectFilter, setSubjectFilter] = useState("all")
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null)

  useEffect(() => {
    fetchSessions()
  }, [])

  const fetchSessions = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch("/api/sessions")
      if (!response.ok) {
        throw new Error(`Failed to fetch sessions: ${response.status}`)
      }
      
      const data = await response.json()
      setSessions(data)
    } catch (err) {
      console.error("Error fetching sessions:", err)
      setError(err instanceof Error ? err.message : "Failed to load sessions")
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteSession = async (sessionId: string, sessionTitle: string) => {
    if (!confirm(`Are you sure you want to delete "${sessionTitle}"? This action cannot be undone.`)) {
      return
    }

    try {
      setDeletingSessionId(sessionId)
      
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Failed to delete session: ${response.status}`)
      }

      const result = await response.json()
      
      // Remove the session from the local state
      setSessions(prev => prev.filter(session => session.id !== sessionId))
      
      toast.success("Session deleted successfully", {
        description: `"${sessionTitle}" and all its data have been permanently deleted.`
      })
      
    } catch (err) {
      console.error("Error deleting session:", err)
      toast.error("Failed to delete session", {
        description: err instanceof Error ? err.message : "An unexpected error occurred"
      })
    } finally {
      setDeletingSessionId(null)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short", 
      day: "numeric"
    })
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed":
        return "default"
      case "in_progress":
        return "secondary"
      case "pending":
        return "outline"
      default:
        return "outline"
    }
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

  // Filter sessions based on search and filters
  const filteredSessions = sessions.filter((session) => {
    const matchesSearch = session.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         session.subject.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesStatus = statusFilter === "all" || 
                         session.sessionStatus.toLowerCase() === statusFilter.toLowerCase() ||
                         (statusFilter === "in-progress" && session.sessionStatus.toLowerCase() === "in_progress")
    
    const matchesSubject = subjectFilter === "all" || 
                          session.subject.toLowerCase() === subjectFilter.toLowerCase()
    
    return matchesSearch && matchesStatus && matchesSubject
  })

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Grading Sessions</h1>
            <p className="text-muted-foreground">View and manage all your exam grading sessions</p>
          </div>
          <Button asChild className="sm:w-auto">
            <Link href="/grading-sessions/new">
              <PlusCircle className="mr-2 h-4 w-4" />
              New Session
            </Link>
          </Button>
        </div>
        
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="flex items-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span>Loading sessions...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Grading Sessions</h1>
            <p className="text-muted-foreground">View and manage all your exam grading sessions</p>
          </div>
          <Button asChild className="sm:w-auto">
            <Link href="/grading-sessions/new">
              <PlusCircle className="mr-2 h-4 w-4" />
              New Session
            </Link>
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
            <Button onClick={fetchSessions} variant="outline">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-6 p-6 border-2">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Grading Sessions</h1>
          <p className="text-muted-foreground">View and manage all your exam grading sessions</p>
        </div>
        <Button asChild className="sm:w-auto">
          <Link href="/grading-sessions/new">
            <PlusCircle className="mr-2 h-4 w-4" />
            New Session
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Grading Sessions</CardTitle>
          <CardDescription>A list of all your WAEC exam grading sessions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                type="search" 
                placeholder="Search sessions..." 
                className="pl-8" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={subjectFilter} onValueChange={setSubjectFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Subject" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Subjects</SelectItem>
                  <SelectItem value="mathematics">Mathematics</SelectItem>
                  <SelectItem value="english">English</SelectItem>
                  <SelectItem value="physics">Physics</SelectItem>
                  <SelectItem value="chemistry">Chemistry</SelectItem>
                  <SelectItem value="biology">Biology</SelectItem>
                  <SelectItem value="geography">Geography</SelectItem>
                  <SelectItem value="economics">Economics</SelectItem>
                  <SelectItem value="government">Government</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {filteredSessions.length === 0 ? (
            <div className="mt-6 text-center py-12">
              <p className="text-muted-foreground">
                {sessions.length === 0 
                  ? "No grading sessions found. Create your first session to get started."
                  : "No sessions match your current filters."
                }
              </p>
              {sessions.length === 0 && (
                <Button asChild className="mt-4">
                  <Link href="/grading-sessions/new">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Create First Session
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="mt-6 overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-left text-sm font-medium text-muted-foreground">
                      <th className="pb-3 pl-4">Exam Title</th>
                      <th className="pb-3">Subject</th>
                      <th className="pb-3">Year</th>
                      <th className="pb-3">Date Created</th>
                      <th className="pb-3">Students</th>
                      <th className="pb-3">Status</th>
                      <th className="pb-3 pr-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSessions.map((session) => (
                      <tr
                        key={session.id}
                        className="border-b text-sm cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => router.push(`/grading-sessions/${session.id}`)}
                      >
                        <td className="py-3 pl-4 font-medium">{session.title}</td>
                        <td className="py-3">{session.subject}</td>
                        <td className="py-3">{session.examYear}</td>
                        <td className="py-3">{formatDate(session.createdAt)}</td>
                        <td className="py-3">{session._count.students}</td>
                        <td className="py-3">
                          <Badge variant={getStatusBadgeVariant(session.sessionStatus)}>
                            {formatStatus(session.sessionStatus)}
                          </Badge>
                        </td>
                        <td className="py-3 pr-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon" asChild>
                              <Link href={`/grading-sessions/${session.id}`}>
                                <Eye className="h-4 w-4" />
                                <span className="sr-only">View</span>
                              </Link>
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              disabled={session.sessionStatus.toLowerCase() !== "completed"}
                            >
                              <Download className="h-4 w-4" />
                              <span className="sr-only">Download</span>
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                  <span className="sr-only">More</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={() => router.push(`/grading-sessions/${session.id}`)}
                                >
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  disabled={session.sessionStatus.toLowerCase() !== "completed"}
                                >
                                  Download Reports
                                </DropdownMenuItem>
                                <DropdownMenuItem>Clone Session</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  className="text-destructive"
                                  onClick={() => handleDeleteSession(session.id, session.title)}
                                  disabled={deletingSessionId === session.id}
                                >
                                  {deletingSessionId === session.id ? "Deleting..." : "Delete Session"}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing <strong>{filteredSessions.length}</strong> of <strong>{sessions.length}</strong> sessions
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled>
                    Previous
                  </Button>
                  <Button variant="outline" size="sm" disabled>
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
