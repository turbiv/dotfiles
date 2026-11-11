#!/bin/bash
# Claude Code status line: folder name, model, context window, and usage

input=$(cat)

dir_path=$(echo "$input" | jq -r '.workspace.current_dir // .cwd // empty')
folder=$(basename "$dir_path" 2>/dev/null)
[ -z "$folder" ] && folder="~"

model=$(echo "$input" | jq -r '.model.display_name // "unknown"')

ctx_size=$(echo "$input" | jq -r '.context_window.context_window_size // empty')
remaining_pct=$(echo "$input" | jq -r '.context_window.remaining_percentage // empty')
used_pct=$(echo "$input" | jq -r '.context_window.used_percentage // empty')

# Derive used% either directly or from remaining%
if [ -z "$used_pct" ] || [ "$used_pct" = "null" ]; then
  if [ -n "$remaining_pct" ] && [ "$remaining_pct" != "null" ]; then
    used_pct=$(awk -v p="$remaining_pct" 'BEGIN { printf "%.0f", 100 - p }')
  else
    used_pct=""
  fi
fi

# Format a token count as Xk, or XM when it's an exact multiple of 1,000,000
format_size() {
  local n=$1
  if [ -z "$n" ] || [ "$n" = "null" ]; then
    echo ""
    return
  fi
  if [ "$n" -ge 1000000 ] && [ "$((n % 1000000))" -eq 0 ]; then
    echo "$((n / 1000000))M"
  else
    echo "$((n / 1000))k"
  fi
}
ctx_size_str=$(format_size "$ctx_size")

# ANSI color by percentage: green <50, yellow 50-79, red >=80
color_for_pct() {
  local p=$1
  if [ -z "$p" ]; then
    echo ""
    return
  fi
  awk -v p="$p" 'BEGIN {
    if (p >= 80) print "31";
    else if (p >= 50) print "33";
    else print "32";
  }'
}

colorize() {
  local code=$1 text=$2
  if [ -n "$code" ]; then
    printf "\033[%sm%s\033[0m" "$code" "$text"
  else
    printf "%s" "$text"
  fi
}

DIM="\033[2m"
RESET="\033[0m"
SEP="${DIM} | ${RESET}"

folder_str=$(colorize "36;1" "$folder")
model_str=$(colorize "35" "$model")

used_tokens=$(echo "$input" | jq -r '.context_window.total_input_tokens // empty')
if [ -z "$used_tokens" ] && [ -n "$used_pct" ] && [ -n "$ctx_size" ] && [ "$ctx_size" != "null" ]; then
  used_tokens=$(awk -v p="$used_pct" -v s="$ctx_size" 'BEGIN { printf "%.0f", p * s / 100 }')
fi

# Compact token count: 850, 45.2k, 200k, 1M
fmt_tokens() {
  awk -v n="$1" 'BEGIN {
    if (n >= 1000000) { v = sprintf("%.1f", n / 1000000); u = "M" }
    else if (n >= 1000) { v = sprintf("%.1f", n / 1000); u = "k" }
    else { printf "%d", n; exit }
    sub(/\.0$/, "", v); printf "%s%s", v, u
  }'
}

if [ -n "$used_pct" ] && [ -n "$used_tokens" ]; then
  ctx_text="ctx: $(fmt_tokens "$used_tokens")"
  [ -n "$ctx_size" ] && [ "$ctx_size" != "null" ] && ctx_text="${ctx_text} / $(fmt_tokens "$ctx_size")"
  # Bright yellow while low; orange/red past 50%/80%
  ctx_color=$(color_for_pct "$used_pct")
  case "$ctx_color" in 32) ctx_color="93" ;; 33) ctx_color="38;5;208" ;; esac
  ctx_str=$(colorize "$ctx_color" "$ctx_text")
else
  ctx_str=$(colorize "2" "ctx: n/a")
fi

five=$(echo "$input" | jq -r '.rate_limits.five_hour.used_percentage // empty')
week=$(echo "$input" | jq -r '.rate_limits.seven_day.used_percentage // empty')

usage_parts=()
if [ -n "$five" ] && [ "$five" != "null" ]; then
  five_int=$(awk -v p="$five" 'BEGIN { printf "%.0f", p }')
  usage_parts+=("$(colorize "$(color_for_pct "$five_int")" "5h: ${five_int}% used")")
fi
if [ -n "$week" ] && [ "$week" != "null" ]; then
  week_int=$(awk -v p="$week" 'BEGIN { printf "%.0f", p }')
  usage_parts+=("$(colorize "$(color_for_pct "$week_int")" "7d: ${week_int}% used")")
fi

if [ "${#usage_parts[@]}" -eq 0 ]; then
  usage_str=$(colorize "2" "usage: n/a")
else
  usage_str=$(IFS=$'\002'; printf "%s" "${usage_parts[*]}")
  usage_str="${usage_str//$'\002'/${SEP}}"
fi

printf "%b" "${folder_str}${SEP}${model_str}${SEP}${ctx_str}${SEP}${usage_str}\n"
