#!/usr/bin/env bash
set -euo pipefail

# ═══════════════════════════════════════════════════════════════════
#  ClauDEX Setup Script
#  Persistent Memory for Claude Code
# ═══════════════════════════════════════════════════════════════════
#
#  Installs dependencies, builds the project, generates plugin
#  configuration, and registers ClauDEX with Claude Code.
#
#  Usage:
#    ./setup.sh            Full install + register
#    ./setup.sh --build    Build only (skip registration)
#    ./setup.sh --help     Show help
# ═══════════════════════════════════════════════════════════════════

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_DIR="$SCRIPT_DIR"
BUILD_ONLY=false
CLAUDE_SETTINGS_DIR="${CLAUDE_SETTINGS_DIR:-$HOME/.claude}"
VERSION=$(node -p "require('${SCRIPT_DIR}/package.json').version" 2>/dev/null || echo "0.0.0")

# ── Colors ───────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

ok()   { echo -e "  ${GREEN}✓${RESET} $*"; }
warn() { echo -e "  ${YELLOW}⚠${RESET} $*"; }
fail() { echo -e "  ${RED}✗${RESET} $*"; }
step() { echo -e "\n${CYAN}▸${RESET} ${BOLD}$*${RESET}"; }

# ── Parse args ───────────────────────────────────────────────────
for arg in "$@"; do
  case "$arg" in
    --build)     BUILD_ONLY=true ;;
    --help|-h)
      echo "ClauDEX Setup"
      echo ""
      echo "Usage:"
      echo "  ./setup.sh            Full install + register"
      echo "  ./setup.sh --build    Build only (skip registration)"
      echo "  ./setup.sh --help     Show this help"
      echo ""
      echo "Environment:"
      echo "  CLAUDEX_DATA_DIR      Override data directory (default: ~/.claudex)"
      echo "  CLAUDE_SETTINGS_DIR   Override Claude settings dir (default: ~/.claude)"
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg"
      echo "Run ./setup.sh --help for usage."
      exit 1
      ;;
  esac
done

# ── Banner ───────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}  ╔═══════════════════════════════════════╗${RESET}"
echo -e "${BOLD}  ║  ${CYAN}Clau${YELLOW}DEX${RESET}${BOLD}  Setup                      ║${RESET}"
echo -e "${BOLD}  ║  Persistent Memory for Claude Code    ║${RESET}"
echo -e "${BOLD}  ╚═══════════════════════════════════════╝${RESET}"

# ─────────────────────────────────────────────────────────────────
# PHASE 1: Prerequisites
# ─────────────────────────────────────────────────────────────────
step "Checking prerequisites..."

# Node.js
if ! command -v node &>/dev/null; then
  fail "Node.js not found. Please install Node.js >= 20."
  exit 1
fi
NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
  fail "Node.js >= 20 required (found $(node -v))"
  exit 1
fi
ok "Node.js $(node -v)"

# npm
if ! command -v npm &>/dev/null; then
  fail "npm not found."
  exit 1
fi
ok "npm v$(npm -v)"

# Claude Code CLI (optional)
HAS_CLAUDE=false
if command -v claude &>/dev/null; then
  HAS_CLAUDE=true
  ok "Claude Code CLI found"
else
  warn "Claude Code CLI not found (optional — needed for --plugin-dir)"
fi

# ─────────────────────────────────────────────────────────────────
# PHASE 2: Install dependencies
# ─────────────────────────────────────────────────────────────────
step "Installing dependencies..."

cd "$PLUGIN_DIR"
npm install 2>&1 | tail -1
ok "Dependencies installed"

# ─────────────────────────────────────────────────────────────────
# PHASE 3: Build
# ─────────────────────────────────────────────────────────────────
step "Compiling TypeScript..."

npx tsc 2>&1
ok "Build complete → dist/"

# ─────────────────────────────────────────────────────────────────
# PHASE 4: Generate plugin hook configuration
# ─────────────────────────────────────────────────────────────────
step "Generating hook configuration..."

mkdir -p "$PLUGIN_DIR/hooks"

# Write hooks.json with absolute paths baked in
cat > "$PLUGIN_DIR/hooks/hooks.json" << HOOKEOF
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|resume",
        "hooks": [
          {
            "type": "command",
            "command": "node \"${PLUGIN_DIR}/dist/src/hooks/adapters/hook-runner.js\" SessionStart"
          }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"${PLUGIN_DIR}/dist/src/hooks/adapters/hook-runner.js\" UserPromptSubmit"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Read|Edit|Write|Bash|Grep|Glob|WebFetch|WebSearch",
        "hooks": [
          {
            "type": "command",
            "command": "node \"${PLUGIN_DIR}/dist/src/hooks/adapters/hook-runner.js\" PostToolUse"
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "node \"${PLUGIN_DIR}/dist/src/hooks/adapters/hook-runner.js\" PreToolUse"
          }
        ]
      }
    ],
    "PreCompact": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"${PLUGIN_DIR}/dist/src/hooks/adapters/hook-runner.js\" PreCompact"
          }
        ]
      }
    ],
    "SessionEnd": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"${PLUGIN_DIR}/dist/src/hooks/adapters/hook-runner.js\" SessionEnd"
          }
        ]
      }
    ]
  }
}
HOOKEOF

