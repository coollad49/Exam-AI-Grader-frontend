"use client"

import type React from "react"
import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { FileUp, Check, AlertCircle, X } from "lucide-react"
import { toast } from "sonner"
interface Student {
  id: string
  name: string
  file: File | null
}

interface StudentUploadStepProps {
  students: Student[]
  setStudents: React.Dispatch<React.SetStateAction<Student[]>>
}

export function StudentUploadStep({ students, setStudents }: StudentUploadStepProps) {
  const [activeStudent, setActiveStudent] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleNameChange = (id: string, name: string) => {
    setStudents(students.map((student) => (student.id === id ? { ...student, name } : student)))
  }

  const handleFileUpload = (id: string, file: File | null) => {
    if (file && file.type !== "application/pdf") {
      toast.error("Invalid file type", {
        description: "Please upload a PDF file only",
      })
      return
    }

    setStudents(students.map((student) => (student.id === id ? { ...student, file } : student)))

    if (file) {
      toast.info("File uploaded", {
        description: `PDF uploaded for ${students.find((s) => s.id === id)?.name || "student"}`,
      })
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null
    handleFileUpload(students[activeStudent].id, file)
    // Reset input value to allow re-uploading the same file
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleNextStudent = () => {
    if (activeStudent < students.length - 1) {
      setActiveStudent(activeStudent + 1)
    }
  }

  const handlePreviousStudent = () => {
    if (activeStudent > 0) {
      setActiveStudent(activeStudent - 1)
    }
  }

  const removeFile = (id: string) => {
    handleFileUpload(id, null)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row">
        <ScrollArea className="h-[300px] w-full rounded-md border sm:w-[200px]">
          <div className="p-4">
            <h4 className="mb-4 text-sm font-medium leading-none">Students</h4>
            {students.map((student, index) => (
              <div key={student.id} className="mb-2">
                <Button
                  variant={activeStudent === index ? "default" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => setActiveStudent(index)}
                >
                  <div className="flex w-full items-center">
                    <span className="mr-2">{index + 1}.</span>
                    <span className="truncate">{student.name || `Student ${index + 1}`}</span>
                    <div className="ml-auto flex items-center gap-1">
                      {student.name && <Check className="h-3 w-3 text-green-500" />}
                      {student.file && <Check className="h-3 w-3 text-blue-500" />}
                    </div>
                  </div>
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="flex-1 space-y-6 rounded-md border p-4">
          <div>
            <h3 className="text-lg font-medium">
              Student {activeStudent + 1} of {students.length}
            </h3>
            <p className="text-sm text-muted-foreground">Enter student details and upload their exam booklet</p>
          </div>

          <div className="space-y-4">
            <div className="grid gap-3">
              <Label htmlFor={`student-name-${activeStudent}`}>Student Name *</Label>
              <Input
                id={`student-name-${activeStudent}`}
                placeholder="Enter student name"
                value={students[activeStudent]?.name || ""}
                onChange={(e) => handleNameChange(students[activeStudent].id, e.target.value)}
              />
            </div>

            <div className="grid gap-3">
              <Label htmlFor={`student-file-${activeStudent}`}>Upload Exam Booklet (PDF) *</Label>

              {students[activeStudent]?.file ? (
                <div className="flex items-center gap-2 rounded-md border border-green-500 bg-green-50 p-4">
                  <Check className="h-5 w-5 text-green-600" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-800">{students[activeStudent].file.name}</p>
                    <p className="text-xs text-green-600">
                      {(students[activeStudent].file.size / (1024 * 1024)).toFixed(2)} MB
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeFile(students[activeStudent].id)}
                    className="h-8 w-8 text-green-600 hover:text-green-800"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div
                  className="flex h-32 cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-gray-300 hover:border-gray-400"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="flex flex-col items-center text-gray-500">
                    <FileUp className="mb-2 h-8 w-8" />
                    <p className="text-sm font-medium">Drag and drop or click to upload</p>
                    <p className="text-xs">PDF files only (max 10MB)</p>
                  </div>
                </div>
              )}

              <input ref={fileInputRef} type="file" accept=".pdf" onChange={handleFileInputChange} className="hidden" />
            </div>
          </div>

          <div className="flex justify-between">
            <Button variant="outline" onClick={handlePreviousStudent} disabled={activeStudent === 0}>
              Previous Student
            </Button>
            <Button
              onClick={handleNextStudent}
              disabled={
                activeStudent >= students.length - 1 || !students[activeStudent]?.name || !students[activeStudent]?.file
              }
            >
              Next Student
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-md border bg-muted/40 p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 text-blue-500" />
          <div>
            <h4 className="text-sm font-medium">Upload Requirements</h4>
            <ul className="mt-1 text-sm text-muted-foreground">
              <li>• Each student must have a name and uploaded PDF</li>
              <li>• Only PDF files are accepted (max 10MB per file)</li>
              <li>• Ensure PDFs are clear and readable for accurate grading</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
