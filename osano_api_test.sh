#!/usr/bin/env bash
# ==============================================================================
# Osano Customer REST API - Interactive Endpoint Tester
# ==============================================================================
# A menu-driven tester for every endpoint documented in the Osano Customer
# REST API reference. Supports path params, query params, and JSON request
# bodies (inline entry or from a file).
#
# Requires: bash 3.2+ (default macOS), curl, optional: jq (for pretty output)
# Usage:    chmod +x osano_api_test.sh && ./osano_api_test.sh
# ==============================================================================

set -u

# -------------------------- Configuration / Globals --------------------------
BASE_URL_DEFAULT="https://api.osano.com"
BASE_URL="${OSANO_BASE_URL:-$BASE_URL_DEFAULT}"
API_KEY="${OSANO_API_KEY:-}"

# Terminal colors (fallback to empty if not a tty)
if [ -t 1 ]; then
  C_RESET=$'\033[0m'
  C_BOLD=$'\033[1m'
  C_DIM=$'\033[2m'
  C_RED=$'\033[31m'
  C_GREEN=$'\033[32m'
  C_YELLOW=$'\033[33m'
  C_BLUE=$'\033[34m'
  C_MAGENTA=$'\033[35m'
  C_CYAN=$'\033[36m'
else
  C_RESET=""; C_BOLD=""; C_DIM=""; C_RED=""; C_GREEN=""; C_YELLOW=""; C_BLUE=""; C_MAGENTA=""; C_CYAN=""
fi

HAS_JQ=0
if command -v jq >/dev/null 2>&1; then
  HAS_JQ=1
fi

# ------------------------------ Helpers --------------------------------------

banner() {
  clear
  echo "${C_CYAN}${C_BOLD}"
  echo "╔══════════════════════════════════════════════════════════════════════╗"
  echo "║            Osano Customer REST API - Endpoint Tester                 ║"
  echo "╚══════════════════════════════════════════════════════════════════════╝"
  echo "${C_RESET}"
  echo "  ${C_DIM}Base URL:${C_RESET} $BASE_URL"
  if [ -n "$API_KEY" ]; then
    local masked="${API_KEY:0:4}…${API_KEY: -4}"
    echo "  ${C_DIM}API Key: ${C_GREEN}$masked${C_RESET}"
  else
    echo "  ${C_DIM}API Key: ${C_RED}<not set>${C_RESET}"
  fi
  echo ""
}

pause() {
  echo ""
  read -r -p "${C_DIM}Press <Enter> to continue...${C_RESET} " _
}

ensure_api_key() {
  if [ -z "$API_KEY" ]; then
    echo "${C_YELLOW}No API key set. Enter it now (input hidden):${C_RESET}"
    read -r -s -p "  x-osano-api-key: " API_KEY
    echo ""
    if [ -z "$API_KEY" ]; then
      echo "${C_RED}API key required. Aborting request.${C_RESET}"
      return 1
    fi
  fi
  return 0
}

# Prompt for a value with optional default. Usage: prompt_value "Label" "default"
# Result is placed in REPLY_VALUE.
prompt_value() {
  local label="$1"
  local default="${2:-}"
  local val
  if [ -n "$default" ]; then
    read -r -p "  $label [${C_DIM}$default${C_RESET}]: " val
    val="${val:-$default}"
  else
    read -r -p "  $label: " val
  fi
  REPLY_VALUE="$val"
}

# Prompt for a required value; re-prompt until non-empty
prompt_required() {
  local label="$1"
  while true; do
    read -r -p "  ${C_BOLD}$label${C_RESET} (required): " REPLY_VALUE
    if [ -n "$REPLY_VALUE" ]; then
      return 0
    fi
    echo "  ${C_RED}A value is required.${C_RESET}"
  done
}

