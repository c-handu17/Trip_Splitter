# Trip Split — Tasks

Build order follows `docs/TECH_SPEC.md`. One task at a time. Do not start the next task until the current one is tested, approved, and committed.

- [ ] **T-01 — Scaffold the Expo app**

  Create the TypeScript Expo app with expo-router, expo-file-system, and Jest. Add the folder skeleton from the spec with empty screen files so later tasks have a place to land.

  Files: `package.json`, `app.json`, `tsconfig.json`, `App.tsx`, `app/_layout.tsx`, `app/index.tsx`, `app/trips/[tripId]/index.tsx`, `app/trips/[tripId]/expense/new.tsx`, `app/trips/[tripId]/expense/[expenseId].tsx`, `app/trips/[tripId]/people/[participantId].tsx`, `app/trips/[tripId]/settle.tsx`

  Acceptance criteria:
  - `npm test` runs Jest and passes with no tests yet, or with a single placeholder test that passes.
  - `npx tsc --noEmit` passes.
  - The app shell renders a trip-list screen title.

  PRD feature: Saved on the phone (project foundation for the mobile app).

- [ ] **T-02 — Save and load the JSON document**

  Define the document types and a file store that reads and writes `trip-split.json`. The first read creates `{ "nextId": 1, "trips": [] }`. Saves write a temporary file, then replace the real file.

  Files: `src/store/types.ts`, `src/store/fileStore.ts`, `tests/persistence.test.ts`

  Acceptance criteria:
  - A missing file becomes an empty document with `nextId` 1 and no trips.
  - A saved document is returned unchanged by the next read.
  - A failed replace leaves the previous file bytes unchanged.

  PRD feature: Saved on the phone.

- [ ] **T-03 — Shared errors and currency rules**

  Add the error shape (`validation_error`, `not_found`, `conflict`) and the currency helpers. Allow only `INR`, `USD`, `EUR`, and `GBP`. Convert a major-unit display amount to minor units and back, using two decimal places.

  Files: `src/validation/errors.ts`, `src/money/currency.ts`, `tests/validation.test.ts`

  Acceptance criteria:
  - Unknown currency codes are rejected.
  - ₹10.50 becomes `1050`, and `1050` displays as `10.50`.
  - More than two decimal places is rejected.

  PRD feature: One currency per trip.

- [ ] **T-04 — Create, list, and open trips**

  Implement `POST /trips`, `GET /trips`, and `GET /trips/:tripId`. Creating a trip also creates the organizer participant and assigns both ids from `nextId`. List and detail include participant and expense counts.

  Files: `src/api/trips.ts`, `tests/validation.test.ts`

  Acceptance criteria:
  - A valid trip returns `201` with the trip and `isOrganizer: true`.
  - Empty names, names over the limit, and unknown currencies return `validation_error` and do not change the file.
  - The list shows `participantCount` and `expenseCount`.
  - A missing trip returns `not_found`.

  PRD feature: Multiple trips. One currency per trip. Participant list. Trip list summary.

- [ ] **T-05 — Rename a trip and lock its currency**

  Implement `PATCH /trips/:tripId`. Name can change any time. Currency can change only while the trip has no expenses.

  Files: `src/api/trips.ts`, `tests/validation.test.ts`

  Acceptance criteria:
  - Renaming returns the updated trip.
  - Changing currency on a trip with no expenses succeeds.
  - Changing currency after an expense exists returns `conflict` and leaves the file unchanged.
  - A missing trip returns `not_found`.

  PRD feature: Rename a trip and change its currency only while it has no expenses.

- [ ] **T-06 — Add and list participants**

  Implement `GET /trips/:tripId/participants` and `POST /trips/:tripId/participants`. Names are trimmed and unique per trip, ignoring letter case.

  Files: `src/api/participants.ts`, `tests/validation.test.ts`

  Acceptance criteria:
  - A new friend returns `201` with `isOrganizer: false` and is listed only on that trip.
  - A blank name, a too-long name, or a duplicate name (any case) returns `validation_error`.
  - The same display name may exist on a different trip.
  - A missing trip returns `not_found`.

  PRD feature: Participant list.

