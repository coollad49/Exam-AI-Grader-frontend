"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Eye, Download } from "lucide-react"

interface StudentResultsProps {
  students: Array<{
    id: string
    name: string
    score: number
    status: string
  }>
  onViewDetails: (studentId: string) => void
}

export function StudentResults({ students, onViewDetails }: StudentResultsProps) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600"
    if (score >= 60) return "text-amber-600"
    return "text-muted-foreground"
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b text-left text-sm font-medium text-muted-foreground">
            <th className="pb-3 pl-4">Student Name</th>
            <th className="pb-3">Score</th>
            <th className="pb-3">Performance</th>
            <th className="pb-3 pr-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {students.length === 0 ? (
            <tr>
              <td colSpan={4} className="py-6 text-center text-muted-foreground">
                No students found matching your search criteria.
              </td>
            </tr>
          ) : (
            students.map((student) => (
              <tr key={student.id} className="border-b text-sm">
                <td className="py-3 pl-4 font-medium">{student.name}</td>
                <td className="py-3">
                  <span className={getScoreColor(student.score)}>{student.score}%</span>
                </td>
                <td className="py-3">
                  <Badge
                    variant="outline"
                    className={
                      student.score >= 80
                        ? "bg-green-50 text-green-700 border-green-200"
                        : student.score >= 60
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-gray-50 text-gray-700 border-gray-200"
                    }
                  >
                    {student.score >= 80 ? "Excellent" : student.score >= 60 ? "Good" : "Needs Improvement"}
                  </Badge>
                </td>
                <td className="py-3 pr-4 text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="icon" onClick={() => onViewDetails(student.id)}>
                      <Eye className="h-4 w-4" />
                      <span className="sr-only">View Details</span>
                    </Button>
                    <Button variant="ghost" size="icon">
                      <Download className="h-4 w-4" />
                      <span className="sr-only">Download</span>
                    </Button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing <strong>{students.length}</strong> students
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
    </div>
  )
}
