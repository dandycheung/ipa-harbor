#!/usr/bin/env bash
# Build ipatool from main branch source (includes list-purchases; not yet in official releases)
# Interactive target selection by default; Linux packages are built natively in Docker per arch
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN_DIR="${SCRIPT_DIR}/server/bin"
CACHE_DIR="${SCRIPT_DIR}/server/.cache"
SRC_DIR="${CACHE_DIR}/ipatool-src"
GO_MOD_CACHE="${CACHE_DIR}/go-mod"
GO_BUILD_CACHE="${CACHE_DIR}/go-build"
BUILD_DARWIN=0
BUILD_LINUX=0
BUILD_ARCHES=()
IPATOOL_REPO="${IPATOOL_REPO:-https://github.com/majd/ipatool.git}"
IPATOOL_REF="${IPATOOL_REF:-main}"
GO_IMAGE="${GO_IMAGE:-golang:1.25-bookworm}"

usage() {
  cat <<EOF
Usage: $(basename "$0") [options]

  Build ipatool from source. With no options, an interactive menu is shown (Enter = option 1).

Options:
  --choice N    Non-interactive choice: 1 | 2 | 3 | 4 | 0 (0 = exit)
  --arch ARCH   Linux only: amd64 | arm64 | all (skips menu when combined with --darwin)
  --darwin      Also build a local macOS binary at server/bin/ipatool
  -h, --help    Show this help

Environment:
  IPATOOL_REPO   Source repository (default: majd/ipatool)
  IPATOOL_REF    Branch or tag (default: main)
  GO_IMAGE       Docker image for builds (default: golang:1.25-bookworm)

Notes:
  The first build is slow (pull image + Go modules). Later builds reuse server/.cache.
  On Apple Silicon, linux/amd64 uses QEMU and is much slower than arm64.
EOF
}

apply_choice() {
  local choice="$1"
  BUILD_LINUX=0
  BUILD_DARWIN=0
  BUILD_ARCHES=()

  case "$choice" in
    1)
      BUILD_LINUX=1
      BUILD_ARCHES=(amd64 arm64)
      BUILD_DARWIN=1
      ;;
    2)
      BUILD_DARWIN=1
      ;;
    3)
      BUILD_LINUX=1
      BUILD_ARCHES=(arm64)
      ;;
    4)
      BUILD_LINUX=1
      BUILD_ARCHES=(amd64)
      ;;
    0)
      echo "Exited."
      exit 0
      ;;
    *)
      echo "Invalid choice: $choice" >&2
      exit 1
      ;;
  esac
}

prompt_choice() {
  cat <<EOF
Select build target (Enter = 1):
  1. Linux packages (arm64 + amd64) + local macOS dev binary
  2. Local macOS dev binary only
  3. Linux package (arm64)
  4. Linux package (amd64)
  0. Exit
EOF
  local ans=""
  read -r -p "> " ans || true
  ans="${ans:-1}"
  apply_choice "$ans"
}

CLI_ARGS=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --choice)
      [[ $# -ge 2 ]] || { echo "Missing value for --choice" >&2; exit 1; }
      CLI_ARGS=1
      apply_choice "$2"
      shift 2
      ;;
    --arch)
      [[ $# -ge 2 ]] || { echo "Missing value for --arch" >&2; exit 1; }
      CLI_ARGS=1
      BUILD_LINUX=1
      case "$2" in
        amd64|arm64) BUILD_ARCHES=("$2") ;;
        all) BUILD_ARCHES=(amd64 arm64) ;;
        *)
          echo "Unknown arch: $2 (expected amd64 | arm64 | all)" >&2
          exit 1
          ;;
      esac
      shift 2
      ;;
    --darwin)
      CLI_ARGS=1
      BUILD_DARWIN=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ "$CLI_ARGS" -eq 0 ]]; then
  if [[ -t 0 ]]; then
    prompt_choice
  else
    apply_choice 1
  fi
elif [[ "$BUILD_LINUX" -eq 0 ]] && [[ "$BUILD_DARWIN" -eq 0 ]]; then
  echo "Specify --choice, or use --arch / --darwin." >&2
  exit 1
fi

if [[ "$BUILD_LINUX" -eq 1 ]] && ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required for Linux builds: https://docs.docker.com/get-docker/" >&2
  exit 1
fi

if [[ "$BUILD_DARWIN" -eq 1 ]] && ! command -v go >/dev/null 2>&1; then
  echo "Go is required for macOS builds: https://go.dev/dl/" >&2
  exit 1
fi

mkdir -p "$BIN_DIR" "$GO_MOD_CACHE" "$GO_BUILD_CACHE"