ok "hooks/hooks.json generated"

# ─────────────────────────────────────────────────────────────────
# PHASE 5: Generate MCP server configuration
# ─────────────────────────────────────────────────────────────────
step "Generating MCP server configuration..."

cat > "$PLUGIN_DIR/.mcp.json" << MCPEOF
{
  "mcpServers": {
    "claudex": {
      "command": "node",
      "args": ["${PLUGIN_DIR}/dist/src/mcp/stdio-server.js"],
      "env": {}
    }
  }
}
MCPEOF

ok ".mcp.json generated"

# ─────────────────────────────────────────────────────────────────
# PHASE 6: Update plugin.json with standard fields
# ─────────────────────────────────────────────────────────────────
step "Updating plugin manifest..."

cat > "$PLUGIN_DIR/.claude-plugin/plugin.json" << PLUGINEOF
{
  "name": "claudex",
  "version": "${VERSION}",
  "description": "Persistent memory for Claude Code — captures observations, saves knowledge, enables search across sessions.",
  "author": { "name": "ClauDEX" },
  "license": "MIT",
  "skills": ".claude/skills/",
  "hooks": "hooks/hooks.json",
  "mcpServers": ".mcp.json"
}
PLUGINEOF

ok "plugin.json updated with hooks, MCP, and skills references"

# ─────────────────────────────────────────────────────────────────
# PHASE 7: Verify database
# ─────────────────────────────────────────────────────────────────
step "Testing database initialization..."

