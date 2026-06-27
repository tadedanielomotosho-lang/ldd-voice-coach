import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-brand-700 to-brand-900 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full text-center space-y-8">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 text-sm text-white/80">
            <span className="w-2 h-2 rounded-full bg-gold-400 animate-pulse" />
            AI-Powered Communication Coaching
          </div>
          <h1 className="text-5xl font-bold text-white tracking-tight">LDD Voice Coach</h1>
          <p className="text-xl text-white/70 max-w-lg mx-auto leading-relaxed">
            Evaluate presentations. Score performance. Deliver structured coaching — powered by GPT-4o.
          </p>
        </div>
        <div className="flex gap-4 justify-center">
          <Link href="/login"
            className="bg-white text-brand-600 font-semibold px-8 py-3 rounded-lg hover:bg-white/90 transition-colors">
            Sign in
          </Link>
          <Link href="/signup"
            className="border border-white/30 text-white font-semibold px-8 py-3 rounded-lg hover:bg-white/10 transition-colors">
            Get started
          </Link>
        </div>
      </div>
    </main>
  )
}
