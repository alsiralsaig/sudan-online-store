#!/bin/bash
# بناء تطبيقات «الغلاف» (WebView + خادم سند) بثلاث هويات مختلفة.
# الطريقة: نفس مشروع أندرويد صغير (app/wrapper) يُبنى ثلاث مرات بملف خصائص مختلف.
set -euo pipefail

export JAVA_HOME=${JAVA_HOME:-/home/user/.toolchain/jdk17}
export ANDROID_HOME=${ANDROID_HOME:-/home/user/.toolchain/android-sdk}
export PATH="$JAVA_HOME/bin:$PATH"
export TMPDIR=${TMPDIR:-/home/user/.tmp}
export GRADLE_USER_HOME=${GRADLE_USER_HOME:-/home/user/.gradlehome}
mkdir -p "$TMPDIR"

HERE=$(cd "$(dirname "$0")" && pwd)
KEYS=${SANAD_KEYS:-/home/user/sanad-signing-keys}
OUT=${OUT:-/tmp/wrapper-out}
HOST=${SANAD_HOST:-sudan-online-store-eta.vercel.app}
mkdir -p "$OUT"

build_one () {
  local key="$1" appid="$2" start="$3" theme="$4" ua="$5" label="$6" vcode="$7" vname="$8"
  local kdir="$KEYS/$key"
  local storepass="" keypass="" alias=""

  if [ -f "$kdir/signing-key-info.txt" ]; then
    storepass=$(grep "Key store password" "$kdir/signing-key-info.txt" | sed 's/.*: //' | tr -d '\r\n')
    keypass=$(grep "Key password" "$kdir/signing-key-info.txt" | sed 's/.*: //' | tr -d '\r\n')
    alias=$(grep "Key alias" "$kdir/signing-key-info.txt" | sed 's/.*: //' | tr -d '\r\n')
  fi

  cat > "$HERE/sanad.props" <<PROPS
appId=$appid
appKey=$key
versionCode=$vcode
versionName=$vname
host=$HOST
startUrl=https://$HOST/?app=$start
theme=$theme
uaTag=$ua
PROPS
  if [ -n "$storepass" ]; then
    cat >> "$HERE/sanad.props" <<PROPS
keystore=$kdir/signing.keystore
storePassword=$storepass
keyAlias=$alias
keyPassword=$keypass
PROPS
  fi

  # اسم التطبيق: نكتبه في values-<key> ثم نختاره بفلتر موارد
  python3 - "$HERE" "$key" "$label" <<'PY'
import sys, pathlib
here, key, label = sys.argv[1], sys.argv[2], sys.argv[3]
p = pathlib.Path(here) / 'app/src/main/res/values/strings.xml'
p.write_text('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
             f'    <string name="app_name">{label}</string>\n</resources>\n', encoding='utf-8')
PY

  echo "=== $key -> $appid ($label) ==="
  ( cd "$HERE" && bash ./gradlew --no-daemon -q assembleRelease -PsanadProps="$HERE/sanad.props" )
  cp "$HERE/app/build/outputs/apk/release/sanad-$key.apk" "$OUT/sanad-$key.apk"
  ls -l "$OUT/sanad-$key.apk"
}

# النطاق نفسه، لكن كل تطبيق يفتح وضعه (?app=...) بلونه واسمه
build_one merchant "com.sanad.merchant"     "merchant"    "#047857" "SanadMerchant"    "تاجر السند"  10008 "1.0.8"
build_one client   "com.sanad.marketplace"  "client"      "#0369a1" "SanadMarketplace" "السند"       10008 "1.0.8"
build_one admin    "com.sanad.platformadmin" "super_admin" "#0f172a" "SanadPlatformAdmin" "إدارة السند" 10004 "1.0.4"
echo "DONE"
