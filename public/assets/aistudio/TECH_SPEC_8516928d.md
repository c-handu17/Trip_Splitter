# Trip Split — Technical Specification

## Overview

Trip Split is a mobile app for one organizer. It keeps several trips on the phone, each with its own people, one currency, and expenses.

Each expense records the date, description, amount, the one participant who paid, and custom share amounts for only the people included. Shares must add up to the expense amount.

The app shows what each person paid, what was assigned to them, and their net. Settle calculates the shortest payment list that brings every net to zero. Those payments are not stored.

## Tech Stack

- **Expo with TypeScript.** One beginner-friendly project that runs as a phone app, which matches the mobile-only product.
- **expo-router.** Screens are files, so the trip list, a trip, an expense form, a person, and settle stay easy to find.
- **expo-file-system.** Trips, people, and expenses live in one JSON file on the phone and are still there after the app closes. No server and no accounts.
- **Jest.** Share checks, equal-fill, and settlement are pure rules and can be tested without tapping through the phone.

There is no remote API. The paths below are local functions the screens call. They read and write the phone JSON file.

## Architecture

Screens call a local data layer. That layer checks the rules, then reads or writes one JSON document. Settlement reads balances from that document and returns payments. It does not write payments back into the file.

```
┌──────────────────────────────────────────┐
│ Screens (Expo)                           │
│ Trip list → Trip home → Expense form     │
│                      → Person            │
│                      → Settle            │
└────────────────────┬─────────────────────┘
                     │ local function calls
┌────────────────────▼─────────────────────┐
│ Data layer                               │
│ validation, totals, settlement           │
└────────────────────┬─────────────────────┘
                     │ read / write whole file
┌────────────────────▼─────────────────────┐
│ trip-split.json on the phone             │
│ trips[]                                  │
│   participants[]                         │
│   expenses[]                             │
│     shares[]                             │
└──────────────────────────────────────────┘
```

Each save loads the file, changes the document in memory, and writes the whole document again. The write goes to a temporary file first. The app replaces `trip-split.json` only after that temporary file is fully written. A failed check leaves the existing file untouched.

Money is stored as an integer number of minor units (the smallest coin). For a currency with two decimal places, ₹10.50 is stored as `1050`. Screens divide by 100 for display. Shares are compared as integers, so a total either matches or it does not.

Supported currencies are `INR`, `USD`, `EUR`, and `GBP`. All four use two decimal places, so one minor-unit rule covers every trip.

## Folder Structure

```
expenses_tracker/
├── docs/
│   ├── PRD.md
│   └── TECH_SPEC.md
├── requirments.txt
├── app/
│   ├── _layout.tsx                 # navigation shell
│   ├── index.tsx                   # trip list
│   └── trips/
│       └── [tripId]/
│           ├── index.tsx           # trip home: people, expenses, counts
│           ├── expense/
│           │   ├── new.tsx
│           │   └── [expenseId].tsx # view and edit one expense
│           ├── people/
│           │   └── [participantId].tsx
│           └── settle.tsx
├── src/
│   ├── store/
│   │   ├── fileStore.ts            # read and write trip-split.json
│   │   └── types.ts                # document types
│   ├── api/
│   │   ├── trips.ts
│   │   ├── participants.ts
│   │   ├── expenses.ts
│   │   ├── people.ts
│   │   └── settlement.ts
│   ├── money/
│   │   ├── currency.ts             # allowed currency codes, minor units
│   │   ├── equalFill.ts
│   │   └── settlement.ts           # greedy payment list
│   └── validation/
│       └── errors.ts
├── tests/
│   ├── equalFill.test.ts
│   ├── settlement.test.ts
│   ├── validation.test.ts
│   └── persistence.test.ts
├── App.tsx
├── app.json
├── package.json
└── tsconfig.json
```

## Data Model

The phone keeps a single file named `trip-split.json` in the app document directory. If the file is missing, the first launch creates:

```json
{ "nextId": 1, "trips": [] }
```

`nextId` is the next integer id to assign. Trip, participant, and expense ids all come from this counter, then `nextId` increases by 1. Amounts are integers in minor units. Dates are `YYYY-MM-DD` text. Timestamps are ISO-8601 text in UTC.

```json
{
  "nextId": 51,
  "trips": [
    {
      "id": 1,
      "name": "Goa",
      "currency": "INR",
      "createdAt": "2026-11-20T05:00:00Z",
      "participants": [
        { "id": 10, "name": "Asha", "isOrganizer": true, "createdAt": "2026-11-20T05:00:00Z" }
      ],
      "expenses": [
        {
          "id": 50,
          "paidByParticipantId": 10,
          "expenseDate": "2026-11-20",
          "description": "Dinner",
          "amountMinor": 180000,
          "note": null,
          "createdAt": "2026-11-20T06:00:00Z",
          "shares": [
            { "participantId": 11, "amountMinor": 100000 }
          ]
        }
      ]
    }
  ]
}
```

