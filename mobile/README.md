# Budget Tracker mobile app

This Expo React Native app is the mobile companion for the existing Budget Tracker web app. It includes:

- Dashboard with balance, income, spending, budget health, recent transactions, and savings goals
- Expense search, category filters, add-expense form, and EMI schedule modal
- Accounts, cards, balances, and net-worth summary
- Savings goals with progress tracking and a create-goal form
- Bills, transfers, categories, reports, import/export, privacy, and appearance entry points
- Secure sign-in/sign-up, persisted bearer-token sessions, sign-out, and account-scoped API access
- Backend snapshot hydration for cards, categories, expenses, payments, transfers, bills, income,
  loans, insurance, budget rules, savings goals, investments, rewards, net-worth, and household data
- Add and update flows for supported module records, with local demo data retained only when no
  authenticated backend records are available
- Offline-first cache with account-scoped, persistent queued creates/updates/deletes for expenses,
  goals, supported modules, and statement imports; queued changes sync in order when connectivity
  returns, when the app is reopened, or from the sync banner
- Previously signed-in users can reopen the app offline and continue using cached data; an
  unauthorized server response still clears the saved session, and explicit sign-out removes it
- Pending counts and server errors are shown in the sync banner; failed changes remain on-device
  until they can be retried
- Mobile-specific authentication screen, compact bottom navigation, quick-add actions, searchable
  module lists, swipe-friendly delete controls, status toggles, and mobile-sized form sheets
- Pull-to-refresh on dashboard, expenses, and every module screen
- Offline cache banner with retry and device-local data retention
- Shared mobile calculations for EMI amortization, budget forecasts and carryovers, recurring due
  dates, insurance premium status, investment returns, net worth, and currency conversion
- JSON export/import for moving a local mobile snapshot between devices
- Native CSV/JSON document picker and OS share sheet for statement import and backups
- Household invitation creation, native invite sharing, invitation acceptance, member removal, and leaving a household
- Bank statement workflows use user-selected CSV/JSON files; no bank credentials are stored or transmitted
- Mobile alert center with due-bill, pending-payment, EMI, budget-risk, and offline-sync alerts
- Persistent alert dismissal, deep links from alerts to the relevant module, pull-to-refresh, quick-add
  actions, compact bottom navigation, and offline-first cache behavior
- Optional native device notifications for pending bills, payments, EMI installments, budget risks,
  and offline state, with a mobile settings toggle
- Haptic feedback when interacting with alerts and compact dashboard quick actions for expenses,
  income, transfers, and bills
- Optional Face ID, Touch ID, or device-biometric app lock with automatic relocking when the app
  leaves the foreground
- One-day alert snoozing so reminders can be deferred without losing them
- Next-generation mobile navigation with animated screen transitions, spring press feedback, and an
  animated active-tab indicator
- Modern mobile visual system with elevated surfaces, rounded cards, pill filters, stronger
  hierarchy, refined quick actions, and a floating bottom navigation treatment
- Voice expense drafting with native speech recognition, automatic category and amount extraction,
  and explicit confirmation before saving
- Camera receipt scanning with on-device OCR, detected total/category preview, and confirmation
  before creating an expense
- Calendar bill-reminder creation, actionable notification snooze/dismiss controls, background
  snapshot sync, and native app shortcuts for adding expenses or scanning receipts
- Android share-target routing for text, CSV, JSON, and image content into the import flow
- Home-screen widget showing current balance, monthly spending, and alert count
- App-icon long-press quick actions for adding an expense, scanning a receipt, and viewing alerts
- Bank-agnostic statement upload for CSV, Excel, JSON, and tab-delimited exports. The importer
  detects common debit/credit, amount, date, narration, reference, merchant, and balance columns,
  previews transactions, identifies duplicates, separates income from expenses, and syncs new
  transactions to the shared backend.
- Import parsing is resilient to quoted CSV values, semicolon/tab-delimited exports, JSON
  transaction arrays, ambiguous common date formats, duplicate rows, and partial sync failures.

Set the API URL for a physical device:

```bash
EXPO_PUBLIC_API_BASE_URL=http://YOUR_COMPUTER_IP:4000/api npm start
```

## Run

```bash
cd mobile
npm install
npm start
```

Use the Expo QR code with Expo Go, or run `npm run ios` / `npm run android`.

## Tests

```bash
cd mobile
npm test
npm run typecheck
```

The Jest suites cover financial calculations, statement/voice/receipt parsing, offline queue
scoping and replay, API snapshot failures, and app boot, authentication, hydration, and navigation.
Native device integrations still require simulator or physical-device validation.

For simulator, physical-device, EAS build, store submission, notification, biometric, backend URL,
statement-import, troubleshooting, and release instructions, see
[DEPLOYMENT.md](./DEPLOYMENT.md).

Voice expense entry requires an Expo development build or production build because it uses native
speech recognition and microphone permissions; it is not available in Expo Go.

Receipt OCR, calendar access, background sync, app shortcuts, notification actions, share targets,
and home-screen widgets require a development or production build. Siri/App Intents remain
separate native integration work.
