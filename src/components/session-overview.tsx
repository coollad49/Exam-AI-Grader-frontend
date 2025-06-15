import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { BarChart3, CheckCircle2, FileText, XCircle } from "lucide-react"

interface SessionOverviewProps {
  session: {
    id: string
    title: string
    subject: string
    year: string
    date: string
    students: number
    status: string
    averageScore: number
    highestScore: number
    lowestScore: number
    passingRate: number
  }
}

export function SessionOverview({ session }: SessionOverviewProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Average Score</CardTitle>
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{session.averageScore}%</div>
          <Progress value={session.averageScore} className="mt-2" />
          <div className="mt-2 flex justify-between text-xs text-muted-foreground">
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Score Range</CardTitle>
          <FileText className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Highest</p>
              <p className="text-2xl font-bold text-green-600">{session.highestScore}%</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Lowest</p>
              <p className="text-2xl font-bold text-red-600">{session.lowestScore}%</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-5 gap-1">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={`h-8 rounded-sm ${
                  i === 0
                    ? "bg-red-200"
                    : i === 1
                      ? "bg-orange-200"
                      : i === 2
                        ? "bg-yellow-200"
                        : i === 3
                          ? "bg-lime-200"
                          : "bg-green-200"
                }`}
              />
            ))}
          </div>
          <div className="mt-1 flex justify-between text-xs text-muted-foreground">
            <span>0-20</span>
            <span>40</span>
            <span>60</span>
            <span>80</span>
            <span>100</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pass Rate</CardTitle>
          <div className="flex items-center gap-1">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <XCircle className="h-4 w-4 text-red-500" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{session.passingRate}%</div>
          <div className="mt-2 flex h-4 w-full overflow-hidden rounded-full bg-red-100">
            <div className="bg-green-500" style={{ width: `${session.passingRate}%` }} />
          </div>
          <div className="mt-2 flex justify-between text-xs">
            <span className="text-green-600">{Math.round((session.passingRate / 100) * session.students)} Passed</span>
            <span className="text-red-600">
              {session.students - Math.round((session.passingRate / 100) * session.students)} Failed
            </span>
          </div>
        </CardContent>
      </Card>

      <Card className="md:col-span-2 lg:col-span-3">
        <CardHeader>
          <CardTitle>Performance Distribution</CardTitle>
          <CardDescription>Distribution of student scores across different grade ranges</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] w-full">
            <div className="flex h-full items-end gap-2">
              {[
                { range: "0-20%", count: 1, color: "bg-red-500" },
                { range: "21-40%", count: 3, color: "bg-orange-500" },
                { range: "41-60%", count: 12, color: "bg-yellow-500" },
                { range: "61-80%", count: 18, color: "bg-lime-500" },
                { range: "81-100%", count: 8, color: "bg-green-500" },
              ].map((item, i) => (
                <div key={i} className="flex flex-1 flex-col items-center justify-end">
                  <div
                    className={`w-full ${item.color}`}
                    style={{
                      height: `${(item.count / 18) * 100}%`,
                    }}
                  />
                  <div className="mt-2 text-xs">{item.range}</div>
                  <div className="text-xs font-medium">{item.count}</div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
