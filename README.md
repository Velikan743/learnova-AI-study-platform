# Learnova

Learnova is an AI-powered study platform built with TypeScript, HTML, and CSS. Its dashboard includes a study planner, progress overview, focus timer, library, and shortcuts to the AI tools. There is no internship portal.

## Features

- Email and password account creation and login, with bcrypt password hashing and signed, HTTP-only sessions.
- AI Quiz Maker, Notes Summarizer, Exam Prep Planner, Performance Analyzer, Transcript Generator, AI Study Advisor, Resume Builder, Career Roadmap, and Interview Prep.
- Gemini-powered generation through a server endpoint. The Google AI Studio key stays on the server.
- Responsive dashboard, study schedule, progress view, saved-work library layout, and Pomodoro timer.

## Run locally

1. Install Node.js 20 or later.
2. Run `npm install`.
3. Copy `.env.example` to `.env`. Set `GEMINI_API_KEY` to a key from Google AI Studio and replace `SESSION_SECRET` with a long private random value. For local development, the Express server stores accounts in a local JSON file; `DATABASE_URL` is used by the Vercel serverless functions.
4. In one terminal, run `npm run server`.
5. In another terminal, run `npm run dev` and open the Vite URL shown in the terminal.

The local Express server stores account records in `data/accounts.json`. On Vercel, the API uses Neon Postgres through `DATABASE_URL`, since serverless filesystems are temporary. Google OAuth and password reset need provider credentials and email delivery configuration; the current login flow is email and password.

## Deploy to Vercel

1. Push this project to GitHub and import the repository in Vercel. Vercel uses `vercel.json` to run `npm run build` and publish `dist/`; the `api/` TypeScript files become serverless functions.
2. Create a Neon Postgres database and add its pooled connection string as `DATABASE_URL` in the Vercel project’s Environment Variables for Production (and Preview if desired). The accounts table is created automatically on the first account request.
3. Add `GEMINI_API_KEY` from Google AI Studio and a random `SESSION_SECRET` of at least 32 characters. Optionally set `GEMINI_MODEL`.
4. Redeploy after setting the environment variables. Keep these secrets in Vercel’s settings, never in frontend code or Git.

The GitHub repository supplied for this project was empty when inspected. This workspace is connected to it, but no commit has been pushed. Vercel hosting cannot be activated until the project is pushed/imported and the Neon and Gemini environment variables are configured in your Vercel account.

### Video transcripts

The transcript tool accepts a video URL and optional caption text. A URL alone does not provide the server with the video's audio or captions, so the tool asks for pasted captions to produce an accurate transcript rather than inventing dialogue. A production transcript pipeline needs a permitted caption or audio transcription provider.

## Build

Run `npm run build` to type-check and create the production frontend in `dist/`.
