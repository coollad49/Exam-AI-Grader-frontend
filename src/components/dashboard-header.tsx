import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { PlusCircle } from "lucide-react"
import Link from "next/link"

export function DashboardHeader() {
  return (
    <Card className="border-none shadow-none">
      <CardContent className="flex flex-col gap-4 p-0 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back! Here's an overview of your grading activities.</p>
        </div>
        <Button asChild className="sm:w-auto">
          <Link href="/grading-sessions/new">
            <PlusCircle className="mr-2 h-4 w-4" />
            New Grading Session
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}
