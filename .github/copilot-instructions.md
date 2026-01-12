# Copilot instructions for this repository

Purpose
- Help AI coding agents be immediately productive working on this Expo + React Native app.

Big picture
- Expo app using `expo-router` (file-based routing). Entry is the `app/` directory; route layouts live in `_layout.tsx` files (see `app/_layout.tsx` and nested layouts in `app/(tabs)/_layout.tsx`).
- Code is TypeScript + React Native with Expo-managed SDK (see `package.json` dependencies: `expo`, `expo-router`, `expo-camera`, etc.).
- UI pattern: small reusable components in `components/` (e.g., `themed-text.tsx`, `themed-view.tsx`, `ui/` helpers). Prefer using `themed-*` components and hooks in `hooks/` when altering visual elements.

Key developer commands
- Install: `npm install`
- Start dev server: `npx expo start` (or `npm run start`)
- Open on Android/iOS/web: `npm run android`, `npm run ios`, `npm run web`
- Reset starter project: `npm run reset-project` (runs `scripts/reset-project.js`)
- Lint: `npm run lint`

Routing and structure notes
- File-based routes live under `app/`. Creating `app/foo.tsx` => route `/foo`.
- Grouping and special routes: folders like `(auth)` and `(tabs)` are used to group routes without adding to the URL; nested `_layout.tsx` files provide shared UI and navigation for route groups.
- Example files to inspect when modifying routes: `app/(auth)/login.tsx`, `app/(tabs)/home.tsx`, `app/(cashier)/scanner.tsx`.

Patterns & conventions
- The project favors `themed-*` primitives and `use-theme-color`/`use-color-scheme` hooks for color handling. See `components/themed-text.tsx`, `hooks/use-theme-color.ts`.
- Platform-specific components exist (e.g., `components/ui/icon-symbol.ios.tsx` and `icon-symbol.tsx`); if modifying icons, consider platform fallbacks.
- Keep business logic out of route components where possible; prefer small components in `components/` and utility hooks.

Integration points
- Camera and scanner: `expo-camera` used in `app/(cashier)/scanner.tsx` — be mindful of permission flows and native APIs.
- Navigation: `expo-router` + `@react-navigation/*` packages — use file routes and the `useRouter()` hook from `expo-router` when programmatically navigating.

Editing guidelines (practical examples)
- To add a new tab screen: create `app/(tabs)/new-screen.tsx` and update `app/(tabs)/_layout.tsx` if you need to expose it in tab navigation.
- To share layout across auth pages: edit `app/(auth)/_layout.tsx` rather than copying UI into each page.
- When adding colors or themes, update `constants/theme.ts` and prefer `use-theme-color.ts` for lookups.

Testing, build, and CI cues
- No test harness or CI config is present in the repo. Use `npx expo start` to verify runtime behavior on device/emulator.
- Linting: run `npm run lint` to catch style issues.

What NOT to change blindly
- `app/_layout.tsx` and nested `_layout.tsx` files — these control routing and common UI; large refactors here affect many routes.
- `scripts/reset-project.js` — used to move starter code; only edit if you understand its reset semantics.

Where to look first (file map)
- Routing: `app/` (top priority)
- UI primitives: `components/` and `components/ui/`
- Theme/hooks: `constants/theme.ts`, `hooks/use-theme-color.ts`, `hooks/use-color-scheme.ts`
- Build and scripts: `package.json`, `scripts/reset-project.js`

If anything is unclear or you need a deeper dive (examples, tests, or a small refactor), ask and I'll expand this file with targeted examples.
