# Release Log

Human-readable notes for production releases.

## 2026-07-06

### Added
- Created `stage` branch for staging work.
- Added staging deployment at `staging.blutattoostudio.com`.
- Added `npm run release-check` as a local pre-release build check.

### Changed
- Established release flow: `stage` → `main` → production.

### Notes
- TypeScript checking is intentionally not part of `release-check` yet.