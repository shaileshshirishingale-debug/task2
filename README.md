# QuestHabit - 100-Day Microtasks & Dopamine-Supportive Habit Tracker

QuestHabit is a production-grade, Vercel-compatible 100-Day Microtask & Habit Tracking platform designed around healthy reward anticipation, immediate feedback, visible progress, and anti-procrastination execution.

---

## 🌟 Core Program & Features

1. **100-Day / 1,000-Microtask Program**:
   - **Program Duration**: 100 days (calculated accurately in the user's local timezone from a configurable start date).
   - **Daily Target**: 10 microtasks per day (each taking 2–15 minutes).
   - **Total Target**: 1,000 completed microtasks.
   - **Full CRUD & Ordering**: Create, edit, delete, reorder, complete, uncomplete, and duplicate tasks to the next day.

2. **Dopamine-Supportive Reward System**:
   - **Instant Task Rewards**: Fixed **+10 XP** per completed microtask with subtle animation, varied non-repetitive encouraging messages, and optional sound/haptic feedback (disabled/muted by default).
   - **Transparent Level System**:
     - Level 1: 0–99 XP
     - Level 2: 100–249 XP
     - Level 3: 250–499 XP
     - Level 4: 500–999 XP
     - Level 5: 1,000–1,999 XP
     - Level $L \ge 6$: $(L - 3) \times 1,000$ XP
   - **Milestone Celebrations**: Accessible celebrations at 1st task, 1st full day, and 3, 7, 14, 30, 50, 75, and 100 successful days.
   - **Configurable Healthy Reward Menu**: Define healthy, low-cost personal rewards unlocked at task or full-day milestones.

3. **Daily Completion Logic & Compassionate Streak Rules**:
   - A day is **Fully Completed** when all 10 microtasks are completed (`10/10`).
   - Days with `1–9` tasks completed are preserved as **Partially Completed** so effort is always recognized.
   - Uncompleting a task reverses its 10 XP and updates completion status consistently.
   - Users can mark any day as a **Rest / Paused Day** without breaking their streak.

4. **Anti-Procrastination & Low-Energy Support**:
   - **“Just Start” Mode**: Picks the easiest 2–5 minute incomplete microtask and starts a focused countdown timer.
   - **Low-Energy Task Replacement**: Swaps a demanding task with a gentle 2–3 minute alternative so users can maintain momentum on tough days.
   - **Daily Minimum Guidance**: Focuses on completing the first 3 microtasks to build initial momentum.

5. **100-Day Visual Calendar, Daily Review & Analytics**:
   - **100-Day Grid & Heatmap**: Color-coded status for every day (Fully Completed, Partially Completed, In Progress, Rest Day, Not Started, Future).
   - **End-of-Day Reflection**: Structured daily review (what went well, what was learned, distractions, tomorrow's improvement, energy & mood ratings).
   - **Analytics & Vercel Blob Exports**: Category breakdown, day-of-week performance, consistency metrics, and server-side JSON/CSV exports via `@vercel/blob`.

---

## 🛠️ Technology Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS, Lucide React icons
- **Backend API**: Express API routes (`/api/*`), Node.js
- **Database**: PostgreSQL (compatible with Vercel Postgres, Neon, Supabase, Cloud SQL) via `pg` pool with automatic local persistence fallback
- **Blob Storage**: Vercel Blob (`@vercel/blob`) for JSON/CSV exports and backups

---

## 🚀 Environment Variables

Configure these environment variables in your Vercel Project Settings or local `.env` file:

| Variable Name | Description | Required? | Example |
| --- | --- | --- | --- |
| `DATABASE_URL` | PostgreSQL connection string | Recommended for Production | `postgres://user:pass@host:5432/db?sslmode=require` |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob read/write token | Recommended for Exports | `vercel_blob_rw_...` |
| `JWT_SECRET` | Secret key for signing JWT auth tokens | Required | `your-secure-jwt-secret-key` |
| `GEMINI_API_KEY` | Google Gemini API key | Optional | `AIzaSy...` |

---

## 💻 Local Development & Testing

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Run Unit Tests**:
   ```bash
   npm test
   ```

3. **Start Development Server**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` in your browser.

---

## 🗄️ Database Setup (PostgreSQL)

Run `db/schema.sql` against your PostgreSQL database (Vercel Postgres, Neon, Supabase, or local Postgres):

```bash
psql $DATABASE_URL -f db/schema.sql
```
