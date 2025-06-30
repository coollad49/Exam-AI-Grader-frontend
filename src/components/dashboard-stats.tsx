"use client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart3, FileText, Users } from "lucide-react"
import { useEffect, useState } from "react"

export function DashboardStats() {
  const [stats, setStats] = useState<{
    totalSessions: number
    totalStudentsGraded: number
    averageScore: number
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchStats() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch("/api/monitoring/stats")
        const data = await res.json()
        setStats({
          totalSessions: data.stats.totalSessions ?? 0,
          totalStudentsGraded: data.stats.totalStudentsGraded ?? 0,
          averageScore: data.stats.averageScore ?? 0,
        })
      } catch (e) {
        setError("Failed to load stats")
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [])

  if (loading) {
    return <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">Loading dashboard stats...</div>
  }
  if (error) {
    return <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 text-red-500">{error}</div>
  }
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
          <FileText className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats?.totalSessions ?? 0}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Students Graded</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats?.totalStudentsGraded ?? 0}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Average Score</CardTitle>
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{Math.round((stats?.averageScore ?? 0) * 10) / 10}%</div>
        </CardContent>
      </Card>
    </div>
  )
}
