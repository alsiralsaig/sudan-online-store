#!/usr/bin/env bash
# Install the local JDK 21 + Android SDK required by Capacitor 7.
set -euo pipefail

TC="${SANAD_TOOLCHAIN_DIR:-/home/user/.toolchain}"
TMPDIR="${TMPDIR:-/home/user/.tmp}"
mkdir -p "$TC" "$TMPDIR"

if [[ ! -x "$TC/jdk21/bin/java" ]]; then
  echo "== Downloading JDK 21 =="
  curl -fL --retry 3 -o "$TMPDIR/jdk21.tar.gz" \
    "https://api.adoptium.net/v3/binary/latest/21/ga/linux/x64/jdk/hotspot/normal/eclipse"
  mkdir -p "$TC/jdk21"
  tar -xzf "$TMPDIR/jdk21.tar.gz" -C "$TC/jdk21" --strip-components=1
  rm -f "$TMPDIR/jdk21.tar.gz"
fi
"$TC/jdk21/bin/java" -version 2>&1 | head -n 1

SDK="$TC/android-sdk"
export JAVA_HOME="$TC/jdk21"
export PATH="$JAVA_HOME/bin:$PATH"
if [[ ! -x "$SDK/cmdline-tools/latest/bin/sdkmanager" ]]; then
  echo "== Download Android SDK command-line tools =="
  mkdir -p "$SDK/cmdline-tools"
  curl -fL --retry 3 -o "$TMPDIR/cmdtools.zip" \
    "https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"
  unzip -q -o "$TMPDIR/cmdtools.zip" -d "$SDK/cmdline-tools"
  rm -rf "$SDK/cmdline-tools/latest"
  mv "$SDK/cmdline-tools/cmdline-tools" "$SDK/cmdline-tools/latest"
  rm -f "$TMPDIR/cmdtools.zip"
fi

SDKMANAGER="$SDK/cmdline-tools/latest/bin/sdkmanager"
yes | "$SDKMANAGER" --sdk_root="$SDK" --licenses >/dev/null 2>&1 || true
"$SDKMANAGER" --sdk_root="$SDK" \
  "platform-tools" "platforms;android-35" "build-tools;35.0.0"
ls "$SDK/platforms" "$SDK/build-tools"
echo "TOOLCHAIN READY (JDK 21, Android API 35)"
