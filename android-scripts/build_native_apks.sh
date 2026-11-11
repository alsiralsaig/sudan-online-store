#!/usr/bin/env bash
# Build three independently branded Sanad Android APKs from the Capacitor project.
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
ANDROID="$ROOT/android"
TC="${SANAD_TOOLCHAIN_DIR:-/home/user/.toolchain}"
export JAVA_HOME="${JAVA_HOME:-$TC/jdk21}"
export ANDROID_HOME="${ANDROID_HOME:-$TC/android-sdk}"
export ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$ANDROID_HOME}"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"
export TMPDIR="${TMPDIR:-/home/user/.tmp}"
export GRADLE_USER_HOME="${GRADLE_USER_HOME:-/home/user/.gradlehome}"
KEYS="${SANAD_SIGNING_KEYS_DIR:-/home/user/sanad-signing-keys}"
OUT="${SANAD_APK_OUT_DIR:-$ROOT/apk-output}"
BUILD_TYPE="${SANAD_BUILD_TYPE:-}"
mkdir -p "$TMPDIR" "$OUT"

if [[ ! -x "$JAVA_HOME/bin/java" ]]; then
  echo "JDK 21 not found at $JAVA_HOME. Run npm run native:setup or set JAVA_HOME." >&2
  exit 1
fi
if [[ ! -x "$ANDROID_HOME/platform-tools/adb" && ! -x "$ANDROID_HOME/build-tools/35.0.0/aapt" ]]; then
  echo "Android SDK API 35 not found at $ANDROID_HOME. Run npm run native:setup or set ANDROID_HOME." >&2
  exit 1
fi

# Package the native-mode frontend (absolute API base) and ensure generated Capacitor files exist.
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=2048}"
( cd "$ROOT" && npm run native:web && npx cap sync android )

# Branding helpers edit tracked Android resources; preserve and restore the originals.
RESTORE_DIR="$(mktemp -d "$TMPDIR/sanad-resources.XXXXXX")"
cp -a "$ANDROID"/app/src/main/res/mipmap-* "$RESTORE_DIR/"
cp -a "$ANDROID/app/src/main/res/values/strings.xml" "$RESTORE_DIR/strings.xml"
restore_native_resources() {
  local dir
  for dir in "$ANDROID"/app/src/main/res/mipmap-*; do
    [[ -d "$dir" ]] && rm -rf "$dir"
  done
  cp -a "$RESTORE_DIR"/mipmap-* "$ANDROID/app/src/main/res/"
  cp -a "$RESTORE_DIR/strings.xml" "$ANDROID/app/src/main/res/values/strings.xml"
  rm -rf "$RESTORE_DIR"
}
trap restore_native_resources EXIT

# Use release only when signing keys are present for all three apps; otherwise build
# installable debug-signed APKs. Set SANAD_BUILD_TYPE=release to require signed releases.
if [[ -z "$BUILD_TYPE" ]]; then
  if [[ -f "$KEYS/merchant/signing-key-info.txt" && -f "$KEYS/client/signing-key-info.txt" && -f "$KEYS/admin/signing-key-info.txt" ]]; then
    BUILD_TYPE=release
  else
    BUILD_TYPE=debug
    echo "Signing keys not found; building debug-signed APKs (not Play Store release artifacts)."
  fi
fi
if [[ "$BUILD_TYPE" != debug && "$BUILD_TYPE" != release ]]; then
  echo "SANAD_BUILD_TYPE must be 'debug' or 'release'." >&2
  exit 1
fi
if [[ "$BUILD_TYPE" == release ]]; then
  for key in merchant client admin; do
    if [[ ! -f "$KEYS/$key/signing-key-info.txt" || ! -f "$KEYS/$key/signing.keystore" ]]; then
      echo "Missing release signing material for $key under $KEYS." >&2
      exit 1
    fi
  done
fi

build_app () {
  local key="$1" appid="$2" label="$3" iconbg="$4" splashbg="$5"
  local kdir="$KEYS/$key"
  local props="$ANDROID/sanad-build.properties"

  cat > "$props" <<EOF
sanadAppId=$appid
sanadAppKey=$key
sanadIconBg=$iconbg
sanadSplashBg=$splashbg
EOF

  if [[ "$BUILD_TYPE" == release ]]; then
    local storepass keypass alias
    storepass=$(grep "Key store password" "$kdir/signing-key-info.txt" | sed 's/.*: //' | tr -d '\r\n')
    keypass=$(grep "Key password" "$kdir/signing-key-info.txt" | sed 's/.*: //' | tr -d '\r\n')
    alias=$(grep "Key alias" "$kdir/signing-key-info.txt" | sed 's/.*: //' | tr -d '\r\n')
    cat >> "$props" <<EOF
sanadKeystore=$kdir/signing.keystore
sanadStorePassword=$storepass
sanadKeyAlias=$alias
sanadKeyPassword=$keypass
EOF
  fi

  python3 "$SCRIPT_DIR/write_app_strings.py" "$label" "$appid"
  python3 "$SCRIPT_DIR/make_icons.py" "$key"
  python3 "$SCRIPT_DIR/set_native_config.py" "$key" "$ANDROID/app/src/main/assets/capacitor.config.json"

  local task="assemble${BUILD_TYPE^}"
  echo "=== building $key ($appid), $BUILD_TYPE ==="
  ( cd "$ANDROID" && bash ./gradlew --project-cache-dir="$TMPDIR/pc" -q --no-daemon "$task" -PsanadProps="$props" )
  local apk="$ANDROID/app/build/outputs/apk/$BUILD_TYPE/sanad-$key.apk"
  if [[ ! -f "$apk" ]]; then
    echo "Expected APK was not produced: $apk" >&2
    return 1
  fi
  local suffix=""
  [[ "$BUILD_TYPE" == debug ]] && suffix="-debug"
  cp "$apk" "$OUT/sanad-$key$suffix.apk"
  ls -lh "$OUT/sanad-$key$suffix.apk"
}

build_app merchant sd.sanad.merchant "كاشير سند" "#0b3d91" "#0b1220"
build_app client   sd.sanad.client   "متجر سند"  "#0284c7" "#0b1220"
build_app admin    sd.sanad.admin    "إدارة سند" "#0f172a" "#0b1220"
echo "ALL BUILT ($BUILD_TYPE)"