# Minimal URL-encoder (no python/php dependency). Encodes reserved query chars.
urlencode() {
  local s="$1"
  local out=""
  local i ch
  for (( i = 0; i < ${#s}; i++ )); do
    ch="${s:i:1}"
    case "$ch" in
      [a-zA-Z0-9.~_-]) out+="$ch" ;;
      *) out+=$(printf '%%%02X' "'$ch") ;;
    esac
  done
  printf '%s' "$out"
}

# Build a query string from interactive prompts.
# Pass pairs: "paramName" "human description" "default"
# Only non-empty values are appended.
# Usage: build_query_string "limit" "Max results (<=1000)" "100"  "next" "Pagination token" ""  ...
# Result in REPLY_QUERY (empty string or leading '?').
build_query_string() {
  local qs=""
  while [ $# -gt 0 ]; do
    local name="$1"; shift
    local desc="$1"; shift
    local default="$1"; shift
    prompt_value "$desc ($name)" "$default"
    if [ -n "$REPLY_VALUE" ]; then
      local enc
      enc=$(urlencode "$REPLY_VALUE")
      if [ -z "$qs" ]; then
        qs="?${name}=${enc}"
      else
        qs="${qs}&${name}=${enc}"
      fi
    fi
  done
  REPLY_QUERY="$qs"
}

# Prompt for a JSON body. Offers three options:
#   1. Type/paste inline (terminated with a line containing only EOF)
#   2. Load from a file
#   3. Skip (send empty body)
# A suggested template string may be passed as $1. Result in REPLY_BODY.
prompt_json_body() {
  local template="${1:-}"
  REPLY_BODY=""
  echo ""
  echo "  ${C_CYAN}Request body (JSON):${C_RESET}"
  echo "    ${C_DIM}1) Paste/type JSON inline (end with a single line: EOF)"
  echo "    2) Load from file"
  echo "    3) Skip / send empty body${C_RESET}"
  read -r -p "  Choice [1]: " choice
  choice="${choice:-1}"

  case "$choice" in
    1)
      if [ -n "$template" ]; then
        echo "  ${C_DIM}Template (edit as needed):${C_RESET}"
        echo "${C_DIM}${template}${C_RESET}"
        echo ""
      fi
      echo "  ${C_DIM}Enter JSON, then a line containing only EOF to submit:${C_RESET}"
      local line body=""
      while IFS= read -r line; do
        [ "$line" = "EOF" ] && break
        body+="$line"$'\n'
      done
      REPLY_BODY="$body"
      ;;
    2)
      read -r -p "  Path to JSON file: " fpath
      # Expand ~
      fpath="${fpath/#\~/$HOME}"
      if [ ! -f "$fpath" ]; then
        echo "  ${C_RED}File not found: $fpath${C_RESET}"
        REPLY_BODY=""
        return 1
      fi
      REPLY_BODY="$(cat "$fpath")"
      ;;
    3|*)
      REPLY_BODY=""
      ;;
  esac
}

# Execute a curl request and pretty-print the result.
# Args: METHOD  PATH_WITH_QUERY  [BODY]
execute_request() {
  local method="$1"
  local path="$2"
  local body="${3:-}"

  ensure_api_key || { pause; return 1; }

  local url="${BASE_URL}${path}"
  echo ""
  echo "${C_MAGENTA}${C_BOLD}── Request ──────────────────────────────────────────────────────${C_RESET}"
  echo "  ${C_BOLD}${method}${C_RESET} ${url}"
  if [ -n "$body" ]; then
    echo "  ${C_DIM}Content-Type: application/json${C_RESET}"
    echo "  ${C_DIM}Body:${C_RESET}"
    if [ "$HAS_JQ" = "1" ]; then
      echo "$body" | jq . 2>/dev/null || echo "$body"
    else
      echo "$body"
    fi
  fi
  echo ""
  read -r -p "  Send this request? [Y/n]: " confirm
  confirm="${confirm:-Y}"
  if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    echo "${C_YELLOW}  Cancelled.${C_RESET}"
    pause
    return 0
  fi

  local tmp_body tmp_headers
  tmp_body=$(mktemp -t osano_body.XXXXXX)
  tmp_headers=$(mktemp -t osano_headers.XXXXXX)

  local curl_args=(
    -sS
    -X "$method"
    -H "x-osano-api-key: ${API_KEY}"
    -H "Accept: application/json"
    -D "$tmp_headers"
    -o "$tmp_body"
    -w "%{http_code}"
  )

  if [ -n "$body" ]; then
    curl_args+=( -H "Content-Type: application/json" --data-binary "$body" )
  fi

  echo "${C_MAGENTA}${C_BOLD}── Response ─────────────────────────────────────────────────────${C_RESET}"
  local status
  status=$(curl "${curl_args[@]}" "$url") || status="ERR"

  # Colorize status
  local status_color="$C_YELLOW"
  case "$status" in
    2??) status_color="$C_GREEN" ;;
    4??|5??|ERR) status_color="$C_RED" ;;
  esac
  echo "  ${C_BOLD}HTTP Status:${C_RESET} ${status_color}${status}${C_RESET}"

  echo "  ${C_DIM}Headers:${C_RESET}"
  sed 's/^/    /' "$tmp_headers" | head -20

  echo ""
  echo "  ${C_DIM}Body:${C_RESET}"
  if [ -s "$tmp_body" ]; then
    if [ "$HAS_JQ" = "1" ]; then
      jq . "$tmp_body" 2>/dev/null || cat "$tmp_body"
    else
      cat "$tmp_body"
    fi
  else
    echo "    ${C_DIM}<empty>${C_RESET}"
  fi
  echo ""

  rm -f "$tmp_body" "$tmp_headers"
  pause
}

# ======================= Settings / Config Submenu ===========================
config_menu() {
  while true; do
    banner
    echo "${C_BOLD}Settings${C_RESET}"
    echo "  1) Set/change API key"
    echo "  2) Set/change base URL"
    echo "  3) Clear API key"
    echo "  0) Back"
    echo ""
    read -r -p "  Choice: " c
    case "$c" in
      1)
        read -r -s -p "  Enter API key (input hidden): " API_KEY
        echo ""
        echo "${C_GREEN}  API key updated.${C_RESET}"
        pause
        ;;
      2)
        prompt_value "Base URL" "$BASE_URL"
        BASE_URL="$REPLY_VALUE"
        echo "${C_GREEN}  Base URL updated.${C_RESET}"
        pause
        ;;
      3)
        API_KEY=""
        echo "${C_GREEN}  API key cleared.${C_RESET}"
        pause
        ;;
      0) return ;;
    esac
  done
}

