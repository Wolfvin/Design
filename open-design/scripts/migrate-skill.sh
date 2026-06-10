#!/usr/bin/env bash
# migrate-skill.sh — Migrate an Open Design skill from <artifact> to <file-edit> output format.
#
# Usage:
#   ./scripts/migrate-skill.sh skills/my-skill/SKILL.md
#   ./scripts/migrate-skill.sh design-templates/web-prototype/SKILL.md
#
# What it does:
#   1. Reads the SKILL.md file
#   2. Adds `outputFormat: file-edit` to the od: frontmatter block (if not present)
#   3. Replaces `<artifact` with `<file-edit` in the body (simple text substitution)
#   4. Replaces `</artifact>` with `</file-edit>` in the body
#   5. Adds the migration comment at the top of the body (if not present)
#   6. Creates a backup (.bak) of the original file
#
# Requirements: bash 4+, sed, grep

set -euo pipefail

# ── Colors ────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ── Args ──────────────────────────────────────────────────────────────────
if [[ $# -lt 1 ]]; then
  echo -e "${RED}Usage: $0 <path-to-SKILL.md>${NC}"
  echo ""
  echo "Migrate an Open Design skill from <artifact> to <file-edit> output format."
  echo ""
  echo "Options:"
  echo "  --dry-run    Show what would change without modifying the file"
  echo "  --no-backup  Skip creating .bak backup file"
  exit 1
fi

SKILL_FILE="$1"
DRY_RUN=false
NO_BACKUP=false

for arg in "$@"; do
  case "$arg" in
    --dry-run)   DRY_RUN=true ;;
    --no-backup) NO_BACKUP=true ;;
  esac
done

# ── Validate ──────────────────────────────────────────────────────────────
if [[ ! -f "$SKILL_FILE" ]]; then
  echo -e "${RED}Error: File not found: $SKILL_FILE${NC}"
  exit 1
fi

if [[ "$(basename "$SKILL_FILE")" != "SKILL.md" ]]; then
  echo -e "${YELLOW}Warning: File is not named SKILL.md: $SKILL_FILE${NC}"
fi

# ── Read ──────────────────────────────────────────────────────────────────
CONTENT=$(cat "$SKILL_FILE")

# ── Check if already migrated ─────────────────────────────────────────────
if echo "$CONTENT" | grep -q "outputFormat: file-edit"; then
  echo -e "${CYAN}Already migrated (outputFormat: file-edit found): $SKILL_FILE${NC}"
  
  # Still check for <artifact> references that weren't converted
  if echo "$CONTENT" | grep -q "<artifact"; then
    echo -e "${YELLOW}  Warning: Found remaining <artifact> references in body${NC}"
    echo -e "${YELLOW}  Run with --force to update body references${NC}"
  fi
  
  if [[ "${FORCE:-}" != "true" ]]; then
    exit 0
  fi
fi

# ── Step 1: Add outputFormat to frontmatter ───────────────────────────────
# Find the od: block and add outputFormat: file-edit if not present

if ! echo "$CONTENT" | grep -q "outputFormat:"; then
  # Try to insert outputFormat after the last od: key that starts with a letter
  # We look for lines that are "  key:" under the od: block and insert after the last one
  
  # Strategy: find the od: block and add outputFormat after the first od: key
  # Use awk for more reliable multi-line processing
  
  if [[ "$DRY_RUN" == true ]]; then
    echo -e "${CYAN}[DRY RUN] Would add 'outputFormat: file-edit' to od: frontmatter${NC}"
  else
    # Use awk to insert outputFormat: file-edit right after the "od:" line
    # if the od: block exists
    CONTENT=$(echo "$CONTENT" | awk '
      /^od:/ {
        print
        # Check if next line is indented (part of od: block)
        getline
        if (/^  [a-z]/) {
          # Insert outputFormat before this first key
          print "  outputFormat: file-edit"
          print
        } else {
          # od: block is empty or unusual, still insert
          print "  outputFormat: file-edit"
          print
        }
        next
      }
      { print }
    ')
    echo -e "${GREEN}Added outputFormat: file-edit to od: frontmatter${NC}"
  fi
else
  echo -e "${CYAN}outputFormat already present in frontmatter${NC}"
fi

# ── Step 2: Replace <artifact with <file-edit in body ─────────────────────
ARTIFACT_COUNT=$(echo "$CONTENT" | grep -c "<artifact" || true)
if [[ "$ARTIFACT_COUNT" -gt 0 ]]; then
  if [[ "$DRY_RUN" == true ]]; then
    echo -e "${CYAN}[DRY RUN] Would replace <artifact with <file-edit ($ARTIFACT_COUNT occurrences)${NC}"
  else
    CONTENT=$(echo "$CONTENT" | sed 's/<artifact/<file-edit/g')
    echo -e "${GREEN}Replaced <artifact with <file-edit ($ARTIFACT_COUNT occurrences)${NC}"
  fi
else
  echo -e "${CYAN}No <artifact references found in body${NC}"
fi

# ── Step 3: Replace </artifact> with </file-edit> in body ─────────────────
CLOSE_COUNT=$(echo "$CONTENT" | grep -c "</artifact>" || true)
if [[ "$CLOSE_COUNT" -gt 0 ]]; then
  if [[ "$DRY_RUN" == true ]]; then
    echo -e "${CYAN}[DRY RUN] Would replace </artifact> with </file-edit> ($CLOSE_COUNT occurrences)${NC}"
  else
    CONTENT=$(echo "$CONTENT" | sed 's|</artifact>|</file-edit>|g')
    echo -e "${GREEN}Replaced </artifact> with </file-edit> ($CLOSE_COUNT occurrences)${NC}"
  fi
else
  echo -e "${CYAN}No </artifact> references found in body${NC}"
fi

# ── Step 4: Add migration comment ─────────────────────────────────────────
MIGRATION_COMMENT="<!-- MIGRATED: output changed from <artifact> to <file-edit> -->"

if echo "$CONTENT" | grep -qF "$MIGRATION_COMMENT"; then
  echo -e "${CYAN}Migration comment already present${NC}"
else
  if [[ "$DRY_RUN" == true ]]; then
    echo -e "${CYAN}[DRY RUN] Would add migration comment after frontmatter${NC}"
  else
    # Insert the migration comment right after the closing --- of the frontmatter
    CONTENT=$(echo "$CONTENT" | awk -v comment="$MIGRATION_COMMENT" '
      BEGIN { found_second_dash = 0; dash_count = 0 }
      /^---$/ {
        dash_count++
        print
        if (dash_count == 2) {
          print ""
          print comment
          found_second_dash = 1
        }
        next
      }
      { print }
    ')
    echo -e "${GREEN}Added migration comment after frontmatter${NC}"
  fi
fi

# ── Write ─────────────────────────────────────────────────────────────────
if [[ "$DRY_RUN" == true ]]; then
  echo ""
  echo -e "${CYAN}=== DRY RUN — no changes written ===${NC}"
  echo ""
  echo "Preview of changes:"
  echo "$CONTENT" | head -30
  echo "..."
else
  # Create backup
  if [[ "$NO_BACKUP" != true ]]; then
    cp "$SKILL_FILE" "${SKILL_FILE}.bak"
    echo -e "${GREEN}Backup created: ${SKILL_FILE}.bak${NC}"
  fi
  
  # Write the modified content
  echo "$CONTENT" > "$SKILL_FILE"
  echo -e "${GREEN}Written: $SKILL_FILE${NC}"
fi

echo ""
echo -e "${GREEN}Migration complete for: $SKILL_FILE${NC}"
