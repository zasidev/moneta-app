# Git Committer Skill (Conventional Commits)

## Purpose
Stage and commit changes following the Conventional Commits specification, without pushing.

## Commit type prefixes
Use one of: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`, `ci`, `build`, `revert`.

Format: `<type>(<optional-scope>): <description>`

## Behavior
When invoked, you must:
1. Inspect the working tree: run `git status` and `git diff --stat` to see what changed.
2. Stage only the intended files (never secrets, never `.env`, never build artifacts unless the user explicitly asks).
3. Ask the user (or use the provided scope/description) for the commit type and a concise description in imperative mood.
4. Compose the commit message: `<type>(<scope>): <description>`. Add an optional body if the change needs explanation.
5. Run `git commit -m "..."` with the composed message.
6. Report the commit hash and the full commit message.
7. Do NOT push unless the user explicitly requests it.

## Rules
- Never commit secrets, keys, or `.env` files.
- Never force-push or rewrite published history (this project is connected to Lovable; force pushing rewrites history on Lovable's side and the user will lose project history).
- Keep the description short and imperative (e.g. "add user avatar to top bar", not "added" or "adds").
- If `git status` shows nothing to commit, report that and make no changes.

## Example
User: "commit the top bar navbar fix"
Agent:
- `git status` shows modified `src/styles.css`
- scope: `ui`, type: `fix`, description: `make topbar sticky on scroll`
- `git commit -m "fix(ui): make topbar sticky on scroll"`
- Report: committed `<hash>` — `fix(ui): make topbar sticky on scroll`

## Output
Return the commit hash and the full commit message, or "nothing to commit".