- [ ] **T-07 — Rename and remove unused participants**

  Implement `PATCH` and `DELETE` for one participant. Block rename and delete when that person has paid or has a share. Never delete the organizer.

  Files: `src/api/participants.ts`, `tests/validation.test.ts`

  Acceptance criteria:
  - An unused friend can be renamed and removed.
  - The organizer can be renamed while unused, and delete returns `conflict`.
  - Rename or delete of a payer or sharer returns `conflict` and leaves the file unchanged.
  - A person from another trip returns `not_found`.

  PRD feature: Correct a mistake.

- [ ] **T-08 — Check expense fields and shares**

  Add pure checks for an expense before it is saved: trimmed description, real calendar date, positive integer amount, note length, at least one share, no repeated participant, positive share amounts, shares owned by people on the same trip, and shares summing exactly to the amount. The payer may be outside the share list.

  Files: `src/validation/expense.ts`, `tests/validation.test.ts`

  Acceptance criteria:
  - A share list that does not sum to the amount is `validation_error`.
  - A zero share, an empty share list, a repeated person, and a person from another trip are `validation_error`.
  - Payer outside the shares, payer inside the shares, and payer as the only sharer all pass.
  - A blank note becomes null. A note over 200 characters is `validation_error`.
  - An impossible date is `validation_error`.

  PRD feature: Expense entry. Custom shares for a subset. Note on an expense.

- [ ] **T-09 — Create, list, and open expenses**

  Implement `POST`, `GET` list, and `GET` one expense. Save the expense and its shares in one write only after the checks pass. List newest date first, then newest id.

  Files: `src/api/expenses.ts`, `tests/validation.test.ts`, `tests/persistence.test.ts`

  Acceptance criteria:
  - A valid expense returns `201` with payer name, currency, and share names.
  - A rejected expense does not change the file bytes.
  - An expense on trip A is `not_found` when opened through trip B.
  - Reading the file again returns the same expense and shares.

  PRD feature: Expense entry. Custom shares for a subset. Saved on the phone.

- [ ] **T-10 — Edit and delete an expense**

  Implement `PATCH` and `DELETE` for one expense. Patch replaces the fields and the whole share list only after the same checks pass. Delete removes the expense and its shares.

  Files: `src/api/expenses.ts`, `tests/validation.test.ts`

  Acceptance criteria:
  - A valid patch returns the new expense, and the old shares are gone.
  - An invalid patch leaves the previous expense unchanged.
  - Delete returns `204`, and a later get returns `not_found`.
  - Deleting an expense on another trip returns `not_found` and does not remove it.

  PRD feature: Correct a mistake.

- [ ] **T-11 — Show expenses by person**

  Implement `GET /trips/:tripId/participants/:participantId/summary`. Net is total paid minus total assigned. Walk only that trip’s expenses.

  Files: `src/api/people.ts`, `tests/validation.test.ts`

  Acceptance criteria:
  - Paid expenses, assigned shares, both totals, and net match the stored amounts.
  - A person with the same name on another trip does not affect these totals.
  - A positive net means the group owes this person. A negative net means this person owes the group.
  - A missing person returns `not_found`.

  PRD feature: Expenses by person.

- [ ] **T-12 — Fill equal share amounts**

  Add the equal-fill helper used by the expense form before save. It does not write the file.

  Files: `src/money/equalFill.ts`, `tests/equalFill.test.ts`

  Acceptance criteria:
  - An amount that does not divide evenly gives the extra minor units to the first selected people, every share is greater than zero, and the shares sum to the total.
  - No people selected, or an amount smaller than the number of people, returns a validation message and no amounts.
  - The saved record is still whatever amounts the organizer keeps. This task does not add an endpoint.

  PRD feature: Equal-fill shortcut.

