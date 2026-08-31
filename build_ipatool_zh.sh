#!/usr/bin/env bash
# 从 ipatool main 分支源码编译（含 list-purchases，官方 release 尚未包含）
# 默认交互询问编译目标；Linux 包通过 Docker 在对应架构容器内原生编译
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

  从源码编译 ipatool。无参数时默认交互选择编译目标（直接回车选 1）。

Options:
  --choice N    非交互指定选项：1 | 2 | 3 | 4 | 0（0 为退出）
  --arch ARCH   仅编译 Linux：amd64 | arm64 | all（与 --darwin 组合时跳过菜单）
  --darwin      额外编译本机 macOS 二进制到 server/bin/ipatool
  -h, --help    显示帮助

环境变量:
  IPATOOL_REPO   源码仓库（默认 majd/ipatool）
  IPATOOL_REF    分支或 tag（默认 main）
  GO_IMAGE       编译用 Docker 镜像（默认 golang:1.25-bookworm）

说明:
  首次编译较慢（拉镜像 + 下载 Go 依赖）。后续会复用 server/.cache 中的源码与 Go 缓存。
  Apple Silicon 上编译 linux/amd64 需 QEMU 模拟，比 arm64 慢很多。
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
      echo "已退出。"
      exit 0
      ;;
    *)
      echo "无效选项: $choice" >&2
      exit 1
      ;;
  esac
}

prompt_choice() {
  cat <<EOF
请选择编译目标（直接回车默认 1）：
  1. Linux 包（arm64 + amd64）+ 本机 macOS 开发二进制
  2. 本机 macOS 开发二进制
  3. Linux 包（arm64）
  4. Linux 包（amd64）
  0. 退出
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
      [[ $# -ge 2 ]] || { echo "缺少 --choice 参数" >&2; exit 1; }
      CLI_ARGS=1
      apply_choice "$2"
      shift 2
      ;;
    --arch)
      [[ $# -ge 2 ]] || { echo "缺少 --arch 参数" >&2; exit 1; }
      CLI_ARGS=1
      BUILD_LINUX=1
      case "$2" in
        amd64|arm64) BUILD_ARCHES=("$2") ;;
        all) BUILD_ARCHES=(amd64 arm64) ;;
        *)
          echo "未知架构: $2（可选 amd64 | arm64 | all）" >&2
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
      echo "未知参数: $1" >&2
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
  echo "请指定 --choice，或使用 --arch / --darwin。" >&2
  exit 1
fi

if [[ "$BUILD_LINUX" -eq 1 ]] && ! command -v docker >/dev/null 2>&1; then
  echo "编译 Linux 包需要 Docker: https://docs.docker.com/get-docker/" >&2
  exit 1
fi

if [[ "$BUILD_DARWIN" -eq 1 ]] && ! command -v go >/dev/null 2>&1; then
  echo "编译 macOS 二进制需要本机安装 Go: https://go.dev/dl/" >&2
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
      echo "本机架构不支持 macOS 编译: $host_arch" >&2
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
  echo "linux 编译完成，耗时 $(( SECONDS - total_start ))s"

  sample_arch="${BUILD_ARCHES[0]}"
  sample_tar="${BIN_DIR}/ipatool-${VERSION}-linux-${sample_arch}.tar.gz"
  if tar -tzf "$sample_tar" | grep -q 'bin/ipatool-'; then
    echo "linux tar.gz 结构校验通过"
  else
    echo "警告: tar.gz 结构异常" >&2
    exit 1
  fi
fi

if [[ "$BUILD_DARWIN" -eq 1 ]]; then
  build_darwin
  if "${BIN_DIR}/ipatool" -h 2>&1 | grep -q 'list-purchases'; then
    echo "list-purchases: OK (darwin)"
  else
    echo "警告: darwin 二进制未检测到 list-purchases" >&2
    exit 1
  fi
fi

if [[ "$BUILD_LINUX" -eq 1 ]]; then
  echo "Done. 可执行 ./build.sh 构建镜像。"
else
  echo "Done."
fi