### `trips`

One object per trip, stored in the top-level `trips` array.

| Field | Type | Rules |
| --- | --- | --- |
| `id` | integer | Unique in the file |
| `name` | text | Required, trimmed, 1–60 characters |
| `currency` | text | Required, one of `INR`, `USD`, `EUR`, `GBP` |
| `createdAt` | text | Set when the trip is added |
| `participants` | array | People on this trip only |
| `expenses` | array | Expenses on this trip only |

### `participants`

People on one trip, including the organizer. A person object lives only inside that trip’s `participants` array.

| Field | Type | Rules |
| --- | --- | --- |
| `id` | integer | Unique in the file |
| `name` | text | Required, trimmed, 1–40 characters |
| `isOrganizer` | boolean | Exactly one `true` per trip |
| `createdAt` | text | Set when the person is added |

Names are unique inside the trip, ignoring letter case. The organizer object is added in the same save as the trip.

### `expenses`

One object per cost, inside that trip’s `expenses` array.

| Field | Type | Rules |
| --- | --- | --- |
| `id` | integer | Unique in the file |
| `paidByParticipantId` | integer | Required. Must match a participant `id` in the same trip |
| `expenseDate` | text | Required calendar date |
| `description` | text | Required, trimmed, 1–120 characters |
| `amountMinor` | integer | Required, greater than 0 |
| `note` | text or null | Optional, trimmed, 1–200 characters, otherwise null |
| `createdAt` | text | Set when the expense is added |
| `shares` | array | People who share this expense |

### `shares`

One object per person who shares an expense, nested on that expense. People who are not listed are not charged. A share has no id of its own.

| Field | Type | Rules |
| --- | --- | --- |
| `participantId` | integer | Required. Must match a participant `id` in the same trip |
| `amountMinor` | integer | Required, greater than 0 |

`participantId` is unique inside one expense’s `shares` array. The sum of `amountMinor` in `shares` must equal that expense’s `amountMinor`. The payer may have a share object, or none.

No settlement collection. Payments are calculated when the organizer opens settle.

## API Endpoints

These are local calls. Errors use one shape:

```json
{ "error": { "code": "validation_error", "message": "Shares must add up to the expense amount." } }
```

`code` is `validation_error`, `not_found`, or `conflict`.

### `GET /trips`

Purpose: trip list with the summary counts.

Response `200`:

```json
{
  "trips": [
    {
      "id": 1,
      "name": "Goa",
      "currency": "INR",
      "participantCount": 4,
      "expenseCount": 8,
      "createdAt": "2026-11-20T05:00:00Z"
    }
  ]
}
```

`participantCount` is the length of that trip’s `participants` array. `expenseCount` is the length of its `expenses` array.

### `POST /trips`

Purpose: create a trip and its organizer participant together.

Request:

```json
{ "name": "Goa", "currency": "INR", "organizerName": "Asha" }
```

Response `201`:

```json
{
  "trip": { "id": 1, "name": "Goa", "currency": "INR" },
  "organizer": { "id": 10, "name": "Asha", "isOrganizer": true }
}
```

### `GET /trips/:tripId`

Purpose: open one trip.

Response `200`:

```json
{
  "id": 1,
  "name": "Goa",
  "currency": "INR",
  "participantCount": 4,
  "expenseCount": 8
}
```

Response `404` when the trip does not exist.

### `PATCH /trips/:tripId`

Purpose: rename a trip. Change currency only while the trip has no expenses.

Request:

```json
{ "name": "Goa 2026", "currency": "INR" }
```

Either field may be sent. Response `200` returns the trip. Response `409` when `currency` is sent and that trip’s `expenses` array is not empty.

### `GET /trips/:tripId/participants`

Purpose: list people on this trip only.

Response `200`:

```json
{
  "participants": [
    { "id": 10, "name": "Asha", "isOrganizer": true },
    { "id": 11, "name": "Ben", "isOrganizer": false }
  ]
}
```

### `POST /trips/:tripId/participants`

Purpose: add a friend.

Request:

```json
{ "name": "Ben" }
```

Response `201`:

```json
{ "id": 11, "tripId": 1, "name": "Ben", "isOrganizer": false }
```

### `PATCH /trips/:tripId/participants/:participantId`

Purpose: rename a participant who is not yet a payer or a sharer.

Request:

```json
{ "name": "Benny" }
```

Response `200` returns the participant. Response `409` when that person’s `id` is any expense’s `paidByParticipantId` in the trip, or appears in any expense’s `shares`.

### `DELETE /trips/:tripId/participants/:participantId`

