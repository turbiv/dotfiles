# dotfiles

My Mac setup: Homebrew, Colima + Docker, the GitHub CLI, iTerm2, the Starship prompt and a Spotify panel for the iTerm2 Toolbelt.

| Path | What it is |
|---|---|
| `Brewfile` | iTerm2, Starship, the JetBrains Mono Nerd Font, gh, Colima, Docker and Docker Compose |
| `starship/starship.toml` | Prompt config |
| `zsh/zshrc` | The line that turns on Starship |
| `iterm2/com.googlecode.iterm2.plist` | iTerm2 settings: profile, colors, font, Toolbelt |
| `iterm2/spotify-toolbelt/` | Spotify now-playing panel (see its own README) |

The files are copied into place, not symlinked. After changing one in `~`, copy it back here.

## Set up a new Mac

1. Xcode Command Line Tools:
   ```sh
   xcode-select --install
   ```
2. [Homebrew](https://brew.sh), with `brew shellenv` in `~/.zprofile`:
   ```sh
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
   eval "$(/opt/homebrew/bin/brew shellenv)"
   ```
3. iTerm2 and the GitHub CLI, then log in (choose HTTPS and let gh authenticate Git):
   ```sh
   brew install --cask iterm2
   brew install gh
   gh auth login
   ```
4. Clone this repo and install everything else in the Brewfile:
   ```sh
   gh repo clone turbiv/dotfiles ~/dotfiles
   cd ~/dotfiles
   brew bundle
   ```
5. Docker on Colima. Link Compose as a Docker CLI plugin so `docker compose` works, then start the VM. Wait for `colima start` to finish before using `docker`, because it switches the Docker context to `colima` at the very end:
   ```sh
   mkdir -p ~/.docker/cli-plugins
   ln -sfn "$(brew --prefix)/opt/docker-compose/bin/docker-compose" ~/.docker/cli-plugins/docker-compose
   colima start --cpu 4 --memory 8 --vm-type vz --mount-type virtiofs
   docker run --rm hello-world
   docker compose version
   ```
6. Starship. The `grep` stops the `starship init` line being added twice if you re-run this:
   ```sh
   mkdir -p ~/.config
   cp starship/starship.toml ~/.config/starship.toml
   grep -qF 'starship init zsh' ~/.zshrc 2>/dev/null || cat zsh/zshrc >> ~/.zshrc
   ```
7. iTerm2 settings. Quit iTerm2 first (⌘Q), because it overwrites its settings when it quits. Run this from Terminal.app or another app.

   `defaults import` replaces **all** iTerm2 settings. If iTerm2 has been opened on this Mac (for example to set up the Claude Code integration), back up its settings and merge them instead. The repo's settings win, but iTerm2's machine-local `NoSync*`/`NS*` keys and its newer Claude Code `Workgroups` are kept:
   ```sh
   B=~/dotfiles-backup-$(date +%Y%m%d-%H%M%S); mkdir -p "$B"
   defaults export com.googlecode.iterm2 "$B/com.googlecode.iterm2.plist" 2>/dev/null
   python3 -I - "$B/com.googlecode.iterm2.plist" iterm2/com.googlecode.iterm2.plist "$B/merged.plist" <<'EOF'
   import os, plistlib, sys
   cur = plistlib.load(open(sys.argv[1], 'rb')) if os.path.exists(sys.argv[1]) else {}
   out = plistlib.load(open(sys.argv[2], 'rb'))
   out.update({k: v for k, v in cur.items() if k not in out or k in ("Workgroups", "SUFeedURL", "iTerm Version")})
   plistlib.dump(out, open(sys.argv[3], 'wb'))
   EOF
   defaults import com.googlecode.iterm2 "$B/merged.plist"
   ```
8. Spotify panel. The Python API is already turned on by the iTerm2 settings above:
   ```sh
   mkdir -p ~/Library/Application\ Support/iTerm2/Scripts/AutoLaunch
   cp iterm2/spotify-toolbelt/spotify_toolbelt.py ~/Library/Application\ Support/iTerm2/Scripts/AutoLaunch/
   ```
   Then follow steps 3–5 in `iterm2/spotify-toolbelt/README.md`.
9. Open iTerm2.

## Update the iTerm2 settings in this repo

Export, then strip the machine-local keys (install ID, window positions, `NoSync*` state) so they don't end up in the repo:

```sh
defaults export com.googlecode.iterm2 iterm2/com.googlecode.iterm2.plist
python3 -I - iterm2/com.googlecode.iterm2.plist <<'EOF'
import plistlib, sys
p = sys.argv[1]; d = plistlib.load(open(p, 'rb'))
d = {k: v for k, v in d.items() if not k.startswith(("NoSync", "NSWindow Frame", "NSSplitView", "NSToolbar"))}
plistlib.dump(d, open(p, 'wb'), fmt=plistlib.FMT_XML)
EOF
```