- [ ] **T-13 — Calculate settlement**

  Implement the greedy payment list and `GET /trips/:tripId/settlement`. Do not write payments into the JSON file.

  Files: `src/money/settlement.ts`, `src/api/settlement.ts`, `tests/settlement.test.ts`

  Acceptance criteria:
  - A fixture with four people, eight expenses, at least three partial groups, and at least three unequal shares settles in the trip currency.
  - Every net is zero after the payments. The payment sum equals what people with a negative net owe.
  - Every payment is from a negative net to a positive net. People who are already even are omitted from `payments` and included in `balances`.
  - The file bytes are unchanged after settlement.
  - Creditors and debtors are ordered as the spec describes, so the payment list is stable.

  PRD feature: Settle.

- [ ] **T-14 — Trip list screen**

  Show every trip with its currency, participant count, and expense count. Let the organizer create a trip by entering a name, a currency, and their own name.

  Files: `app/index.tsx`

  Acceptance criteria:
  - A created trip appears in the list with count 1 participant and 0 expenses.
  - Invalid name or currency shows the validation message and does not add a trip.
  - Opening a trip navigates to that trip’s home screen.
  - Amounts are not shown on this screen.

  PRD feature: Multiple trips. One currency per trip. Trip list summary.

- [ ] **T-15 — Trip home screen**

  Show the trip name, currency, people, and expenses. Let the organizer add a friend, open a person, open an expense, start a new expense, and open settle. Offer rename, and currency change only when there are no expenses.

  Files: `app/trips/[tripId]/index.tsx`

  Acceptance criteria:
  - People and expenses from other trips are absent.
  - Adding a duplicate name shows the validation message.
  - Currency control is available only when the expense list is empty.
  - An unused friend can be removed. A used friend cannot.

  PRD feature: Participant list. Trip list summary. Rename a trip. Correct a mistake.

- [ ] **T-16 — New expense screen**

  Enter date, description, amount in major units, payer, optional note, and a custom share for each selected person. Include equal-fill, then allow edits before save. Store minor units.

  Files: `app/trips/[tripId]/expense/new.tsx`

  Acceptance criteria:
  - Saving a valid expense returns to the trip home and shows the new expense.
  - Shares that do not sum to the amount stay on the form with the validation message, and the file is unchanged.
  - The payer can be left out of the share list.
  - Equal-fill populates the selected people and still allows a manual change before save.

  PRD feature: Expense entry. Custom shares for a subset. Equal-fill shortcut. Note on an expense.

- [ ] **T-17 — View and edit an expense**

  Show one expense and let the organizer replace it or delete it. Use the same checks as create.

  Files: `app/trips/[tripId]/expense/[expenseId].tsx`

  Acceptance criteria:
  - The screen shows date, description, display amount, payer, note, and each share.
  - A valid edit updates the trip home. An invalid edit keeps the previous expense.
  - Delete removes the expense and its shares, then returns to the trip home.

  PRD feature: Correct a mistake. Expense entry.

- [ ] **T-18 — Person screen**

  Show what this person paid, what was assigned, both totals, and the net, in the trip currency.

  Files: `app/trips/[tripId]/people/[participantId].tsx`

  Acceptance criteria:
  - Totals match `GET .../summary`.
  - Display amounts use two decimal places.
  - A positive net is labeled as owed to this person. A negative net is labeled as owed by this person.

  PRD feature: Expenses by person.

- [ ] **T-19 — Settle screen**

  Show every balance and the payment list. Copy the payment list as plain text. Do not mark any payment as paid.

  Files: `app/trips/[tripId]/settle.tsx`

  Acceptance criteria:
  - The on-screen payments match `GET /trips/:tripId/settlement`.
  - People with a zero net do not appear as a payment.
  - Copy places the same payer, recipient, and amount text on the clipboard.
  - Leaving and reopening the screen does not add anything to `trip-split.json`.

  PRD feature: Settle. Copy the settlement list.
