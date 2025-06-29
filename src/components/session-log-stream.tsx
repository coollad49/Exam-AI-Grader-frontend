"use client"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Wifi, WifiOff, Download, PauseCircle, PlayCircle, AlertCircle, CheckCircle, XCircle } from "lucide-react"

interface LogEntry {
  taskId?: string
  studentName?: string
  timestamp: string
  message: string
  level: "info" | "warning" | "error" | "success"
  context?: string
  details?: any
  studentId?: string
}

interface TaskLog {
  taskId: string
  studentName?: string
  studentId?: string
}

interface SessionLogStreamProps {
  sessionId: string
  tasks: TaskLog[]
  sessionStatus: "completed" | "in-progress" | "pending" | "failed"
}

export function SessionLogStream({ sessionId, tasks, sessionStatus }: SessionLogStreamProps) {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [activeTab, setActiveTab] = useState<string>("all")
  const [activeStudent, setActiveStudent] = useState<string | null>(null)
  const wsRefs = useRef<Record<string, WebSocket | null>>({})
  const logContainerRef = useRef<HTMLDivElement>(null)
  const pausedLogsRef = useRef<LogEntry[]>([])
  const shouldConnectToWebSocket = sessionStatus === "in-progress" || sessionStatus === "pending"

  // Helper to fetch session logs
  const fetchSessionLogs = async () => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}/logs`)
      if (response.ok) {
        const sessionLogs = await response.json()
        return sessionLogs.map((log: any) => ({
          timestamp: new Date(log.createdAt).toLocaleTimeString(),
          message: log.message,
          level: log.level.toLowerCase() as LogEntry["level"],
          context: log.context,
          details: log.metadata,
          studentId: log.studentId,
          // Map studentId to studentName if available
          studentName: tasks.find(t => t.studentId === log.studentId)?.studentName,
        }))
      }
    } catch (e) {
      console.error("Failed to fetch session logs:", e)
    }
    return []
  }

  // Load historical logs for completed sessions
  useEffect(() => {
    if (sessionStatus === "completed") {
      (async () => {
        const sessionLogs = await fetchSessionLogs()
        setLogs(sessionLogs)
      })()
      return
    }
    
    // For active sessions, also load recent historical logs as a starting point
    if (sessionStatus === "in-progress" || sessionStatus === "pending") {
      (async () => {
        console.log(`[SessionLogStream] Loading initial historical logs for active session`)
        const sessionLogs = await fetchSessionLogs()
        setLogs(sessionLogs)
        console.log(`[SessionLogStream] Loaded ${sessionLogs.length} initial logs`)
      })()
    }
  }, [sessionId, sessionStatus])

  // Connect to WebSocket for real-time logs (only for active sessions)
  useEffect(() => {
    console.log(`[SessionLogStream] WebSocket effect triggered:`, {
      sessionStatus,
      tasksCount: tasks.length,
      tasks: tasks.map(t => ({ taskId: t.taskId, studentName: t.studentName }))
    })
    
    if (!(sessionStatus === "in-progress" || sessionStatus === "pending")) {
      console.log(`[SessionLogStream] Skipping WebSocket connection - session status: ${sessionStatus}`)
      return
    }
    
    // Open a WebSocket for each task
    tasks.forEach((task) => {
      if (wsRefs.current[task.taskId]) {
        console.log(`[SessionLogStream] WebSocket already exists for task ${task.taskId}`)
        return // already connected
      }
      
      console.log(`[SessionLogStream] Connecting WebSocket for task ${task.taskId} (${task.studentName})`)
      
      try {
        const wsUrl = `ws://localhost:8000/ws/grading-status/${task.taskId}/`
        console.log(`[SessionLogStream] Attempting to connect to: ${wsUrl}`)
        
        const ws = new WebSocket(wsUrl)
        wsRefs.current[task.taskId] = ws
        
        ws.onopen = () => {
          console.log(`[SessionLogStream] WebSocket connected for task ${task.taskId}`)
          setIsConnected(true)
          
          // Add connection log to UI
          setLogs((prev) => [...prev, {
            timestamp: new Date().toLocaleTimeString(),
            message: `Connected to real-time log stream for ${task.studentName}`,
            level: "success" as const,
            context: "system",
            taskId: task.taskId,
            studentName: task.studentName,
          }])
        }
        
        ws.onmessage = async (event) => {
          console.log(`[SessionLogStream] Received WebSocket message for task ${task.taskId}:`, event.data)
          
          try {
            const data = JSON.parse(event.data)
            console.log(`[SessionLogStream] Parsed data:`, data)
            
            let logEntry: LogEntry
            if (data.status && data.timestamp && data.message) {
              // New backend format
              logEntry = {
                timestamp: new Date(data.timestamp).toLocaleTimeString(),
                message: data.message,
                level: getLevelFromStatus(data.status),
                context: data.status,
                details: data.details,
                taskId: task.taskId,
                studentName: task.studentName,
              }
            } else {
              // Fallback to old format
              logEntry = {
                ...data,
                timestamp: data.timestamp ? new Date(data.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString(),
                taskId: task.taskId,
                studentName: task.studentName,
              }
            }
            
            console.log(`[SessionLogStream] Created log entry:`, logEntry)
            
            // Save to database for persistence
            try {
              await fetch(`/api/sessions/${sessionId}/logs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  level: logEntry.level,
                  message: logEntry.message,
                  context: logEntry.context || 'grading',
                  studentId: task.studentId,
                  metadata: logEntry.details,
                }),
              })
              console.log(`[SessionLogStream] Saved log to database for task ${task.taskId}`)
            } catch (dbError) {
              console.error('Failed to save log to database:', dbError)
              // Continue showing in UI even if DB save fails
            }
            
            // Immediately update database when task completes
            if (data.status === 'COMPLETED' || data.status === 'SUCCESS') {
              try {
                console.log(`[SessionLogStream] Task ${task.taskId} completed, updating database with result:`, data.result || data.results)
                await fetch(`/api/tasks/${task.taskId}/update-status`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    status: 'COMPLETED',
                    result: data.result || data.results || data,
                    error: data.error,
                  }),
                })
                console.log(`[SessionLogStream] Immediately updated task ${task.taskId} to COMPLETED`)
              } catch (updateError) {
                console.error('Failed to immediately update task status:', updateError)
              }
            } else if (data.status === 'FAILED' || data.status === 'ERROR') {
              try {
                await fetch(`/api/tasks/${task.taskId}/update-status`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    status: 'FAILED',
                    error: data.error || data.message,
                  }),
                })
                console.log(`[SessionLogStream] Immediately updated task ${task.taskId} to FAILED`)
              } catch (updateError) {
                console.error('Failed to immediately update task status:', updateError)
              }
            } else if (data.status === 'PROCESSING' || data.status === 'PROCESSING_PDF') {
              try {
                await fetch(`/api/tasks/${task.taskId}/update-status`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    status: 'PROCESSING',
                  }),
                })
                console.log(`[SessionLogStream] Immediately updated task ${task.taskId} to PROCESSING`)
              } catch (updateError) {
                console.error('Failed to immediately update task status:', updateError)
              }
            }
            
            if (isPaused) {
              pausedLogsRef.current.push(logEntry)
              console.log(`[SessionLogStream] Log paused for task ${task.taskId}`)
            } else {
              setLogs((prev) => {
                const newLogs = [...prev, logEntry]
                console.log(`[SessionLogStream] Added log to UI for task ${task.taskId}, total logs: ${newLogs.length}`)
                return newLogs
              })
            }
          } catch (error) {
            console.error("Error parsing log message:", error)
          }
        }
        
        ws.onclose = (event) => {
          console.log(`[SessionLogStream] WebSocket closed for task ${task.taskId}:`, event.code, event.reason)
          setIsConnected(false)
          
          // Add disconnection log to UI
          setLogs((prev) => [...prev, {
            timestamp: new Date().toLocaleTimeString(),
            message: `Disconnected from log stream for ${task.studentName}`,
            level: "warning" as const,
            context: "system",
            taskId: task.taskId,
            studentName: task.studentName,
          }])
        }
        
        ws.onerror = (error) => {
          console.error(`[SessionLogStream] WebSocket error for task ${task.taskId}:`, error)
          setIsConnected(false)
        }
      } catch (error) {
        console.error("Failed to establish WebSocket connection:", error)
      }
    })
    
    // Cleanup
    return () => {
      console.log(`[SessionLogStream] Cleaning up WebSocket connections`)
      Object.values(wsRefs.current).forEach((ws) => {
        if (ws && ws.readyState === WebSocket.OPEN) ws.close()
      })
      wsRefs.current = {}
    }
  }, [tasks, sessionStatus, isPaused])

  // Auto-scroll to bottom of logs unless paused
  useEffect(() => {
    if (!isPaused && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }, [logs, isPaused])

  // Pause/resume logic
  const togglePause = () => {
    if (isPaused) {
      setLogs((prev) => [...prev, ...pausedLogsRef.current])
      pausedLogsRef.current = []
    }
    setIsPaused(!isPaused)
  }

  // Filtering/grouping
  const students = Array.from(new Set(tasks.map((t) => t.studentName).filter(Boolean)))
  const filteredLogs = logs.filter((log) => {
    if (activeTab === "all") return !activeStudent || log.studentName === activeStudent
    if (activeTab === "errors") return (log.level === "error" || log.level === "warning") && (!activeStudent || log.studentName === activeStudent)
    if (activeTab === "system") return log.context === "system" && (!activeStudent || log.studentName === activeStudent)
    return true
  })

  // Download logs as text file
  const downloadLogs = () => {
    const logText = logs.map((log) => `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.message}`).join("\n")

    const blob = new Blob([logText], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `session-logs.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Get log entry style based on level
  const getLogStyle = (level: string) => {
    switch (level) {
      case "error":
        return "text-red-600"
      case "warning":
        return "text-amber-600"
      case "success":
        return "text-green-600"
      default:
        return "text-blue-600"
    }
  }

  // Get log icon based on level
  const getLogIcon = (level: string) => {
    switch (level) {
      case "error":
        return <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
      case "warning":
        return <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />
      case "success":
        return <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
      default:
        return <CheckCircle className="h-4 w-4 text-blue-500 flex-shrink-0" />
    }
  }

  // Add a helper to map status to level
  function getLevelFromStatus(status: string): LogEntry["level"] {
    if (!status) return "info"
    if (status.includes("ERROR") || status.includes("FAILED") || status.includes("MISSING")) return "error"
    if (status.includes("WARNING")) return "warning"
    if (status.includes("COMPLETED") || status.includes("SUCCESS")) return "success"
    return "info"
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg">All Task Logs</CardTitle>
        <div className="flex items-center gap-2">
          {sessionStatus === "completed" ? (
            <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
              <CheckCircle className="mr-1 h-3 w-3" /> Completed
            </Badge>
          ) : isConnected ? (
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              <Wifi className="mr-1 h-3 w-3" /> Live
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
              <WifiOff className="mr-1 h-3 w-3" /> Disconnected
            </Badge>
          )}

          {students.length > 1 && (
            <select
              className="border rounded px-2 py-1 text-sm"
              value={activeStudent || ""}
              onChange={(e) => setActiveStudent(e.target.value || null)}
            >
              <option value="">All Students</option>
              {students.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          )}

          {shouldConnectToWebSocket && (
            <Button variant="outline" size="sm" onClick={togglePause}>
              {isPaused ? (
                <>
                  <PlayCircle className="mr-1 h-4 w-4" /> Resume
                </>
              ) : (
                <>
                  <PauseCircle className="mr-1 h-4 w-4" /> Pause
                </>
              )}
            </Button>
          )}

          <Button variant="outline" size="sm" onClick={downloadLogs}>
            <Download className="mr-1 h-4 w-4" /> Export
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {sessionStatus === "completed" && (
          <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 p-3">
            <div className="flex items-start gap-2">
              <CheckCircle className="mt-0.5 h-4 w-4 text-blue-600 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-blue-800">Session Completed</p>
                <p className="text-blue-700">
                  This session has finished processing. Showing historical logs from the grading process.
                </p>
              </div>
            </div>
          </div>
        )}

        <Tabs defaultValue="all" onValueChange={setActiveTab}>
          <TabsList className="mb-2">
            <TabsTrigger value="all">All Logs</TabsTrigger>
            <TabsTrigger value="errors">Errors</TabsTrigger>
            <TabsTrigger value="system">System</TabsTrigger>
          </TabsList>
          <div className="relative">
            <ScrollArea className="h-[300px] border rounded-md bg-muted/20" ref={logContainerRef}>
              <div className="p-3 space-y-1">
                {filteredLogs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {sessionStatus === "completed" ? "No historical logs available" : "No logs available"}
                  </div>
                ) : (
                  filteredLogs.map((log, index) => (
                    <div key={index} className="flex flex-col gap-1 text-xs">
                      <div className="flex items-start gap-2">
                        <span className="text-muted-foreground font-mono whitespace-nowrap">{log.timestamp}</span>
                        {getLogIcon(log.level)}
                        <span className={`${getLogStyle(log.level)} flex-1`}>
                          {log.context && (
                            <span className="inline-block mr-1 px-1 py-0.5 rounded bg-gray-100 border text-gray-700 text-[10px] font-semibold align-middle">{log.context}</span>
                          )}
                          {log.message}
                          {log.studentName && (
                            <span className="ml-1 text-muted-foreground">({log.studentName})</span>
                          )}
                        </span>
                      </div>
                      {log.details && (
                        <div className="ml-8 text-xs text-gray-500 whitespace-pre-wrap">
                          {typeof log.details === "object" ? JSON.stringify(log.details, null, 2) : String(log.details)}
                        </div>
                      )}
                    </div>
                  ))
                )}
                {shouldConnectToWebSocket && isPaused && pausedLogsRef.current.length > 0 && (
                  <div className="sticky bottom-0 w-full bg-amber-50 border-t border-amber-200 p-2 text-center text-xs text-amber-700">
                    {pausedLogsRef.current.length} new log entries while paused
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </Tabs>
      </CardContent>
    </Card>
  )
}
