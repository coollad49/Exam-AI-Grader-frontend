"use client"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Wifi, WifiOff, Download, PauseCircle, PlayCircle, AlertCircle, CheckCircle, XCircle } from "lucide-react"

interface LogEntry {
  timestamp: string
  message: string
  level: "info" | "warning" | "error" | "success"
  context?: string
  studentId?: string
}

interface SessionLogStreamProps {
  sessionId: string
  sessionStatus: "completed" | "in-progress" | "pending" | "failed"
}

export function SessionLogStream({ sessionId, sessionStatus }: SessionLogStreamProps) {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [activeTab, setActiveTab] = useState<"all" | "errors" | "system">("all")
  const wsRef = useRef<WebSocket | null>(null)
  const logContainerRef = useRef<HTMLDivElement>(null)
  const pausedLogsRef = useRef<LogEntry[]>([])

  // Only connect to WebSocket for active sessions
  const shouldConnectToWebSocket = sessionStatus === "in-progress" || sessionStatus === "pending"

  // Load historical logs for completed sessions
  useEffect(() => {
    if (sessionStatus === "completed") {
      // Load historical logs from API
      const loadHistoricalLogs = async () => {
        try {
          const response = await fetch(`/api/sessions/${sessionId}/logs`)
          if (response.ok) {
            const historicalLogs = await response.json()
            setLogs(
              historicalLogs.map((log: any) => ({
                ...log,
                timestamp: new Date(log.timestamp).toLocaleTimeString(),
              })),
            )
          }
        } catch (error) {
          console.error("Failed to load historical logs:", error)
          setLogs([
            {
              timestamp: new Date().toLocaleTimeString(),
              message: "Session completed - historical logs not available",
              level: "info",
              context: "system",
            },
          ])
        }
      }

      loadHistoricalLogs()
      return
    }
  }, [sessionId, sessionStatus])

  // Connect to WebSocket for real-time logs (only for active sessions)
  useEffect(() => {
    if (!shouldConnectToWebSocket) return

    // Create WebSocket connection
    const connectWebSocket = () => {
      try {
        // Replace with your actual WebSocket endpoint
        const ws = new WebSocket(`ws://localhost:8000/ws/session-logs/${sessionId}/`)
        wsRef.current = ws

        ws.onopen = () => {
          setIsConnected(true)
          setLogs((prev) => [
            ...prev,
            {
              timestamp: new Date().toISOString(),
              message: "Connected to log stream",
              level: "success",
              context: "system",
            },
          ])
        }

        ws.onmessage = (event) => {
          try {
            const logEntry: LogEntry = JSON.parse(event.data)

            // Format timestamp if needed
            if (logEntry.timestamp) {
              const date = new Date(logEntry.timestamp)
              logEntry.timestamp = date.toLocaleTimeString()
            } else {
              logEntry.timestamp = new Date().toLocaleTimeString()
            }

            if (isPaused) {
              pausedLogsRef.current.push(logEntry)
            } else {
              setLogs((prev) => [...prev, logEntry])
            }
          } catch (error) {
            console.error("Error parsing log message:", error)
          }
        }

        ws.onclose = () => {
          setIsConnected(false)
          setLogs((prev) => [
            ...prev,
            {
              timestamp: new Date().toISOString(),
              message: "Disconnected from log stream",
              level: "warning",
              context: "system",
            },
          ])

          // Attempt to reconnect after a delay
          setTimeout(connectWebSocket, 3000)
        }

        ws.onerror = () => {
          setIsConnected(false)
          setLogs((prev) => [
            ...prev,
            {
              timestamp: new Date().toISOString(),
              message: "Connection error",
              level: "error",
              context: "system",
            },
          ])
        }

        return ws
      } catch (error) {
        console.error("Failed to establish WebSocket connection:", error)
        return null
      }
    }

    const ws = connectWebSocket()

    // Cleanup on unmount
    return () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close()
      }
    }
  }, [sessionId, shouldConnectToWebSocket])

  // Auto-scroll to bottom of logs unless paused
  useEffect(() => {
    if (!isPaused && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }, [logs, isPaused])

  // Handle pause/resume
  const togglePause = () => {
    if (isPaused) {
      // Resume - add any logs that came in while paused
      setLogs((prev) => [...prev, ...pausedLogsRef.current])
      pausedLogsRef.current = []
    }
    setIsPaused(!isPaused)
  }

  // Filter logs based on active tab
  const filteredLogs = logs.filter((log) => {
    if (activeTab === "all") return true
    if (activeTab === "errors") return log.level === "error" || log.level === "warning"
    if (activeTab === "system") return log.context === "system"
    return true
  })

  // Download logs as text file
  const downloadLogs = () => {
    const logText = logs.map((log) => `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.message}`).join("\n")

    const blob = new Blob([logText], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `session-${sessionId}-logs.txt`
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

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg">Session Logs</CardTitle>
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

        <Tabs defaultValue="all" onValueChange={(value) => setActiveTab(value as any)}>
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
                    <div key={index} className="flex items-start gap-2 text-xs">
                      <span className="text-muted-foreground font-mono whitespace-nowrap">{log.timestamp}</span>
                      {getLogIcon(log.level)}
                      <span className={`${getLogStyle(log.level)} flex-1`}>
                        {log.message}
                        {log.studentId && (
                          <span className="ml-1 text-muted-foreground">(Student: {log.studentId})</span>
                        )}
                      </span>
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
