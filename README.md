# personal_genomes_project_sdk

A JavaScript SDK and demo application for retrieving, caching, and exploring publicly shared 23andMe data from the [**Personal Genome Project (PGP)**](https://my.pgp-hms.org/public_genetic_data).

The toolkit supports participant discovery, profile lookup, summary statistics, and loading of genotype files for downstream analysis. It ships in two flavors from a single package:

- **Browser SDK** (`personal_genomes_project_sdk`) — runs in the browser with client-side caching through LocalForage, interactive visual summaries, and a developer-friendly API for working with public PGP data.
- **Node-safe / Cloud SDK** (`personal_genomes_project_sdk/cloud_sdk.mjs`) — runs in Node.js, Cloud Run, Cloud Shell, Cloud Functions, or any server runtime. Provides ingestion-only functions (`fetch23andMeParticipants`, `resolveDownloadFilenameCloud`, `load23andMeFileCloud`, `parse23Txt`, etc.) for fetching and parsing genotype data server-side, with no dependency on `window`, `document`, or `localforage`.

---

## Live Demo

https://lorenasandoval88.github.io/personal_genomes_project_sdk/
---

## Documentation
Available in the [wiki](https://github.com/lorenasandoval88/personal_genomes_project_sdk/wiki). 

## Quick Test (Dev Console)

You can test the SDK directly in your browser console.

```javascript
const sdk = await import("https://lorenasandoval88.github.io/personal_genomes_project_sdk/dist/sdk.mjs");

const participants = await sdk.fetch23andMeParticipants(10);
const firstProfile = participants.length ? await sdk.fetchProfile(participants[0].id) : null;

console.log({ participants, firstProfile });
```

## ES6 from npm

Use ES6 modules in two common ways:

From npm (Node/Cloud Run)

Browser SDK:

```javascript
import { fetch23andMeParticipants } from "personal_genomes_project_sdk";
```

Node-safe SDK:

```javascript
import {
  fetchAvailableDataTypes,
  allUsersMetaDataByType_fast,
  fetchProfile,
  load23andMeFile
} from "personal_genomes_project_sdk/cloud_sdk.mjs";
```


[<img width="755" height="599" alt="image" src="https://github.com/user-attachments/assets/b67e2a78-9f2f-420f-bd8b-f17945fbcbba" />](https://lorenasandoval88.github.io/personal_genomes_project_sdk/)

<h2>Functionality</h2>
<p>Key features include:</p>
<ul>
  <li>Automated retrieval of publicly shared genotype datasets</li>
  <li>Client-side or server-side processing of genotype files</li>
  <li>Visualization of participant information and selected genetic markers</li>
  <li>Aggregated summary statistics derived from multiple participants</li>
  <li>Simple web interface for browsing available profiles</li>
</ul>

## Architecture

The repository is organized into three layers:

1. **Source code layer** → `src/` — where the actual logic lives.
2. **Entrypoint layer** → `sdk.js` and `cloudNodeEntry.js` — thin re-export modules that define the public API surface for the browser SDK and the Node-safe (cloud) SDK respectively. Rollup uses these as build inputs.
3. **Built package layer** → `dist/` — generated bundles produced by Rollup. These are the artifacts published to npm and consumed by users.

```
personal_genomes_project_sdk/
├── src/                              ← (1) source code layer
│   ├── js/
│   │   ├── cloud/
│   │   │   └── pgp_node.js           ← edit cloud logic here
│   │   ├── data/                     ← browser data-fetch helpers
│   │   ├── get23_allUsers.js
│   │   ├── get23_loadProfiles.js
│   │   ├── get23_loadStats.js
│   │   ├── get23_loadTxts.js
│   │   └── get23_main.js             ← browser UI orchestration
│   └── css/
│       └── styles.css
│
├── sdk.js                            ← (2) browser SDK entrypoint
├── cloudNodeEntry.js                 ← (2) Node-safe SDK entrypoint
│
├── dist/                             ← (3) built package layer (Rollup output)
│   ├── sdk.mjs                       ← generated browser SDK
│   ├── cloud_sdk.mjs                 ← generated cloud / Node SDK
│   ├── allUsers.bundle.mjs
│   ├── loadStats.bundle.mjs
│   └── main.mjs
│
├── server/
│   └── proxy-server.js               ← local CORS proxy (dev only)
├── index.html                        ← demo web interface
├── rollup.config.js                  ← builds entrypoints → dist/
├── package.json                      ← npm metadata, exports, scripts
└── README.md
```

| Layer | Path | Purpose |
| --- | --- | --- |
| **1. Source** | `src/js/` | Browser modules (`get23_main.js`, `get23_loadStats.js`, etc.) and shared data helpers (`src/js/data/`). |
| **1. Source** | `src/js/cloud/pgp_node.js` | Node-safe cloud logic (fetching, parsing, ZIP extraction) — no `window`, `document`, or `localforage`. |
| **1. Source** | `src/css/styles.css` | Demo app styles. |
| **2. Entrypoint** | `sdk.js` | Re-exports the browser public API. Rollup input for `dist/sdk.mjs`. |
| **2. Entrypoint** | `cloudNodeEntry.js` | Re-exports the Node-safe public API from `src/js/cloud/pgp_node.js`. Rollup input for `dist/cloud_sdk.mjs`. |
| **3. Built** | `dist/sdk.mjs` | Bundled browser SDK (published as `personal_genomes_project_sdk`). |
| **3. Built** | `dist/cloud_sdk.mjs` | Bundled Node-safe SDK (published as `personal_genomes_project_sdk/cloud_sdk.mjs`). |
| Config | `rollup.config.js` | Builds source + entrypoints into `dist/`. |
| Config | `package.json` | Declares dependencies, build scripts, and the `exports` map that resolves the two npm subpaths to the right `dist/` file. |
| Dev | `server/proxy-server.js` | Local CORS proxy for the browser demo (not shipped to npm). |
| Dev | `index.html` | Demo web interface. |

**How the layers connect:** edit logic in (1) `src/`, expose it through (2) the appropriate entrypoint (`sdk.js` for browser, `cloudNodeEntry.js` for Node), then run `npm run build` to regenerate (3) `dist/`. The `exports` field in `package.json` points npm consumers at the right `dist/` file.

## Core Functions

The system is organized into three groups:

1. **Public API Functions** – exported functions intended for external use.
2. **Internal Cache Utilities** – helper functions used internally for caching.
3. **UI Rendering Functions** – functions responsible for displaying data in the interface.

---

## Public API Functions

These functions are exported and can be accessed through the SDK.

| Function | File | Type | Description |
|---|---|---|---|
| `fetch23andMeParticipants()` | `/src/js/data/get23_allUsers.js` | async | Fetches the list of publicly available 23andMe participants from PGP. |
| `fetchProfile(id)` | `/src/js/data/get23_allUsers.js` | async | Retrieves the profile JSON for a specific participant. |
| `getLastAllUsersSource()` | `/src/js/data/get23_allUsers.js` | sync | Returns the source of the last participant dataset retrieval (cache or network). |
| `getLastProfileSource()` | `/src/js/data/get23_allUsers.js` | sync | Returns the source of the last profile retrieval. |
| `load23andMeFile(path, id, cache)` | `/src/js/get23_loadTxts.js` | async | Loads and parses a 23andMe TXT/ZIP source. Set `cache=false` to bypass LocalForage reads/writes. |
| `loadStats()` | `/src/js/get23_loadStats.js` | async | Loads statistics about available genetic datasets (exposed through `sdk.js`). |

---

## Internal Cache Utilities

These functions manage LocalForage caching and are not exported.

| Function | File | Type | Purpose |
|---|---|---|---|
| `parseParticipants()` | `/src/js/data/get23_allUsers.js` | sync | Parses participant HTML and extracts structured participant data. |
| `getCachedParticipants()` | `/src/js/data/get23_allUsers.js` | async | Retrieves cached participant list from LocalForage. |
| `cacheParticipantsIfMissing()` | `/src/js/data/get23_allUsers.js` | async | Stores participants in cache if no valid cache exists. |
| `getCachedProfile()` | `/src/js/data/get23_allUsers.js` | async | Retrieves cached participant profile JSON. |
| `setCachedProfile()` | `/src/js/data/get23_allUsers.js` | async | Stores participant profile data in LocalForage cache. |
| `getCachedStats()` | `/src/js/get23_loadStats.js` | async | Retrieves cached dataset statistics. |
| `setCachedStats()` | `/src/js/get23_loadStats.js` | async | Stores dataset statistics in cache. |
| `isCacheWithinMonths()` | `/src/js/data/get23_allUsers.js` and `/src/js/get23_loadStats.js` | sync | Determines whether cached data is still valid based on time limits. |

---

## UI Rendering Functions

These functions manage display logic in the browser interface.

| Function | File | Type | Description |
|---|---|---|---|
| `displayProfiles()` | `/src/js/get23_main.js` | async | Main controller that loads and displays participant profiles. |
| `renderProfilesTable()` | `/src/js/get23_main.js` | sync | Renders the participant dataset table in the user interface. |

---

## Architecture Summary

The architecture separates concerns into three layers:

- **Data Layer** – fetches participant data and profiles
- **Cache Layer** – stores and retrieves cached data using LocalForage
- **UI Layer** – renders participant information in the browser

This separation allows the system to efficiently fetch genomic data, minimize network requests through caching, and maintain a responsive browser-based interface.


## load23andMeFile Usage

```javascript
const sdk = await import("https://lorenasandoval88.github.io/personal_genomes_project_sdk/dist/sdk.mjs");

// Default behavior (cache enabled)
const parsedA = await sdk.load23andMeFile(pathOrUrl, "hu123ABC");

// Disable cache for this call only
const parsedB = await sdk.load23andMeFile(pathOrUrl, "hu123ABC", false);
```

Parameter summary:

- `path`: required (`string` URL/path or `File`/`FileList`)
- `id`: optional cache key suffix
- `cache`: optional boolean, defaults to `true`


## Build

Run `npm run build` to generate:

- `dist/allUsers.bundle.mjs`
- `dist/loadStats.bundle.mjs`
- `dist/sdk.mjs`
- `dist/cloud_sdk.mjs`

SDK build targets:

- Browser SDK: `dist/sdk.mjs`
  - Includes browser-focused modules and caching/UI helpers.
- Node-safe SDK: `dist/cloud_sdk.mjs`
  - Includes ingestion-only functions for server runtimes (no `window`, `document`, or `localforage`).

Cloud Run style import entrypoint:

```javascript
import {
  fetchAvailableDataTypes,
  allUsersMetaDataByType_fast,
  fetchProfile,
  load23andMeFile
} from "./cloud_sdk.mjs";
```

Package subpath import (after installing from npm):

```javascript
import {
  fetchAvailableDataTypes,
  allUsersMetaDataByType_fast,
  fetchProfile,
  load23andMeFile
} from "personal_genomes_project_sdk/cloud_sdk.mjs";
```

## Run

- Run `npm run start` to start the local proxy/static server on `http://localhost:3000`.
- Open `http://localhost:3000` in your browser.
- If you use a separate static server (for example VS Code Live Server), keep the proxy running for API calls to `http://localhost:3000`.
-  - This allows the application to access external APIs while avoiding CORS restrictions.



