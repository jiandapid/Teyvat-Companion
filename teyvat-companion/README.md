# Teyvat Companion

A dark fantasy-style, responsive Genshin Impact guide and tracker MVP built with React + Vite.

## Run locally

You need Node.js 18+.

```bash
npm install
npm run dev
```

Open the local URL Vite prints (usually `http://localhost:5173`). To create a production build:

```bash
npm run build
npm run preview
```

## Included and working

- Dashboard and all eight navigation sections
- Character catalogue with search, elemental / ownership / role filters, editable owned status, levels, talents, constellations, role, weapon and artifact notes
- Startup and manual character catalogue refresh using Project Amber with a genshin.dev fallback; refresh responses with fewer than 120 unique characters are rejected so a partial response cannot replace a larger saved roster
- Source-derived material requirements for full Level 90 ascension and level-10 talent upgrades when the provider returns complete costs; unresolved material IDs are visibly flagged rather than treated as verified names
- Custom team presets saved locally
- Material inventory with editable required / owned quantities, automatic missing totals and progress, custom material creation and deletion
- Daily checklist, upgrade goals, manual AR / WL / Abyss / Primogem / wishes / pity tracking
- Personal resource markers by region and category (schematic planning view only, not a geographic map)
- Links to the official HoYoLAB map and community guide resources
- Public Enka.Network UID sync for the account's public display list, including visible character levels when detailed showcase data is disabled
- Detailed Enka showcase sync for equipped weapons, artifacts, available talent values, friendship, constellation, and public profile stats when the player exposes those details
- Optional import of publicly available Enka profile saved builds, with public visibility filtering and a visible warning that live snapshots can be stale
- Optional AKASHA System sync for public character calculations/rankings, weapon variants, artifact set summaries, and on-demand artifact main-stat/substat/Crit Value detail
- GOOD JSON import for inventory/export data that the public UID endpoint cannot expose, including unequipped artifacts and weapons
- JSON export/import, browser-local persistence, and reset option
- Responsive desktop sidebar and mobile navigation

## Important limitations

This is a functional MVP, not a fully curated official game database. The bundled character records begin as a starter catalogue; the app attempts to retrieve a broader live catalogue on launch. If upstream sources are unavailable or return too few unique character records, the refresh is rejected and existing local progress stays intact. External metadata and images can still have gaps, so verify important values in-game. Community build notes are starting points, not a claim that every build is optimal for every team/version.

Material quantities start at zero unless source-provided upgrade costs are available. The character checklist can add full Level 90 ascension and level-10 talent costs from loaded character data; that is a target plan, not the remaining cost from your current level. Keep the target in mind, retain your owned quantities, and verify values in-game before spending Resin. Material run counts and domain rotations are not guessed. The map panel is explicitly schematic and stores user-created markers; it does not fabricate locations or coordinates. Exact geography is linked out to HoYoLAB's interactive map. Enka sync now merges public display-list entries and uses the detailed showcase when available. The display list is not the full owned roster: it cannot reveal hidden characters or private inventory. Detailed equipped-gear fields depend on the player's in-game Character Details visibility. Public Enka saved builds are imported only when the UID owner has a verified, public Enka profile and the provider returns the saved-build endpoint; explicitly private entries are excluded, and live snapshots may be stale. AKASHA sync reads the community site's calculation and artifact endpoints; the service warns that its API may change without notice, so the integration is best-effort and preserves older local snapshots on failure. AKASHA ranking calculations cover supported leaderboard variants, not every team or universal artifact strength. GOOD JSON import remains the way to add exported unequipped inventory; imports stay local to the browser.

Local data is saved in browser localStorage. Optional Supabase email accounts and manual cloud backup/restore are included in the code but remain disabled until you connect your own Supabase project and configure the environment variables below. The app does not ask for HoYoverse passwords, verification codes, cookies, or tokens. YouTube guide actions use search queries and creator homepages rather than fabricated video IDs; live YouTube API search is not configured.

## Public data references

- [genshin.dev API repository and documentation](https://github.com/genshindev/api) — static game data; does not connect to a player's game.
- [Enka.Network API documentation](https://github.com/EnkaNetwork/API-docs) — public Character Showcase API, with rate limits and public-data restrictions.
- [AKASHA System](https://akasha.cv/) — public character calculation/leaderboard and artifact browser.
- [akasha-py](https://github.com/seriaati/akasha-py) — community API wrapper used to verify the public calculation and artifact endpoint patterns; it notes that AKASHA's API can change without notice.
- [HoYoLAB official interactive map](https://act.hoyolab.com/ys/app/interactive-map/index.html)
- [KeqingMains guides](https://keqingmains.com/)

Genshin Impact and its assets are the property of their respective owners. Teyvat Companion is an unofficial fan-made tool and is not affiliated with or endorsed by HoYoverse.

## Publish as a website with automatic updates

The recommended hosting option is Vercel connected to a GitHub repository. This project includes `vercel.json` with the Vite build settings. Once connected, Vercel automatically builds and publishes the newest version whenever changes are pushed to the connected production branch (usually `main`). You do **not** reinstall the app to receive website updates.

### One-time setup

1. Create a repository at [GitHub](https://github.com/new).
2. Upload the **contents** of this `teyvat-companion` folder to the repository root (including `src/`, `package.json`, `index.html`, and `vercel.json`). Do not upload `node_modules` or `dist`.
3. Open [Vercel](https://vercel.com/new), sign in with GitHub, and import that repository.
4. Keep the detected Vite settings (`npm run build` and `dist`) and click **Deploy**. Vercel will give you a public `*.vercel.app` URL.
5. Later, push code changes to the connected branch; Vercel will redeploy automatically.

### Saving progress

The current MVP saves your tracker in browser local storage. This means the website can update without reinstalling, but progress is tied to the browser/device and is not yet synced between devices. Use **Export JSON** in the app to back up your data. Cloud sync would require a database and user accounts.

### Optional cloud accounts and cross-device backup

Cloud sync is opt-in. No Supabase project is connected by default, so local saving and JSON backups continue to work without cloud credentials.

1. Create or select a Supabase project in your own account.
2. Open the Supabase SQL Editor and run `supabase/cloud-sync.sql`. It creates one private workspace row per authenticated user and enables row-level security so users can access only their own data.
3. In Supabase Authentication, enable email/password sign-in and configure the site URL plus allowed redirect URL for your deployed website (and `http://localhost:5173` for local development). If email confirmation is on, confirm the sign-up message before signing in.
4. Copy `.env.example` to `.env.local` for local use and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Add the same two variables in Vercel Project Settings → Environment Variables, then redeploy.
5. Use only the **publishable** key in browser code. Never use a service-role/secret key as a Vite environment variable.
6. Sign in under Settings → Cloud save. Choose **Save local tracker to cloud** to upload this browser's current tracker, or **Restore cloud backup** on another device to replace its local workspace. Restore requires confirmation and a valid backup. Export a JSON backup before restoring.

The cloud copy is manual rather than continuous autosync; this avoids one device silently overwriting another. A successful GitHub build does not mean your live Vercel deployment has picked up the environment variables.

### Publish without GitHub (manual alternative)

You can use the Vercel CLI from the project folder: install dependencies with `npm install`, then run `npx vercel` and follow the prompts to create a preview deployment. After reviewing it, run `npx vercel --prod` to publish production. Connecting GitHub is recommended for automatic deployments.
