# Server Security

The default host is 127.0.0.1. The normal desktop update button uses a temporary
per-process token. Tokens are not written to files or browser localStorage.
Do not disable the request-host or origin checks.

For explicit hosted deployment, set WT_HOST=0.0.0.0 and WT_PUBLIC_ORIGIN to the
canonical external origin (scheme and host, no trailing slash). Render's
RENDER_EXTERNAL_URL can supply the origin instead. Set NODE_ENV=production.
Bind only behind a trusted HTTPS reverse proxy and network access controls.

Hosted updates are disabled by default. Administrators can set WT_ENABLE_UPDATES=1
and provide a random WT_ADMIN_TOKEN of at least 32 bytes through private host
environment settings. Send it in the X-WT-Update-Token header when calling the
JSON update API. The hosted browser cannot retrieve this token; its ordinary
update button is intentionally unavailable. Never put the token in source,
URLs, screenshots, release notes, logs, or a static frontend.

Concurrency is 1-8 (default 5), one HTTP update at a time with a 60-second
cooldown and a five-minute task deadline. Wiki proxy endpoints allow at most two
simultaneous requests and 20 requests per minute per server process. These
limits are process-local, not a distributed rate limiter.

Saved plans and modification selections remain in local browser storage.
Clear this site's browser data after using a shared computer. Third-party
vehicle images still require network requests. The app sends no-referrer from
its local server; the static site's matching meta policy covers Pages.

Git hooks and CI inspect common secrets, personal directories and email
addresses before publication. They supplement, not replace, GitHub account
email privacy settings and human review. Public-source code is not encrypted.