Purpose: remove a participant who is not yet used on an expense.

Response `204` on success. Response `409` when the person is the organizer, or is already a payer or a sharer. The organizer is never removed; the organizer’s name can be changed with `PATCH` while they are unused.

### `GET /trips/:tripId/expenses`

Purpose: list expenses for this trip, newest date first, then newest `id`.

Response `200`:

```json
{
  "expenses": [
    {
      "id": 50,
      "expenseDate": "2026-11-20",
      "description": "Dinner",
      "amountMinor": 180000,
      "currency": "INR",
      "paidBy": { "id": 10, "name": "Asha" },
      "note": null,
      "shares": [
        { "participantId": 11, "name": "Ben", "amountMinor": 100000 },
        { "participantId": 12, "name": "Cia", "amountMinor": 80000 }
      ]
    }
  ]
}
```

### `POST /trips/:tripId/expenses`

Purpose: save an expense and its shares together, or reject the whole save.

Request:

```json
{
  "expenseDate": "2026-11-20",
  "description": "Dinner",
  "amountMinor": 180000,
  "paidByParticipantId": 10,
  "note": "Tip included",
  "shares": [
    { "participantId": 11, "amountMinor": 100000 },
    { "participantId": 12, "amountMinor": 80000 }
  ]
}
```

`note` may be omitted. Response `201` returns the expense in the same shape as one list item. The payer does not need to appear in `shares`. The new expense object, including its `shares` array, is appended to that trip only after every check passes.

### `GET /trips/:tripId/expenses/:expenseId`

Purpose: open one expense for review or edit.

Response `200` is the expense object. Response `404` when the expense is missing or belongs to another trip.

### `PATCH /trips/:tripId/expenses/:expenseId`

Purpose: replace the expense fields and the full `shares` array. The same rules as create apply. The previous expense object stays in the file until the new object is valid.

Request body matches create. Response `200` returns the updated expense.

### `DELETE /trips/:tripId/expenses/:expenseId`

Purpose: delete an expense. Its `shares` array is deleted with it, because the shares live on the expense object.

Response `204` on success. Response `404` when the expense is missing or belongs to another trip.

### `GET /trips/:tripId/participants/:participantId/summary`

Purpose: expenses by person.

Response `200`:

```json
{
  "participant": { "id": 10, "name": "Asha" },
  "currency": "INR",
  "totalPaidMinor": 180000,
  "totalAssignedMinor": 0,
  "netMinor": 180000,
  "paid": [
    {
      "expenseId": 50,
      "expenseDate": "2026-11-20",
      "description": "Dinner",
      "amountMinor": 180000
    }
  ],
  "assigned": []
}
```

`netMinor` is `totalPaidMinor - totalAssignedMinor`. A positive net means the group owes this person. A negative net means this person owes the group. `assigned` items include `shareMinor`, `expenseAmountMinor`, and `paidBy`. Totals are computed by walking that trip’s `expenses` array. Paid rows are expenses whose `paidByParticipantId` matches this person. Assigned rows are shares whose `participantId` matches this person.

### `GET /trips/:tripId/settlement`

Purpose: calculate who should pay whom. Nothing is written to `trip-split.json`.

Response `200`:

```json
{
  "currency": "INR",
  "balances": [
    {
      "participantId": 10,
      "name": "Asha",
      "totalPaidMinor": 180000,
      "totalAssignedMinor": 0,
      "netMinor": 180000
    },
    {
      "participantId": 11,
      "name": "Ben",
      "totalPaidMinor": 0,
      "totalAssignedMinor": 100000,
      "netMinor": -100000
    }
  ],
  "payments": [
    {
      "fromParticipantId": 11,
      "fromName": "Ben",
      "toParticipantId": 10,
      "toName": "Asha",
      "amountMinor": 100000
    }
  ]
}
```

`balances` includes every participant so the nets can be checked. `payments` omits anyone whose net is zero. Each payment is from a person with a negative net to a person with a positive net.

Settlement steps, in order:

1. Net for each participant is total paid minus total assigned on this trip.
2. Drop nets of zero.
3. Creditors are positive nets, sorted by net descending, then by `participantId` ascending.
4. Debtors are negative nets, sorted by the absolute value descending, then by `participantId` ascending.
5. While both lists still have someone, transfer the smaller of the creditor’s remaining net and the debtor’s remaining debt. Record that payment. Reduce both. Remove anyone who reaches zero.

The result uses at most one payment fewer than the number of non-zero balances, every net ends at zero, and the payment amounts add up to the absolute value of all negative nets.

### Equal-fill and copy

Equal-fill does not have an endpoint or a stored collection. On the expense form, the organizer selects people and the app fills amounts before save:

