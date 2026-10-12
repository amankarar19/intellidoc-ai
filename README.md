# IntelliDoc AI

AI-Powered Document Review and Management System (MCA Semester 5 individual project; evolved from "IntelliDoc Lite").

A React + Vite dashboard for registering document records, applying simple rule-based checks, tracking Pending / Verified / Rejected status, searching, filtering, and exporting CSV reports. Records are stored in a **Supabase PostgreSQL** database. The **AI Review** page sends pasted text or a PDF to **Google Gemini** through a Supabase Edge Function, shows a summary, extracted fields and review hints, and lets a human edit and save the result as **Pending**. Details, deployment and tests: `docs/AI_MODULE.md` and section 7 below.

> This is a document-management and rule-based checking prototype. It does **not** prove that a real document is authentic. Use fictional data only.

## 1. Run it

Requires Node.js 18 or newer (check with `node -v` and `npm -v`; Node 20 or 22 LTS is best).

```bash
cd intellidoc-lite
npm install
npm run dev
```

Open the URL printed in the terminal (usually http://localhost:5173). With a valid `.env` (section 2) you will see the dashboard with a green **Live · Supabase** badge. Without it you will see a setup screen explaining what to do.

Other commands:

```bash
npm test          # 23 tests: validation, filtering, CSV, AI input helpers, login helpers
npm run test:function   # 20 tests of the Edge Function (fake Gemini, needs Node 22.6+)
npm run build     # production build into dist/
npm run preview   # serve the production build locally
```

## 2. Connect Supabase (required)

1. Create a free project at https://supabase.com (use a throwaway project; the demo policies are open).
2. Open **SQL Editor -> New query**, paste all of `supabase.sql`, click **Run**. Then run `supabase-auth-migration.sql` the same way (login support, see section 8). It deletes any existing rows.
3. Open **Project Settings -> API** and copy the Project URL and the **legacy anon key** (starts with `eyJ`; the AI function needs this JWT form).
4. Copy `.env.example` to a file named exactly `.env` (Windows: `copy .env.example .env`; macOS/Linux: `cp .env.example .env`) and fill in:
   ```
   VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...your-legacy-anon-key
   ```
5. Stop and restart `npm run dev` (Vite reads `.env` only at startup).
6. The badge shows **Live · Supabase**. Add a record, then check **Table Editor -> documents** in Supabase.

Never put the `service_role` / secret key in `.env`; anything starting with `VITE_` is visible in the browser.

## 3. Project structure

```
intellidoc-lite/
  index.html            page shell
  package.json
  vite.config.js
  supabase.sql          table, constraints, indexes, RLS + demo policies (+ AI columns)
  supabase-ai-migration.sql   additive AI columns only (for an existing database)
  supabase-auth-migration.sql user_id column + per-user Row Level Security (login)
  supabase/functions/analyze-document/index.ts   Edge Function that calls Gemini
  .env.example
  src/
    main.jsx            React entry point
    App.jsx             dashboard, table, form, delete dialog
    styles.css          all styling
    lib/supabase.js     single Supabase client + "is it configured?" check
    lib/documents.js    list / create / update / delete against Supabase
    utils/dates.js      local-date helpers (no timezone off-by-one)
    utils/validation.js status values, rules, stats, search/filter
    utils/csv.js        CSV escaping and download
    utils/aiInput.js    AI screen helpers (validation, save payload)
    lib/ai.js           calls the Edge Function (no API key here)
    lib/auth.js         Supabase Auth wrapper (sign in / up / out)
    utils/authInput.js  login form validation and friendly auth errors
    components/AuthScreen.jsx   login and sign-up page
    components/AiReview.jsx   AI Review page
  tests/                utils.test.js, ai.test.js, auth.test.js, analyze-document.test.js
  docs/                 report draft, test plan, viva Q&A, submission checklist
```

## 4. Verification rules

1. Missing title, type or number: the record is not saved; errors are shown.
2. Expiry date before today (local calendar date): status **Rejected**, flagged as expired.
3. Otherwise: status **Verified** by default.
4. Status can be changed manually to Pending / Verified / Rejected at any time (from the table or the edit form).

## 5. Common problems

| Problem                                                                        | Fix                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Still shows the "Connect IntelliDoc AI to Supabase" screen after adding `.env` | File must be named `.env` (not `.env.txt`), be in the project root, and the dev server must be restarted.                                                                                                                                                                                                                                                                             |
| "The documents table was not found"                                            | Run `supabase.sql` in the Supabase SQL Editor.                                                                                                                                                                                                                                                                                                                                        |
| "permission denied" / records do not save                                      | The demo policies in `supabase.sql` were not run (or RLS blocks anon). Re-run the script.                                                                                                                                                                                                                                                                                             |
| "Could not reach Supabase"                                                     | Check internet and that the URL starts with `https://` and has no extra spaces.                                                                                                                                                                                                                                                                                                       |
| `Failed to resolve entry for package "lucide-react"` (or any other package)    | The `node_modules` folder is incomplete or damaged (interrupted install, antivirus, or copied files). In the project folder run: `rmdir /s /q node_modules` (Windows) or `rm -rf node_modules` (macOS/Linux), then `npm cache verify`, then `npm install`. Do not copy `node_modules` between computers. Keep the project path short (e.g. `D:\intellidoc-lite`, not nested folders). |
| `npm run dev` or `npm install` fails straight away                             | Run `node -v`. If it is older than 18, install the current LTS from https://nodejs.org, then delete the `node_modules` folder and run `npm install` again.                                                                                                                                                                                                                            |
| Port already in use / blank page                                               | Use the exact URL printed by `npm run dev` (it may be 5174 etc.).                                                                                                                                                                                                                                                                                                                     |
| Port already in use                                                            | Vite picks the next port; use the URL it prints.                                                                                                                                                                                                                                                                                                                                      |

## 6. Security note

Users sign in with email and password (Supabase Auth) and each user sees only their own documents (Row Level Security, section 8). The Gemini key is a server-side secret. Remaining limits: any person can create an account (open sign-up), so the AI function's size limits, per-user rate limit and your Google quota are what cap usage; there is no admin role or audit log; use fictional documents only.

## 7. AI Review: set-up and deployment

The Gemini API key must **never** go in `.env`, React code or Git. It lives only as a Supabase secret.

**Step 1: database columns** (skip if you ran the new `supabase.sql`). SQL Editor, paste `supabase-ai-migration.sql`, Run. It only adds columns; existing rows are untouched.

**Step 2: deploy the function.** Either:

- Dashboard: **Edge Functions -> Deploy a new function -> Via Editor**, name `analyze-document`, paste `supabase/functions/analyze-document/index.ts`, keep **Verify JWT** on, Deploy. Or
- CLI (from the project folder):
  ```bash
  npx supabase login
  npx supabase functions deploy analyze-document --project-ref mfkmhpeapkqglazlmgng
  ```
  (use your own project ref if you made a new project).

**Step 3: set the secrets.** Create a key in https://aistudio.google.com/apikey, then either use the dashboard (**Edge Functions -> Secrets -> Add new secret**) or the CLI:

```bash
npx supabase secrets set GEMINI_API_KEY=your-key-here --project-ref mfkmhpeapkqglazlmgng
npx supabase secrets set GEMINI_MODEL=your-model-id --project-ref mfkmhpeapkqglazlmgng
```

`GEMINI_MODEL` has no default on purpose: model names change, so copy a current model ID that supports PDF input from Google AI Studio (for example a "flash" model). If it is wrong the app says "The configured Gemini model is not available". Optional: `ALLOWED_ORIGIN=https://your-site` to restrict browser origins. Secrets are available to the function immediately; no redeploy needed.

**Step 4: `.env`** must hold the legacy anon key (section 2). Restart `npm run dev`, open **AI Review**.

Manual test checklist: `docs/AI_MODULE.md`, section 6.

### AI security limits (read before the viva)

- The function requires a Supabase JWT, but the legacy anon key is public (it is in the browser bundle), so this is **not user authentication**. Real protection here is the size limits (30,000 characters, 6 MB PDF), a best-effort per-IP rate limit (10 requests per 10 minutes, in memory per server instance) and your Google quota. Set a low quota/budget on the Gemini key.
- The proper fix is Supabase Auth (login) so every call carries a real user token and limits can be per user. Not done in this project.
- The `documents` table is still open to anyone with the URL and key (demo RLS policies). Use fictional data only.
- Text and PDFs are sent to Google's Gemini API. Do not use real personal documents.

## 8. Login (Supabase Auth)

1. **Run the migration.** SQL Editor, paste `supabase-auth-migration.sql`, Run. **It deletes all existing document rows** (they have no owner), adds `user_id` (filled automatically with the signed-in user), removes the open demo policies and anonymous access, and adds per-user policies.
2. **Authentication settings** (Supabase dashboard):
   - Authentication -> Sign In / Providers -> **Email** must be enabled.
   - For an easy demo turn **Confirm email** off. If you leave it on, new users must click the emailed link first (Supabase's built-in email is heavily rate-limited).
   - Authentication -> URL Configuration -> set **Site URL** to your GitHub Pages address (`https://YOUR-USERNAME.github.io/intellidoc-ai/`) and add `http://localhost:5173` under Redirect URLs.
3. Redeploy the function if you have not (it now requires a signed-in user), restart `npm run dev`, open the app, **Create an account**, then sign in.
4. How it works: `AuthGate` in `App.jsx` keeps the session; no session shows `AuthScreen`; a session shows the dashboard. The browser Supabase client automatically sends the user's token with every database and function call, and Row Level Security (`auth.uid() = user_id`) decides which rows are visible. Passwords are handled only by Supabase
