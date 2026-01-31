#!/bin/bash
# UserPromptSubmit hook for skill-aware responses

cat <<'EOF'
REQUIRED: SKILL LOADING PROTOCOL

Before writing any code, complete these steps in order:

1. SCAN each skill below and decide: LOAD or SKIP (with brief reason)
   - nextjs
   - react
   - typescript
   - tailwind
   - supabase
   - tanstack-query
   - react-hook-form
   - zod
   - exceljs
   - frontend-design
   - node

2. For every skill marked LOAD → immediately invoke Skill(name)
   If none need loading → write "Proceeding without skills"

3. Only after step 2 completes may you begin coding.

IMPORTANT: Skipping step 2 invalidates step 1. Always call Skill() for relevant items.

Sample output:
- nextjs: LOAD - building components
- react: SKIP - not needed for this task
- typescript: LOAD - building components
- tailwind: SKIP - not needed for this task

Then call:
> Skill(nextjs)
> Skill(typescript)

Now implementation can begin.
EOF
