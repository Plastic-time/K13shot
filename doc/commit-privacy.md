# Commit Email Privacy

This repository uses GitHub noreply addresses in commit metadata. Historical
development commits were replaced with independent snapshots to remove personal
email addresses from branch and tag histories. Release snapshot files are preserved.

## Set Up Each New Clone

Run from the repository root:

```sh
git config --local user.name Plastic-time
git config --local user.email 247457381+Plastic-time@users.noreply.github.com
git config --local user.useConfigOnly true
git config --local core.hooksPath .githooks
node tools/check-commit-privacy.cjs --identity
node tools/check-commit-privacy.cjs --all
```

The pre-commit hook checks both author and committer identities. The pre-push hook
checks every reachable commit in the history being pushed, including old commits.
Hooks require Node.js and are not enabled automatically by cloning. Do not bypass
them with `--no-verify`. The Actions check is a secondary alert after a push, not
a server-side guarantee that an email can never become public.

## GitHub Account Settings

At https://github.com/settings/emails, enable both:

- Keep my email addresses private.
- Block command line pushes that expose my email.

Verify the noreply address shown by GitHub. These settings must be managed by the
account owner; repository configuration cannot enable them. Avoid API commit
tools that silently select the account's real email address.

## Old Copies And Cached Commits

Do not merge history from old clones. Re-clone and transfer only needed file
changes. Rewriting branches and tags does not erase third-party downloads or
GitHub's cached objects accessible through old commit hashes. Contact GitHub
Support for a privacy-removal assessment if those cached objects must be removed;
acceptance and deletion are controlled by GitHub.
