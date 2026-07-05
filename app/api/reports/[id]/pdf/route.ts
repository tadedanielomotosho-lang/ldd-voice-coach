import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  buildReportPdfBytes,
  getReportSummary,
  reportPdfFilename,
  type ReportPdfData,
} from '@/lib/report/generateReportPdf'
import { getLddCoachFeedback } from '@/lib/report/coachFeedback'
import { formatDate } from '@/lib/utils'
import type { Analysis } from '@/types'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: analysis, error } = await supabase
      .from('analyses')
      .select(`
        *,
        sessions(
          id, session_name, presentation_topic, created_at,
          students(id, name)
        )
      `)
      .eq('session_id', id)
      .eq('tutor_id', user.id)
      .single()

    if (error || !analysis) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    const session = analysis.sessions as Record<string, unknown> | null
    const student = session?.students as { name: string } | null
    const typedAnalysis = analysis as Analysis
    const { strengths, areas } = getReportSummary(typedAnalysis)

    const pdfData: ReportPdfData = {
      sessionName: String(session?.session_name || 'Session'),
      studentName: student?.name || 'Student',
      topic:       String(session?.presentation_topic || ''),
      date:        formatDate(String(session?.created_at || '')),
      wordCount:   typedAnalysis.word_count,
      overall:     Math.round(Number(typedAnalysis.overall_score)),
      content:     Math.round(Number(typedAnalysis.content_score)),
      delivery:    Math.round(Number(typedAnalysis.delivery_score)),
      coachFeedback: getLddCoachFeedback(typedAnalysis),
      strengths,
      areas,
      coaching: typedAnalysis.transcript_coaching ?? [],
      analysis: typedAnalysis,
    }

    const bytes = buildReportPdfBytes(pdfData)
    const filename = reportPdfFilename(pdfData.sessionName)

    return new NextResponse(Buffer.from(bytes), {
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control':       'no-store',
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to generate PDF'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
