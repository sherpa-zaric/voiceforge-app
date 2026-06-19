# FieldBrief AI Project Configuration

## GitHub Accounts

This project has two GitHub accounts configured:

| Account          | Status                | Purpose                             |
| ---------------- | --------------------- | ----------------------------------- |
| **sherpa-zaric** | Active (use this one) | Primary account for this repository |
| focusontec       | Inactive              | Secondary account                   |

**Repository:** `sherpa-zaric/voiceforge-app.git`
**Active account:** `sherpa-zaric`
**Git user:** `sherpa-zaric` (`zarichub@gmail.com`)

### Switching Accounts

```bash
# Check current account
gh auth status

# Switch to sherpa-zaric (the correct one)
gh auth switch --user sherpa-zaric

# Switch to focusontec (if needed)
gh auth switch --user focusontec
```

### Push Commands

Always ensure you're on `sherpa-zaric` before pushing:

```bash
gh auth switch --user sherpa-zaric
git push origin main
```

## Project Info

- **Domain:** fieldbrief.ai
- **Framework:** Next.js 16 with Turbopack
- **Database:** Supabase (PostgreSQL)
- **Auth:** better-auth
- **Deployment:** Vercel
- **Styling:** Tailwind CSS v4 with OKLCH color system
- **Font:** DM Sans (primary), Merriweather (serif), JetBrains Mono (mono)

## Environment Variables

Key env vars on Vercel:

- `NEXT_PUBLIC_APP_URL`: `https://fieldbrief.ai`
- `NEXT_PUBLIC_APP_NAME`: `FieldBrief AI`
- `SITE_PASSWORD`: (empty — no password protection)
