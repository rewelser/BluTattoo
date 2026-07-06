# BluTattoo Deployment Guide

## Branches

main
- Production
- Deploys to https://blutattoostudio.com

stage
- Staging
- Deploys to https://staging.blutattoostudio.com

feature/*
- Optional feature branches
- Merge into stage

---

## Development

Run locally:

```bash
npm run dev
```

---

## Before releasing

```bash
npm run release-check
```

---

## Release Procedure

1. Finish work on `stage`.
2. Verify staging site.
3. Run:

```bash
npm run release-check
```

4. Merge:

```bash
git checkout main
git pull
git merge stage
```

5. Push:

```bash
git push origin main
```

6. Verify production deployment.

---

## Rollback

If a deployment fails:
- Vercel keeps the previous deployment active.

If a bad deployment succeeds:
- Revert the offending commit or redeploy a previous good commit.

---

## Release Notes

Record every production release in:

docs/releases.md