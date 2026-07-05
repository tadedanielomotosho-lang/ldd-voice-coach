import { z } from 'zod'

export function formatZodError(error: z.ZodError): string {
  return error.issues.map(issue => issue.message).join(' ')
}

export const CreateStudentSchema = z.object({
  name:  z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  notes: z.string().max(500).optional(),
})

export const CreateSessionSchema = z.object({
  student_id:         z.string().uuid('Invalid student').optional(),
  student_name:       z.string().min(2, 'Student name must be at least 2 characters').max(100).optional(),
  session_name:       z.string().min(2).max(200).optional(),
  presentation_topic: z.string().min(2).max(300).optional(),
}).refine(data => data.student_id || data.student_name, {
  message: 'Student name is required',
})

export type CreateStudentInput  = z.infer<typeof CreateStudentSchema>
export type CreateSessionInput  = z.infer<typeof CreateSessionSchema>
