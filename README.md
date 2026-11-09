# Learnova

Learnova is an AI-powered study workspace that helps students turn their own learning materials, goals, and results into practical study support. It combines AI tools with a personal dashboard, subject-based planning, progress tracking, and a private document library.

## What you can do

- **AI Quiz Maker** — create practice quizzes from notes or a topic.
- **Notes Summarizer** — extract key ideas from study material.
- **Exam Prep Planner** — build a revision plan around your subjects and exam dates.
- **Performance Analyzer** — review grade cards or academic results and get focused improvement suggestions.
- **Transcript Generator** — create concise summaries, detailed transcripts, or step-by-step study notes from a YouTube video link.
- **AI Study Advisor** — get study guidance based on your goals and academic context.
- **Resume Builder** — draft an ATS-friendly resume and download it as an editable DOCX file.
- **Career Roadmap** — create a learning roadmap for a career goal.
- **Interview Prep** — practice with role-specific interview questions.
- **Student Dashboard** — manage subjects, study sessions, focus timer, study streaks, activity, and saved work.

Learnova also includes email-and-password account creation and login, a personal PDF library, and recent activity notifications. The internship portal is not part of the product.

## How it works

The web interface is built with TypeScript, HTML, and CSS. AI requests are sent to server-side API endpoints, which call Gemini without exposing the API key to the browser. User accounts, subjects, study activity, and saved AI creations use Neon Postgres. Uploaded PDFs are stored privately in the Neon Object Storage `uploads` bucket; the database stores their metadata.

## Technology

- **Frontend:** TypeScript, Vite, HTML, CSS
- **Server/API:** TypeScript serverless functions on Vercel
- **Database:** Neon Postgres (`pg`)
- **File storage:** Neon Object Storage through the Neon Files SDK
- **AI:** Google Gemini API via Google AI Studio
- **Authentication:** Email and password with bcrypt-hashed passwords and signed, HTTP-only sessions

## Deploying on Vercel

1. Import the GitHub repository into Vercel. The project uses `vercel.json` to build with `npm run build`, publish the `dist` directory, and deploy the `api/` handlers as serverless functions.
2. Connect the Neon project and enable Postgres and the private `uploads` object-storage bucket.
3. Add the following server-side environment variables in the Vercel project settings. Keep them out of client-side `VITE_` variables and out of Git.

   | Variable | Purpose |
   | --- | --- |
   | `DATABASE_URL` | Neon Postgres connection string |
   | `AWS_ACCESS_KEY_ID` | Neon Object Storage access key |
   | `AWS_SECRET_ACCESS_KEY` | Neon Object Storage secret key |
   | `AWS_ENDPOINT_URL_S3` | Neon Object Storage S3 endpoint |
   | `AWS_REGION` | Object-storage region from Neon |
   | `GEMINI_API_KEY` | Google AI Studio API key |
   | `SESSION_SECRET` | Random private secret of at least 32 characters for signing sessions |
   | `GEMINI_MODEL` | Optional model for text tools; defaults to `gemini-3.8-flash` |
   | `GEMINI_VIDEO_MODEL` | Optional video-capable model for the transcript tool; defaults to `gemini-3.7-flash` |

4. Apply the SQL files in `migrations/` to the Neon database before using the app. Keep schema updates in numbered migration files.
5. Redeploy after changing environment variables or database configuration. Review Vercel function logs if an API request fails.

The transcript feature sends the supplied video URL to the configured Gemini video model. The video must be accessible to that model; availability depends on the model enabled for the API key and its current quota.

## Project structure

```text
api/          Server-side API handlers
migrations/   Neon Postgres schema migrations
public/       Static assets, including the site favicon
scripts/      Database migration and verification utilities
server/       Express API server used by the development setup
src/          TypeScript application and styles
```

## Privacy and secrets

PDFs are stored in a private object-storage bucket and accessed through the app’s authenticated API. Database credentials, the Gemini key, and the session secret belong only in protected server environment settings. Never commit real secret values.
