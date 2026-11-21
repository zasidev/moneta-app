# Roadmap Task Skill

## Purpose
Mark tasks as completed in the project roadmap file.

## Roadmap file
`/Users/simone.zanetti/Documents/Personali/projects/expenses-tracker-hub/roadmap.md`

## Behavior
When invoked, you receive a task identifier, which is either:
- a task number (e.g. `07`, `13`, `22`), or
- a substring of the task description.

You must:
1. Read the roadmap file.
2. Find the line matching the identifier. Task numbers appear as two-digit prefixes (e.g. `- [ ] 07 — ...`). Match by number first; if not found, match by description substring (case-insensitive).
3. If the task is already marked `- [x]`, report that it is already completed and make no changes.
4. Otherwise, replace `- [ ]` with `- [x]` on that exact line only.
5. Write the file back.
6. Re-read the file to confirm the change was applied correctly.
7. Report which task was marked completed, including its number and full description.

## Rules
- Only modify the single matching line. Do not touch other lines.
- Do not change formatting, indentation, or section headers.
- Do not mark a task completed if it is already `- [x]`.
- If no line matches the identifier, report that no matching task was found and make no changes.

## Example
User: "Mark task 08 as done"
Agent: finds line `- [ ] 08 — Implement income and expense analytics` under Phase 2, changes to `- [x] 08 — Implement income and expense analytics`, writes file, confirms.

## Output
Return a short confirmation: which task number and description were marked `[x]`, or "already completed" / "not found".

## Automation
After you finish implementing a task that corresponds to a roadmap item, invoke this skill to mark the roadmap item complete before reporting the final result to the user.
