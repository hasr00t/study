# Web viewer

The Next.js 16 app that renders study guides. It reads every `*.json` in
`public/guides/` and serves a reading view with a graded quiz.

See the [repo README](../README.md) for the full pipeline and setup. Quick start:

```bash
npm install          # from the repo root (workspace install)
cd web && npm run dev     # http://localhost:3000
cd web && npm run build   # static export to web/out/
```

- **Tailwind v4** — tokens live in an `@theme inline` block in `app/globals.css`;
  there is no `tailwind.config.js`.
- **Static export** (`output: 'export'` in `next.config.ts`) — no server or
  secrets; serve `web/out/` from any static host.
- Reading progress and quiz results are stored per-reader in the browser.
