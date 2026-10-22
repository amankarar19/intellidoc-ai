# IntelliDoc AI: Test Plan

Fill in the **Actual result** and **Pass/Fail** columns yourself while you run each test. Take a screenshot of the important ones for the report.

Automated logic tests: `npm test` (12 tests: validation rules, expiry boundary, date maths, filtering, stats, CSV escaping). Everything else below is manual.

| #   | Test                       | Steps                                                                                                              | Expected result                                                                                       | Actual | Pass/Fail |
| --- | -------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- | ------ | --------- |
| 1   | App starts                 | `npm install`, `npm run dev`, open URL                                                                             | Dashboard loads, no red errors in the browser console                                                 |        |           |
| 2   | Connection and empty state | `.env` filled, `npm run dev`, empty table                                                                          | Green Live · Supabase badge; empty-state message with an Add Document button; all four cards show 0   |        |           |
| 3   | Counts correct             | Add one Verified, one Pending and one expired (Rejected) record, look at the cards and the Status distribution bar | Total 3, Verified 1, Pending 1, Rejected 1; bar and percentages match                                 |        |           |
| 4   | Add a valid document       | Add Document; title "Test Cert", type Certificate, number "T-1", no expiry; Save                                   | Success message; record appears at top; status Verified; Total increases by 1                         |        |           |
| 5   | Missing required fields    | Open form, click Save with everything empty                                                                        | Form stays open; red messages under title, type and number; nothing saved                             |        |           |
| 6   | Expired document flagged   | Add record with expiry date yesterday                                                                              | Status Rejected; "Expired on ..." shown in the row; success message mentions expiry                   |        |           |
| 7   | Valid initial status       | Add record with expiry date in the future                                                                          | Status Verified                                                                                       |        |           |
| 8   | Edit                       | Pencil icon on a record, change the title, Save                                                                    | Row shows the new title; no duplicate row; count unchanged                                            |        |           |
| 9   | Manual status change       | Use the small status dropdown in a row; also try it in the edit form                                               | Badge and stat cards update immediately                                                               |        |           |
| 10  | Delete with confirmation   | Trash icon; first click Cancel, then try again and click Delete                                                    | Cancel keeps the record; Delete removes it; counts drop                                               |        |           |
| 11  | Search                     | Type part of a title, then a type, then a number, then "rejected"                                                  | Only matching rows shown; "No matching documents" when none                                           |        |           |
| 12  | Status filter              | Choose Verified / Pending / Rejected / All                                                                         | Only that status shown; the "x of y records" text is correct                                          |        |           |
| 13  | CSV export                 | Filter to one status, click Export Report; open the file in Excel / Notepad                                        | Only the filtered rows; 7 columns; commas, quotes and line breaks in Notes do not break rows          |        |           |
| 14  | Persistence                | Add/edit/delete, then refresh the page (F5) and also check Supabase Table Editor                                   | Changes are still there and match the Table Editor                                                    |        |           |
| 15  | Supabase read/write        | Add, edit, delete a record, and change a status from the table                                                     | Rows appear/change/disappear in Supabase Table Editor                                                 |        |           |
| 16  | Database errors shown      | With Supabase configured, temporarily break the URL in `.env` (or go offline), restart                             | Red "Could not load documents" panel with a Try again button; no records are shown from anywhere else |        |           |
| 17  | Small screen               | Browser dev tools, device width about 375 px                                                                       | Sidebar hidden behind the menu button; form fits; table scrolls sideways; cards in 2 columns          |        |           |
| 18  | Production build           | `npm run build`                                                                                                    | Finishes with "built in ..." and no errors                                                            |        |           |

## Extra checks for the new interface

- More than 10 records: the pager shows "Page 1 of 2"; Next/Previous work.
- Click the column headings (Document, Type, Expiry, Status, Created): the arrow icon changes and the order changes; records without an expiry date always stay last when sorting by Expiry.
- Status tabs (All / Verified / Pending / Rejected) show counts that change as you type in the search box.
- A document expiring within 30 days appears under "Expiring within 30 days" on Overview.
- Remove or rename `.env`, restart: you should see the "Connect IntelliDoc AI to Supabase" screen, not the dashboard.

## Extra edge cases worth trying

- Expiry date equal to **today** should stay Verified (it expires at the end of today).
- Notes containing `a,b`, `"quoted"` and a line break, then export the CSV.
- Title made only of spaces should be rejected.
- Edit a record, then delete it in another tab, then press Save: you should see an error, not a new duplicate record.
- Click Export Report with no records: you should see "There are no records to export."

## AI Review tests

See `docs/AI_MODULE.md`, section 6 (17 manual cases) and section 5 (automated tests that were run).
