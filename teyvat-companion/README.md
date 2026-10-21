# Teyvat Companion

A dark fantasy-style, responsive Genshin Impact guide and tracker MVP built with React + Vite.

## Run locally

You need Node.js 18+.

```bash
npm ci
npm run dev
```

Open the local URL Vite prints (usually `http://localhost:5173`).

Because this repository includes `package-lock.json`, use `npm ci` for a clean, reproducible install. When intentionally adding or upgrading dependencies, run `npm install` to update the lockfile, then commit both `package.json` and `package-lock.json`. To create a production build:

```bash
npm run build
npm run preview
```

## Included and working

- Dashboard and all eight navigation sections
- Character catalogue with search, elemental / ownership / role filters, editable owned status, levels, talents, constellations, role, weapon and artifact notes
- Startup and manual character catalogue refresh using Project Amber reconciled with the genshin.dev catalogue; records are merged by character identity and Traveler element, supplemental fields fill source gaps, refreshes with fewer than 120 unique records are rejected, and missing character details can fall back to the name slug
- Source-derived material requirements for full Level 90 ascension and level-10 talent upgrades when the provider returns complete costs; unresolved material IDs are visibly flagged rather than treated as verified names
- Settings data-health report for metadata warnings, image references, build-reference matches and cached character detail records
- Custom team presets saved locally, with live roster-level hints for possible elemental reactions, duplicate slots, missing party members, on-field role, and sustain
- Artifact optimizer shows each selected piece’s main-stat, weighted-substat, rarity, and level contributions so its heuristic ranking is easier to inspect
- Material inventory with editable required / owned quantities, automatic missing totals and progress, custom material creation and deletion
- Daily checklist, upgrade goals, manual AR / WL / Abyss / Primogem / wishes / pity tracking
- Personal resource markers by region and category (schematic planning view only, not a geographic map)
- Links to the official HoYoLAB map and community guide resources
- Public Enka.Network UID sync for the account's public display list, including visible character levels when detailed showcase data is disabled
- Detailed Enka showcase sync for equipped weapons, artifacts, available talent values, friendship, constellation, and public profile stats when the player exposes those details
- Optional import of publicly available Enka profile saved builds, with public visibility filtering and a visible warning that live snapshots can be stale
- Optional AKASHA System sync for public character calculations/rankings, weapon variants, artifact set summaries, and on-demand artifact main-stat/substat/Crit Value detail; the one-click UID sync reports the provider's actual failure reason when AKASHA is unavailable
- Inventory Kamera `.GOOD` file import for full inventory data that UID showcase sync cannot expose, including unequipped artifacts and weapons
- JSON export/import, browser-local persistence, and reset option
- Responsive desktop sidebar and mobile navigation

## Important limitations

This is a functional MVP, not a fully curated official game database. The bundled character records begin as a starter catalogue; the app attempts to retrieve a broader live catalogue on launch. If upstream sources are unavailable or return too few unique character records, the refresh is rejected and existing local progress stays intact. External metadata and images can still have gaps, so verify important values in-game. Community build notes are starting points, not a claim that every build is optimal for every team/version.

Material quantities start at zero unless source-provided upgrade costs are available. Team review is a transparent roster heuristic, not a damage or rotation simulation; possible elemental reactions do not prove reliable application. Artifact optimizer score components explain the relative heuristic ranking, but scores are not predicted damage. The character checklist can add full Level 90 ascension and level-10 talent costs from loaded character data; that is a target plan, not the remaining cost from your current level. Keep the target in mind, retain your owned quantities, and verify values in-game before spending Resin. Material run counts and domain rotations are not guessed. The map panel is explicitly schematic and stores user-created markers; it does not fabricate locations or coordinates. Exact geography is linked out to HoYoLAB's interactive map. Enka sync now merges public display-list entries and uses the detailed showcase when available. The display list is not the full owned roster: it cannot reveal hidden characters or private inventory. Detailed equipped-gear fields depend on the player's in-game Character Details visibility. Public Enka saved builds are imported only when the UID owner has a verified, public Enka profile and the provider returns the saved-build endpoint; explicitly private entries are excluded, and live snapshots may be stale. AKASHA sync reads the community site's calculation and artifact endpoints; the service warns that its API may change without notice, so the integration is best-effort and preserves older local snapshots on failure. AKASHA ranking calculations cover supported leaderboard variants, not every team or universal artifact strength. GOOD JSON import remains the way to add exported unequipped inventory; Inventory Kamera exports a `.GOOD` file that the app accepts directly without renaming. Its scanner itself is Windows software, but a compatible export can be imported into Teyvat Companion from any browser. Imports stay local to the browser.

Local data is saved in browser localStorage. Optional Supabase email accounts and manual cloud backup/restore are included in the code but remain disabled until you connect your own Supabase project and configure the environment variables below. The app does not ask for HoYoverse passwords, verification codes, cookies, or tokens. YouTube guide actions use search queries and creator homepages rather than fabricated video IDs; live YouTube API search is not configured.

## Inventory Kamera import

1. Install and run [Inventory Kamera](https://github.com/Andrewthe13th/Inventory_Kamera) on its supported Windows setup, with Genshin open.
2. Follow its setup instructions and use **Scan**; it scans visible inventory screens and exports a `.GOOD` inventory file.
3. In Teyvat Companion, open **Account Tracker → Inventory Kamera / GOOD Import → Import .GOOD inventory** and select that file. You do not need to rename it to `.json`.
4. The file is parsed in your browser and saved in that browser's local storage. It is not uploaded to Teyvat Companion's server.

Inventory Kamera's official scanner is Windows software and does not provide a native macOS app; you can still import a compatible `.GOOD` file created on a supported Windows computer.

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

The Teyvat Companion Supabase project is now provisioned on the **$0/month quoted plan** in Frankfurt, and the private workspace table has been created with row-level security. The app has its public publishable key configured as a safe browser default, so you do not need a Vercel secret to connect it. The cloud UI will appear once the updated frontend deploys. Free plans have usage limits; do not upgrade or enable paid add-ons for this project.

Before email confirmation redirects work, set Supabase Auth's URL Configuration:
1. Open the [Supabase project](https://supabase.com/dashboard/project/ktsgeuswodqhfbfbmeci).
2. Set **Site URL** to `https://teyvatcompanion.vercel.app`.
3. Add `https://teyvatcompanion.vercel.app/**` and `http://localhost:5173/**` to the allowed redirect URLs.
4. Under Authentication → Providers, ensure **Email** sign-in is enabled.

No service-role or secret key is included in the app. The publishable key is public by design; row-level security ensures each signed-in user can read or write only their own workspace.

After the latest website deploys, open Settings → Cloud save. Create an account, confirm your email, then sign in. Choose **Save local tracker to cloud** on the current browser; on another device, sign in and choose **Restore cloud backup**. Restore requires confirmation and replaces that browser's local workspace, so export a JSON backup before restoring. Saving is manual, not continuous autosync, to prevent devices silently overwriting each other.

For local development, blank entries in `.env.example` work because the project URL and public key have safe defaults in `src/lib/supabase.js`. You can override both with `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` if you intentionally test another project.

### Publish without GitHub (manual alternative)

You can use the Vercel CLI from the project folder: install dependencies with `npm ci`, then run `npx vercel` and follow the prompts to create a preview deployment. After reviewing it, run `npx vercel --prod` to publish production. Connecting GitHub is recommended for automatic deployments.
