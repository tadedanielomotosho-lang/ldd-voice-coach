// =============================================
// LDD Voice Coach — Core Types
// =============================================

export type UserRole = 'coach' | 'admin'
export type SessionStatus = 'pending' | 'processing' | 'done' | 'error'
export type JobStatus = 'queued' | 'processing' | 'done' | 'error'

// ── Database row types ──────────────────────

export interface Profile {
  id: string
  full_name: string
  email: string
  role: UserRole
  created_at: string
  updated_at: string
}

export interface Student {
  id: string
  tutor_id: string
  name: string
  email: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Session {
  id: string
  tutor_id: string
  student_id: string | null
  session_name: string
  presentation_topic: string
  audio_storage_path: string | null
  audio_mime_type: string | null
  audio_duration_seconds: number | null
  status: SessionStatus
  recorded_at: string | null
  created_at: string
  updated_at: string
  // joined
  student?: Student | null
}

export interface AnalysisJob {
  id: string
  session_id: string
  status: JobStatus
  error_message: string | null
  attempt_count: number
  queued_at: string
  started_at: string | null
  completed_at: string | null
}

export interface FeedbackItem {
  title: string
  detail: string
}

export interface CoachingItem {
  what_you_said: string
  suggested_version: string
  why_better: string
}

export interface Analysis {
  id: string
  session_id: string
  student_id: string | null
  tutor_id: string
  transcript: string | null
  word_count: number
  // Content
  content_score: number
  hook_score: number
  purpose_score: number
  key_points_score: number
  cta_score: number
  clarity_score: number
  // Delivery
  delivery_score: number
  tone_score: number
  pace_score: number
  pause_score: number
  volume_score: number
  // Overall
  overall_score: number
  // Feedback
  hook_feedback: string | null
  purpose_feedback: string | null
  key_points_feedback: string | null
  cta_feedback: string | null
  clarity_feedback: string | null
  tone_feedback: string | null
  pace_feedback: string | null
  pause_feedback: string | null
  volume_feedback: string | null
  // Coaching
  transcript_coaching: CoachingItem[]
  strengths?: FeedbackItem[]
  areas_for_improvement?: FeedbackItem[]
  raw_ai_response: unknown
  created_at: string
}

// ── AI Pipeline types ───────────────────────

export interface LDDFrameworkResult {
  hook:        { score: number; feedback: string }
  purpose:     { score: number; feedback: string }
  key_points:  { score: number; feedback: string }
  cta:         { score: number; feedback: string }
  clarity:     { score: number; feedback: string }
  tone:        { score: number; feedback: string }
  pace:        { score: number; feedback: string }
  pauses:      { score: number; feedback: string }
  volume:      { score: number; feedback: string }
  transcript_coaching: CoachingItem[]
  strengths:             FeedbackItem[]
  areas_for_improvement: FeedbackItem[]
  ldd_coach_feedback:    string[]
}

export interface ScoreBreakdown {
  content_score:   number
  delivery_score:  number
  overall_score:   number
}

// ── Dashboard types ─────────────────────────

export interface DashboardStats {
  total_students:  number
  total_analyses:  number
  average_score:   number
  recent_sessions: Session[]
}

// ── API types ───────────────────────────────

export interface CreateSessionPayload {
  student_id:           string
  session_name:         string
  presentation_topic:   string
  audio_file:           File
  recorded_at?:         string
}

export interface CreateStudentPayload {
  name:   string
  email?: string
  notes?: string
}

export interface ApiError {
  error: string
  details?: string
}

// ── Report view type ────────────────────────

export interface ReportWithSession {
  analysis: Analysis
  session:  Session
  student:  Student | null
}

// ── Score dimension metadata ─────────────────

export interface ScoreDimension {
  key:      keyof Analysis
  fbKey:    keyof Analysis
  label:    string
  maxScore: number
  category: 'content' | 'delivery'
  description: string
}

export const CONTENT_DIMENSIONS: ScoreDimension[] = [
  { key: 'hook_score',       fbKey: 'hook_feedback',        label: 'Hook',              maxScore: 20, category: 'content',  description: 'Story, question, quote, fact, statistic, or scenario' },
  { key: 'purpose_score',    fbKey: 'purpose_feedback',     label: 'Purpose statement', maxScore: 15, category: 'content',  description: 'Objective, audience understanding, and purpose clarity' },
  { key: 'key_points_score', fbKey: 'key_points_feedback',  label: 'Key point structure',maxScore:30, category: 'content',  description: 'Organization, transitions, and logical flow' },
  { key: 'cta_score',        fbKey: 'cta_feedback',         label: 'Call to action',    maxScore: 15, category: 'content',  description: 'Action, thought, reflection, or next step' },
  { key: 'clarity_score',    fbKey: 'clarity_feedback',     label: 'Message clarity',   maxScore: 20, category: 'content',  description: 'Grammar, comprehension, and coherence' },
]

export const DELIVERY_DIMENSIONS: ScoreDimension[] = [
  { key: 'tone_score',   fbKey: 'tone_feedback',   label: 'Tone variation', maxScore: 25, category: 'delivery', description: 'Monotone → slightly varied → varied → highly engaging' },
  { key: 'pace_score',   fbKey: 'pace_feedback',   label: 'Pace',           maxScore: 25, category: 'delivery', description: 'Too slow → ideal → too fast' },
  { key: 'pause_score',  fbKey: 'pause_feedback',  label: 'Pauses & breathing', maxScore: 25, category: 'delivery', description: 'Insufficient → healthy → excessive pauses' },
  { key: 'volume_score', fbKey: 'volume_feedback', label: 'Volume',         maxScore: 25, category: 'delivery', description: 'Low → inconsistent → strong projection' },
]
