# Host roles (authoritative)

| Host | Role | What runs here |
|------|------|----------------|
| **portalv2** | Ops / deploy / paid smoke PC (Windows, Tailscale) | Git working copy, `npm run smoke:paid`, Express API if private, secrets in env, Vercel CLI, CDP-adjacent ops |
| **pikatop** | **Daily driver** (Linux) | Code edit, browse, normal desktop use. **No** production API listeners. **No** funded mainnet payer keys by default. |
| **Vercel** | Public edge | `apps/vending-machine` production |
| **Railway** (optional) | Public long-running API | `apps/api` when needed |

## Rules

1. **Production pay-per-call traffic** → Vercel (vending) and/or Railway (`apps/api`).
2. **Paid E2E with a funded private key** → **portalv2 only** (`X402_PRIVATE_KEY` in shell env, never committed).
3. **pikatop** may hold a git clone for development, but do not enable `X402_ENABLED` API units or leave hot wallets there.
4. Canonical remote: `https://github.com/noesisx8/x402.git` — sync portalv2 ↔ pikatop via git, not ad-hoc tarballs of `node_modules`.

## GitHub identity (authoritative)

| Item | Value |
|------|--------|
| **GitHub user for all project work** | **`noesisx8`** |
| Repo | `noesisx8/x402` |
| PRs / issues / awesome-x402 / forks | Use **`noesisx8`** only |

### Agent / CLI rules

- Prefer `gh` as **noesisx8** (active account). If both accounts are logged in: `gh auth switch --user noesisx8` or `GH_HOST` / `gh auth setup-git` so HTTPS git uses noesisx8.
- **Do not** push or open PRs as **`fourthdensity`** for this project (that account previously 403’d on `noesisx8/x402`).
- Commits may use the human name/email on the machine; remote auth must be **noesisx8**.

```powershell
# portalv2 — confirm before git push / gh pr
gh auth status
# Active account should be noesisx8
gh auth switch --user noesisx8   # if needed
gh auth setup-git
```

## This session

- Shell hostname **portalv2** = the machine Phase 0.2 paid smoke is meant for.
- **pikatop** = daily driver; treat it like a laptop, not a payment host.
- GitHub: **noesisx8** (signed in / preferred).