# =============================================================================
#   Common query params used by many list endpoints
# =============================================================================
# Shared list-style filters. Appends limit + next pagination params.
# Callers pass additional name/desc/default triples.
# (Here we just inline per-endpoint for clarity.)

# =============================================================================
#   Cookie Consent Configurations
# =============================================================================

ep_list_cookie_configs() {
  banner
  echo "${C_BOLD}GET /v1/cookie-consent/configs${C_RESET}  — List Cookie Consent Configurations"
  echo "${C_DIM}Leave any filter blank to skip it.${C_RESET}"
  echo ""
  build_query_string \
    "name"    "Filter by name (case-insensitive, partial)" "" \
    "domains" "Comma-separated domains (optional any:/all:/not: prefix)" "" \
    "limit"   "Max results (<=1000)" "100" \
    "next"    "Pagination token" "" \
    "sortBy"  "Sort by (name|created|updated|lastPublished)" "created" \
    "orgIds"  "Comma-separated org UUIDs (optional any:/all:/not: prefix)" "" \
    "mode"    "Compliance mode (debug|permissive|production)" "" \
    "status"  "Publish status (unpublished|in-progress|published|outdated|error)" "" \
    "tattleRecordStopped" "Tattle record stopped (true|false)" ""
  execute_request "GET" "/v1/cookie-consent/configs${REPLY_QUERY}"
}

ep_create_cookie_config() {
  banner
  echo "${C_BOLD}POST /v1/cookie-consent/configs${C_RESET}  — Create New Cookie Consent Configuration"
  local template='{
  "name": "My Config",
  "domains": ["example.com"],
  "orgIds": [],
  "mode": "production",
  "configuration": {
    "allowTimeout": true,
    "dntSupport": true,
    "gpcSupport": true
  }
}'
  prompt_json_body "$template"
  execute_request "POST" "/v1/cookie-consent/configs" "$REPLY_BODY"
}

ep_get_cookie_config() {
  banner
  echo "${C_BOLD}GET /v1/cookie-consent/configs/{configId}${C_RESET}  — Get Cookie Consent Configuration"
  prompt_required "configId"
  local cfgId="$REPLY_VALUE"
  execute_request "GET" "/v1/cookie-consent/configs/$(urlencode "$cfgId")"
}

ep_update_cookie_config() {
  banner
  echo "${C_BOLD}PATCH /v1/cookie-consent/configs/{configId}${C_RESET}  — Update Cookie Consent Configuration"
  prompt_required "configId"
  local cfgId="$REPLY_VALUE"
  local template='{
  "name": "Updated Name",
  "mode": "production"
}'
  prompt_json_body "$template"
  execute_request "PATCH" "/v1/cookie-consent/configs/$(urlencode "$cfgId")" "$REPLY_BODY"
}

ep_publish_cookie_config() {
  banner
  echo "${C_BOLD}POST /v1/cookie-consent/configs/{configId}/publish${C_RESET}  — Publish Cookie Consent Configuration"
  prompt_required "configId"
  local cfgId="$REPLY_VALUE"
  execute_request "POST" "/v1/cookie-consent/configs/$(urlencode "$cfgId")/publish"
}

ep_list_config_discoveries() {
  banner
  echo "${C_BOLD}GET /v1/cookie-consent/configs/{configId}/discoveries${C_RESET}  — List Configuration Discoveries"
  prompt_required "configId"
  local cfgId="$REPLY_VALUE"
  build_query_string \
    "limit" "Max results" "100" \
    "next"  "Pagination token" ""
  execute_request "GET" "/v1/cookie-consent/configs/$(urlencode "$cfgId")/discoveries${REPLY_QUERY}"
}

ep_list_config_rules() {
  banner
  echo "${C_BOLD}GET /v1/cookie-consent/configs/{configId}/rules${C_RESET}  — List Configuration Rules"
  prompt_required "configId"
  local cfgId="$REPLY_VALUE"
  build_query_string \
    "limit" "Max results" "100" \
    "next"  "Pagination token" ""
  execute_request "GET" "/v1/cookie-consent/configs/$(urlencode "$cfgId")/rules${REPLY_QUERY}"
}

ep_create_cookie_rules() {
  banner
  echo "${C_BOLD}POST /v1/cookie-consent/rules${C_RESET}  — Create New Cookie Consent Rules"
  local template='{
  "configId": "uuid-here",
  "rules": [
    {
      "name": "Example rule",
      "category": "ESSENTIAL",
      "matchType": "exact",
      "pattern": "example.com"
    }
  ]
}'
  prompt_json_body "$template"
  execute_request "POST" "/v1/cookie-consent/rules" "$REPLY_BODY"
}

