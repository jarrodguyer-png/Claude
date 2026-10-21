# Bill Ledger

A small web app for tracking monthly bills and income, ticking things off as they are paid, and checking them against bank statements.

- **Month**: this month's checklist, built from your recurring list. Tick a bill off and it moves into a Done group. Tap any bill or income row to change its amount or due date in one sheet, either for this and the following months or for this month only. Earlier months keep what they had. Log income in one line (source, amount, date); a source that matches an expected paycheck ticks it off. Variable expenses (groceries, dining out, clothes and so on) keep a running total of what you enter against a monthly amount and turn red when you go over. One form at the top picks the expense and takes the amount. A line with no limit just tracks, and money you put aside (savings, investing) shows green when the goal is reached and never red.
- **Planner**: type in a paycheck and see the unpaid bills for the month in due-date order, what is left of the check after each one, what you still have to pay, and what is left over. **Log it as income** records the check (and ticks off a matching expected paycheck). Hidden from view-only viewers.
- **Bills**: the list of everything that repeats (monthly, twice a month, every 2 weeks, weekly, quarterly, twice a year, yearly). **+ Add** creates a bill, income or a variable expense. Category, start and end months and statement text live under More options.
- **Bank**: add CSV, OFX/QFX or PDF statements. Spending shows where the money went by category and month, Reconcile matches bills to statement lines (review, then apply), Transactions lists every line, Files lists what you imported.

No framework, no build dependencies beyond Python 3, and nothing is sent anywhere. Statement files are read inside the page and only the date, description and amount of each line are saved.

## Run it

Open `index.html` in a browser, or host the folder anywhere static (GitHub Pages, Netlify, `python3 -m http.server`).

Data is saved in your browser's local storage. Use **Settings → Export backup** now and then, and before clearing browser data. **Restore from backup** brings it back, including on another device.

When the same page is published as a Claude Artifact it saves with the page on your Claude account instead, so it is the same on every device.

## Share a view-only copy

Publish the page as an Artifact with these capabilities, then use the Share menu on the page to invite your spouse by email as a **Viewer**:

```json
{ "db": { "rules": [ { "path": "ledger", "read": "view", "write": "owner" } ] }, "user": {}, "downloads": true }
```

Only the owner can write to the ledger. A viewer sees Month, Bills and the spending summary on the Bank tab, updated live, with every edit control removed. Importing and reconciling are hidden for viewers, although the underlying lines are readable by anyone you share with, so share only with people you trust with your finances. Invite by email; do not use a public link.

Data saved by the first version (in the owner's private space) is copied to the shared ledger automatically the first time the owner opens the page.

## Statement formats

| Format | Notes |
| --- | --- |
| CSV | Columns are detected from the header (date, description, amount, or separate money out / money in columns). You can correct the choice in the import dialog. Credit card files where charges are positive are detected, with a switch to flip signs. |
| OFX / QFX | Read directly. Signs come from the file. |
| PDF | Best effort. The page reads the text layer and looks for lines that start with a date and end with an amount. Check each line in the preview and flip any wrong signs. Loads `pdf.js` from cdnjs on first use. |

Files imported twice are detected, and lines you already have are left out by default.

## Develop

Source lives in `src/`:

```
src/styles.css       design tokens and components
src/body.html        page markup
src/js/01-core.js    helpers, data model, storage (browser or Claude storage)
src/js/02-parse.js   CSV, OFX and PDF parsing
src/js/03-logic.js   recurrence, matching, categories, spending maths, example data
src/js/04-views.js   the four tabs
src/js/05-dialogs.js dialogs, import flow, settings and backup
src/js/06-main.js    events and start-up
```

`bash build.sh` writes `index.html` (a normal page) and `dist/artifact.html` (the same page without the document wrapper, for publishing as an Artifact). `index.html` is committed so the repo can be hosted as is.
