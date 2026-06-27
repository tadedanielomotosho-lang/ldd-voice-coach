# LDD Voice Coach

AI-powered communication coaching platform. Coaches upload or record student presentations — GPT-4o analyses against the LDD Framework and returns structured scores, feedback, and transcript coaching.

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Edge Functions, Realtime)
- **AI**: OpenAI Whisper (transcription) + GPT-4o (analysis)
- **Deployment**: Vercel + Supabase Cloud

---

## Setup

### 1. Prerequisites

```bash
node >= 18
npm >= 9
supabase CLI: npm install -g supabase
```

### 2. Clone and install

```bash
git clone <repo>
cd ldd-voice-coach
npm install
```

### 3. Create Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Copy your project URL and anon key from **Settings → API**
3. Copy your service role key (keep this secret)

### 4. Configure environment

```bash
cp .env.local.example .env.local
```

Fill in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
OPENAI_API_KEY=sk-...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 5. Run database migrations

```bash
# Link to your Supabase project
supabase link --project-ref your-project-ref

# Push all migrations
supabase db push
```

Or run them manually in the Supabase SQL editor (files in `supabase/migrations/`).

### 6. Enable pg_cron and pg_net extensions

In your Supabase dashboard → **Database → Extensions**, enable:
- `pg_cron`
- `pg_net`

Then run `003_storage_and_cron.sql` after setting these app settings in SQL editor:

```sql
alter database postgres set app.supabase_url = 'https://your-project.supabase.co';
alter database postgres set app.service_role_key = 'your-service-role-key';
```

### 7. Deploy Edge Function

```bash
supabase functions deploy process-analysis --project-ref your-project-ref
```

Set Edge Function secrets in Supabase dashboard → **Edge Functions → Secrets**:
```
OPENAI_API_KEY=sk-...
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 8. Run locally

```bash
npm run dev
```

Visit `http://localhost:3000`

---

## Deployment (Vercel)

```bash
npx vercel --prod
```

Set all environment variables in Vercel dashboard → **Settings → Environment Variables**.

---

## LDD Framework Scoring

### Content (100 pts)
| Dimension | Points |
|-----------|--------|
| Hook | 20 |
| Purpose statement | 15 |
| Key point structure | 30 |
| Call to action | 15 |
| Message clarity | 20 |

### Delivery (100 pts)
| Dimension | Points |
|-----------|--------|
| Tone variation | 25 |
| Pace | 25 |
| Pauses & breathing | 25 |
| Volume | 25 |

### Overall Score Formula
```
overall = (content_score × 0.6) + (delivery_score × 0.4)
```

---

## Architecture

```
Browser → Next.js API Routes → Supabase Storage + DB
                                        ↓
                              pg_cron polls every 10s
                                        ↓
                           Supabase Edge Function
                                        ↓
                        OpenAI Whisper → GPT-4o
                                        ↓
                           Write analyses table
                                        ↓
                        Realtime broadcast → client
```

## File Structure

```
app/
  (auth)/          login, signup, reset
  (app)/           dashboard, students, studio, upload, reports
  api/             sessions, students, reports
lib/
  supabase/        client.ts, server.ts
  ai/              whisper.ts, analyser.ts, scorer.ts, prompt.ts
  hooks/           useRealtimeSession.ts, useRecorder.ts
supabase/
  migrations/      001-003 SQL files
  functions/       process-analysis Edge Function
types/             index.ts (all shared types)
```