- Let `n` be the number selected and `amountMinor` the expense total.
- If `n` is 0, or `amountMinor` is less than `n`, fill nothing and show a validation message. A share of zero is not allowed.
- Otherwise each person gets `floor(amountMinor / n)`. The first `amountMinor % n` people in the selected order get one extra minor unit.
- The organizer can change any filled amount. Save still goes through `POST` or `PATCH` and still requires the shares to sum to the total.

Copy settlement does not have an endpoint or a stored collection. The settle screen turns the `payments` list into plain text and copies it on the phone. The app does not send messages.

## Error Handling and Validation

- Trip name, organizer name, participant name, and description are trimmed. Empty values are `validation_error`.
- Names are unique per trip, ignoring letter case.
- Currency is exactly `INR`, `USD`, `EUR`, or `GBP`.
- `amountMinor` and every share are integers greater than 0.
- A share list has at least one object, no repeated participant, and the amounts sum exactly to `amountMinor`.
- The payer and every sharer must already belong to that trip.
- Create and update of an expense are all-or-nothing. Invalid shares leave the previous file unchanged.
- A participant who has paid or shared cannot be renamed or removed (`conflict`). The organizer cannot be removed (`conflict`).
- Currency cannot change after the first expense (`conflict`). The trip name can.
- A missing trip, participant, or expense, or an id that belongs to a different trip, is `not_found`.
- Dates must be real calendar dates.
- `note` longer than 200 characters is `validation_error`. A note that is omitted or blank is stored as null.
- The JSON file stays on the phone. The app writes a temporary file and replaces `trip-split.json` only when the new document is complete, so a crash cannot leave an expense without its shares.

## Testing Approach

Jest tests cover the rules that the success metrics depend on. Phone UI is checked with one manual script.

Automated:

- Equal-fill splits an amount that does not divide evenly, gives every selected person a positive share, and sums to the total. It refuses a split that would create a zero share.
- An expense whose shares do not sum to the amount is rejected and does not change the JSON file.
- The payer can be outside the share list, inside it, or the only sharer.
- Person totals use paid minus assigned. Two trips with the same person names do not mix expenses.
- Settlement on a fixture with four people, eight expenses, at least three partial groups, and at least three unequal shares returns payments in the trip currency, brings every net to zero, and matches the sum of what the debtors owe.
- Every payment in that fixture is from a negative net to a positive net.
- Saving the document, then reading `trip-split.json` again, returns the same trips, participants, expenses, and totals.
- Rename and delete of a used participant are rejected. Currency change is rejected once an expense exists. Deleting an expense removes its shares.
- A rejected save leaves the previous file bytes unchanged.

Manual, on a phone or emulator:

- Create a trip, add four people including the organizer, enter eight expenses, force-close the app, reopen it, and confirm the trip list counts and the person totals.
- Run settle and read the copied text against the on-screen payment list.

## Traceability Table

| PRD feature | Endpoint(s) | Collection(s) |
| --- | --- | --- |
| Multiple trips | `GET /trips`, `POST /trips`, `GET /trips/:tripId` | `trips`, `participants` |
| One currency per trip | `POST /trips`, `GET /trips/:tripId` | `trips` |
| Participant list, including the organizer | `POST /trips`, `GET /trips/:tripId/participants`, `POST /trips/:tripId/participants` | `participants` |
| Expense entry | `POST /trips/:tripId/expenses`, `GET /trips/:tripId/expenses`, `GET /trips/:tripId/expenses/:expenseId` | `expenses` |
| Custom shares for a subset | `POST /trips/:tripId/expenses`, `GET /trips/:tripId/expenses` | `shares` |
| Expenses by person | `GET /trips/:tripId/participants/:participantId/summary` | `expenses`, `shares`, `participants` |
| Settle | `GET /trips/:tripId/settlement` | `expenses`, `shares`, `participants` (read only) |
| Saved on the phone | Every endpoint above, through `trip-split.json` | `trips`, `participants`, `expenses`, `shares` |
| Correct a mistake | `PATCH /trips/:tripId/expenses/:expenseId`, `DELETE /trips/:tripId/expenses/:expenseId`, `PATCH /trips/:tripId/participants/:participantId`, `DELETE /trips/:tripId/participants/:participantId` | `expenses`, `shares`, `participants` |
| Equal-fill shortcut | None. Calculated on the expense form before save | None |
| Trip list summary | `GET /trips`, `GET /trips/:tripId` | `trips`, `participants`, `expenses` |
| Rename a trip; currency only before expenses | `PATCH /trips/:tripId` | `trips` |
| Note on an expense | `POST /trips/:tripId/expenses`, `PATCH /trips/:tripId/expenses/:expenseId` | `expenses` |
| Copy the settlement list | None. The settle screen copies the text of `GET /trips/:tripId/settlement` | None |