sync_source() {
  if [[ -d "${SRC_DIR}/.git" ]]; then
    echo "Updating cached source (${IPATOOL_REF}) …"
    git -C "$SRC_DIR" fetch --depth 1 origin "$IPATOOL_REF"
    git -C "$SRC_DIR" checkout -f FETCH_HEAD
  else
    echo "Cloning ${IPATOOL_REPO} (${IPATOOL_REF}) …"
    rm -rf "$SRC_DIR"
    git clone --depth 1 --branch "$IPATOOL_REF" "$IPATOOL_REPO" "$SRC_DIR" 2>/dev/null \
      || git clone --depth 1 "$IPATOOL_REPO" "$SRC_DIR"
  fi

  git -C "$SRC_DIR" fetch --depth 1 origin 'refs/tags/v*' 2>/dev/null || true
}

sync_source

VERSION=$(git -C "$SRC_DIR" describe --tags --always | sed 's/^v//')
if [[ "$VERSION" =~ ^[0-9a-f]{7,}$ ]]; then
  VERSION="2.4.0-dev.${VERSION}"
fi
echo "Build version: ${VERSION}"

LDFLAGS="-s -w -X github.com/majd/ipatool/v2/cmd.version=${VERSION}"

build_linux_docker() {
  local arch="$1"
  local bin_name="ipatool-${VERSION}-linux-${arch}"
  local staging="${SRC_DIR}/dist/linux-${arch}"
  local tar_path="${BIN_DIR}/ipatool-${VERSION}-linux-${arch}.tar.gz"
  local start_ts=$SECONDS

  rm -rf "$staging"
  mkdir -p "${staging}/bin"

  echo "Building linux/${arch} (docker --platform linux/${arch}) …"
  docker run --rm \
    --platform "linux/${arch}" \
    -v "${SRC_DIR}:/src" \
    -v "${GO_MOD_CACHE}:/go/pkg/mod" \
    -v "${GO_BUILD_CACHE}:/go/cache" \
    -w /src \
    -e GOCACHE=/go/cache \
    -e GOMODCACHE=/go/pkg/mod \
    -e "LDFLAGS=${LDFLAGS}" \
    "$GO_IMAGE" \
    go build -trimpath -ldflags="$LDFLAGS" -o "/src/dist/linux-${arch}/bin/${bin_name}" .

  chmod +x "${staging}/bin/${bin_name}"
  rm -f "$tar_path"
  tar -czf "$tar_path" -C "$staging" bin
  echo "  -> ${tar_path} ($(( SECONDS - start_ts ))s)"
}

build_darwin() {
  local host_arch goarch out start_ts
  host_arch="$(uname -m)"
  case "$host_arch" in
    arm64) goarch=arm64 ;;
    x86_64) goarch=amd64 ;;
    *)
      echo "Unsupported host arch for macOS build: $host_arch" >&2
      exit 1
      ;;
  esac

  out="${BIN_DIR}/ipatool"
  if [[ -f "$out" ]]; then
    cp "$out" "${out}.bak.$(date +%Y%m%d%H%M%S)"
  fi

  start_ts=$SECONDS
  echo "Building darwin/${goarch} …"
  (
    cd "$SRC_DIR"
    CGO_ENABLED=1 GOOS=darwin GOARCH="$goarch" \
      GOMODCACHE="$GO_MOD_CACHE" GOCACHE="$GO_BUILD_CACHE" \
      go build -trimpath -ldflags="$LDFLAGS" -o "$out" .
  )
  chmod +x "$out"
  echo "  -> ${out} ($(( SECONDS - start_ts ))s)"
}

if [[ "$BUILD_LINUX" -eq 1 ]]; then
  for old_tar in "$BIN_DIR"/ipatool-*-linux-*.tar.gz; do
    [[ -e "$old_tar" ]] || continue
    rm -f "$old_tar" "${old_tar}.sha256sum"
  done

  total_start=$SECONDS
  pids=()
  for arch in "${BUILD_ARCHES[@]}"; do
    build_linux_docker "$arch" &
    pids+=($!)
  done

  build_failed=0
  for pid in "${pids[@]}"; do
    wait "$pid" || build_failed=1
  done
  [[ "$build_failed" -eq 0 ]] || exit 1
  echo "Linux build finished in $(( SECONDS - total_start ))s"

  sample_arch="${BUILD_ARCHES[0]}"
  sample_tar="${BIN_DIR}/ipatool-${VERSION}-linux-${sample_arch}.tar.gz"
  if tar -tzf "$sample_tar" | grep -q 'bin/ipatool-'; then
    echo "Linux tar.gz layout OK"
  else
    echo "Warning: unexpected tar.gz layout" >&2
    exit 1
  fi
fi

if [[ "$BUILD_DARWIN" -eq 1 ]]; then
  build_darwin
  if "${BIN_DIR}/ipatool" -h 2>&1 | grep -q 'list-purchases'; then
    echo "list-purchases: OK (darwin)"
  else
    echo "Warning: list-purchases not found in darwin binary" >&2
    exit 1
  fi
fi

if [[ "$BUILD_LINUX" -eq 1 ]]; then
  echo "Done. Run ./build.sh to build the Docker image."
else
  echo "Done."
fi
