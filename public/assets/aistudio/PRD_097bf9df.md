# Trip Split

A mobile app for one organizer to track shared expenses across several friend trips and, at the end of a trip, see who should pay whom.

## Problem Statement

On a trip with friends, one person usually ends up remembering who paid, who was included, and who owes what. Expenses are uneven: not everyone shares every cost, and the people who pay are not always the same person. By the end of the trip the group is doing the math by hand, and it is easy to miss a cost or charge someone who was not there. This product gives the organizer one place to record those facts during the trip and a clear payment list when it is time to settle.

## Target Users

- **Organizer.** The only person who uses the app. They create trips, add the people on each trip, enter every expense, review spending by person, and run settle. They do not manage accounts for anyone else.
- **Trip participant.** A friend on a trip, including the organizer. Participants do not open the app. They matter because each one can pay an expense, be assigned a share of an expense, and appear in the final “who pays whom” list.

## User Stories

1. As an organizer, I want to create more than one trip so that each trip keeps its own people and expenses.
2. As an organizer, I want to choose one currency when I create a trip so that every amount on that trip is in the same money.
3. As an organizer, I want to add the people on a trip, including myself, so that I can record who paid and who shares each cost.
4. As an organizer, I want to enter an expense with a date, a description, an amount, and the participant who paid so that the record matches what happened.
5. As an organizer, I want to assign a custom amount to each participant who shares an expense, including only the people who were part of it, so that someone who was not included is not charged.
6. As an organizer, I want the assigned amounts to add up to the expense total before the expense is saved so that the split is complete and can be settled later.
7. As an organizer, I want a view of expenses by person so that I can see what each participant paid and what was assigned to them.
8. As an organizer, I want a settle action that lists who should pay whom, and how much, so that the group can clear the trip without doing the math by hand.
9. As an organizer, I want trips, people, and expenses to still be there after I close the app and open it again on the same phone so that I can keep using it through a real trip.
10. As a trip participant, I want the payment list to be based on what I paid minus what was assigned to me so that I only pay or receive the remaining difference.

## Features

### Must Have

- **Multiple trips.** The organizer can create and open separate trips. People and expenses on one trip never appear on another. *(Stories 1, 10)*
- **One currency per trip.** The organizer sets a single currency at trip creation. Every expense amount and every settlement amount on that trip uses it. *(Story 2)*
- **Participant list.** The organizer can add participants to a trip. There are no accounts, invites, or logins. The organizer is a participant and can pay or share like anyone else. *(Story 3)*
- **Expense entry.** Each expense stores a date, a description, an amount, and exactly one participant who paid. *(Story 4)*
- **Custom shares for a subset.** For each expense, the organizer chooses which participants share it and enters an amount for each of them. A participant who is not selected is not charged. The payer is chosen separately, so the payer may or may not be in the sharing group. At least one participant must have a share. Each share is greater than zero. The shares must add up to the expense amount or the expense is not saved. *(Stories 5, 6)*
- **Expenses by person.** For a chosen participant, the organizer can see the expenses that person paid, the expenses where that person has a share and the share amount, the total paid, the total assigned, and the net (total paid minus total assigned). *(Stories 7, 10)*
- **Settle.** A settle action for a trip shows a list of payments: payer, recipient, and amount in the trip currency. After those payments, every participant’s net is zero. When more than one valid list exists, the app shows a list with as few payments as possible. Participants who are already even are omitted. *(Stories 8, 10)*
- **Saved on the phone.** Closing the app and opening it again on the same phone shows the same trips, participants, and expenses. *(Story 9)*

### Should Have

- **Correct a mistake.** The organizer can edit or delete an expense, and can edit or remove a participant who is not yet used on an expense. A real trip will include wrong amounts, wrong names, and wrong splits. *(Stories 4, 5, 7, 8)*
- **Equal-fill shortcut.** From the custom-share entry, the organizer can fill the selected participants with equal amounts that sum to the expense total, then change any amount before saving. The saved record is still custom amounts. *(Stories 5, 6)*
- **Trip list summary.** Each trip shows its currency, how many participants it has, and how many expenses it has, so the organizer can tell trips apart. *(Story 1)*

### Nice to Have

- **Rename a trip** and change its currency only while it has no expenses. *(Stories 1, 2)*
- **Add a note** on an expense, such as “dinner included tip,” without changing the amount or the split. *(Story 4)*
- **Copy the settlement list** as plain text the organizer can read aloud or send in a message. Sending is done by the organizer outside the app. *(Story 8)*

## Success Metrics

1. **A real trip survives a restart.** On one phone, the organizer creates a trip, adds at least four participants (including themselves), enters at least eight expenses where at least three expenses exclude someone and at least three use unequal shares, closes the app, and reopens it. All eight expenses and all participant totals match what was entered.
2. **Settlement clears the trip.** For that same trip, every suggested payment uses the trip currency, every participant’s net is zero after the payments are applied, and the sum of payment amounts equals the sum of what participants with a negative net owe.
3. **The list is explainable.** For every participant, total paid minus total assigned equals their net, and each suggested payment is between a participant who owes and a participant who is owed. The organizer can point to those totals and justify the list without a separate spreadsheet.

## Constraints and Assumptions

- Only the organizer uses the app. Participants do not get access.
- The product is a mobile app used on the organizer’s phone.
- The organizer is always a participant on each trip they create.
- Each trip has one currency, chosen by the organizer. The app does not convert currencies.
- A share is a specific amount of money, not a percentage. The organizer is responsible for entering amounts that match the bill. The app only checks that the shares are positive and sum to the expense amount.
- “Who paid” and “who shares” are separate. A participant can pay an expense and take none of the share, take part of it, or take all of it.
- Net balance for a participant is total paid minus total assigned on that trip. A positive net means the group owes that person. A negative net means that person owes the group.
- Settle suggests payments that bring every net to zero, using as few payments as possible. It does not record that those payments were actually made.
- Data must remain available on the same phone after the app is closed. This version does not require the organizer to reach that data from a second phone.
- Editing or deleting a participant who is already a payer or a sharer on an expense is not part of the first version; the organizer corrects the expenses instead.
- No account, password, or permission model is required, because a single person manages the trip.

## Out of Scope

- Accounts, login, passwords, and inviting friends into the app.
- More than one person adding or editing the same trip.
- A web or desktop version.
- More than one currency on a trip, exchange rates, or mixed-currency settlement.
- Receipt photos, bank or card import, and automatic reading of a bill.
- Tax, tip, or discount calculated by the app. Those amounts are already included in the expense total the organizer enters.
- Marking a settlement payment as paid, partial payoff, or a running “still unpaid” list after settle.
- Notifications, reminders, and comments between friends.
- Budgets, spending limits, and charts.
