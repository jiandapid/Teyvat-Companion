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
- Optional public character catalogue refresh using `https://genshin.jmp.blue/characters/all?lang=en`
- Custom team presets saved locally
- Material inventory with editable required / owned quantities, automatic missing totals and progress, custom material creation and deletion
- Daily checklist, upgrade goals, manual AR / WL / Abyss / Primogem / wishes / pity tracking
- Personal resource markers by region and category (schematic planning view only, not a geographic map)
- Links to the official HoYoLAB map and community guide resources
- Public Enka.Network UID sync for the account's public display list, including visible character levels when detailed showcase data is disabled
- Detailed Enka showcase sync for equipped weapons, artifacts, available talent values, friendship, constellation, and public profile stats when the player exposes those details
- GOOD JSON import for inventory/export data that the public UID endpoint cannot expose, including unequipped artifacts and weapons
- JSON export/import, browser-local persistence, and reset option
- Responsive desktop sidebar and mobile navigation

## Important limitations

This is a functional MVP, not the fully populated production database described in the full specification. The bundled character records are starter/sample records and do not include the complete current playable roster. Public-data refresh is best-effort and its returned fields should be checked. Community build notes are starting points, not a claim that every build is optimal for every team/version.

Material quantities intentionally start at zero rather than being invented. Enter verified costs from the in-game upgrade screen or connect a validated data pipeline before treating results as authoritative. The map panel is explicitly schematic and stores user-created markers; it does not fabricate locations or coordinates. Exact geography is linked out to HoYoLAB's interactive map. Enka sync now merges public display-list entries and uses the detailed showcase when available. The display list is not the full owned roster: it cannot reveal hidden characters or private inventory. Detailed equipped-gear fields depend on the player's in-game Character Details visibility. GOOD JSON import remains the way to add exported unequipped inventory; imports stay local to the browser.

Data is stored in browser localStorage. There is no cloud account/authentication or cross-device syncing in this version. The app does not ask for HoYoverse passwords, verification codes, cookies, or tokens. YouTube guide actions use search queries and creator homepages rather than fabricated video IDs; live YouTube API search is not configured.

## Public data references

- [genshin.dev API repository and documentation](https://github.com/genshindev/api) — static game data; does not connect to a player's game.
- [Enka.Network API documentation](https://github.com/EnkaNetwork/API-docs) — public Character Showcase API, with rate limits and public-data restrictions.
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

### Publish without GitHub (manual alternative)

You can use the Vercel CLI from the project folder: install dependencies with `npm install`, then run `npx vercel` and follow the prompts to create a preview deployment. After reviewing it, run `npx vercel --prod` to publish production. Connecting GitHub is recommended for automatic deployments.
