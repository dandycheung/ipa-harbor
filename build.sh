#!/usr/bin/env bash
# local build image script
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$SCRIPT_DIR"
SERVER_DIR="$REPO_ROOT/server"
BIN_DIR="$SERVER_DIR/bin"
BUILD_IPATOOL_SCRIPT="$REPO_ROOT/build_ipatool.sh"

IMAGE_NAME="${IMAGE_NAME:-ipaharbor}"
TAG="${TAG:-latest}"
FULL_IMAGE="${IMAGE_NAME}:${TAG}"

FETCH=0
SKIP_FETCH_CHOICE=0
PLATFORM_ARG=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --fetch)
      FETCH=1
      SKIP_FETCH_CHOICE=1
      shift
      ;;
    --no-fetch)
      FETCH=0
      SKIP_FETCH_CHOICE=1
      shift
      ;;
    --platform)
      [[ $# -ge 2 ]] || { echo "Missing value for --platform" >&2; exit 1; }
      PLATFORM_ARG=(--platform "$2")
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [[ "${SKIP_FETCH_CHOICE}" -eq 0 ]]; then
  if [[ -t 0 ]]; then
    read -r -p "Fetch latest ipatool before build? [Y/n] " ans || true
    case "${ans}" in
      ''|[Yy]|[Yy][Ee][Ss]) FETCH=1 ;;
      *) FETCH=0 ;;
    esac
  elif [[ -n "${AUTO_FETCH+x}" ]]; then
    case "${AUTO_FETCH}" in
      1|[Yy]|[Yy][Ee][Ss]) FETCH=1 ;;
      *) FETCH=0 ;;
    esac
  fi
fi

if [[ ! -d "$SERVER_DIR" ]]; then
  echo "server directory not found: $SERVER_DIR" >&2
  exit 1
fi

if [[ "$FETCH" -eq 1 ]]; then
  if [[ ! -x "$BUILD_IPATOOL_SCRIPT" ]]; then
    echo "Cannot execute: $BUILD_IPATOOL_SCRIPT (try: chmod +x build_ipatool.sh)" >&2
    exit 1
  fi
  echo "Running build_ipatool.sh to build ipatool from source …"
  "$BUILD_IPATOOL_SCRIPT" --choice 1
fi

# Dockerfile needs ipatool *.tar.gz under bin directory
if ! compgen -G "$BIN_DIR/ipatool-*-linux-*.tar.gz" > /dev/null; then
  echo "No ipatool-*-linux-*.tar.gz under $BIN_DIR" >&2
  echo "Run ./build_ipatool.sh first, or: $0 --fetch" >&2
  exit 1
fi

printf 'Building image: %s (context: %s)\n' "${FULL_IMAGE}" "${SERVER_DIR}"
cd "${SERVER_DIR}"

if [[ -z "${APP_VERSION:-}" ]]; then
  if APP_VERSION="$(git -C "${REPO_ROOT}" describe --tags --always 2>/dev/null)"; then
    APP_VERSION="${APP_VERSION#v}"
  else
    APP_VERSION="$(node -p "require('./package.json').version")"
  fi
fi
printf 'App version: %s\n' "${APP_VERSION}"

BUILD_ARGS=(--build-arg "APP_VERSION=${APP_VERSION}")

if [[ ${#PLATFORM_ARG[@]} -gt 0 ]]; then
  docker build "${PLATFORM_ARG[@]}" "${BUILD_ARGS[@]}" -t "${FULL_IMAGE}" --load .
else
  docker build "${BUILD_ARGS[@]}" -t "${FULL_IMAGE}" --load .
fi

printf 'Local image ready: %s\n' "${FULL_IMAGE}"
printf 'Example run:\n'
printf 'docker rm -f ipa-harbor-demo && docker run -d -p 3388:3080 -v ipa_data:/app/data -e KEYCHAIN_PASSPHRASE=1234567890 --name ipa-harbor-demo %s\n' "${FULL_IMAGE}"