DB_TEST=$(node --input-type=module -e "
  const { getDb, closeDb } = await import('${PLUGIN_DIR}/dist/src/db/database.js');
  try {
    const db = getDb();
    const row = db.prepare(\"SELECT COUNT(*) as c FROM sqlite_master WHERE type='table'\").get();
    console.log('OK:' + row.c);
    closeDb();
  } catch(e) {
    console.log('FAIL:' + e.message);
  }
" 2>/dev/null || echo "FAIL:module error")

if [[ "$DB_TEST" == OK:* ]]; then
  TABLE_COUNT="${DB_TEST#OK:}"
  ok "Database OK (${TABLE_COUNT} tables)"
else
  warn "Database test: ${DB_TEST#FAIL:}"
fi

# ─────────────────────────────────────────────────────────────────
# PHASE 8: Verify MCP server loads
# ─────────────────────────────────────────────────────────────────
step "Verifying MCP server module..."

MCP_TEST=$(node --input-type=module -e "
  const { toolDefinitions } = await import('${PLUGIN_DIR}/dist/src/mcp/index.js');
  console.log('OK:' + toolDefinitions.length);
" 2>/dev/null || echo "FAIL")

if [[ "$MCP_TEST" == OK:* ]]; then
  TOOL_COUNT="${MCP_TEST#OK:}"
  ok "MCP server OK (${TOOL_COUNT} tools registered)"
else
  warn "MCP module failed to load"
fi

# ─────────────────────────────────────────────────────────────────
# PHASE 9: Verify skills
# ─────────────────────────────────────────────────────────────────
step "Checking skills..."

SKILL_COUNT=$(find "$PLUGIN_DIR/.claude/skills" -name "SKILL.md" 2>/dev/null | wc -l)
if [ "$SKILL_COUNT" -gt 0 ]; then
  ok "${SKILL_COUNT} skills found:"
  for skill_dir in "$PLUGIN_DIR/.claude/skills"/*/; do
    skill_name=$(basename "$skill_dir")
    echo -e "    ${DIM}/${skill_name}${RESET}"
  done
else
  warn "No skills found in .claude/skills/"
fi

# ─────────────────────────────────────────────────────────────────
# PHASE 10: Register with Claude Code
# ─────────────────────────────────────────────────────────────────
if [ "$BUILD_ONLY" = false ]; then
  step "Registering plugin..."

  REGISTERED=false

  # Method 1: Try --plugin-dir flag (add to project settings)
  if [ -d "$CLAUDE_SETTINGS_DIR" ]; then
    # Create or update project-level settings to reference this plugin
    PROJECT_SETTINGS_DIR="$PLUGIN_DIR/.claude"
    mkdir -p "$PROJECT_SETTINGS_DIR"

    # Write settings.local.json to enable ClauDEX for this project
    SETTINGS_LOCAL="$PROJECT_SETTINGS_DIR/settings.local.json"
    if [ -f "$SETTINGS_LOCAL" ]; then
      # Merge into existing
      node --input-type=module -e "
        import fs from 'fs';
        const f = '${SETTINGS_LOCAL}';
        let cfg = {};
        try { cfg = JSON.parse(fs.readFileSync(f, 'utf-8')); } catch {}
        cfg.plugins = cfg.plugins || [];
        const entry = { type: 'local', path: '${PLUGIN_DIR}' };
        if (!cfg.plugins.some(p => p.path === entry.path)) {
          cfg.plugins.push(entry);
        }
        fs.writeFileSync(f, JSON.stringify(cfg, null, 2) + '\n');
        console.log('OK');
      " 2>/dev/null && REGISTERED=true
    else
      cat > "$SETTINGS_LOCAL" << SETTINGSEOF
{
  "plugins": [
    { "type": "local", "path": "${PLUGIN_DIR}" }
  ]
}
SETTINGSEOF
      REGISTERED=true
    fi

    if [ "$REGISTERED" = true ]; then
      ok "Plugin registered in .claude/settings.local.json"
    fi
  fi

  if [ "$REGISTERED" = false ]; then
    warn "Could not auto-register. Use: claude --plugin-dir \"${PLUGIN_DIR}\""
  fi
fi

# ─────────────────────────────────────────────────────────────────
# Done
# ─────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}  ╔═══════════════════════════════════════╗${RESET}"
echo -e "${BOLD}  ║  ${GREEN}✓${RESET}${BOLD}  ClauDEX is ready!                  ║${RESET}"
echo -e "${BOLD}  ╚═══════════════════════════════════════╝${RESET}"
echo ""

echo -e "${BOLD}QUICK START${RESET}"
echo ""
echo -e "  Launch Claude Code with ClauDEX loaded:"
echo ""
echo -e "    ${CYAN}claude --plugin-dir \"${PLUGIN_DIR}\"${RESET}"
echo ""
echo -e "  Or add an alias to your shell profile:"
echo ""
echo -e "    ${DIM}alias claude-dex='claude --plugin-dir \"${PLUGIN_DIR}\"'${RESET}"
echo ""

echo -e "${BOLD}SLASH COMMANDS${RESET}"
echo ""
echo -e "  ${CYAN}/remember${RESET} <content>    Save to persistent memory"
echo -e "  ${CYAN}/recall${RESET}   <query>      Search all memory"
echo -e "  ${CYAN}/forget${RESET}   <what>       Delete memories"
echo -e "  ${CYAN}/stash${RESET}    [label]      Park current conversation"
echo -e "  ${CYAN}/resume${RESET}                Resume a stashed conversation"
echo -e "  ${CYAN}/checkpoint${RESET} [label]    Create session save point"
echo -e "  ${CYAN}/resolve${RESET}               Handle memory conflicts"
echo ""

echo -e "${BOLD}MCP TOOLS${RESET} (9 tools available to Claude automatically)"
echo ""
echo -e "  memory_search    memory_save      memory_timeline"
echo -e "  memory_get       memory_forget    memory_stash"
echo -e "  memory_resume    memory_stats     memory_resolve"
echo ""

echo -e "${BOLD}WEB UI${RESET}"
echo ""
echo -e "  ${CYAN}http://127.0.0.1:37820${RESET}"
echo -e "  ${DIM}Dashboard, Search, Timeline, Knowledge Graph, Settings${RESET}"
echo ""

echo -e "${BOLD}FILES${RESET}"
echo ""
echo -e "  Data:     ${DIM}~/.claudex/${RESET}"
echo -e "  Config:   ${DIM}~/.claudex/settings.json${RESET}"
echo -e "  Database: ${DIM}~/.claudex/claudex.db${RESET}"
echo -e "  Plugin:   ${DIM}${PLUGIN_DIR}${RESET}"
echo ""

if [ "$BUILD_ONLY" = false ]; then
  echo -e "${BOLD}MODES${RESET}"
  echo ""
  echo -e "  ${GREEN}Plugin mode${RESET} (--plugin-dir):"
  echo -e "    Skills, MCP tools, basic hooks, web UI."
  echo -e "    Each hook spawns a short-lived Node process."
  echo ""
  echo -e "  ${GREEN}SDK mode${RESET} (programmatic via initClaudex):"
  echo -e "    Full feature set: observation buffer, curation agent,"
  echo -e "    conflict detection, in-process MCP — zero process spawning."
  echo -e "    ${DIM}import { initClaudex } from '${PLUGIN_DIR}'${RESET}"
  echo ""
fi

echo -e "${DIM}Re-run ./setup.sh after moving the directory to update paths.${RESET}"
echo ""