ep_update_cookie_rule() {
  banner
  echo "${C_BOLD}PATCH /v1/cookie-consent/rules/{ruleId}${C_RESET}  — Update Cookie Consent Rule"
  prompt_required "ruleId"
  local rid="$REPLY_VALUE"
  local template='{
  "category": "ANALYTICS"
}'
  prompt_json_body "$template"
  execute_request "PATCH" "/v1/cookie-consent/rules/$(urlencode "$rid")" "$REPLY_BODY"
}

ep_delete_cookie_rule() {
  banner
  echo "${C_BOLD}DELETE /v1/cookie-consent/rules/{ruleId}${C_RESET}  — Delete Cookie Consent Rule"
  prompt_required "ruleId"
  local rid="$REPLY_VALUE"
  execute_request "DELETE" "/v1/cookie-consent/rules/$(urlencode "$rid")"
}

cookie_consent_menu() {
  while true; do
    banner
    echo "${C_BOLD}Cookie Consent${C_RESET}"
    echo "  1)  GET    /v1/cookie-consent/configs                       — List configs"
    echo "  2)  POST   /v1/cookie-consent/configs                       — Create config"
    echo "  3)  GET    /v1/cookie-consent/configs/{configId}            — Get config"
    echo "  4)  PATCH  /v1/cookie-consent/configs/{configId}            — Update config"
    echo "  5)  POST   /v1/cookie-consent/configs/{configId}/publish    — Publish config"
    echo "  6)  GET    /v1/cookie-consent/configs/{configId}/discoveries — List discoveries"
    echo "  7)  GET    /v1/cookie-consent/configs/{configId}/rules      — List rules"
    echo "  8)  POST   /v1/cookie-consent/rules                         — Create rules"
    echo "  9)  PATCH  /v1/cookie-consent/rules/{ruleId}                — Update rule"
    echo "  10) DELETE /v1/cookie-consent/rules/{ruleId}                — Delete rule"
    echo "  0)  Back"
    echo ""
    read -r -p "  Choice: " c
    case "$c" in
      1)  ep_list_cookie_configs ;;
      2)  ep_create_cookie_config ;;
      3)  ep_get_cookie_config ;;
      4)  ep_update_cookie_config ;;
      5)  ep_publish_cookie_config ;;
      6)  ep_list_config_discoveries ;;
      7)  ep_list_config_rules ;;
      8)  ep_create_cookie_rules ;;
      9)  ep_update_cookie_rule ;;
      10) ep_delete_cookie_rule ;;
      0)  return ;;
    esac
  done
}

# =============================================================================
#   Connectors
# =============================================================================

ep_list_connectors() {
  banner
  echo "${C_BOLD}GET /v1/connectors${C_RESET}  — List Connectors"
  build_query_string \
    "limit" "Max results" "100" \
    "next"  "Pagination token" ""
  execute_request "GET" "/v1/connectors${REPLY_QUERY}"
}

ep_list_dd_connectors() {
  banner
  echo "${C_BOLD}GET /v1/data-discovery/connectors${C_RESET}  — List Data Discovery Connectors"
  build_query_string \
    "limit" "Max results" "100" \
    "next"  "Pagination token" ""
  execute_request "GET" "/v1/data-discovery/connectors${REPLY_QUERY}"
}

connectors_menu() {
  while true; do
    banner
    echo "${C_BOLD}Connectors${C_RESET}"
    echo "  1) GET /v1/connectors                     — List connectors"
    echo "  2) GET /v1/data-discovery/connectors      — List data discovery connectors"
    echo "  0) Back"
    echo ""
    read -r -p "  Choice: " c
    case "$c" in
      1) ep_list_connectors ;;
      2) ep_list_dd_connectors ;;
      0) return ;;
    esac
  done
}

# =============================================================================
#   Subject Rights Requests — /v1/subject-rights/requests
# =============================================================================

ep_list_srr() {
  banner
  echo "${C_BOLD}GET /v1/subject-rights/requests${C_RESET}  — List Subject Rights Requests"
  build_query_string \
    "limit" "Max results" "100" \
    "next"  "Pagination token" "" \
    "status" "Status filter" "" \
    "type"  "Request type" ""
  execute_request "GET" "/v1/subject-rights/requests${REPLY_QUERY}"
}

ep_create_srr() {
  banner
  echo "${C_BOLD}POST /v1/subject-rights/requests${C_RESET}  — Create Subject Rights Request"
  local template='{
  "type": "access",
  "subject": {
    "email": "user@example.com",
    "firstName": "First",
    "lastName": "Last"
  }
}'
  prompt_json_body "$template"
  execute_request "POST" "/v1/subject-rights/requests" "$REPLY_BODY"
}

ep_get_srr() {
  banner
  echo "${C_BOLD}GET /v1/subject-rights/requests/{dsarId}${C_RESET}  — Get Subject Rights Request"
  prompt_required "dsarId"
  local id="$REPLY_VALUE"
  execute_request "GET" "/v1/subject-rights/requests/$(urlencode "$id")"
}

