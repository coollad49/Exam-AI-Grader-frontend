import { useEffect, useRef, useCallback } from "react"

interface SessionStatusData {
  id: string
  status: string
  completedStudents: number
  totalStudents: number
  failedStudents: number
  processingStudents: number
  pendingStudents: number
}

interface UseSessionStatusPollingOptions {
  sessionId: string
  enabled?: boolean
  interval?: number
  onStatusChange?: (status: SessionStatusData) => void
  onCompleted?: () => void
}

export function useSessionStatusPolling({
  sessionId,
  enabled = true,
  interval = 5000, // Poll every 5 seconds
  onStatusChange,
  onCompleted,
}: UseSessionStatusPollingOptions) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastStatusRef = useRef<string | null>(null)

  const checkSessionStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}/status`)
      if (!response.ok) {
        console.error("Failed to fetch session status:", response.status)
        return
      }

      const statusData: SessionStatusData = await response.json()
      
      // Check if status changed
      if (lastStatusRef.current !== statusData.status) {
        lastStatusRef.current = statusData.status
        onStatusChange?.(statusData)

        // Check if session is completed
        if (statusData.status === "COMPLETED") {
          onCompleted?.()
          // Stop polling when completed
          if (intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
          }
        }
      }
    } catch (error) {
      console.error("Error checking session status:", error)
    }
  }, [sessionId, onStatusChange, onCompleted])

  useEffect(() => {
    if (!enabled || !sessionId) {
      return
    }

    // Initial check
    checkSessionStatus()

    // Start polling
    intervalRef.current = setInterval(checkSessionStatus, interval)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [enabled, sessionId, interval, checkSessionStatus])

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const startPolling = useCallback(() => {
    if (!intervalRef.current && enabled && sessionId) {
      intervalRef.current = setInterval(checkSessionStatus, interval)
    }
  }, [enabled, sessionId, interval, checkSessionStatus])

  return {
    stopPolling,
    startPolling,
    checkNow: checkSessionStatus,
  }
}
