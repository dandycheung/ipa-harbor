#!/usr/bin/env bash
# 构建镜像到本地
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$SCRIPT_DIR"
SERVER_DIR="$REPO_ROOT/server"
BIN_DIR="$SERVER_DIR/bin"
DL_SCRIPT="$REPO_ROOT/dl_latest.sh"

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
      [[ $# -ge 2 ]] || { echo "缺少 --platform 的值"; exit 1; }
      PLATFORM_ARG=(--platform "$2")
      shift 2
      ;;
    *)
      echo "未知参数: $1" >&2
      exit 1
      ;;
  esac
done

if [[ "${SKIP_FETCH_CHOICE}" -eq 0 ]]; then
  if [[ -t 0 ]]; then
    read -r -p "构建镜像前是否更新 ipatool？[Y/n] " ans || true
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
  echo "未找到 server 目录: $SERVER_DIR"
  exit 1
fi

if [[ "$FETCH" -eq 1 ]]; then
  if [[ ! -x "$DL_SCRIPT" ]]; then
    echo "无法执行: $DL_SCRIPT（可先 chmod +x dl_latest.sh）"
    exit 1
  fi
  echo "执行 dl_latest.sh 拉取 ipatool …"
  "$DL_SCRIPT"
fi

# Dockerfile 需要 bin 下对应架构的 ipatool *.tar.gz
if ! compgen -G "$BIN_DIR/ipatool-*-linux-*.tar.gz" > /dev/null; then
  echo "未在 $BIN_DIR 发现 ipatool-*-linux-*.tar.gz"
  echo "请先运行: ./dl_latest.sh 或使用 $0 --fetch"
  exit 1
fi

printf '开始构建镜像: %s（当前目录: %s）\n' "${FULL_IMAGE}" "${SERVER_DIR}"
cd "${SERVER_DIR}"

if [[ ${#PLATFORM_ARG[@]} -gt 0 ]]; then
  docker build "${PLATFORM_ARG[@]}" -t "${FULL_IMAGE}" --load .
else
  docker build -t "${FULL_IMAGE}" --load .
fi

printf '本地镜像已构建完成: %s\n' "${FULL_IMAGE}"
printf '示例运行: \n'
printf 'docker rm -f ipa-harbor-demo && docker run -d -p 3388:3080 -v ipa_data:/app/data -e KEYCHAIN_PASSPHRASE=1234567890 --name ipa-harbor-demo %s\n' "${FULL_IMAGE}"