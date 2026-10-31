# Budget Tracker Mobile: Development and Deployment Guide

This guide covers running the Expo React Native app in simulators, on physical devices, and in
production. The mobile app uses the same authenticated backend and database as the web app.

## Prerequisites

- Node.js `^22.13.0`, `^24.3.0`, `^26.0.0`, or `>=27.0.0` (Expo SDK 58 requirement)
- npm
- Expo CLI through the project scripts
- An Expo account for EAS builds
- For iOS simulator builds:
  - macOS
  - Xcode and an installed iOS Simulator
- For Android emulator builds:
  - Android Studio
  - Android SDK, emulator, and `adb`
- For physical devices:
  - Expo Go for basic development, or
  - an Expo development build for notifications, biometrics, and other native modules

## Install and start

```bash
cd mobile
npm install
npm start
```

Useful scripts:

```bash
npm run ios       # Open the iOS simulator
npm run android   # Open the Android emulator
npm run web       # Run the Expo web target
npm run typecheck # TypeScript validation
```

The mobile app defaults to:

```text
http://localhost:4000/api
```

This works from the local development environment when the backend is running on the same
computer. The backend must be started separately from the repository root using its normal
development command.

## Backend URL configuration

Set `EXPO_PUBLIC_API_BASE_URL` before starting Expo:

```bash
EXPO_PUBLIC_API_BASE_URL=http://localhost:4000/api npm start
```

### iOS simulator

The iOS simulator can normally reach `localhost` on the Mac running the backend:

```bash
EXPO_PUBLIC_API_BASE_URL=http://localhost:4000/api npm run ios
```

### Android emulator

Android's emulator uses `10.0.2.2` to reach the host computer:

```bash
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:4000/api npm run android
```

For a different emulator configuration, use the host address supported by that emulator.

### Physical iPhone or Android device

The device and computer must be on the same network. Find the computer's LAN address and use it
instead of `localhost`:

```bash
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.25:4000/api npm start
```

The backend must listen on a network-reachable interface, and the computer firewall must allow the
backend port. Do not expose a development backend directly to the public internet.

## Environment files and secrets

For local work, create `mobile/.env.local` if desired:

```text
EXPO_PUBLIC_API_BASE_URL=http://localhost:4000/api
```

Expo loads `EXPO_PUBLIC_*` values into the client bundle. Treat every value with that prefix as
public: never put passwords, database URLs, JWT signing keys, or third-party private keys there.
Keep local environment files out of version control and use the deployment platform's environment
secrets for CI builds.

If a URL changes, restart Metro and rebuild any native client. Existing installed binaries retain
the URL that was embedded when they were built.

## Backend and database prerequisites

The mobile app is a client of the existing Express API; it does not connect directly to MongoDB.
Before testing synchronized features:

1. Start the API server from the repository root.
2. Confirm the API can reach its configured MongoDB database.
3. Confirm authentication, CORS/network access, and `/api/auth/session` work.
4. Create or use a test account.
5. Confirm the mobile API URL points to that same backend environment.

Use separate development, staging, and production databases. Never validate imports or destructive
CRUD flows against production data.

## Simulator workflows

### iOS Simulator

1. Start the backend.
2. Start Expo with the iOS API URL.
3. Run `npm run ios`.
4. Choose an installed simulator if Xcode asks.
5. Sign in with an existing backend account or create one.

The iOS simulator supports local app storage and most UI behavior. Face ID can be simulated from
the simulator's **Features > Face ID** menu after biometric lock is enabled.

### Android Emulator

1. Start an Android Virtual Device in Android Studio.
2. Start the backend.
3. Start Expo with `10.0.2.2`.
4. Run `npm run android`.

Android emulator biometric behavior depends on the configured virtual device. Use a physical
device when validating real fingerprint or face unlock behavior.

## Physical-device workflows

### Expo Go

Expo Go is useful for quickly testing navigation, API synchronization, forms, offline cache, and
statement import. Install Expo Go, start the project, and scan the QR code.

Some native capabilities may require a development build rather than Expo Go, especially when
testing notification behavior, notification channels, biometric configuration, or custom native
configuration.

### Metro connectivity modes

If the QR code cannot be reached, try the options below from `mobile/`:

```bash
npx expo start --lan
npx expo start --tunnel
npx expo start --localhost
```

LAN is usually fastest, tunnel works across restrictive networks but can be slower, and localhost
is intended for simulator/emulator workflows. The Metro connection mode does not replace the API
URL: configure both independently.

