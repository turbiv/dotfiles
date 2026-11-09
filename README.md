# dotfiles

My terminal setup: iTerm2, the Starship prompt and a Spotify panel for the iTerm2 Toolbelt.

| Path | What it is |
|---|---|
| `Brewfile` | Starship, iTerm2 and the JetBrains Mono Nerd Font |
| `starship/starship.toml` | Prompt config |
| `zsh/zshrc` | The line that turns on Starship |
| `iterm2/com.googlecode.iterm2.plist` | iTerm2 settings: profile, colors, font, Toolbelt |
| `iterm2/spotify-toolbelt/` | Spotify now-playing panel (see its own README) |

## Set up a new Mac

1. Install [Homebrew](https://brew.sh), then run this from the repo folder:
   ```sh
   brew bundle
   ```
2. Starship:
   ```sh
   mkdir -p ~/.config
   cp starship/starship.toml ~/.config/starship.toml
   cat zsh/zshrc >> ~/.zshrc
   ```
3. iTerm2 settings. Quit iTerm2 first (run this from Terminal.app), because iTerm2 overwrites the settings when it quits:
   ```sh
   defaults import com.googlecode.iterm2 iterm2/com.googlecode.iterm2.plist
   ```
4. Spotify panel:
   ```sh
   mkdir -p ~/Library/Application\ Support/iTerm2/Scripts/AutoLaunch
   cp iterm2/spotify-toolbelt/spotify_toolbelt.py ~/Library/Application\ Support/iTerm2/Scripts/AutoLaunch/
   ```
   Then follow steps 3–5 in `iterm2/spotify-toolbelt/README.md`.
5. Open iTerm2.

## Update the iTerm2 settings in this repo

```sh
defaults export com.googlecode.iterm2 iterm2/com.googlecode.iterm2.plist
plutil -convert xml1 iterm2/com.googlecode.iterm2.plist
```