ep_update_srr() {
  banner
  echo "${C_BOLD}PATCH /v1/subject-rights/requests/{dsarId}${C_RESET}  — Update Subject Rights Request"
  prompt_required "dsarId"
  local id="$REPLY_VALUE"
  local template='{
  "status": "in-progress"
}'
  prompt_json_body "$template"
  execute_request "PATCH" "/v1/subject-rights/requests/$(urlencode "$id")" "$REPLY_BODY"
}

ep_srr_identification() {
  banner
  echo "${C_BOLD}POST /v1/subject-rights/requests/{dsarId}/identification${C_RESET}  — Update Identification Photo"
  prompt_required "dsarId"
  local id="$REPLY_VALUE"
  local template='{
  "identificationPhoto": "base64-encoded-image-data"
}'
  prompt_json_body "$template"
  execute_request "POST" "/v1/subject-rights/requests/$(urlencode "$id")/identification" "$REPLY_BODY"
}

ep_srr_summaries() {
  banner
  echo "${C_BOLD}GET /v1/subject-rights/requests/{requestId}/summaries${C_RESET}  — Get Request Summaries"
  prompt_required "requestId"
  local id="$REPLY_VALUE"
  build_query_string \
    "limit" "Max results" "100" \
    "next"  "Pagination token" ""
  execute_request "GET" "/v1/subject-rights/requests/$(urlencode "$id")/summaries${REPLY_QUERY}"
}

ep_srr_get_summary_notification() {
  banner
  echo "${C_BOLD}GET /v1/subject-rights/requests/{requestId}/summary-notification${C_RESET}  — Get Summary Notification"
  prompt_required "requestId"
  local id="$REPLY_VALUE"
  execute_request "GET" "/v1/subject-rights/requests/$(urlencode "$id")/summary-notification"
}

ep_srr_send_summary_notification() {
  banner
  echo "${C_BOLD}POST /v1/subject-rights/requests/{requestId}/summary-notification${C_RESET}  — Send Summary Notification"
  prompt_required "requestId"
  local id="$REPLY_VALUE"
  local template='{
  "notify": true
}'
  prompt_json_body "$template"
  execute_request "POST" "/v1/subject-rights/requests/$(urlencode "$id")/summary-notification" "$REPLY_BODY"
}

ep_srr_activity_log() {
  banner
  echo "${C_BOLD}POST /v1/subject-rights/requests/{requestId}/activity-log${C_RESET}  — Create Activity Log Entry"
  prompt_required "requestId"
  local id="$REPLY_VALUE"
  local template='{
  "message": "Offline activity entry",
  "occurredAt": 0
}'
  prompt_json_body "$template"
  execute_request "POST" "/v1/subject-rights/requests/$(urlencode "$id")/activity-log" "$REPLY_BODY"
}

ep_srr_get_portal_messages() {
  banner
  echo "${C_BOLD}GET /v1/subject-rights/requests/{requestId}/portal-messages${C_RESET}  — Get Portal Messages"
  prompt_required "requestId"
  local id="$REPLY_VALUE"
  build_query_string \
    "limit" "Max results" "100" \
    "next"  "Pagination token" ""
  execute_request "GET" "/v1/subject-rights/requests/$(urlencode "$id")/portal-messages${REPLY_QUERY}"
}

ep_srr_create_portal_message() {
  banner
  echo "${C_BOLD}POST /v1/subject-rights/requests/{requestId}/portal-messages${C_RESET}  — Create Portal Message"
  prompt_required "requestId"
  local id="$REPLY_VALUE"
  local template='{
  "message": "Hello from the admin portal."
}'
  prompt_json_body "$template"
  execute_request "POST" "/v1/subject-rights/requests/$(urlencode "$id")/portal-messages" "$REPLY_BODY"
}

ep_srr_update_portal_message() {
  banner
  echo "${C_BOLD}PATCH /v1/subject-rights/requests/{requestId}/portal-messages/{messageId}${C_RESET}  — Update Portal Message"
  prompt_required "requestId"
  local rid="$REPLY_VALUE"
  prompt_required "messageId"
  local mid="$REPLY_VALUE"
  local template='{
  "read": true
}'
  prompt_json_body "$template"
  execute_request "PATCH" "/v1/subject-rights/requests/$(urlencode "$rid")/portal-messages/$(urlencode "$mid")" "$REPLY_BODY"
}

