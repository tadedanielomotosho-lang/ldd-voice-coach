import { jsPDF } from 'jspdf'
import {
  getExecutiveSummary,
  getFullRedraft,
  getLddCoachFeedback,
  getOverallJustification,
  getPracticeGoal,
} from '@/lib/report/coachFeedback'
import type { Analysis, CoachingItem, FeedbackItem, LDDFrameworkResult } from '@/types'
import { CONTENT_DIMENSIONS, DELIVERY_DIMENSIONS, type ScoreDimension } from '@/types'

export type ReportPdfData = {
  sessionName: string
  studentName: string
  topic: string
  date: string
  wordCount: number
  durationSeconds: number | null
  overall: number
  content: number
  delivery: number
  overallJustification: string | null
  executiveSummary: string | null
  practiceGoal: string | null
  fullRedraft: string | null
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
    .replace(/…/g, '...')
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '')
}

const BRAND = { r: 26, g: 58, b: 92 }
const BRAND_LIGHT = { r: 232, g: 240, b: 248 }
const MUTED = { r: 100, g: 116, b: 139 }
const TEXT = { r: 30, g: 41, b: 59 }
const BORDER = { r: 226, g: 232, b: 240 }
const GREEN = { r: 5, g: 150, b: 105 }
const AMBER = { r: 217, g: 119, b: 6 }

