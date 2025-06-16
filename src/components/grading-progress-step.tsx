"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { CheckCircle2, AlertCircle, Loader2, XCircle, Clock, Wifi, WifiOff } from "lucide-react"
import { toast } from "sonner"

interface Student {
  id: string
  name: string
  file: File | null
  taskId?: string
  status?: string
}

interface GradingProgressStepProps {
  sessionConfig: {
    examTitle: string
    numStudents: number
    subject: string
    examYear: string
    gradingRubric: string
  }
  students: Student[]
  setStudents: React.Dispatch<React.SetStateAction<Student[]>>
  gradingStarted: boolean
}

interface LogEntry {
  timestamp: string
  message: string
  type: "info" | "success" | "error" | "warning"
}

interface TaskProgress {
  status: string
  logs: LogEntry[]
  result?: any
  error?: string
  wsConnected: boolean
  lastUpdate: string
}

export function GradingProgressStep({
  sessionConfig,
  students,
  setStudents,
  gradingStarted,
}: GradingProgressStepProps) {
  const [taskProgress, setTaskProgress] = useState<Record<string, TaskProgress>>({})
  const wsConnections = useRef<Record<string, WebSocket>>({})
  const pollingIntervals = useRef<Record<string, NodeJS.Timeout>>({})

  // Initialize progress tracking for students with task IDs
  useEffect(() => {
    if (!gradingStarted) return

    students.forEach((student) => {
      if (student.taskId && !taskProgress[student.taskId]) {
        setTaskProgress((prev) => ({ ...prev, [student.taskId!]: {
            status: "PENDING",
            logs: [
              {
                timestamp: new Date().toLocaleTimeString(),
                message: "Grading task initiated",
                type: "info",
              },
            ],
            wsConnected: false,
            lastUpdate: new Date().toISOString(),
          }
        }))

        // Start WebSocket connection
        connectWebSocket(student.taskId, student.name)
      }
    })

    return () => {
      // Cleanup WebSocket connections and polling intervals
      Object.values(wsConnections.current).forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close()
        }
      })
      Object.values(pollingIntervals.current).forEach((interval) => {
        clearInterval(interval)
      })
    }
  }, [gradingStarted, students])

  const connectWebSocket = (taskId: string, studentName: string) => {
    try {
      // Use environment variable for WebSocket URL
      const wsBaseUrl = process.env.NEXT_PUBLIC_GRADING_WS_URL || "ws://localhost:8000"
      const wsUrl = `${wsBaseUrl}/ws/grading-status/${taskId}/`
      const ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        setTaskProgress((prev) => ({
          ...prev,
          [taskId]: {
            ...prev[taskId],
            wsConnected: true,
            lastUpdate: new Date().toISOString(),
          },
        }))

        addLog(taskId, "WebSocket connected - receiving real-time updates", "success")
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          handleWebSocketMessage(taskId, data)
        } catch (error) {
          console.error("Error parsing WebSocket message:", error)
          addLog(taskId, "Error parsing WebSocket message", "error")
        }
      }

      ws.onclose = () => {
        setTaskProgress((prev) => ({
          ...prev,
          [taskId]: {
            ...prev[taskId],
            wsConnected: false,
            lastUpdate: new Date().toISOString(),
          },
        }))

        addLog(taskId, "WebSocket disconnected - falling back to polling", "warning")

        // Start polling as fallback
        startPolling(taskId, studentName)
      }

      ws.onerror = (error) => {
        console.error("WebSocket error:", error)
        addLog(taskId, "WebSocket connection failed - using polling instead", "warning")

        // Start polling as fallback
        startPolling(taskId, studentName)
      }

      wsConnections.current[taskId] = ws
    } catch (error) {
      console.error("Failed to create WebSocket connection:", error)
      addLog(taskId, "Failed to establish WebSocket connection - using polling", "warning")
      startPolling(taskId, studentName)
    }
  }

  const handleWebSocketMessage = (taskId: string, data: any) => {
    const { status, details } = data

    setTaskProgress((prev) => ({
      ...prev,
      [taskId]: {
        ...prev[taskId],
        status,
        lastUpdate: new Date().toISOString(),
      },
    }))

    // Add log entry
    if (details?.message) {
      const logType = status === "ERROR" ? "error" : status === "COMPLETED" ? "success" : "info"

      addLog(taskId, details.message, logType)
    }

    // Handle completion
    if (status === "COMPLETED" && details?.results) {
      setTaskProgress((prev) => ({
        ...prev,
        [taskId]: {
          ...prev[taskId],
          result: details.results,
        },
      }))

      toast.success("Grading completed", {
        description: `Task ${taskId} completed successfully`,
      })
    }

    // Handle errors
    if (status === "ERROR") {
      const errorMessage = details?.message || "Unknown error occurred"
      setTaskProgress((prev) => ({
        ...prev,
        [taskId]: {
          ...prev[taskId],
          error: errorMessage,
        },
      }))

      toast.error("Grading failed", {
        description: `Task ${taskId}: ${errorMessage}`,
      })
    }
  }

  const startPolling = (taskId: string, studentName: string) => {
    if (pollingIntervals.current[taskId]) {
      clearInterval(pollingIntervals.current[taskId])
    }

    const pollStatus = async () => {
      try {
        const response = await fetch(`/api/grade/status/${taskId}/`)
        if (response.ok) {
          const data = await response.json()

          setTaskProgress((prev) => ({
            ...prev,
            [taskId]: {
              ...prev[taskId],
              status: data.status,
              lastUpdate: new Date().toISOString(),
            },
          }))

          // Add progress log if available
          if (data.progress?.message) {
            addLog(taskId, data.progress.message, "info")
          }

          // Handle completion
          if (data.status === "SUCCESS" && data.result) {
            setTaskProgress((prev) => ({
              ...prev,
              [taskId]: {
                ...prev[taskId],
                result: data.result,
              },
            }))

            addLog(taskId, "Grading completed successfully", "success")
            clearInterval(pollingIntervals.current[taskId])

            toast.success("Grading completed", {
              description: `${studentName}'s exam has been graded`,
            })
          }

          // Handle failure
          if (data.status === "FAILURE") {
            const errorMessage = data.error || "Unknown error occurred"
            setTaskProgress((prev) => ({
              ...prev,
              [taskId]: {
                ...prev[taskId],
                error: errorMessage,
              },
            }))

            addLog(taskId, `Error: ${errorMessage}`, "error")
            clearInterval(pollingIntervals.current[taskId])

            toast.error("Grading failed", {
              description: `${studentName}: ${errorMessage}`,
            })
          }
        }
      } catch (error) {
        console.error("Polling error:", error)
        addLog(taskId, "Failed to fetch status update", "error")
      }
    }

    // Poll every 2 seconds
    pollingIntervals.current[taskId] = setInterval(pollStatus, 2000)

    // Initial poll
    pollStatus()
  }

  const addLog = (taskId: string, message: string, type: LogEntry["type"]) => {
    setTaskProgress((prev) => ({
      ...prev,
      [taskId]: {
        ...prev[taskId],
        logs: [
          ...prev[taskId].logs,
          {
            timestamp: new Date().toLocaleTimeString(),
            message,
            type,
          },
        ],
      },
    }))
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "COMPLETED":
      case "SUCCESS":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />
      case "ERROR":
      case "FAILURE":
        return <XCircle className="h-5 w-5 text-red-500" />
      case "PENDING":
      case "PROGRESS":
      case "PROCESSING_PDF":
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
      default:
        return <Clock className="h-5 w-5 text-gray-500" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "COMPLETED":
      case "SUCCESS":
        return <Badge className="bg-green-500">Completed</Badge>
      case "ERROR":
      case "FAILURE":
        return <Badge variant="destructive">Failed</Badge>
      case "PROCESSING_PDF":
        return <Badge variant="secondary">Processing PDF</Badge>
      case "PROGRESS":
        return <Badge variant="secondary">In Progress</Badge>
      case "PENDING":
        return <Badge variant="outline">Pending</Badge>
      default:
        return <Badge variant="outline">Unknown</Badge>
    }
  }

  if (!gradingStarted) {
    // Show review before starting
    const completedStudents = students.filter((student) => student.file).length
    const pendingStudents = students.length - completedStudents

    return (
      <div className="space-y-6">
        <div className="rounded-md border bg-muted/40 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 text-blue-500" />
            <div>
              <h4 className="text-sm font-medium">Ready to Start Grading</h4>
              <p className="text-sm text-muted-foreground">
                Please review the session details below. Once you click "Start Grading", the AI grading agent will begin
                processing the exam papers with real-time progress monitoring.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-medium">Session Summary</h3>

          <Card>
            <CardContent className="p-4">
              <div className="grid gap-3">
                <div className="flex justify-between border-b pb-2">
                  <span className="font-medium">Exam Title:</span>
                  <span>{sessionConfig.examTitle}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="font-medium">Subject:</span>
                  <span>{sessionConfig.subject}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="font-medium">Exam Year:</span>
                  <span>{sessionConfig.examYear}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="font-medium">Total Students:</span>
                  <span>{students.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Status:</span>
                  <div className="flex gap-2">
                    <Badge variant="default" className="bg-green-500">
                      {completedStudents} Ready
                    </Badge>
                    {pendingStudents > 0 && <Badge variant="outline">{pendingStudents} Pending</Badge>}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <h3 className="text-lg font-medium">Students</h3>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {students.map((student, index) => (
              <Card key={student.id}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    {student.file ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-amber-500" />
                    )}
                    <div className="flex-1 truncate">
                      <p className="font-medium truncate">{student.name || `Student ${index + 1}`}</p>
                      <p className="text-xs text-muted-foreground">
                        {student.file ? "PDF uploaded" : "No PDF uploaded"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Show progress monitoring
  return (
    <div className="space-y-6">
      <div className="rounded-md border bg-blue-50 p-4">
        <div className="flex items-start gap-3">
          <Loader2 className="mt-0.5 h-5 w-5 text-blue-500 animate-spin" />
          <div>
            <h4 className="text-sm font-medium">Grading in Progress</h4>
            <p className="text-sm text-muted-foreground">
              Real-time monitoring of grading progress for each student. This may take several minutes per exam.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6">
        {students.map((student) => {
          if (!student.taskId) return null

          const progress = taskProgress[student.taskId] || {
            status: "PENDING",
            logs: [],
            wsConnected: false,
            lastUpdate: new Date().toISOString(),
          }

          return (
            <Card key={student.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {getStatusIcon(progress.status)}
                    {student.name}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {progress.wsConnected ? (
                      <Wifi className="h-4 w-4 text-green-500" />
                    ) : (
                      <WifiOff className="h-4 w-4 text-amber-500" />
                    )}
                    {getStatusBadge(progress.status)}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Task ID: {student.taskId}</span>
                  <span>•</span>
                  <span>Last update: {new Date(progress.lastUpdate).toLocaleTimeString()}</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <h4 className="text-sm font-medium mb-2">Progress Log</h4>
                    <ScrollArea className="h-32 w-full rounded-md border bg-muted/20 p-3">
                      <div className="space-y-1">
                        {progress.logs.map((log, index) => (
                          <div key={index} className="flex items-start gap-2 text-xs">
                            <span className="text-muted-foreground font-mono">{log.timestamp}</span>
                            <span
                              className={
                                log.type === "error"
                                  ? "text-red-600"
                                  : log.type === "success"
                                    ? "text-green-600"
                                    : log.type === "warning"
                                      ? "text-amber-600"
                                      : "text-foreground"
                              }
                            >
                              {log.message}
                            </span>
                          </div>
                        ))}
                        {progress.logs.length === 0 && (
                          <div className="text-xs text-muted-foreground">Waiting for updates...</div>
                        )}
                      </div>
                    </ScrollArea>
                  </div>

                  {progress.error && (
                    <div className="rounded-md border border-red-200 bg-red-50 p-3">
                      <h4 className="text-sm font-medium text-red-800 mb-1">Error Details</h4>
                      <p className="text-sm text-red-700">{progress.error}</p>
                    </div>
                  )}

                  {progress.result && (
                    <div className="rounded-md border border-green-200 bg-green-50 p-3">
                      <h4 className="text-sm font-medium text-green-800 mb-1">Grading Results</h4>
                      <pre className="text-xs text-green-700 overflow-x-auto">
                        {JSON.stringify(progress.result, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
