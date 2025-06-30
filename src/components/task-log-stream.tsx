"use client"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Wifi, WifiOff, Download, PauseCircle, PlayCircle, AlertCircle, CheckCircle, XCircle } from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface LogEntry {
  timestamp: string
  message: string
  level: "info" | "warning" | "error" | "success"
  context?: string
  details?: any
}

interface TaskLogStreamProps {
  taskId: string
  status: "completed" | "in-progress" | "pending" | "failed"
}

export function TaskLogStream({ taskId, status }: TaskLogStreamProps) {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [activeTab, setActiveTab] = useState<"all" | "errors" | "system">("all")
  const wsRef = useRef<WebSocket | null>(null)
  const logContainerRef = useRef<HTMLDivElement>(null)
  const pausedLogsRef = useRef<LogEntry[]>([])

  const shouldConnectToWebSocket = status === "in-progress" || status === "pending"

  useEffect(() => {
    if (status === "completed") {
      const loadHistoricalLogs = async () => {
        try {
          const response = await fetch(`/api/tasks/${taskId}/logs`)
          if (response.ok) {
            const historicalLogs = await response.json()
            setLogs((prev) => {
              const merged = [
                ...prev,
                ...historicalLogs.map((log: any) => ({
                  timestamp: new Date(log.createdAt).toISOString(),
                  message: log.message,
                  level: log.level.toLowerCase() as LogEntry["level"],
                  context: log.context,
                  details: log.metadata,
                })),
              ]
              return merged.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
            })
          }
        } catch (error) {
          setLogs((prev) => [
            ...prev,
            {
              timestamp: new Date().toISOString(),
              message: "Task completed - historical logs not available",
              level: "info",
              context: "system",
            },
          ])
        }
      }
      loadHistoricalLogs()
      return
    }
  }, [taskId, status])

  useEffect(() => {

    if (!shouldConnectToWebSocket) {
      console.log(`[TaskLogStream] Skipping WebSocket connection - status: ${status}`)
      return
    }
    console.log(`[TaskLogStream] Connecting to WebSocket for task ${taskId}`)

    const connectWebSocket = () => {
      try {
        const ws = new WebSocket(`ws://localhost:8000/ws/grading-status/${taskId}/`)
        wsRef.current = ws
        
        ws.onopen = () => {
          console.log(`[TaskLogStream] WebSocket connected for task ${taskId}`)
          setIsConnected(true)
          setLogs((prev) => [
            ...prev,
            {
              timestamp: new Date().toLocaleTimeString(),
              message: "Connected to log stream",
              level: "success",
              context: "system",
            },
          ])
        }
        
        ws.onmessage = async (event) => {
          console.log(`[TaskLogStream] Received WebSocket message for task ${taskId}:`, event.data)
          
          try {
            const data = JSON.parse(event.data)
            console.log(`[TaskLogStream] Parsed data:`, data)
            
            // Support both old and new formats
            let logEntry: LogEntry
            if (data.status && data.timestamp && data.message) {
              // New backend format
              logEntry = {
                timestamp: new Date(data.timestamp).toLocaleTimeString(),
                message: data.message,
                level: getLevelFromStatus(data.status),
                context: data.status,
                details: data.details,
              }
            } else {
              // Fallback to old format
              logEntry = {
                ...data,
                timestamp: data.timestamp ? new Date(data.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString(),
              }
            }
            
            console.log(`[TaskLogStream] Created log entry:`, logEntry)
            
            // Save to database for persistence (if we have sessionId)
            // Note: Task log stream doesn't have sessionId, so we'll need to find it
            try {
              // Find the session ID by looking up the student with this taskId
              const studentResponse = await fetch(`/api/tasks/${taskId}/student`)
              if (studentResponse.ok) {
                const studentData = await studentResponse.json()
                if (studentData.sessionId) {
                  await fetch(`/api/sessions/${studentData.sessionId}/logs`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      level: logEntry.level,
                      message: logEntry.message,
                      context: logEntry.context || 'grading',
                      studentId: studentData.studentId,
                      metadata: logEntry.details,
                    }),
                  })
                  console.log(`[TaskLogStream] Saved log to database for task ${taskId}`)
                }
              }
            } catch (dbError) {
              console.error('Failed to save task log to database:', dbError)
              // Continue showing in UI even if DB save fails
            }
            
            // Immediately update database when task completes
            if (data.status === 'COMPLETED' || data.status === 'SUCCESS') {
              try {
                console.log(`[TaskLogStream] Task ${taskId} completed, updating database with result:`, data.result || data.results)
                await fetch(`/api/tasks/${taskId}/update-status`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    status: 'COMPLETED',
                    result: data.result || data.results || data,
                    error: data.error,
                  }),
                })
                console.log(`[TaskLogStream] Immediately updated task ${taskId} to COMPLETED`)
              } catch (updateError) {
                console.error('Failed to immediately update task status:', updateError)
              }
            } else if (data.status === 'FAILED' || data.status === 'ERROR') {
              try {
                await fetch(`/api/tasks/${taskId}/update-status`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    status: 'FAILED',
                    error: data.error || data.message,
                  }),
                })
                console.log(`[TaskLogStream] Immediately updated task ${taskId} to FAILED`)
              } catch (updateError) {
                console.error('Failed to immediately update task status:', updateError)
              }
            } else if (data.status === 'PROCESSING' || data.status === 'PROCESSING_PDF') {
              try {
                await fetch(`/api/tasks/${taskId}/update-status`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    status: 'PROCESSING',
                  }),
                })
                console.log(`[TaskLogStream] Immediately updated task ${taskId} to PROCESSING`)
              } catch (updateError) {
                console.error('Failed to immediately update task status:', updateError)
              }
            }
            
            if (isPaused) {
              pausedLogsRef.current.push(logEntry)
              console.log(`[TaskLogStream] Log paused for task ${taskId}`)
            } else {
              setLogs((prev) => {
                const merged = [...prev, logEntry]
                return merged.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
              })
            }
          } catch (error) {
            console.error(`[TaskLogStream] Error parsing log message for task ${taskId}:`, error)
          }
        }
        
        ws.onclose = (event) => {
          console.log(`[TaskLogStream] WebSocket closed for task ${taskId}:`, event.code, event.reason)
          setIsConnected(false)
          setLogs((prev) => [
            ...prev,
            {
              timestamp: new Date().toLocaleTimeString(),
              message: "Disconnected from log stream",
              level: "warning",
              context: "system",
            },
          ])
          setTimeout(connectWebSocket, 3000)
        }
        
        ws.onerror = (error) => {
          console.error(`[TaskLogStream] WebSocket error for task ${taskId}:`, error)
          setIsConnected(false)
          setLogs((prev) => [
            ...prev,
            {
              timestamp: new Date().toLocaleTimeString(),
              message: "Connection error",
              level: "error",
              context: "system",
            },
          ])
        }
        
        return ws
      } catch (error) {
        console.error(`[TaskLogStream] Failed to create WebSocket connection for task ${taskId}:`, error)
        return null
      }
    }
    
    const ws = connectWebSocket()
    return () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        console.log(`[TaskLogStream] Cleaning up WebSocket for task ${taskId}`)
        ws.close()
      }
    }
  }, [taskId, shouldConnectToWebSocket])

  useEffect(() => {
    if (!isPaused && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }, [logs, isPaused])

  const togglePause = () => {
    if (isPaused) {
      setLogs((prev) => [...prev, ...pausedLogsRef.current])
      pausedLogsRef.current = []
    }
    setIsPaused(!isPaused)
  }

  const filteredLogs = logs.filter((log) => {
    if (activeTab === "all") return true
    if (activeTab === "errors") return log.level === "error" || log.level === "warning"
    if (activeTab === "system") return log.context === "system"
    return true
  })

  const downloadLogs = () => {
    const logText = logs.map((log) => `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.message}`).join("\n")
    const blob = new Blob([logText], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `task-${taskId}-logs.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const getLogStyle = (level: string) => {
    switch (level) {
      case "error": return "text-red-600"
      case "warning": return "text-amber-600"
      case "success": return "text-green-600"
      default: return "text-blue-600"
    }
  }

  const getLogIcon = (level: string) => {
    switch (level) {
      case "error": return <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
      case "warning": return <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />
      case "success": return <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
      default: return <CheckCircle className="h-4 w-4 text-blue-500 flex-shrink-0" />
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
        <CardTitle className="text-lg">Task Logs</CardTitle>
        <div className="flex items-center gap-2">
          {status === "completed" ? (
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
        {status === "completed" && (
          <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 p-3">
            <div className="flex items-start gap-2">
              <CheckCircle className="mt-0.5 h-4 w-4 text-blue-600 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-blue-800">Task Completed</p>
                <p className="text-blue-700">
                  This grading task has finished processing. Showing historical logs from the grading process.
                </p>
              </div>
            </div>
          </div>
        )}
        <Tabs defaultValue="all" onValueChange={(value) => setActiveTab(value as any)}>
          <TabsList className="mb-2">
            <TabsTrigger value="all">All Logs</TabsTrigger>
            <TabsTrigger value="errors">Errors</TabsTrigger>
            <TabsTrigger value="system">System</TabsTrigger>
          </TabsList>
          <div className="relative">
            <ScrollArea className="h-[400px] border rounded-md bg-muted/20" ref={logContainerRef}>
              <div className="p-3 space-y-1">
                {filteredLogs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {status === "completed" ? "No historical logs available" : "No logs available"}
                  </div>
                ) : (
                  filteredLogs.map((log, index) => (
                    <div key={index} className="flex flex-col gap-1 text-xs">
                      <div className="flex items-start gap-2">
                        <span className="text-muted-foreground font-mono whitespace-nowrap">{new Date(log.timestamp).toLocaleTimeString()}</span>
                        {getLogIcon(log.level)}
                        <span className={`${getLogStyle(log.level)} flex-1`}>
                          {log.context && (
                            <span className="inline-block mr-1 px-1 py-0.5 rounded bg-gray-100 border text-gray-700 text-[10px] font-semibold align-middle">{log.context}</span>
                          )}
                          {log.message}
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
