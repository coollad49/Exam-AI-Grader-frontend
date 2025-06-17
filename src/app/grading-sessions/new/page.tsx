"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
// import { useToast } from "@/hooks/use-toast" old toast, use sonner instead
import { toast } from "sonner"
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import { SessionConfigStep } from "@/components/session-config-step"
import { StudentUploadStep } from "@/components/student-upload-step"
import { GradingProgressStep } from "@/components/grading-progress-step"

export default function NewGradingSession() {
  const [step, setStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [gradingStarted, setGradingStarted] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [creatingSession, setCreatingSession] = useState(false)
  const [persistingStudents, setPersistingStudents] = useState(false)
  const router = useRouter()
  // const { toast } = useToast()

  // Session configuration state
  const [sessionConfig, setSessionConfig] = useState({
    examTitle: "",
    numStudents: 0,
    subject: "",
    examYear: "",
    gradingRubric: "",
  })

  // Student details state
  const [students, setStudents] = useState<
    Array<{
      id: string
      name: string
      file: File | null
      taskId?: string
      status?: string
    }>
  >([])

  const handleNextStep = async () => {
    if (step === 1) {
      // Validate step 1
      if (
        !sessionConfig.examTitle ||
        !sessionConfig.subject ||
        !sessionConfig.examYear ||
        !sessionConfig.numStudents ||
        !sessionConfig.gradingRubric
      ) {
        toast.error("Missing information", { description: "Please fill in all required fields",})
        return
      }

      // Validate JSON format
      try {
        JSON.parse(sessionConfig.gradingRubric)
      } catch (error) {
        toast.error("Invalid JSON", {
          description: "Please provide a valid JSON grading rubric",})
        return
      }

      // Create or update grading session in database
      setCreatingSession(true)
      try {
        const requestData = {
          title: sessionConfig.examTitle,
          subject: sessionConfig.subject,
          examYear: sessionConfig.examYear,
          numStudents: parseInt(sessionConfig.numStudents.toString()),
          gradingRubric: sessionConfig.gradingRubric,
        }
        
        console.log("Sending request data:", requestData) // Debug log
        
        let response
        if (sessionId) {
          // Update existing session
          response = await fetch(`/api/sessions/${sessionId}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(requestData),
          })
        } else {
          // Create new session
          response = await fetch("/api/sessions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",  
            },
            body: JSON.stringify(requestData),
          })
        }

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || `Failed to ${sessionId ? 'update' : 'create'} session: ${response.status}`)
        }

        const sessionData = await response.json()
        
        // Only set sessionId if it's a new session
        if (!sessionId) {
          setSessionId(sessionData.id)
        }
        
        toast.success(`${sessionId ? 'Session updated' : 'Session created'} successfully`, {
          description: `Grading session "${sessionConfig.examTitle}" ${sessionId ? 'updated' : 'created'} successfully`,})
      } catch (error: any) {

        toast.error(`Error ${sessionId ? 'updating' : 'creating'} session`, {
          description: error.message || `Failed to ${sessionId ? 'update' : 'create'} grading session`,})

        setCreatingSession(false)
        return
      }
      setCreatingSession(false)

      // Initialize student array based on number of students (only if not already initialized)
      if (students.length === 0 || students.length !== sessionConfig.numStudents) {
        const newStudents = Array.from({ length: sessionConfig.numStudents }, (_, i) => ({
          id: `student-${i + 1}`, // Temporary client ID, will be replaced with DB ID
          name: "",
          file: null,
        }))
        setStudents(newStudents)
      }
      setStep(step + 1)
      return
    }

    if (step === 2) {
      // Validate step 2
      const allStudentsValid = students.every((student) => student.name && student.file)
      if (!allStudentsValid) {
        toast.error("Missing information", {
          description: "Please provide name and upload exam PDF for all students",
        })
        return
      }

      // Create student records in database
      if (!sessionId) {
        toast.error("Session Error", {
          description: "No session ID found. Please go back to step 1 and try again.",
        })
        return
      }

      setPersistingStudents(true)
      try {
        // Create FormData to send both metadata and files
        const formData = new FormData()
        
        // Add session ID
        formData.append("sessionId", sessionId)
        
        // Add student metadata as JSON
        const studentData = students.map(student => ({
          name: student.name,
          tempId: student.id // Send the temporary ID for matching
        }))
        formData.append("students", JSON.stringify(studentData))
        
        // Add each file with a reference to the temporary student ID
        students.forEach(student => {
          if (student.file) {
            formData.append(`file_${student.id}`, student.file)
          }
        })

        const response = await fetch(`/api/sessions/${sessionId}/students`, {
          method: "POST",
          body: formData
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || `Failed to save students: ${response.status}`)
        }

        // Get the created student records with real database IDs
        const createdStudents = await response.json()
        
        // Update our students array with the real database IDs
        const updatedStudents = students.map(student => {
          const dbStudent = createdStudents.find(
            (s: any) => s.tempId === student.id || s.name === student.name
          )
          
          return {
            ...student,
            id: dbStudent?.id || student.id, // Use real DB ID if available
          }
        })
        
        setStudents(updatedStudents)
        
        toast.success("Students Saved", {
          description: `${updatedStudents.length} student records created successfully`,
        })
      } catch (error: any) {
        toast.error("Error Saving Students", {
          description: error.message || "Failed to save student information",
        })
        setPersistingStudents(false)
        return
      }
      setPersistingStudents(false)
    }

    if (step === 3 && !gradingStarted) {
      // Start grading process
      handleStartGrading()
      return
    }

    setStep(step + 1)
  }

  const handlePreviousStep = () => {
    if (gradingStarted) return // Don't allow going back once grading started
    setStep(step - 1)
  }

  const handleStartGrading = async () => {
    setIsSubmitting(true)
    // We'll set gradingStarted conditionally based on success
    // setGradingStarted(true) // Deferred

    let anyTaskSuccessfullyStarted = false
    const updatedStudents = [...students]

    try {
      for (let i = 0; i < updatedStudents.length; i++) {
        const student = updatedStudents[i]
        // Step 2 validation should ensure student.file exists.
        // If somehow a student without a file reaches here, skip them.
        if (!student.file) {
          updatedStudents[i] = { ...student, status: "Skipped - No File", taskId: undefined }
          continue
        }

        try {
          const formData = new FormData()
          formData.append("pdf_file", student.file)
          formData.append("grading_guide_json_str", sessionConfig.gradingRubric)

          const response = await fetch("/api/grade/upload", {
            method: "POST",
            body: formData,
          })

          if (!response.ok) {
            let errorDescription = `Failed to start grading task. Server responded with status ${response.status}.`
            try {
              const errorData = await response.json()
              if (errorData && errorData.error) {
                errorDescription = errorData.error
              }
            } catch (e) {
              // Non-JSON response or parsing error, stick with the status code message
              console.warn(`Could not parse error response body for status ${response.status} for ${student.name}`)
            }
            toast.error(`Error for ${student.name || `Student ${i + 1}`}`,{
              description: errorDescription,
            })
            updatedStudents[i] = { ...student, status: "Error", taskId: undefined }
          } 
          else {
            const result = await response.json()
            updatedStudents[i] = { ...student, taskId: result.task_id, status: "PENDING" }
            anyTaskSuccessfullyStarted = true

            // Update student's taskId and status in the database
            // By this point, student.id should be the real database ID from step 2
            if (student.id && result.task_id) {
              try {
                // Check if the ID is a database ID (not a temp ID like 'student-1')
                if (!student.id.startsWith('student-')) {
                  // Only update the database if we have a real DB ID
                  const studentUpdateResponse = await fetch(`/api/students/${student.id}/grading`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      taskId: result.task_id,
                      status: 'PENDING', // Or use GradingStatus.PENDING from @prisma/client
                    }),
                  });

                  if (!studentUpdateResponse.ok) {
                    const errorData = await studentUpdateResponse.json().catch(() => ({}))
                    console.error(`Failed to update student ${student.id} in DB:`, errorData.error || studentUpdateResponse.statusText);
                    // Optionally, show a specific toast for this failure
                    toast.error(`DB Update Failed for ${student.name || `Student ${i + 1}`}`, {
                      description: `Could not save Task ID to database: ${errorData.error || studentUpdateResponse.statusText}`,
                    })
                    // Decide if this should revert anyTaskSuccessfullyStarted or mark student differently
                  }
                }
              } catch (dbError) {
                console.error(`Error updating student ${student.id} in DB:`, dbError);
                toast.error(`Network Error During DB Update`, {
                  description: `Could not save Task ID for ${student.name || `Student ${i + 1}`} to database.`,
                })
              }
            } else {
              console.warn(`Student ID or Task ID missing for student ${student.name}, cannot update DB.`);
            }

            toast.info(`Grading initiated for ${student.name || `Student ${i + 1}`}`, {
              description: `Task ID: ${result.task_id}`,
            })
          }
        } catch (error: any) { // Catch network errors or other issues with fetch
          console.error(`Network or unexpected error for student ${student.id}:`, error)
          toast.error(`Error for ${student.name || `Student ${i + 1}`}`, {
            description: error.message || "A network error occurred, or the server might be offline. Please try again.",
          })
          updatedStudents[i] = { ...student, status: "Error - Network", taskId: undefined }
        }
      }

      setStudents(updatedStudents)

      if (anyTaskSuccessfullyStarted) {
        setGradingStarted(true) // Grading has indeed started for at least one student
        setStep(step + 1) // Move to the progress view
      } else {
        // No tasks were successfully started
        setGradingStarted(false) // Reset to allow user to try again
        toast.error("Grading Could Not Start", {
          description: "None of the grading tasks could be initiated. Please check server status or error details above and try again.",
          duration: 7000, // Longer duration for this general failure message
        })
        // Stay on the current step (step 3, review page)
      }
    } catch (e) {
      // Catch unexpected errors in the overall try block (should be rare)
      console.error("Unexpected error in handleStartGrading outer try:", e)
      setGradingStarted(false) // Ensure reset
      toast.error("An Unexpected Error Occurred", {
        description: "Something went wrong while trying to start grading. Please try again.",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const getStepTitle = () => {
    if (step === 1) return "Session Configuration"
    if (step === 2) return "Student Details & Exam Upload"
    if (step === 3 && !gradingStarted) return "Review & Start Grading"
    return "Grading Progress"
  }

  const getStepDescription = () => {
    if (step === 1) return "Configure the grading session with exam details and rubrics"
    if (step === 2) return "Provide student names and upload their exam papers for grading"
    if (step === 3 && !gradingStarted) return "Review the session configuration and student details before starting"
    return "Monitoring the real-time progress of grading for each student"
  }

  return (
    <div className="container mx-auto max-w-4xl py-6">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.push("/grading-sessions")}
          className="mb-2"
          disabled={isSubmitting}
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back to Sessions
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">New Grading Session</h1>
        <p className="text-muted-foreground">Create a new session to grade exam papers</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            Step {step}: {getStepTitle()}
          </CardTitle>
          <CardDescription>{getStepDescription()}</CardDescription>
        </CardHeader>
        <CardContent>
          {step === 1 && <SessionConfigStep sessionConfig={sessionConfig} setSessionConfig={setSessionConfig} />}

          {step === 2 && <StudentUploadStep students={students} setStudents={setStudents} />}

          {step === 3 && (
            <GradingProgressStep
              sessionConfig={sessionConfig}
              students={students}
              setStudents={setStudents}
              gradingStarted={gradingStarted}
              sessionId={sessionId || undefined}
            />
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button
            variant="outline"
            onClick={handlePreviousStep}
            disabled={step === 1 || isSubmitting || gradingStarted}
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            Previous
          </Button>

          {step < 3 || !gradingStarted ? (
            <Button onClick={handleNextStep} disabled={isSubmitting || creatingSession || persistingStudents}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Starting...
                </>
              ) : creatingSession ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Session...
                </>
              ) : persistingStudents ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving Students...
                </>
              ) : step === 3 ? (
                "Start Grading"
              ) : (
                <>
                  Next
                  <ChevronRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          ) : (
            <Button onClick={() => router.push("/grading-sessions")} variant="outline">
              View All Sessions
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  )
}
