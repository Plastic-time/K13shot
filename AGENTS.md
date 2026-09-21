## Local Skill: guizang-ppt-skill

When the user asks for a web PPT, horizontal swipe deck, magazine-style PPT,
Swiss Style deck, or explicitly mentions guizang-ppt-skill, read and follow
the `guizang-ppt-skill/SKILL.md` file under the user's local Codex skills directory.

## Commit Privacy

- Never publish personal author or committer email addresses.
- For this repository, use `Plastic-time` and
  `247457381+Plastic-time@users.noreply.github.com` for both Git identities.
- Enable the repository hooks with `git config --local core.hooksPath .githooks`.
- Run `node tools/check-commit-privacy.cjs --identity` before committing and
  `node tools/check-commit-privacy.cjs --all` before publishing.
- Do not use connector commit/file-write tools that cannot set or guarantee
  both privacy-safe Git identities. Use authenticated Git with explicit identities.
- Never merge or force-push history from a clone predating the privacy cleanup.
  Re-clone or transfer reviewed file changes without importing old commits.
- Do not print discovered personal emails or credentials in logs or responses.
- GitHub account email privacy settings are separate from repository settings.
  Never claim those account settings were changed without verifying them.