srr_menu() {
  while true; do
    banner
    echo "${C_BOLD}Subject Rights Requests${C_RESET}"
    echo "  1)  GET   /v1/subject-rights/requests                                         — List"
    echo "  2)  POST  /v1/subject-rights/requests                                         — Create"
    echo "  3)  GET   /v1/subject-rights/requests/{dsarId}                                — Get"
    echo "  4)  PATCH /v1/subject-rights/requests/{dsarId}                                — Update"
    echo "  5)  POST  /v1/subject-rights/requests/{dsarId}/identification                 — Update ID photo"
    echo "  6)  GET   /v1/subject-rights/requests/{requestId}/summaries                   — Get summaries"
    echo "  7)  GET   /v1/subject-rights/requests/{requestId}/summary-notification        — Get summary notif"
    echo "  8)  POST  /v1/subject-rights/requests/{requestId}/summary-notification        — Send summary notif"
    echo "  9)  POST  /v1/subject-rights/requests/{requestId}/activity-log                — Create activity log"
    echo "  10) GET   /v1/subject-rights/requests/{requestId}/portal-messages             — Get portal msgs"
    echo "  11) POST  /v1/subject-rights/requests/{requestId}/portal-messages             — Create portal msg"
    echo "  12) PATCH /v1/subject-rights/requests/{requestId}/portal-messages/{messageId} — Update portal msg"
    echo "  0)  Back"
    echo ""
    read -r -p "  Choice: " c
    case "$c" in
      1)  ep_list_srr ;;
      2)  ep_create_srr ;;
      3)  ep_get_srr ;;
      4)  ep_update_srr ;;
      5)  ep_srr_identification ;;
      6)  ep_srr_summaries ;;
      7)  ep_srr_get_summary_notification ;;
      8)  ep_srr_send_summary_notification ;;
      9)  ep_srr_activity_log ;;
      10) ep_srr_get_portal_messages ;;
      11) ep_srr_create_portal_message ;;
      12) ep_srr_update_portal_message ;;
      0)  return ;;
    esac
  done
}

# =============================================================================
#   Data Discovery - Data Stores — /v1/data-discovery/data-stores
# =============================================================================

ep_list_dd_data_stores() {
  banner
  echo "${C_BOLD}GET /v1/data-discovery/data-stores${C_RESET}  — List Data Stores"
  build_query_string \
    "limit" "Max results" "100" \
    "next"  "Pagination token" "" \
    "name"  "Filter by name" "" \
    "labels" "Comma-separated labels" ""
  execute_request "GET" "/v1/data-discovery/data-stores${REPLY_QUERY}"
}

ep_create_dd_data_store() {
  banner
  echo "${C_BOLD}POST /v1/data-discovery/data-stores${C_RESET}  — Create New Data Store"
  local template='{
  "name": "My Data Store",
  "connectorId": "uuid-here",
  "labels": []
}'
  prompt_json_body "$template"
  execute_request "POST" "/v1/data-discovery/data-stores" "$REPLY_BODY"
}

ep_list_dd_data_store_labels() {
  banner
  echo "${C_BOLD}GET /v1/data-discovery/data-stores/labels${C_RESET}  — List Data Store Labels"
  build_query_string \
    "limit" "Max results" "100" \
    "next"  "Pagination token" ""
  execute_request "GET" "/v1/data-discovery/data-stores/labels${REPLY_QUERY}"
}

ep_get_dd_data_store() {
  banner
  echo "${C_BOLD}GET /v1/data-discovery/data-stores/{dataStoreId}${C_RESET}  — Get Data Store"
  prompt_required "dataStoreId"
  local id="$REPLY_VALUE"
  execute_request "GET" "/v1/data-discovery/data-stores/$(urlencode "$id")"
}

ep_delete_dd_data_store() {
  banner
  echo "${C_BOLD}DELETE /v1/data-discovery/data-stores/{dataStoreId}${C_RESET}  — Delete Data Store"
  prompt_required "dataStoreId"
  local id="$REPLY_VALUE"
  execute_request "DELETE" "/v1/data-discovery/data-stores/$(urlencode "$id")"
}

ep_update_dd_data_store() {
  banner
  echo "${C_BOLD}PATCH /v1/data-discovery/data-stores/{dataStoreId}${C_RESET}  — Update Data Store"
  prompt_required "dataStoreId"
  local id="$REPLY_VALUE"
  local template='{
  "name": "Renamed Data Store"
}'
  prompt_json_body "$template"
  execute_request "PATCH" "/v1/data-discovery/data-stores/$(urlencode "$id")" "$REPLY_BODY"
}

ep_put_dd_data_store_fields() {
  banner
  echo "${C_BOLD}PUT /v1/data-discovery/data-stores/{dataStoreId}/fields${C_RESET}  — Update Data Store Fields (replace set)"
  prompt_required "dataStoreId"
  local id="$REPLY_VALUE"
  local template='{
  "fields": [
    { "name": "email", "classification": "PII" }
  ]
}'
  prompt_json_body "$template"
  execute_request "PUT" "/v1/data-discovery/data-stores/$(urlencode "$id")/fields" "$REPLY_BODY"
}

ep_get_dd_data_store_fields() {
  banner
  echo "${C_BOLD}GET /v1/data-discovery/data-stores/{dataStoreId}/fields${C_RESET}  — List Data Store Fields"
  prompt_required "dataStoreId"
  local id="$REPLY_VALUE"
  build_query_string \
    "limit" "Max results" "100" \
    "next"  "Pagination token" ""
  execute_request "GET" "/v1/data-discovery/data-stores/$(urlencode "$id")/fields${REPLY_QUERY}"
}