### Development build

Install EAS CLI and authenticate:

```bash
npm install --global eas-cli
eas login
```

Create a development build:

```bash
cd mobile
eas build:configure
eas build --profile development --platform ios
eas build --profile development --platform android
```

After installing the development build on the device, start the bundler:

```bash
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.25:4000/api npx expo start --dev-client
```

Use the development build to validate:

- Push/local notification permissions and behavior
- Face ID, Touch ID, and Android biometrics
- Native document picker
- Native share sheet
- Haptic feedback
- Offline-to-online synchronization
- Screen transitions, bottom-tab press feedback, and modal sheet animations on both platforms
- Receipt OCR using a real device camera and supported on-device OCR services
- Calendar bill reminders, notification action buttons, background sync, app shortcuts, and Android
  share-target routing
- Home-screen widget installation, rendering, and refresh after signing in and changing expense data
- App-icon long-press quick actions for Add expense, Scan receipt, and View alerts, including
  launching the app from a cold start

Receipt OCR, calendar access, background sync, notification actions, app shortcuts, share
extensions, and home-screen widgets are native features and are not fully represented by Expo Go.
Rebuild the development client after changing native plugins or permissions.

The app caches a background-sync snapshot and a per-account mutation outbox under its private
device storage. Expense, goal, supported module, and statement-import changes are persisted locally
before sync; they are replayed in order after connectivity returns, on app foreground, or from the
sync banner. Pending changes remain queued if the server rejects a request, and the banner displays
the error so it can be retried after resolving the issue. A previously signed-in account can open
its cached data offline; explicit sign-out clears the cached session but preserves that account's
pending outbox for its next sign-in.

Background execution is advisory: iOS and Android decide when the task runs, and it must not be
treated as a guaranteed real-time sync mechanism. Offline storage uses AsyncStorage and is not an
encrypted database; use the optional biometric lock to reduce access when the device is unattended.

Android and iOS share targets route supported text, CSV, JSON, and image shares into the app's
import surface. Expo config plugins generate the share and widget extension targets. Siri/App
Intents and Google Assistant integrations still require native extension or intent declarations
beyond the JavaScript bundle.

## Statement imports

The app accepts bank exports in common formats:

- CSV
- Excel `.xlsx` and `.xls`
- JSON
- Tab-delimited or semicolon-delimited text

The importer detects common fields such as date, description, narration, merchant, debit,
withdrawal, credit, deposit, amount, reference, and balance. It previews rows, skips duplicates,
separates income from expenses, and sends supported records to the shared backend.

For testing, use a copy of a statement with sensitive data removed. Do not commit bank statements
or credentials to the repository.

## Notifications and biometric lock

Notifications and biometric lock are optional and controlled in the mobile app settings.

- Notifications require user permission.
- iOS notification behavior requires a development or production build for complete native
  validation.
- Biometric lock requires Face ID, Touch ID, or enrolled Android biometrics.
- Notification history, alert dismissal, snoozes, and biometric preference are stored locally on
  the device.
- The app does not read SMS messages or store bank credentials.

## Production environment

Use a secure HTTPS backend URL for production:

```bash
EXPO_PUBLIC_API_BASE_URL=https://api.example.com/api
```

Do not use `localhost`, a LAN address, development credentials, or a development database in a
production build.

Environment values are embedded into the client bundle at build time. Rebuild the app after
changing `EXPO_PUBLIC_API_BASE_URL`.

## EAS production builds

Configure EAS once:

```bash
cd mobile
eas build:configure
```

Build installable artifacts:

```bash
EXPO_PUBLIC_API_BASE_URL=https://api.example.com/api \
  eas build --profile production --platform ios

EXPO_PUBLIC_API_BASE_URL=https://api.example.com/api \
  eas build --profile production --platform android
```

For both platforms:

```bash
EXPO_PUBLIC_API_BASE_URL=https://api.example.com/api \
  eas build --profile production --platform all
```

Before the first store build, configure production identifiers, signing credentials, app icons,
privacy details, and store metadata in `app.json` and the EAS project configuration. Never commit
Apple certificates, Android keystores, API secrets, or signing passwords.

For iOS distribution, prepare an Apple Developer account, bundle identifier, App Store Connect
app, certificates/profiles, notification capability, and privacy declarations. For Android,
prepare a unique application ID, Google Play Console app, package signing configuration, release
keystore ownership, notification channel behavior, and Data safety declarations.

