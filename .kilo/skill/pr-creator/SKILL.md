# PR Creator Skill

## Purpose
Create a pull request / merge request for the current branch, pushing only when explicitly requested.

## Behavior
When invoked, you must:
1. Inspect git state: `git status`, `git branch --show-current`, `git log --oneline -5`, and remote tracking info.
2. Confirm there are commits to push (local branch ahead of remote, or no remote set).
3. Ask the user for the PR title and description if not provided, or compose them from the latest commit messages.
4. Ask the user which base branch to target (default: the default branch, usually `main` or `master`).
5. If the user explicitly requests pushing, run `git push -u origin <current-branch>`.
6. Open the PR using `gh pr create --title "..." --body "..." --base <base-branch> --head <current-branch>` (or equivalent GitLab/Bitbucket command).
7. Report the PR URL.
8. Do NOT push or create a PR without explicit user confirmation.

## Rules
- Never push without explicit user approval.
- Respect Lovable's rule: do not rewrite published history (no force push, no rebase/amend/squash of already-pushed commits).
- If there is no remote configured, report that and stop before pushing.
- Include a concise PR body summarizing the changes and any linked roadmap task numbers.

## Example
User: "create a PR for the top bar sticky fix"
Agent:
- current branch: `fix/topbar-sticky`, 1 commit ahead of `main`
- ask user to confirm push + PR
- `git push -u origin fix/topbar-sticky`
- `gh pr create --title "fix(ui): make topbar sticky on scroll" --body "..." --base main --head fix/topbar-sticky`
- Report: PR created at `https://github.com/.../pull/N`

## Output
Return the PR URL, or "push/PR cancelled by user" if the user declined.
