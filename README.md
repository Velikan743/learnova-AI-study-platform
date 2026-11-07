# Learnova

Learnova is an AI-powered study platform built with TypeScript, HTML, and CSS. Its dashboard includes a study planner, progress overview, focus timer, library, and shortcuts to the AI tools. There is no internship portal.

## Features

- Email and password account creation and login, with bcrypt password hashing and signed, HTTP-only sessions.
- AI Quiz Maker, Notes Summarizer, Exam Prep Planner, Performance Analyzer, Transcript Generator, AI Study Advisor, Resume Builder, Career Roadmap, and Interview Prep.
- Gemini-powered generation through a server endpoint. The Google AI Studio key stays on the server.
- Private PDF uploads in Neon Object Storage, with per-account library and secure download links.
- Neon Postgres accounts and uploaded-document metadata.
- Responsive dashboard, study schedule, progress view, saved-work library layout, and Pomodoro timer.

## Run locally

1. Install Node.js 20 or later.
2. Run `npm install`.
3. Run `neon deploy` to pull Neon credentials into `.env.local`. Add `GEMINI_API_KEY` from Google AI Studio and a random `SESSION_SECRET` of at least 32 characters to `.env.local`.
4. In one terminal, run `npm run server`.
5. In another terminal, run `npm run dev` and open the Vite URL shown in the terminal.

Both local and Vercel API handlers use Neon Postgres. Private PDFs go directly to the Neon `uploads` bucket using short-lived signed URLs; only their metadata is stored in Postgres. Google OAuth and password reset need provider credentials and email delivery configuration; the current login flow is email and password.

## Deploy to Vercel

1. Push this project to GitHub and import the repository in Vercel. Vercel uses `vercel.json` to run `npm run build` and publish `dist/`; the `api/` TypeScript files become serverless functions.
2. In Vercel Project Settings → Environment Variables, add the Neon variables from `.env.local`: `DATABASE_URL`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_ENDPOINT_URL_S3`, and `AWS_REGION`.
3. Add `GEMINI_API_KEY` from Google AI Studio and a random `SESSION_SECRET` of at least 32 characters. Optionally set `GEMINI_MODEL`.
4. Run `npm run db:migrate` once for the Neon branch you are deploying. The migration uses `DATABASE_URL_UNPOOLED` when available.
5. Redeploy after setting the environment variables. Keep these secrets in Vercel’s settings, never in frontend code or Git. Do not put the secret values in `VITE_` variables.

The project is configured for Vercel’s Node.js serverless runtime. Database connections use `pg` with Vercel’s `attachDatabasePool` helper, and the Neon Files SDK handles private object storage.

### Video transcripts

The transcript tool accepts a video URL and optional caption text. A URL alone does not provide the server with the video's audio or captions, so the tool asks for pasted captions to produce an accurate transcript rather than inventing dialogue. A production transcript pipeline needs a permitted caption or audio transcription provider.

## Build

Run `npm run build` to type-check and create the production frontend in `dist/`.
