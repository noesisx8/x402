# New GitHub + Vercel setup (x402 vending machine)

Use this when switching accounts. **Do not commit tokens or CDP secrets.**

## Current machine state

- Vercel CLI user: run `npx vercel whoami`
- Vending app linked: `apps/vending-machine/.vercel/` → project under scope **x-vendor** / **vending-machine**
- Repo: `/home/willd/Projects/x402` — monorepo; Vercel **Root Directory** must stay `apps/vending-machine`

---

## 1. New GitHub account

### A. SSH (recommended — you already have a key)

```bash
cat ~/.ssh/id_ed25519.pub
```

1. New GitHub → **Settings → SSH and GPG keys → New SSH key**
2. Paste the public key, save.

```bash
ssh -T git@github.com
# expect: Hi <new-username>! ...
```

### B. Git identity (use your **new** GitHub name/email)

```bash
git config --global user.name "Your Name"
git config --global user.email "you@email.com"
```

### C. Create empty repo on GitHub

Web: **New repository** → name e.g. `x402` (private recommended) → **no** README/license (we push existing code).

### D. Push monorepo

```bash
cd /home/willd/Projects/x402
git remote add origin git@github.com:NEW_USERNAME/x402.git   # or your repo name
git push -u origin master
```

Optional: install `gh` and `gh auth login` for PRs/issues later (`sudo apt install gh` on Debian).

---

## 2. Vercel (new account)

### CLI login

```bash
npx vercel logout    # if wrong account
npx vercel login     # browser → new account
cd apps/vending-machine
npx vercel link --yes
```

### Connect GitHub in dashboard (auto-deploy on push)

1. https://vercel.com → **vending-machine** (or your project)
2. **Settings → Git** → Connect **new** GitHub account
3. Import repo `NEW_USERNAME/x402`
4. **Root Directory** = `apps/vending-machine`
5. Framework: Next.js (matches `vercel.json`)

### Production environment variables

Set in **Project → Settings → Environment Variables** (Production):

| Name | Value |
|------|--------|
| `X402_PAY_TO_ADDRESS` | `0xc648116b5deBE4AF7D78838AA468d07e0A9Ab697` |
| `X402_NETWORK_MODE` | `base` |
| `X402_FACILITATOR_URL` | `https://api.cdp.coinbase.com/platform/v2/x402` |
| `PUBLIC_BASE_URL` | `https://<your-project>.vercel.app` (after first deploy) |
| `CDP_API_KEY_ID` | from portal.cdp.coinbase.com |
| `CDP_API_KEY_SECRET` | from portal.cdp.coinbase.com |

CLI alternative (from `apps/vending-machine`):

```bash
printf '%s' '0xc648...' | npx vercel env add X402_PAY_TO_ADDRESS production
printf '%s' 'base' | npx vercel env add X402_NETWORK_MODE production
printf '%s' 'https://api.cdp.coinbase.com/platform/v2/x402' | npx vercel env add X402_FACILITATOR_URL production
```

Redeploy after adding `PUBLIC_BASE_URL` and CDP keys.

### Deploy

```bash
cd apps/vending-machine
npx vercel --prod --yes
```

Smoke: `curl -sI "https://YOUR_APP.vercel.app/api/v/qr-code?data=test" | head -1` → **402**

---

## 3. CDP (Coinbase Developer Platform)

Same **new** email/org as you prefer:

1. https://portal.cdp.coinbase.com → API keys for **seller** verify/settle
2. Keys only in Vercel env — never in git

---

## 4. Checklist

- [ ] SSH key on **new** GitHub
- [ ] `git config` name/email updated
- [ ] Repo created + `git push`
- [ ] Vercel logged into **new** account
- [ ] Vercel Git linked, root = `apps/vending-machine`
- [ ] Env vars set (payTo, network, facilitator, CDP keys, PUBLIC_BASE_URL)
- [ ] Production deploy + 402 smoke test