ep_delete_dd_data_store_field() {
  banner
  echo "${C_BOLD}DELETE /v1/data-discovery/data-stores/{dataStoreId}/fields/{fieldId}${C_RESET}  — Delete Field"
  prompt_required "dataStoreId"
  local dsid="$REPLY_VALUE"
  prompt_required "fieldId"
  local fid="$REPLY_VALUE"
  execute_request "DELETE" "/v1/data-discovery/data-stores/$(urlencode "$dsid")/fields/$(urlencode "$fid")"
}

ep_update_dd_data_store_field() {
  banner
  echo "${C_BOLD}PATCH /v1/data-discovery/data-stores/{dataStoreId}/fields/{fieldId}${C_RESET}  — Update Field"
  prompt_required "dataStoreId"
  local dsid="$REPLY_VALUE"
  prompt_required "fieldId"
  local fid="$REPLY_VALUE"
  local template='{
  "classification": "PII"
}'
  prompt_json_body "$template"
  execute_request "PATCH" "/v1/data-discovery/data-stores/$(urlencode "$dsid")/fields/$(urlencode "$fid")" "$REPLY_BODY"
}

dd_data_stores_menu() {
  while true; do
    banner
    echo "${C_BOLD}Data Discovery - Data Stores${C_RESET}"
    echo "  1)  GET    /v1/data-discovery/data-stores                                     — List"
    echo "  2)  POST   /v1/data-discovery/data-stores                                     — Create"
    echo "  3)  GET    /v1/data-discovery/data-stores/labels                              — List labels"
    echo "  4)  GET    /v1/data-discovery/data-stores/{dataStoreId}                       — Get"
    echo "  5)  DELETE /v1/data-discovery/data-stores/{dataStoreId}                       — Delete"
    echo "  6)  PATCH  /v1/data-discovery/data-stores/{dataStoreId}                       — Update"
    echo "  7)  PUT    /v1/data-discovery/data-stores/{dataStoreId}/fields                — Replace fields"
    echo "  8)  GET    /v1/data-discovery/data-stores/{dataStoreId}/fields                — List fields"
    echo "  9)  DELETE /v1/data-discovery/data-stores/{dataStoreId}/fields/{fieldId}      — Delete field"
    echo "  10) PATCH  /v1/data-discovery/data-stores/{dataStoreId}/fields/{fieldId}      — Update field"
    echo "  0)  Back"
    echo ""
    read -r -p "  Choice: " c
    case "$c" in
      1)  ep_list_dd_data_stores ;;
      2)  ep_create_dd_data_store ;;
      3)  ep_list_dd_data_store_labels ;;
      4)  ep_get_dd_data_store ;;
      5)  ep_delete_dd_data_store ;;
      6)  ep_update_dd_data_store ;;
      7)  ep_put_dd_data_store_fields ;;
      8)  ep_get_dd_data_store_fields ;;
      9)  ep_delete_dd_data_store_field ;;
      10) ep_update_dd_data_store_field ;;
      0)  return ;;
    esac
  done
}

# =============================================================================
#   Subject Rights Action Items — /v1/subject-rights/action-items
# =============================================================================

ep_list_sr_action_items() {
  banner
  echo "${C_BOLD}GET /v1/subject-rights/action-items${C_RESET}  — List Subject Rights Action Items"
  build_query_string \
    "limit" "Max results" "100" \
    "next"  "Pagination token" "" \
    "status" "Status filter" "" \
    "requestId" "Filter by request id" ""
  execute_request "GET" "/v1/subject-rights/action-items${REPLY_QUERY}"
}

ep_get_sr_action_item() {
  banner
  echo "${C_BOLD}GET /v1/subject-rights/action-items/{actionItemId}${C_RESET}  — Get Action Item"
  prompt_required "actionItemId"
  local id="$REPLY_VALUE"
  execute_request "GET" "/v1/subject-rights/action-items/$(urlencode "$id")"
}

ep_update_sr_action_item() {
  banner
  echo "${C_BOLD}PATCH /v1/subject-rights/action-items/{actionItemId}${C_RESET}  — Update Action Item"
  prompt_required "actionItemId"
  local id="$REPLY_VALUE"
  local template='{
  "status": "completed"
}'
  prompt_json_body "$template"
  execute_request "PATCH" "/v1/subject-rights/action-items/$(urlencode "$id")" "$REPLY_BODY"
}

ep_list_sr_ai_summaries() {
  banner
  echo "${C_BOLD}GET /v1/subject-rights/action-items/{actionItemId}/summaries${C_RESET}  — List Summaries"
  prompt_required "actionItemId"
  local id="$REPLY_VALUE"
  build_query_string \
    "limit" "Max results" "100" \
    "next"  "Pagination token" ""
  execute_request "GET" "/v1/subject-rights/action-items/$(urlencode "$id")/summaries${REPLY_QUERY}"
}

