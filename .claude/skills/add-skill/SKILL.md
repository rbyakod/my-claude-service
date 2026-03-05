# Skill: add-skill

## When to use
Run when the user wants to teach Claude a new capability specific to this service.
Triggers: "create a skill", "add a skill", "teach Claude how to", "new skill for".

## What a skill is

A skill is a markdown file at `.claude/skills/<name>/SKILL.md`.
It is NOT code — it is natural-language instructions that Claude follows when triggered.
Claude discovers all skills automatically; no registration is required.

## Step-by-step

### 1. Agree on a name
Use lowercase-hyphenated names that describe the action, e.g.:
- `add-auth`, `migrate-data`, `rotate-logs`, `deploy-staging`

### 2. Create the skill file
```bash
mkdir -p .claude/skills/<name>
```
Then write `.claude/skills/<name>/SKILL.md` with this structure:

```markdown
# Skill: <name>

## When to use
<One sentence describing the trigger condition>
Triggers: "<phrase 1>", "<phrase 2>"

## Steps (run commands directly — do not ask the user to run them)

### 1. <First step title>
<Instructions or bash block>

### 2. <Second step title>
...

## Verification
<How to confirm the skill completed successfully>
```

### 3. Skill writing rules
- Instructions must be self-contained — Claude has no memory between sessions
  except what is in CLAUDE.md and the skill file itself
- List every file that must be edited, with the exact change
- Include verification commands at the end
- Never assume the user will run a command — Claude runs them
- If the skill modifies CLAUDE.md, say so explicitly and describe the update

### 4. Register in CLAUDE.md
Add a bullet to the "Available skills" section:
```
- `<name>` — one-line description of what it does
```

### 5. Test it
Ask: "use the <name> skill" and confirm Claude follows the instructions correctly.