Keep the signing account and keystore recovery information in an approved password manager. Losing
Android signing credentials can prevent future updates to an existing Play Store application.

## Store submission

After a successful production build:

```bash
eas submit --platform ios
eas submit --platform android
```

Review the generated build in App Store Connect and Google Play Console before release. Store
review and privacy declarations should accurately describe:

- Financial data synchronization
- Local notifications
- Biometric app lock
- User-selected statement uploads
- Offline device cache
- No SMS scanning

### OTA updates and native changes

JavaScript-only changes may be delivered through an approved Expo/EAS update strategy if one is
configured. Native dependency changes, `app.json` plugin changes, permissions, icons, and SDK
upgrades require a new native build and store submission. Keep runtime versions compatible between
the installed binary and any OTA update.

Do not use OTA updates to bypass store review or to change privacy-sensitive native behavior.

## Release, backup, and rollback

- Tag the source revision used for every submitted build.
- Record the mobile version, backend version, API environment, and EAS build ID.
- Export a redacted test dataset before release testing.
- Back up production database data according to the backend operations policy.
- Test API backward compatibility before releasing a mobile binary.
- Keep the previous store build available for rollback planning.
- If an API migration is required, deploy additive backend changes before shipping the client.
- Never roll back by restoring an old mobile cache over newer server data.

## Testing and quality gates

Automated validation:

```bash
cd mobile
npm ci
npm run typecheck
npx expo config --type public
```

For dependency or native configuration changes, build a development client on both platforms.
For release candidates, test a production-like build rather than only Metro/Expo Go.

Test at least one device on each supported iOS and Android major version, plus:

- Slow or unavailable network
- App termination and restart
- Background/foreground transitions
- Permission denial and later re-enablement
- Empty backend data
- Large statement files
- Duplicate and malformed statement rows
- Expired authentication
- Household owner and member roles
- Currency and date boundary cases

## Logging and support diagnostics

When investigating a report, collect only non-sensitive diagnostics:

- App version and build ID
- iOS/Android version and device model
- API environment name, not credentials
- Whether the issue reproduces online or offline
- A redacted error message and timestamp

Never request passwords, bearer tokens, full bank statements, database dumps, or unredacted
financial records in support channels. Add centralized crash/error reporting only after reviewing
its retention, access controls, and financial-data redaction behavior.

## Validation checklist

Run before every release:

```bash
cd mobile
npm run typecheck
npx expo config --type public
```

Then verify manually:

- Login, signup, session restore, and secure logout
- Web/mobile data synchronization using the same account
- Offline cache and later synchronization
- Add, edit, delete, and status changes
- Statement preview, duplicate detection, and partial failures
- Alert badge, deep links, dismiss, and snooze
- Notification permission and delivery
- Biometric lock and relock after backgrounding
- iOS simulator and physical iPhone
- Android emulator and physical Android device
- Production HTTPS backend connectivity

## Troubleshooting

### The app cannot connect to the backend

- Confirm the backend is running.
- Confirm the API URL includes `/api`.
- Use `10.0.2.2` for the standard Android emulator.
- Use the computer LAN IP for physical devices.
- Confirm the backend binds to a reachable interface.
- Check firewall rules and device Wi-Fi.

### Notifications do not appear

- Enable notifications in the app and OS settings.
- Test on a development or production build.
- Confirm the app has not already scheduled or dismissed the alert.
- Check notification settings for the current simulator/device.

### Biometrics cannot be enabled

- Enroll Face ID, Touch ID, or Android biometrics on the device.
- Use the simulator's biometric controls where supported.
- Rebuild if native configuration changed.

### Imported rows are missing

- Confirm the statement has a header row.
- Use standard date, amount, debit, credit, and description columns.
- Check the preview before importing.
- Review duplicate matching, which uses date, amount, and description.
- Check the offline banner for rows that could not sync.

### Native changes are not visible

Restart Expo with a clean cache:

```bash
npx expo start --clear
```

If native configuration or dependencies changed, rebuild the development client.

## Security and privacy

- Use HTTPS outside local development.
- Do not embed secrets in the mobile bundle.
- Do not commit statements, tokens, credentials, or signing files.
- Use test accounts and redacted statements during development.
- Rotate exposed credentials immediately.
- Keep the backend authorization and household permissions enabled.
- Restrict production database and EAS access by role and require MFA where available.
- Use short-lived/revocable sessions and sign out lost or compromised devices.
- Verify statement files before importing and delete temporary exports from shared devices.
