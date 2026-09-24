# v1.0.4 Maintenance Update

## Downloads

- Most players: extract the portable ZIP and run WarThunderResearchCalculator.exe.
- The source ZIP requires current Node.js 24 LTS and npm install.
- SHA256SUMS.txt lists SHA-256 hashes of both downloads.

## Changes

- The desktop server binds to loopback by default. Requests from unrelated
  websites or unexpected hostnames are rejected.
- The local update button obtains a per-process authorization token without
  storing it in browser storage. Hosted updates are disabled unless explicitly
  enabled and authenticated by an administrator.
- Update concurrency is restricted to 1-8. Overlapping updates and repeated
  requests are blocked, update work is bounded to five minutes, and successful
  updates replace files atomically. Failed or empty updates keep existing data.
- API errors no longer expose stack traces or local paths.
- Updated dependencies, Node.js 24 LTS packaging and .NET 10 launcher target.
- Added security and calculation regression checks plus pre-publication scans
  for personal paths, email addresses and common credential patterns.
- Removed a local user-directory path from public instructions.

Research algorithms, rank unlock requirements, vehicle costs, modification data,
and the tech-tree layout have not been changed by this security update.

## Privacy Boundaries

This is a public-source project. ZIP packaging is not source encryption, and
browser code is necessarily delivered to visitors. Plans remain in browser
storage; image requests still reach the War Thunder image host. No claim of
complete anonymity or zero undiscovered vulnerabilities is made. Old copies or
GitHub cached objects cannot be revoked by updating a release.

Web calculator: https://plastic-time.github.io/warthunder-research-calculator/
