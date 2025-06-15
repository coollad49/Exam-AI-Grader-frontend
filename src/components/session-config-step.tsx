"use client"

import type React from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface SessionConfigStepProps {
  sessionConfig: {
    examTitle: string
    numStudents: number
    subject: string
    examYear: string
    gradingRubric: string
  }
  setSessionConfig: React.Dispatch<
    React.SetStateAction<{
      examTitle: string
      numStudents: number
      subject: string
      examYear: string
      gradingRubric: string
    }>
  >
}

export function SessionConfigStep({ sessionConfig, setSessionConfig }: SessionConfigStepProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setSessionConfig({
      ...sessionConfig,
      [name]: name === "numStudents" ? Number.parseInt(value) || 0 : value,
    })
  }

  const sampleRubric = `{
  "question1": {
    "total_points": 10,
    "parts": {
      "a": {
        "points": 5,
        "answer": "The correct answer for part a",
        "keywords": ["key1", "key2"]
      },
      "b": {
        "points": 5,
        "answer": "The correct answer for part b",
        "keywords": ["key3", "key4"]
      }
    }
  },
  "question2": {
    "total_points": 15,
    "parts": {
      "a": {
        "points": 8,
        "answer": "The correct answer for question 2a",
        "keywords": ["concept1", "concept2"]
      },
      "b": {
        "points": 7,
        "answer": "The correct answer for question 2b",
        "keywords": ["formula", "calculation"]
      }
    }
  }
}`

  return (
    <div className="space-y-6">
      <div className="grid gap-3">
        <Label htmlFor="examTitle">Exam Title *</Label>
        <Input
          id="examTitle"
          name="examTitle"
          placeholder="e.g., WAEC Mathematics 2024 - May/June"
          value={sessionConfig.examTitle}
          onChange={handleChange}
          required
        />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="grid gap-3">
          <Label htmlFor="subject">Subject *</Label>
          <Input
            id="subject"
            name="subject"
            placeholder="e.g., Mathematics"
            value={sessionConfig.subject}
            onChange={handleChange}
            required
          />
        </div>

        <div className="grid gap-3">
          <Label htmlFor="examYear">Exam Year *</Label>
          <Input
            id="examYear"
            name="examYear"
            placeholder="e.g., 2024"
            value={sessionConfig.examYear}
            onChange={handleChange}
            required
          />
        </div>

        <div className="grid gap-3">
          <Label htmlFor="numStudents">Number of Students *</Label>
          <Input
            id="numStudents"
            name="numStudents"
            type="number"
            min="1"
            max="100"
            placeholder="Enter number"
            value={sessionConfig.numStudents || ""}
            onChange={handleChange}
            required
          />
        </div>
      </div>

      <div className="grid gap-3">
        <Label htmlFor="gradingRubric">Grading Rubric (JSON) *</Label>
        <Textarea
          id="gradingRubric"
          name="gradingRubric"
          placeholder="Paste your JSON grading rubric here..."
          className="min-h-[300px] font-mono text-sm"
          value={sessionConfig.gradingRubric}
          onChange={handleChange}
          required
        />
        <div className="rounded-md border bg-muted/40 p-4">
          <h4 className="text-sm font-medium mb-2">Sample JSON Format:</h4>
          <pre className="text-xs text-muted-foreground overflow-x-auto">{sampleRubric}</pre>
        </div>
        <p className="text-sm text-muted-foreground">
          Provide the grading guide in JSON format. This will be used by the AI grading agent to evaluate student
          answers.
        </p>
      </div>
    </div>
  )
}
