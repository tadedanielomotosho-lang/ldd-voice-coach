import { jsPDF } from 'jspdf'
import { getExecutiveSummary, getLddCoachFeedback, getPracticeGoal } from '@/lib/report/coachFeedback'
import type { Analysis, CoachingItem, FeedbackItem, LDDFrameworkResult } from '@/types'
import { CONTENT_DIMENSIONS, DELIVERY_DIMENSIONS } from '@/types'

export type ReportPdfData = {
  sessionName: string
  studentName: string
  topic: string
  date: string
  wordCount: number
  overall: number
  content: number
  delivery: number
  executiveSummary: string | null
  practiceGoal: string | null
  coachFeedback: string[]
  strengths: FeedbackItem[]
  areas: FeedbackItem[]
  coaching: CoachingItem[]
  analysis: Analysis
}

export function getReportSummary(analysis: Analysis) {
  const raw = analysis.raw_ai_response as Partial<LDDFrameworkResult> | null
  return {
    strengths: analysis.strengths ?? raw?.strengths ?? [],
    areas:     analysis.areas_for_improvement ?? raw?.areas_for_improvement ?? [],
  }
}

function pdfText(text: string): string {
  return text
    .replace(/\u2014/g, '-')
    .replace(/\u2013/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u2022/g, '-')
    .replace(/\u2192/g, '->')
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '')
}

function truncate(text: string, max: number) {
  const clean = pdfText(text).replace(/\s+/g, ' ').trim()
  return clean.length > max ? `${clean.slice(0, max - 3)}...` : clean
}

