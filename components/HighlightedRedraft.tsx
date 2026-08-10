'use client'

import { FileText } from 'lucide-react'
import { getFullRedraft } from '@/lib/report/coachFeedback'
import { getRedraftChanges, parseRedraftSegments } from '@/lib/report/redraft'
import type { Analysis } from '@/types'

export default function HighlightedRedraft({ analysis }: { analysis: Analysis }) {
  const redraft = getFullRedraft(analysis)
  const changes = getRedraftChanges(analysis)
  if (!redraft) return null

  const segments = parseRedraftSegments(redraft)

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 space-y-5">
      <div className="flex items-center gap-2">
        <FileText className="w-5 h-5 text-brand-600 dark:text-brand-400" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Improved practise script</h2>
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        Every major coaching suggestion is applied below.
        {' '}
        <span className="font-semibold text-emerald-700 dark:text-emerald-400">
          Bold green underlined text
        </span>
        {' '}
        = new or changed versus your original. Plain text is unchanged.
      </p>

      <p className="text-sm leading-relaxed text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
        {segments.map((seg, i) =>
          seg.type === 'highlight' ? (
            <mark
              key={i}
              className="bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 font-semibold underline decoration-emerald-600/80 decoration-2 underline-offset-2 rounded-sm px-0.5"
            >
              {seg.text}
            </mark>
          ) : (
            <span key={i}>{seg.text}</span>
          )
        )}
      </p>

      {changes.length > 0 && (
        <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-gray-800">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Changes applied (old → new)
          </h3>
          <ul className="space-y-3">
            {changes.map((change, i) => (
              <li
                key={i}
                className="rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950/40 p-3 space-y-1.5"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-400">
                  {change.label}
                </p>
                <p className="text-sm text-amber-800 dark:text-amber-300">
                  <span className="font-medium">OLD:</span>{' '}
                  {change.from ? `"${change.from}"` : '(new addition — not in original)'}
                </p>
                <p className="text-sm text-emerald-800 dark:text-emerald-300 font-medium">
                  <span className="font-semibold">NEW:</span> &quot;{change.to}&quot;
                </p>
                {change.applied_suggestion && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                    {change.applied_suggestion}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