export function buildReportPdfBytes(data: ReportPdfData): Uint8Array {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const margin = 14
  const pageWidth = 210
  const contentWidth = pageWidth - margin * 2
  const pageBottom = 285
  let y = 0
  let pageNum = 1

  const newPage = () => {
    drawFooter()
    doc.addPage()
    pageNum += 1
    y = 18
  }

  const ensureSpace = (needed: number) => {
    if (y + needed > pageBottom) newPage()
  }

  const drawFooter = () => {
    doc.setFontSize(7)
    doc.setTextColor(130, 130, 130)
    doc.setFont('helvetica', 'normal')
    doc.text(
      'LDD Voice Coach  |  Full coaching report with scores  |  Overall = Content (60%) + Delivery (40%)',
      margin,
      292
    )
    doc.text(`Page ${pageNum}`, pageWidth - margin, 292, { align: 'right' })
  }

  const writeWrapped = (
    text: string,
    size: number,
    opts?: { indent?: number; bold?: boolean; color?: { r: number; g: number; b: number }; lineGap?: number }
  ) => {
    const indent = opts?.indent ?? 0
    const lineGap = opts?.lineGap ?? size * 0.42
    doc.setFontSize(size)
    doc.setFont('helvetica', opts?.bold ? 'bold' : 'normal')
    const c = opts?.color ?? TEXT
    doc.setTextColor(c.r, c.g, c.b)
    const lines = doc.splitTextToSize(pdfText(text), contentWidth - indent) as string[]
    for (const line of lines) {
      ensureSpace(lineGap + 1)
      doc.text(line, margin + indent, y)
      y += lineGap
    }
  }

  const sectionTitle = (title: string) => {
    ensureSpace(14)
    y += 3
    doc.setFillColor(BRAND.r, BRAND.g, BRAND.b)
    doc.roundedRect(margin, y - 4, contentWidth, 8, 1.5, 1.5, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(255, 255, 255)
    doc.text(title, margin + 3, y + 1.2)
    y += 9
  }

  const drawScoreBar = (score: number, max: number, x: number, barY: number, width: number) => {
    const pct = Math.max(0, Math.min(1, score / max))
    doc.setFillColor(BORDER.r, BORDER.g, BORDER.b)
    doc.roundedRect(x, barY, width, 2.2, 1, 1, 'F')
    if (pct > 0) {
      doc.setFillColor(BRAND.r, BRAND.g, BRAND.b)
      doc.roundedRect(x, barY, Math.max(2, width * pct), 2.2, 1, 1, 'F')
    }
  }

  const drawScoreCard = (label: string, value: string, x: number, cardY: number, w: number) => {
    doc.setFillColor(248, 250, 252)
    doc.setDrawColor(BORDER.r, BORDER.g, BORDER.b)
    doc.roundedRect(x, cardY, w, 16, 2, 2, 'FD')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(MUTED.r, MUTED.g, MUTED.b)
    doc.text(label, x + 3, cardY + 5)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(BRAND.r, BRAND.g, BRAND.b)
    doc.text(value, x + 3, cardY + 12)
  }

  const writeDimensionBlock = (dim: ScoreDimension) => {
    const raw = data.analysis.raw_ai_response as Partial<LDDFrameworkResult> | null
    const rawKey =
      dim.key === 'pause_score' ? 'pauses'
        : dim.key === 'richness_score' ? 'richness'
          : dim.key === 'duration_score' ? 'duration'
            : dim.key.replace(/_score$/, '')
    const rawDim = raw?.[rawKey as keyof LDDFrameworkResult] as
      | { score?: number; feedback?: string }
      | undefined
    const score = Math.round(Number(data.analysis[dim.key] ?? rawDim?.score ?? 0))
    const feedback = String(data.analysis[dim.fbKey] ?? rawDim?.feedback ?? '')
    if (!feedback && !score) return

    const feedbackLines = feedback
      ? (doc.splitTextToSize(pdfText(feedback), contentWidth - 6) as string[]).length
      : 0
    const blockH = 14 + feedbackLines * 3.4
    ensureSpace(blockH)

    const startY = y
    doc.setFillColor(255, 255, 255)
    doc.setDrawColor(BORDER.r, BORDER.g, BORDER.b)
    doc.roundedRect(margin, startY, contentWidth, blockH - 1, 2, 2, 'D')

    y = startY + 5
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(TEXT.r, TEXT.g, TEXT.b)
    doc.text(dim.label, margin + 3, y)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(BRAND.r, BRAND.g, BRAND.b)
    doc.text(`${score}/${dim.maxScore}`, pageWidth - margin - 3, y, { align: 'right' })

    y += 3
    drawScoreBar(score, dim.maxScore, margin + 3, y, contentWidth - 6)
    y += 5

    if (feedback) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(TEXT.r, TEXT.g, TEXT.b)
      const lines = doc.splitTextToSize(pdfText(feedback), contentWidth - 6) as string[]
      for (const line of lines) {
        doc.text(line, margin + 3, y)
        y += 3.4
      }
    }
    y = startY + blockH + 1.5
  }

  // ── Cover header ──────────────────────────────────────────
  doc.setFillColor(BRAND.r, BRAND.g, BRAND.b)
  doc.rect(0, 0, pageWidth, 34, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('LDD Voice Coach', margin, 12)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('Full presentation coaching report', margin, 18)
  doc.text(pdfText(data.date), pageWidth - margin, 12, { align: 'right' })
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text(pdfText(data.sessionName).slice(0, 70), margin, 26)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.text(
    `${pdfText(data.studentName).slice(0, 40)}  |  ${pdfText(data.topic).slice(0, 70)}`,
    margin,
    31
  )
  y = 42

  // ── Score overview (PDF only) ─────────────────────────────
  sectionTitle('Score overview')
  const cardY = y
  const cardW = (contentWidth - 12) / 5
  const durationLabel =
    data.durationSeconds && data.durationSeconds > 0
      ? `${Math.floor(data.durationSeconds / 60)}:${String(data.durationSeconds % 60).padStart(2, '0')}`
      : '—'
  drawScoreCard('OVERALL', String(data.overall), margin, cardY, cardW)
  drawScoreCard('CONTENT', String(data.content), margin + cardW + 3, cardY, cardW)
  drawScoreCard('DELIVERY', String(data.delivery), margin + 2 * (cardW + 3), cardY, cardW)
  drawScoreCard('WORDS', String(data.wordCount), margin + 3 * (cardW + 3), cardY, cardW)
  drawScoreCard('TIME', durationLabel, margin + 4 * (cardW + 3), cardY, cardW)
  y = cardY + 20

  // Justification under overall score
  if (data.overallJustification) {
    y += 2
    ensureSpace(18)
    writeWrapped('Grade justification', 8, { bold: true, color: MUTED })
    y += 1
    writeWrapped(data.overallJustification, 8.5)
    y += 2
  }

  // Mini bars for overall/content/delivery
  writeWrapped('Performance gauges', 8, { bold: true, color: MUTED })
  y += 1
  const gauges = [
    { label: 'Overall', score: data.overall, max: 100 },
    { label: 'Content', score: data.content, max: 100 },
    { label: 'Delivery', score: data.delivery, max: 100 },
  ]
  for (const g of gauges) {
    ensureSpace(8)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(TEXT.r, TEXT.g, TEXT.b)
    doc.text(g.label, margin, y)
    doc.setTextColor(BRAND.r, BRAND.g, BRAND.b)
    doc.setFont('helvetica', 'bold')
    doc.text(`${g.score}/${g.max}`, pageWidth - margin, y, { align: 'right' })
    y += 2
    drawScoreBar(g.score, g.max, margin, y, contentWidth)
    y += 6
  }

  // ── Coach summary ─────────────────────────────────────────
  sectionTitle('Coach summary')
  if (data.executiveSummary) {
    writeWrapped(data.executiveSummary, 9)
    y += 2
  }
  for (const point of data.coachFeedback) {
    ensureSpace(8)
    writeWrapped(`- ${point}`, 8.5, { indent: 1 })
    y += 1
  }
  if (data.practiceGoal) {
    y += 2
    ensureSpace(16)
    doc.setFillColor(BRAND_LIGHT.r, BRAND_LIGHT.g, BRAND_LIGHT.b)
    doc.setDrawColor(BRAND.r, BRAND.g, BRAND.b)
    const goalLines = doc.splitTextToSize(
      pdfText(`Next practice goal: ${data.practiceGoal}`),
      contentWidth - 6
    ) as string[]
    const goalH = 6 + goalLines.length * 3.6
    doc.roundedRect(margin, y, contentWidth, goalH, 2, 2, 'FD')
    y += 5
    for (const line of goalLines) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.5)
      doc.setTextColor(TEXT.r, TEXT.g, TEXT.b)
      doc.text(line, margin + 3, y)
      y += 3.6
    }
    y += 3
  }

  // ── Strengths / Improvements ──────────────────────────────
  if (data.strengths.length || data.areas.length) {
    sectionTitle('Strengths & priority improvements')

    if (data.strengths.length) {
      writeWrapped('Strengths', 9, { bold: true, color: GREEN })
      y += 1
      for (const item of data.strengths) {
        writeWrapped(item.title, 8.5, { bold: true })
        writeWrapped(item.detail, 8, { indent: 1 })
        y += 2
      }
    }

    if (data.areas.length) {
      y += 1
      writeWrapped('Priority improvements', 9, { bold: true, color: AMBER })
      y += 1
      for (const item of data.areas) {
        writeWrapped(item.title, 8.5, { bold: true })
        writeWrapped(item.detail, 8, { indent: 1 })
        y += 2
      }
    }
  }

  // ── Content coaching with scores ──────────────────────────
  sectionTitle('Content coaching')
  for (const dim of CONTENT_DIMENSIONS) writeDimensionBlock(dim)

  // ── Delivery coaching with scores ─────────────────────────
  sectionTitle('Delivery coaching')
  writeWrapped(
    'Pace, pauses and breathing, volume, and speaking duration — with where to slow down, when to breathe, how loud to project, and whether the talk was long enough to develop the message.',
    8,
    { color: MUTED }
  )
  y += 2
  for (const dim of DELIVERY_DIMENSIONS) writeDimensionBlock(dim)

  // ── Line-by-line comparison ───────────────────────────────
  if (data.coaching.length) {
    sectionTitle('What you said vs try this')
    for (const item of data.coaching) {
      const saidLines = doc.splitTextToSize(
        pdfText(`"${item.what_you_said}"`),
        contentWidth - 8
      ) as string[]
      const tryLines = doc.splitTextToSize(
        pdfText(`"${item.suggested_version}"`),
        contentWidth - 8
      ) as string[]
      const whyLines = doc.splitTextToSize(pdfText(item.why_better), contentWidth - 8) as string[]
      const blockH = 14 + (saidLines.length + tryLines.length + whyLines.length) * 3.4
      ensureSpace(Math.min(blockH, 50))

      const startY = y
      doc.setDrawColor(BORDER.r, BORDER.g, BORDER.b)
      doc.setFillColor(255, 255, 255)
      doc.roundedRect(margin, startY, contentWidth, blockH - 1, 2, 2, 'D')

      y = startY + 5
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7.5)
      doc.setTextColor(MUTED.r, MUTED.g, MUTED.b)
      doc.text('WHAT YOU SAID', margin + 3, y)
      y += 4
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(8)
      doc.setTextColor(TEXT.r, TEXT.g, TEXT.b)
      for (const line of saidLines) {
        doc.text(line, margin + 3, y)
        y += 3.4
      }

      y += 1
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7.5)
      doc.setTextColor(BRAND.r, BRAND.g, BRAND.b)
      doc.text('TRY THIS INSTEAD', margin + 3, y)
      y += 4
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(TEXT.r, TEXT.g, TEXT.b)
      for (const line of tryLines) {
        doc.text(line, margin + 3, y)
        y += 3.4
      }

      y += 1
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(MUTED.r, MUTED.g, MUTED.b)
      for (const line of whyLines) {
        doc.text(line, margin + 3, y)
        y += 3.4
      }

      y = startY + blockH + 2
    }
  }

  // ── Full redraft ──────────────────────────────────────────
  if (data.fullRedraft) {
    sectionTitle('Full redrafted script')
    writeWrapped(
      'A polished version to practise aloud. Compare with the original transcript below.',
      8,
      { color: MUTED }
    )
    y += 2
    ensureSpace(20)
    const redraftLines = doc.splitTextToSize(pdfText(data.fullRedraft), contentWidth - 6) as string[]
    // Draw as a tinted block that can span pages
    doc.setFillColor(BRAND_LIGHT.r, BRAND_LIGHT.g, BRAND_LIGHT.b)
    const firstChunkH = Math.min(8 + redraftLines.length * 3.6, pageBottom - y)
    doc.roundedRect(margin, y, contentWidth, Math.max(10, firstChunkH), 2, 2, 'F')
    y += 5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(TEXT.r, TEXT.g, TEXT.b)
    for (const line of redraftLines) {
      if (y > pageBottom - 4) {
        newPage()
        doc.setFillColor(BRAND_LIGHT.r, BRAND_LIGHT.g, BRAND_LIGHT.b)
        doc.roundedRect(margin, y, contentWidth, pageBottom - y - 2, 2, 2, 'F')
        y += 5
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8.5)
        doc.setTextColor(TEXT.r, TEXT.g, TEXT.b)
      }
      doc.text(line, margin + 3, y)
      y += 3.6
    }
    y += 4
  }

  // ── Full transcript ───────────────────────────────────────
  if (data.analysis.transcript) {
    sectionTitle('Full transcript')
    writeWrapped(
      'Original words from the recording — use this to compare with the redraft and line suggestions above.',
      8,
      { color: MUTED }
    )
    y += 2
    writeWrapped(data.analysis.transcript, 8.5)
  }

  drawFooter()

  const buffer = doc.output('arraybuffer')
  return new Uint8Array(buffer)
}

export function reportPdfFilename(sessionName: string): string {
  const safeName = sessionName.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'session'
  return `${safeName}_coaching_report.pdf`
}

/** Convenience helper used by callers that only have an Analysis row. */
export function buildCoachMeta(analysis: Analysis) {
  return {
    coachFeedback: getLddCoachFeedback(analysis),
    overallJustification: getOverallJustification(analysis),
    executiveSummary: getExecutiveSummary(analysis),
    practiceGoal: getPracticeGoal(analysis),
    fullRedraft: getFullRedraft(analysis),
  }
}