export function buildReportPdfBytes(data: ReportPdfData): Uint8Array {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const margin = 14
  const pageWidth = 210
  const contentWidth = pageWidth - margin * 2
  let y = 0

  const ensureSpace = (needed: number) => {
    if (y + needed <= 288) return true
    doc.addPage()
    y = 16
    return true
  }

  const writeLines = (text: string, size: number, indent = 0) => {
    doc.setFontSize(size)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(40, 40, 40)
    const lines = doc.splitTextToSize(pdfText(text), contentWidth - indent) as string[]
    for (const line of lines) {
      ensureSpace(size * 0.5)
      doc.text(line, margin + indent, y)
      y += size * 0.42
    }
    return true
  }

  const section = (title: string) => {
    ensureSpace(12)
    y += 2
    doc.setFillColor(37, 99, 235)
    doc.rect(margin, y - 3.5, contentWidth, 6.5, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(255, 255, 255)
    doc.text(title, margin + 2, y + 0.5)
    y += 7
    return true
  }

  doc.setFillColor(30, 64, 175)
  doc.rect(0, 0, pageWidth, 30, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text('LDD Voice Coach', margin, 11)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text('Presentation Analysis Summary', margin, 17)
  doc.text(pdfText(data.date), pageWidth - margin, 11, { align: 'right' })
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text(truncate(data.sessionName, 70), margin, 24)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.text(`${truncate(data.studentName, 40)}  |  ${truncate(data.topic, 80)}`, margin, 28)
  y = 38

  doc.setDrawColor(220, 220, 220)
  doc.setFillColor(248, 250, 252)
  doc.roundedRect(margin, y, 38, 14, 2, 2, 'FD')
  doc.roundedRect(margin + 42, y, 38, 14, 2, 2, 'FD')
  doc.roundedRect(margin + 84, y, 38, 14, 2, 2, 'FD')
  doc.roundedRect(margin + 126, y, 52, 14, 2, 2, 'FD')

  doc.setFontSize(7)
  doc.setTextColor(100, 100, 100)
  doc.text('OVERALL', margin + 3, y + 4)
  doc.text('CONTENT', margin + 45, y + 4)
  doc.text('DELIVERY', margin + 87, y + 4)
  doc.text('WORDS', margin + 129, y + 4)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(30, 64, 175)
  doc.text(`${data.overall}`, margin + 3, y + 11)
  doc.text(`${data.content}`, margin + 45, y + 11)
  doc.text(`${data.delivery}`, margin + 87, y + 11)
  doc.setTextColor(40, 40, 40)
  doc.text(`${data.wordCount}`, margin + 129, y + 11)
  y += 20

  if (section('Coach summary (first page)')) {
    if (data.executiveSummary) {
      writeLines(truncate(data.executiveSummary, 700), 8)
      y += 1
    }
    for (const point of data.coachFeedback) {
      writeLines(`- ${truncate(point, 280)}`, 8, 2)
      y += 0.5
    }
    if (data.practiceGoal) {
      y += 1
      writeLines(`Next practice goal: ${truncate(data.practiceGoal, 280)}`, 8, 2)
    }
  }

  if (section('Score breakdown')) {
    const chunks: string[] = []
    for (const dim of [...CONTENT_DIMENSIONS, ...DELIVERY_DIMENSIONS]) {
      const score = Math.round(Number(data.analysis[dim.key]))
      chunks.push(`${dim.label} ${score}/${dim.maxScore}`)
    }
    writeLines(chunks.join('  |  '), 7.5)
  }

  if (data.strengths.length && section('Strengths (full detail)')) {
    for (const item of data.strengths.slice(0, 4)) {
      writeLines(`${item.title}: ${truncate(item.detail, 320)}`, 8, 2)
      y += 1
    }
  }

  if (data.areas.length && section('Priority improvements (full detail)')) {
    for (const item of data.areas.slice(0, 4)) {
      writeLines(`${item.title}: ${truncate(item.detail, 320)}`, 8, 2)
      y += 1
    }
  }

  if (data.coaching.length && section('Line-by-line coaching')) {
    for (const item of data.coaching.slice(0, 5)) {
      writeLines(
        `- "${truncate(item.what_you_said, 70)}" -> "${truncate(item.suggested_version, 70)}"`,
        7.5,
        2
      )
      writeLines(`  Why: ${truncate(item.why_better, 180)}`, 7, 2)
      y += 0.5
    }
  }

  if (section('Content coaching notes')) {
    const highlights = [
      { label: 'Hook', text: data.analysis.hook_feedback },
      { label: 'Purpose', text: data.analysis.purpose_feedback },
      { label: 'Key points', text: data.analysis.key_points_feedback },
      { label: 'Call to action', text: data.analysis.cta_feedback },
      { label: 'Clarity / grammar', text: data.analysis.clarity_feedback },
    ]
    for (const h of highlights) {
      if (!h.text) continue
      writeLines(`${h.label}: ${truncate(h.text, 420)}`, 7.5, 2)
      y += 0.8
    }
  }

  if (section('Delivery coaching (pace, pauses & breathing, volume)')) {
    const delivery = [
      { label: 'Tone', text: data.analysis.tone_feedback },
      { label: 'Pace', text: data.analysis.pace_feedback },
      { label: 'Pauses & breathing', text: data.analysis.pause_feedback },
      { label: 'Volume', text: data.analysis.volume_feedback },
    ]
    for (const h of delivery) {
      if (!h.text) continue
      writeLines(`${h.label}: ${truncate(h.text, 420)}`, 7.5, 2)
      y += 0.8
    }
  }

  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(130, 130, 130)
    doc.text(
      'LDD Voice Coach  |  Overall = Content (60%) + Delivery (40%)  |  Specific, balanced, actionable coaching',
      margin,
      292
    )
  }

  const buffer = doc.output('arraybuffer')
  return new Uint8Array(buffer)
}

export function reportPdfFilename(sessionName: string): string {
  const safeName = sessionName.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'session'
  return `${safeName}_summary.pdf`
}

/** Convenience helper used by callers that only have an Analysis row. */
export function buildCoachMeta(analysis: Analysis) {
  return {
    coachFeedback: getLddCoachFeedback(analysis),
    executiveSummary: getExecutiveSummary(analysis),
    practiceGoal: getPracticeGoal(analysis),
  }
}