ep_create_sr_ai_summary() {
  banner
  echo "${C_BOLD}POST /v1/subject-rights/action-items/{actionItemId}/summaries${C_RESET}  — Create Summary"
  prompt_required "actionItemId"
  local id="$REPLY_VALUE"
  local template='{
  "entry": "Summary of work done"
}'
  prompt_json_body "$template"
  execute_request "POST" "/v1/subject-rights/action-items/$(urlencode "$id")/summaries" "$REPLY_BODY"
}

ep_update_sr_ai_summary() {
  banner
  echo "${C_BOLD}PATCH /v1/subject-rights/action-items/{actionItemId}/summaries/{dsarSummaryEntryId}${C_RESET}  — Update Summary"
  prompt_required "actionItemId"
  local aid="$REPLY_VALUE"
  prompt_required "dsarSummaryEntryId"
  local sid="$REPLY_VALUE"
  local template='{
  "entry": "Updated description"
}'
  prompt_json_body "$template"
  execute_request "PATCH" "/v1/subject-rights/action-items/$(urlencode "$aid")/summaries/$(urlencode "$sid")" "$REPLY_BODY"
}

ep_sr_ai_activity_log() {
  banner
  echo "${C_BOLD}POST /v1/subject-rights/action-items/{actionItemId}/activity-log${C_RESET}  — Create Activity Log Entry"
  prompt_required "actionItemId"
  local id="$REPLY_VALUE"
  local template='{
  "message": "Offline activity",
  "occurredAt": 0
}'
  prompt_json_body "$template"
  execute_request "POST" "/v1/subject-rights/action-items/$(urlencode "$id")/activity-log" "$REPLY_BODY"
}

sr_action_items_menu() {
  while true; do
    banner
    echo "${C_BOLD}Subject Rights Action Items${C_RESET}"
    echo "  1) GET   /v1/subject-rights/action-items                                                   — List"
    echo "  2) GET   /v1/subject-rights/action-items/{actionItemId}                                    — Get"
    echo "  3) PATCH /v1/subject-rights/action-items/{actionItemId}                                    — Update"
    echo "  4) GET   /v1/subject-rights/action-items/{actionItemId}/summaries                          — List summaries"
    echo "  5) POST  /v1/subject-rights/action-items/{actionItemId}/summaries                          — Create summary"
    echo "  6) PATCH /v1/subject-rights/action-items/{actionItemId}/summaries/{dsarSummaryEntryId}     — Update summary"
    echo "  7) POST  /v1/subject-rights/action-items/{actionItemId}/activity-log                       — Activity log"
    echo "  0) Back"
    echo ""
    read -r -p "  Choice: " c
    case "$c" in
      1) ep_list_sr_action_items ;;
      2) ep_get_sr_action_item ;;
      3) ep_update_sr_action_item ;;
      4) ep_list_sr_ai_summaries ;;
      5) ep_create_sr_ai_summary ;;
      6) ep_update_sr_ai_summary ;;
      7) ep_sr_ai_activity_log ;;
      0) return ;;
    esac
  done
}

# =============================================================================
#   Customer Insights — /v1/customer-insights
# =============================================================================

ep_customer_insights() {
  banner
  echo "${C_BOLD}GET /v1/customer-insights${C_RESET}  — Customer Insights"
  build_query_string \
    "limit" "Max results" "100" \
    "next"  "Pagination token" "" \
    "from"  "From timestamp (epoch ms)" "" \
    "to"    "To timestamp (epoch ms)" ""
  execute_request "GET" "/v1/customer-insights${REPLY_QUERY}"
}

customer_insights_menu() {
  while true; do
    banner
    echo "${C_BOLD}Customer Insights${C_RESET}"
    echo "  1) GET /v1/customer-insights   — Get customer insights"
    echo "  0) Back"
    echo ""
    read -r -p "  Choice: " c
    case "$c" in
      1) ep_customer_insights ;;
      0) return ;;
    esac
  done
}

# =============================================================================
#   Main Menu
# =============================================================================
main_menu() {
  while true; do
    banner
    echo "${C_BOLD}Main Menu${C_RESET}"
    echo "  1) Cookie Consent                 (10 endpoints)"
    echo "  2) Connectors                     (2 endpoints)"
    echo "  3) Subject Rights Requests        (12 endpoints)"
    echo "  4) Data Discovery - Data Stores   (10 endpoints)"
    echo "  5) Subject Rights Action Items    (7 endpoints)"
    echo "  6) Customer Insights              (1 endpoint)"
    echo ""
    echo "  s) Settings (API key / base URL)"
    echo "  q) Quit"
    echo ""
    read -r -p "  Choice: " c
    case "$c" in
      1) cookie_consent_menu ;;
      2) connectors_menu ;;
      3) srr_menu ;;
      4) dd_data_stores_menu ;;
      5) sr_action_items_menu ;;
      6) customer_insights_menu ;;
      s|S) config_menu ;;
      q|Q) echo ""; echo "Goodbye."; exit 0 ;;
    esac
  done
}

# ------------------------------- Entrypoint ----------------------------------
main_menu
