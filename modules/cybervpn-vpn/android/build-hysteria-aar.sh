#!/usr/bin/env bash
set -euo pipefail

MODULE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GO_VERSION="1.26.8"
HYSTERIA_COMMIT="$(tr -d '[:space:]' < "$MODULE_DIR/hysteria-upstream-commit.txt")"
TOOL_DIR="$MODULE_DIR/.toolchain"
GO_ROOT="$TOOL_DIR/go"
UPSTREAM_DIR="$MODULE_DIR/upstream"
GOLIB_DIR="$MODULE_DIR/golib"
LIBS_DIR="$MODULE_DIR/libs"
mkdir -p "$TOOL_DIR" "$LIBS_DIR"

if [[ -z "${ANDROID_NDK_HOME:-}" ]]; then
  SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
  if [[ -n "$SDK" && -d "$SDK/ndk" ]]; then
    ANDROID_NDK_HOME="$(find "$SDK/ndk" -mindepth 1 -maxdepth 1 -type d | sort -V | tail -n 1)"
  fi
fi
if [[ -z "${ANDROID_NDK_HOME:-}" || ! -d "$ANDROID_NDK_HOME" ]]; then
  echo 'Android NDK is required to build the Hysteria2 core. Install NDK side-by-side and set ANDROID_NDK_HOME.' >&2
  exit 2
fi

case "$(uname -s)/$(uname -m)" in
  Linux/x86_64) GO_ARCH=linux-amd64 ;;
  Linux/aarch64|Linux/arm64) GO_ARCH=linux-arm64 ;;
  Darwin/x86_64) GO_ARCH=darwin-amd64 ;;
  Darwin/arm64) GO_ARCH=darwin-arm64 ;;
  *) echo "Unsupported Go build host: $(uname -s)/$(uname -m)" >&2; exit 2 ;;
esac

if [[ ! -x "$GO_ROOT/bin/go" ]]; then
  ARCHIVE="$TOOL_DIR/go${GO_VERSION}.${GO_ARCH}.tar.gz"
  echo "Downloading Go ${GO_VERSION} (${GO_ARCH})..."
  curl --fail --location --retry 3 "https://go.dev/dl/go${GO_VERSION}.${GO_ARCH}.tar.gz" -o "$ARCHIVE"
  mkdir -p "$GO_ROOT"
  tar -xzf "$ARCHIVE" --strip-components=1 -C "$GO_ROOT"
  rm -f "$ARCHIVE"
fi
export GOROOT="$GO_ROOT"
export GOPATH="${GOPATH:-$TOOL_DIR/gopath}"
export GOBIN="$GOPATH/bin"
export PATH="$GOROOT/bin:$GOBIN:$PATH"
export ANDROID_NDK_HOME
export ANDROID_HOME="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$(dirname "$(dirname "$ANDROID_NDK_HOME")")}}"
mkdir -p "$GOBIN"

if [[ ! -x "$GOBIN/gomobile" || ! -x "$GOBIN/gobind" ]]; then
  go install "golang.org/x/mobile/cmd/gomobile@v0.0.0-20260908204917-8b95e45f8d3e"
  go install "golang.org/x/mobile/cmd/gobind@v0.0.0-20260908204917-8b95e45f8d3e"
fi

if [[ ! -f "$UPSTREAM_DIR/core/go.mod" || ! -f "$UPSTREAM_DIR/extras/go.mod" ]]; then
  TMP_DIR="$(mktemp -d)"
  trap 'rm -rf "$TMP_DIR"' EXIT
  echo "Fetching Hysteria upstream commit ${HYSTERIA_COMMIT}..."
  curl --fail --location --retry 3 "https://github.com/apernet/hysteria/archive/${HYSTERIA_COMMIT}.tar.gz" \
    | tar -xz --strip-components=1 -C "$TMP_DIR"
  mkdir -p "$UPSTREAM_DIR"
  cp -a "$TMP_DIR/core" "$UPSTREAM_DIR/core"
  cp -a "$TMP_DIR/extras" "$UPSTREAM_DIR/extras"
  cp "$TMP_DIR/LICENSE" "$UPSTREAM_DIR/LICENSE" 2>/dev/null || true
fi

cd "$GOLIB_DIR"
"$GOBIN/gomobile" bind \
  -target=android/arm64,android/arm \
  -androidapi 29 \
  -tags with_gvisor \
  '-ldflags=-s -w -checklinkname=0' \
  -o "$LIBS_DIR/golib.aar" \
  .
echo "Built $LIBS_DIR/golib.aar"
