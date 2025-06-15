import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { DashboardHeader } from "@/components/dashboard-header"
import { DashboardStats } from "@/components/dashboard-stats"
// import { RecentSessions } from "@/components/recent-sessions"
import Link from "next/link"

export default function Dashboard() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <DashboardHeader />
      <DashboardStats />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>New Grading Session</CardTitle>
            <CardDescription>Start a new grading session for WAEC exam papers</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-[120px] items-center justify-center rounded-md border-2 border-dashed">
              <div className="flex flex-col items-center gap-1 text-center">
                <p className="text-sm text-muted-foreground">Create a new session to grade student exams</p>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button asChild className="w-full">
              <Link href="/grading-sessions/new">Start New Session</Link>
            </Button>
          </CardFooter>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>View All Sessions</CardTitle>
            <CardDescription>Access all your previous grading sessions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-[120px] items-center justify-center rounded-md border-2 border-dashed">
              <div className="flex flex-col items-center gap-1 text-center">
                <p className="text-sm text-muted-foreground">View, filter, and manage all your grading sessions</p>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button asChild variant="outline" className="w-full">
              <Link href="/grading-sessions">View All Sessions</Link>
            </Button>
          </CardFooter>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Analytics</CardTitle>
            <CardDescription>View performance analytics and insights</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-[120px] items-center justify-center rounded-md border-2 border-dashed">
              <div className="flex flex-col items-center gap-1 text-center">
                <p className="text-sm text-muted-foreground">Analyze student performance and grading patterns</p>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button asChild variant="outline" className="w-full">
              <Link href="/analytics">View Analytics</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
      {/* Todo: work on this when the grading is working */}
      {/* <RecentSessions /> */}
    </div>
  )
}
