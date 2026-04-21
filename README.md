# Osano API Tester

A local, menu-driven tester for Osano's public APIs. Originally a Bash script
(`osano_api_test.sh`), now with a web UI that covers two Osano APIs side-by-side.

## What's inside

| API | Base URL | Endpoints |
|-----|----------|-----------|
| Customer REST API | `https://api.osano.com` | 62 |
| Unified Consent Core API (v2) | `https://uc.api.osano.com` | 20 |

The UI is a single-page app served by a tiny Node HTTP server. The server also
acts as a proxy that forwards requests to Osano (so the browser doesn't hit
CORS), adding the appropriate auth headers on each call.

## Requirements

- **Node.js 14 or newer** — check with `node -v`. Nothing else. No `npm install`.
- macOS, Linux, or Windows — anywhere Node runs.

## Run it locally

You have two options depending on what you're working with.

### Option A — the single-file bundle (recommended)

Use this if someone sent you `osano-api-tester.js` or you want the simplest
path.

```bash
node osano-api-tester.js
```

Then open http://localhost:4173 in a browser.

To use a different port:

```bash
PORT=5000 node osano-api-tester.js
```

### Option B — from source

Use this if you've cloned / unzipped the whole folder and want to edit the UI.

```bash
node server.js
```

Then open http://localhost:4173.

Edits to files in `public/` (HTML, CSS, JS, endpoint definitions) are picked up
on a browser refresh — the server reads them fresh from disk on every request.

## First-time setup in the UI

1. Open http://localhost:4173.
2. At the top of the sidebar, pick the API you want (Customer API or Unified
   Consent).
3. Paste your API key(s) into the settings block. Each API has its own fields:
   - **Customer API** — one key, `x-osano-api-key`
   - **Unified Consent** — two keys:
     - `x-uc-api-key` (default for most routes)
     - `x-osano-api-key` (admin — required for `subjects/merge`, `subjects/profile`,
       and `subjects/profile/verification-code`)
4. Pick an endpoint from the sidebar. Fill in path/query parameters and JSON
   body as needed. Click **Send request**.

Keys and base URLs are stored in your browser's `localStorage`. They don't
leave your machine — the Node server forwards requests to Osano using those
values but does not persist them anywhere.

## Features

- **Per-API sidebar** with colour-coded HTTP method badges
  (`GET` / `POST` / `PATCH` / `PUT` / `DELETE`).
- **Searchable endpoint list**.
- **Live path preview** — shows the fully-interpolated URL as you type path
  params and query params.
- **JSON body editor** with "Format" (pretty-print) and "Reset template"
  helpers. Most write endpoints ship with a sensible starting template.
- **Geo override headers** (`x-country-code-override` /
  `x-region-code-override`) on UC consent endpoints.
- **Response viewer** with tabs for body, headers, and a reconstructed view of
  the outbound request (with keys masked).
- **Copy as cURL** — turns the current form state into a shell command you can
  paste into a terminal or share. Auth keys are rendered as env-var
  placeholders (e.g. `${X_OSANO_API_KEY}`), not inline.
- **Auth badges** on each endpoint indicate which header(s) it uses, or
  "Public · no auth" for unauthenticated routes.
- **State persists per-API** — base URL, keys, and the last endpoint you
  viewed are remembered separately for each API.

## Sharing with a teammate

The simplest path is the single-file bundle. Send them `osano-api-tester.js`
(94 KB). They run:

```bash
node osano-api-tester.js
```

No folder, no dependencies, no build step. If they don't have Node, tell them
to install it from https://nodejs.org (LTS version is fine).

## Rebuilding the bundle

After editing anything in `public/` or `server.js`, rebuild the single-file
bundle with:

```bash
node build-bundle.js
```

This writes a fresh `osano-api-tester.js` that has all four assets inlined
(base64) and patches `server.js` to serve them from memory.

## Project layout

```
osano_api_tester/
├── osano_api_test.sh          # Original Customer API Bash tester
├── osano_uc_core_test.sh      # Original Unified Consent Bash tester
├── server.js                  # Node proxy + static file server
├── build-bundle.js            # Produces the single-file bundle
├── osano-api-tester.js        # Self-contained bundle (generated)
├── README.md
└── public/
    ├── index.html             # App shell
    ├── styles.css             # Osano-branded styles
    ├── app.js                 # Client logic (tabs, forms, requests)
    └── endpoints.js           # Endpoint catalog for both APIs
```

## Troubleshooting

### `EADDRINUSE: address already in use :::4173`

Something is already bound to port 4173 — often a previous run that didn't
shut down, or a preview pane from an IDE/editor.

Either free the port:

```bash
lsof -ti:4173 | xargs kill
```

Or run on a different port:

```bash
PORT=5000 node osano-api-tester.js
```

### `command not found: node`

Install Node from https://nodejs.org (any LTS release, 14 or later).

### A request just returns 401 / 403

Check the key you pasted matches the API. UC endpoints marked `Uses
x-osano-api-key` need the admin key, not the UC key. For Customer API, make
sure the key was generated for the right organization.

### The UI looks unstyled

Make sure you opened `http://localhost:4173` (served by Node), not the HTML
file directly via `file://…`. The stylesheet and JS are only resolved when
served over HTTP.

### I pasted a key but the page still says "required"

Keys are stored per-API. Switching tabs changes which key is active. The input
lives in the sidebar — confirm the key is actually saved there for the API
you're testing (it should repopulate after a refresh).

## Security note

This tool is designed to run on your own workstation. Keys live only in your
browser's `localStorage` for that origin and are sent to the local Node server,
which forwards them as headers to Osano. Don't deploy this to a shared server
or the public internet — it has no auth of its own and would expose whoever
hits it to whatever key is configured.
