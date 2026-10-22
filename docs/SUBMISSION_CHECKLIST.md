# Final Submission Checklist

## Before the demo

- [ ] `npm install` and `npm run dev` work on the machine you will present on
- [ ] `npm test` passes and `npm run build` finishes without errors
- [ ] `supabase.sql` run, `.env` filled, dev server restarted, badge shows Live · Supabase
- [ ] Add three fictional records first (Verified, Pending, expired) so the dashboard is not empty
- [ ] Be online (the app needs the internet to reach Supabase); keep a screen recording as backup
- [ ] Only fictional data on screen

## Run through all 18 tests in docs/TEST_PLAN.md

- [ ] Results written in the Actual / Pass-Fail columns (only what you really saw)
- [ ] Screenshots taken: dashboard, add form with errors, expired = Rejected, search/filter, CSV opened, Supabase table, mobile view

## Report

- [ ] Cover page filled in
- [ ] Certificate page left for real college signatures
- [ ] Acknowledgement written in your own words
- [ ] Every [FILL IN] removed
- [ ] Table of contents generated in Word
- [ ] Screenshots and your own test results inserted
- [ ] References limited to sources you used
- [ ] SAL College template followed if one exists
- [ ] Diagrams exported from the Mermaid blocks (paste into https://mermaid.live and download PNG) or redrawn in draw.io

## Files to submit

- [ ] **Delete the `.env` file before zipping** (it holds your Supabase URL and key). Hand in `.env.example` instead
- [ ] Project folder / ZIP (without `node_modules`, `dist` and without your real `.env`)
- [ ] Report (PDF + Word if required)
- [ ] Screenshots / demo video if required
- [ ] Printed copies if required

## Viva

- [ ] Read docs/VIVA_QA.md and open the matching file for each answer
- [ ] Be ready to show `validation.js`, `documents.js`, `supabase.sql`, and `App.jsx`
- [ ] Be honest about limits: rule-based only, no authentication yet

## AI additions

- [ ] Function deployed and GEMINI_API_KEY / GEMINI_MODEL secrets set
- [ ] `.env` uses the legacy anon key
- [ ] AI manual checklist (AI_MODULE.md section 6) filled in by me
- [ ] Gemini key not in the zip, Git or screenshots; `.env` deleted before submission
- [ ] Limitations in AI_MODULE.md section 7 read and understood
- [ ] `supabase-auth-migration.sql` run; Email provider on; Site URL and redirect URLs set
- [ ] Created two test accounts and checked each sees only its own documents
