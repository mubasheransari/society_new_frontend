# Deploying the frontend to Vercel with CI/CD

## What changed in this repo (read this first)

1. **Upgraded `next` from `16.0.8` → `16.2.12`.** `16.0.8` has a publicly
   disclosed, critical (CVSS 10.0) remote-code-execution vulnerability in
   React Server Components affecting App Router apps ("React2Shell",
   CVE-2025-55183 / CVE-2025-55184). There is no workaround — upgrading is
   required. Verified: `npm run build` still succeeds with no code changes
   needed.
2. Added `.github/workflows/ci-cd.yml` for CI/CD (see below).

**Heads up on lint**: this repo currently has ~80 pre-existing ESLint
errors (mostly `@typescript-eslint/no-explicit-any` and a couple of
`react-hooks` rule violations, e.g. in `sub-admins/page.tsx` and
`upload/page.tsx`). I didn't touch app logic, so I left these as-is rather
than risk changing behavior. The CI workflow runs lint so you can see
these in the log, but only **build** (TypeScript compile + `next build`)
is a hard gate for now — otherwise your very first CI run would fail and
block every deploy. Worth cleaning these up when you get a chance, then
flip `continue-on-error: true` off for the lint step.

## 1. Create the Vercel project (frontend)

1. In Vercel: **Add New → Project → Import** this GitHub repo.
2. Framework preset: **Next.js** (auto-detected).
3. Environment variable (Project Settings → Environment Variables):
   - `NEXT_PUBLIC_API_BASE_URL` = your deployed backend's URL
     (e.g. `https://your-backend.vercel.app`) — set for **Production**,
     and also for **Preview** if you want PR previews to hit a real API
     (point it at the backend's preview URL, or just reuse production).
4. **Turn off Vercel's automatic Git deployments** for this project
   (Project Settings → Git → disconnect). GitHub Actions deploys instead,
   so you don't get duplicate/competing deployments.

## 2. GitHub Actions secrets (frontend repo)

In the GitHub repo → Settings → Secrets and variables → Actions, add:

| Secret | Where to get it |
|---|---|
| `VERCEL_TOKEN` | Vercel → Account Settings → Tokens → Create |
| `VERCEL_ORG_ID` | Run `vercel link` locally once in this folder |
| `VERCEL_PROJECT_ID` | Same as above |
| `NEXT_PUBLIC_API_BASE_URL` | Your backend's deployed URL (used at build time) |

The workflow already does the rest:
- **Every PR**: installs deps, lints (non-blocking), builds (hard gate),
  then deploys a **preview** to Vercel if the build passes.
- **Every push to `main`**: same gate, then deploys to **production**.

## 3. Local smoke test before pushing

```bash
npm ci
npm run build
npm run lint   # informational for now, see note above
```
