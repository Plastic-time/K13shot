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

## Game Data Authority

- For future data updates, use version-pinned game configuration as the primary
  authority for vehicle and modification RP, Silver Lions, tiers, unlock counts,
  prerequisites, and modification membership. Record the game version and source
  revision; do not treat a partial correction as a full snapshot upgrade.
- Wiki is supplementary for names, images, and layout. Do not let Wiki costs,
  prerequisite edges, or obsolete modification entries override game data.
- Missing or conflicting game fields require review. Do not silently fill them
  from Wiki, interpret missing costs as zero, or expose internal-only prices as
  player purchase costs without verifying availability and currency semantics.
- Preserve explicitly user-confirmed in-game corrections with their provenance.
  If a later game configuration conflicts with one, report the difference before
  replacing it; keep the existing Ka-29, Do 217 J-2, and CA-27 corrections until
  reviewed against newer evidence.
- This policy governs future update work. Existing importers still need an
  explicit implementation and regression pass before claiming game-only sourcing.
- Do not alter UI or planning algorithms as a side effect of changing data
  sources. Review price and dependency diffs before publishing a refreshed snapshot.
