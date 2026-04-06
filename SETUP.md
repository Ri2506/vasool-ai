# VasoolAI — Sprint 1 Setup

All Sprint 1 code is scaffolded. Before you can run the app, complete these steps.

## ⚠️ Path note

The project lives under `/Users/rishi/Vasool Ai/vasool-ai/`. The parent folder has a **space** in its name (`Vasool Ai`), which can occasionally trip up Metro / Watchman. If you hit bundler errors that mention paths, move the project to a space-free location, e.g.:

```sh
mv "/Users/rishi/Vasool Ai/vasool-ai" "/Users/rishi/vasool-ai"
```

## 1. Install dependencies

```sh
cd "/Users/rishi/Vasool Ai/vasool-ai"
npm install
```

## 2. Create a Supabase project

1. Go to <https://supabase.com>, create a new project.
2. In the SQL editor, paste the contents of `supabase/migrations/0001_init.sql` and run it. (Or run `supabase db push` if you have the Supabase CLI linked.)
3. Under **Authentication → Providers**, enable **Phone** auth and configure an SMS provider (Twilio / MSG91 / Supabase's own for testing).

## 3. Configure env vars

```sh
cp .env.example .env
```

Fill in:
- `EXPO_PUBLIC_SUPABASE_URL` — from Supabase project settings → API
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` — same place

## 4. Build the Android dev client (one time)

WatermelonDB requires native modules, so Expo Go will **not** work. You need a custom dev client.

```sh
# If you don't have eas-cli yet:
npm install -g eas-cli
eas login

# Link this project to an EAS project (updates app.json):
eas init

# Build the Android dev client (cloud build, ~10–15 min):
eas build --profile development --platform android
```

When the build finishes, EAS gives you an APK URL. Install it on your Android device. iOS build is deferred — see the plan file.

## 5. Run the dev server

```sh
npm run start
```

Open the dev-client APK on your Android device, scan the QR code (or enter the URL manually). The app should load.

## 6. Verify Sprint 1

1. First launch → **Language screen** (EN/TA toggle). Tap தமிழ் → UI switches to Tamil. Continue.
2. **Phone login** → enter a test number → OTP screen → enter the OTP from your SMS provider → lands on the owner **Home** placeholder showing "Hello, {phone}".
3. Tap **Sign out** → back to auth. Tap "I'm an agent" → agent login. (Agent login needs a Supabase Edge Function `agent-login` which is a Sprint 2 task — it will fail with "Invalid PIN" until then. That's expected.)
4. Kill and reopen the app → owner session is restored from SecureStore.
5. Enable airplane mode on the auth screen → the **OfflineBanner** appears at the top.
6. Check logs for `[VasoolAI] WatermelonDB ready: true`.

## What's NOT in Sprint 1 (coming later)

- `agent-login` Edge Function (Sprint 2)
- First-login org/user bootstrap (Sprint 2)
- Real sync between WatermelonDB and Supabase (Sprint 3)
- All collection, borrower, loan, report screens
- GPS, voice input, receipt images

## Project layout

```
vasool-ai/
├── App.tsx                 Entry — i18n init, auth hydrate, RootNavigator
├── index.ts                Expo root registration
├── app.json, eas.json      Expo + EAS config
├── babel.config.js         Legacy decorators (for WatermelonDB) + Reanimated
├── tsconfig.json           Strict + @/* path alias
├── supabase/migrations/    0001_init.sql — 10 tables + RLS
└── src/
    ├── constants/          colors, typography, config
    ├── i18n/               English + Tamil + resolver
    ├── db/                 WatermelonDB schema, 10 models, sync stub
    ├── lib/supabase.ts     Supabase client (SecureStore-backed session)
    ├── store/              Zustand — authStore, appStore
    ├── utils/              format (₹ formatting)
    ├── components/common/  Button, Card, Avatar, Badge, ProgressBar, OfflineBanner
    ├── screens/auth/       Language, PhoneLogin, OTP, PinLogin
    ├── screens/owner/      HomeScreen (placeholder)
    ├── screens/agent/      AgentHomeScreen (placeholder)
    └── navigation/         Root, Auth, Owner, Agent navigators
```
