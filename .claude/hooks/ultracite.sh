#!/usr/bin/env bash
# PostToolUse hook for Write|Edit: Ultracite — Oxlint with the anti-slop plugin,
# and Oxfmt — on the one file just written, then a typecheck.
#
# Exit 0: clean. Exit 2: the problems left over go to stderr, which Claude Code
# hands back to Claude to fix. The auto-fixer can change types (it once turned a
# typed array into a Set), so a clean lint alone is not taken as clean.
set -uo pipefail
cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}" || exit 0

file=$(jq -r '.tool_response.filePath // .tool_input.file_path // empty')
[ -n "$file" ] && [ -f "$file" ] || exit 0

# Only what Ultracite handles, only inside this project, never dependencies or
# build output (.next for Next.js, dist and dist-server for Vite and Node).
case "$file" in
  *.ts | *.tsx | *.js | *.jsx | *.mjs | *.cjs | *.json | *.jsonc | *.css | *.md) ;;
  *) exit 0 ;;
esac
case "$(realpath "$file")" in
  "$PWD"/node_modules/* | "$PWD"/.next/* | "$PWD"/dist/* | "$PWD"/dist-server/*) exit 0 ;;
  "$PWD"/*) ;;
  *) exit 0 ;;
esac

npx --no-install ultracite fix "$file" > /dev/null 2>&1

# Oxlint only lints script files; CSS, JSON and Markdown are formatted above and
# that is all. Failure is judged by reported errors, not the exit code: check
# exits non-zero with "No files found to lint" for a file type it skips.
lint=""
count=0
case "$file" in
  *.ts | *.tsx | *.js | *.jsx | *.mjs | *.cjs)
    lint=$(npx --no-install ultracite check "$file" 2>&1)
    count=$(printf '%s\n' "$lint" | grep -c ': error ' || true)
    ;;
esac

types=""
case "$file" in
  *.ts | *.tsx) types=$(npx --no-install tsc --noEmit 2>&1) || true ;;
esac

[ "$count" -eq 0 ] && [ -z "$types" ] && exit 0

{
  if [ "$count" -gt 0 ]; then
    echo "Ultracite: $count problem(s) in $file it could not fix itself."
    printf '%s\n' "$lint" | grep ': error ' | head -n 40
    [ "$count" -gt 40 ] && echo "… and $((count - 40)) more. Run: npx ultracite check $file"
  fi
  if [ -n "$types" ]; then
    echo "Typecheck fails after this edit:"
    printf '%s\n' "$types" | head -n 20
  fi
} >&2
exit 2
