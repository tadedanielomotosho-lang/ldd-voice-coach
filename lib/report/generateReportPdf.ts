import { jsPDF } from 'jspdf'
import { getLddCoachFeedback } from '@/lib/report/coachFeedback'
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

  const ensureSpace = (needed: number) => y + needed <= 288

  const writeLines = (text: string, size: number, indent = 0) => {
    doc.setFontSize(size)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(40, 40, 40)
    const lines = doc.splitTextToSize(pdfText(text), contentWidth - indent) as string[]
    for (const line of lines) {
      if (!ensureSpace(size * 0.5)) return false
      doc.text(line, margin + indent, y)
      y += size * 0.42
    }
    return true
  }

  const section = (title: string) => {
    if (!ensureSpace(12)) return false
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

  if (data.coachFeedback.length && section('LDD Coach feedback (summary)')) {
    for (const point of data.coachFeedback) {
      if (!writeLines(`- ${truncate(point, 200)}`, 8, 2)) break
      y += 0.5
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
      if (!writeLines(`${item.title}: ${truncate(item.detail, 160)}`, 8, 2)) break
      y += 1
    }
  }

  if (data.areas.length && section('Areas for improvement (full detail)')) {
    for (const item of data.areas.slice(0, 4)) {
      if (!writeLines(`${item.title}: ${truncate(item.detail, 160)}`, 8, 2)) break
      y += 1
    }
  }

  if (data.coaching.length && section('Key suggestions')) {
    for (const item of data.coaching.slice(0, 5)) {
      if (!writeLines(
        `- "${truncate(item.what_you_said, 55)}" -> "${truncate(item.suggested_version, 55)}"`,
        7.5,
        2
      )) break
      y += 0.5
    }
  }

  if (section('Coach notes (highlights)')) {
    const highlights = [
      { label: 'Hook', text: data.analysis.hook_feedback },
      { label: 'Purpose', text: data.analysis.purpose_feedback },
      { label: 'Key points', text: data.analysis.key_points_feedback },
      { label: 'Call to action', text: data.analysis.cta_feedback },
    ]
    for (const h of highlights) {
      if (!h.text) continue
      if (!writeLines(`${h.label}: ${truncate(h.text, 180)}`, 7.5, 2)) break
      y += 0.5
    }
  }

  doc.setFontSize(7)
  doc.setTextColor(130, 130, 130)
  doc.text(
    'LDD Voice Coach  |  Overall = Content (60%) + Delivery (40%)',
    margin,
    292
  )

  const buffer = doc.output('arraybuffer')
  return new Uint8Array(buffer)
}

export function reportPdfFilename(sessionName: string): string {
  const safeName = sessionName.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'session'
  return `${safeName}_summary.pdf`
}
