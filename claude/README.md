# Claude Code: what is what

Where each part of my Claude Code setup lives and how it gets onto a new machine.
Taken from the old Linux PC (WSL) on 2026-11-11.

Claude Code keeps its files in three places:

- `~/.claude/settings.json`: settings, permission rules, hooks, status line, plugins. Partly in
  this repo, partly in the private homelab repo.
- `~/.claude/` (the rest): hooks, skills, memory, history, login. Some is in a repo, some is
  copied by hand, and the rest stays behind.
- `~/.claude.json`: Claude Code's own state file. Not kept anywhere (see below).

## In this repo (public)

| File | Installed as | What it does |
|---|---|---|
| `claude/settings.json` | merged into `~/.claude/settings.json` | Theme, model and effort, no attribution, no auto-compaction, workflows on, the status line, the two plugins from the official marketplace (superpowers, claude-security) |
| `claude/statusline-command.sh` | `~/.claude/statusline-command.sh` | Status line in the terminal: folder, model, context used, 5-hour and 7-day usage. Needs `jq` (in the Brewfile) |
| `claude/skills/talk-less/` | `~/.claude/skills/talk-less/` | The `/talk-less` skill: short answers in simple technical English |
| `claude/context-band/` | a Claude desktop app mod | Context meter and the Spotify track in a band. Added from the Mac on 2026-11-10 |
| `claude/install.py` | (run it) | Installs the first three rows. Merges the settings instead of replacing the file |
| `git/ignore` | `~/.config/git/ignore` | Keeps every `.claude/settings.local.json` and `.claude/.cc-writes/` out of git |

Install: `python3 claude/install.py` (step 7 in the main README). Run it again after you change a
file here. After you change something in `~/.claude`, copy it back here by hand.

## In the private homelab repo

The homelab half of the setup lives in `homelab-ops`, folder `guardrails/`: the hooks, the
permission rules, the homelab MCP servers and the wrapper scripts Claude runs. It is private on
purpose. These files show exactly what the safety net blocks and what it lets through, and
Claude reads text that strangers can write (logs). Setup steps: `guardrails/README.md`, section
"New machine". Run it after `claude/install.py`. The order doesn't matter because both scripts
merge, but this way the general settings are in place first.

## Not in any repo: copy by hand from the old machine

- **Claude's memory**: `~/.claude/projects/<folder>/memory/`. The folder name is the project
  path with `/` turned into `-`, so on a Mac `-home-<user>-git-x` becomes `-Users-<user>-git-x`.
  Rename the folder when you copy it. 8 projects had memory on 2026-11-11.
- **Plan ledgers**: `.superpowers/` folders inside repos that git does not track.
- **`~/.ssh/config` and `~/.ssh/known_hosts`**. Not the keys: see below.

## Never copy: make new on the new machine

- `~/.claude/.credentials.json`: run `claude` and log in.
- `~/.claude.json`: Claude Code's state file. It holds the account (name, email, IDs), a machine
  ID, every project folder opened, usage counters, and the MCP servers with their tokens in
  plain text. Claude rewrites it all the time, so a copy would not stay in sync anyway.
  Hooks and permissions are **not** in it; they are in `settings.json`. Its one useful part, the
  MCP server list, is rebuilt with `claude mcp add` (for the homelab: a script in `guardrails/`).
- Tokens and SSH keys: make new ones, and revoke the old ones when the old machine is gone.

## Leave behind

`history.jsonl`, `file-history/`, `sessions/`, `session-env/`, `shell-snapshots/`, `cache/`,
`paste-cache/`, `uploads/`, `backups/`, `plugins/` (reinstalled from `enabledPlugins`),
`skills/synced/` (synced from claude.ai), the `*.bak-*` files, and the session transcripts
(`*.jsonl` in `~/.claude/projects/`) unless you want to resume old sessions. On the old PC
also `~/.local/bin/win-chrome` (WSL only).
