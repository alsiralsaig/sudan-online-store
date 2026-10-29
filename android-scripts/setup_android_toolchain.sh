#!/bin/bash
# تهيئة أدوات بناء أندرويد داخل مساحة العمل (JDK 17 + Android SDK).
# تُنفَّذ مرة واحدة قبل build_native_apks.sh (المجلدات المحذوفة/غير المحفوظة تُعاد بناؤها).
set -euo pipefail

TC=/home/user/.toolchain
export TMPDIR=/home/user/.tmp
mkdir -p "$TC" "$TMPDIR"

if [ ! -x "$TC/jdk17/bin/java" ]; then
  echo "== تحميل JDK 17 =="
  curl -sL -o "$TMPDIR/jdk17.tar.gz" "https://api.adoptium.net/v3/binary/latest/17/ga/linux/x64/jdk/hotspot/normal/eclipse"
  mkdir -p "$TC/jdk17"
  tar -xzf "$TMPDIR/jdk17.tar.gz" -C "$TC/jdk17" --strip-components=1
  rm -f "$TMPDIR/jdk17.tar.gz"
fi
"$TC/jdk17/bin/java" -version 2>&1 | head -n 1

if [ ! -d "$TC/android-sdk/platforms/android-33" ]; then
  echo "== تحميل Android SDK =="
  mkdir -p "$TC/android-sdk/cmdline-tools"
  curl -sL -o "$TMPDIR/cmdtools.zip" "https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"
  ( cd "$TC/android-sdk/cmdline-tools" && unzip -q -o "$TMPDIR/cmdtools.zip" && rm -rf latest && mv cmdline-tools latest )
  rm -f "$TMPDIR/cmdtools.zip"
  export JAVA_HOME="$TC/jdk17"
  export PATH="$JAVA_HOME/bin:$PATH"
  yes | "$TC/android-sdk/cmdline-tools/latest/bin/sdkmanager" --sdk_root="$TC/android-sdk" --licenses >/dev/null 2>&1 || true
  "$TC/android-sdk/cmdline-tools/latest/bin/sdkmanager" --sdk_root="$TC/android-sdk" \
    "platform-tools" "platforms;android-33" "build-tools;33.0.1" "build-tools;34.0.0" >/dev/null 2>&1
fi
ls "$TC/android-sdk/platforms" "$TC/android-sdk/build-tools"
echo "TOOLCHAIN READY"
