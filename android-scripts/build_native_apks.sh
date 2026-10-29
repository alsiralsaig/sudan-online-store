#!/bin/bash
# بناء ثلاثة تطبيقات أندرويد أصلية (كاشير / متجر / إدارة) من نفس مشروع Capacitor.
# كل تطبيق: معرّف مستقل + اسم مستقل + أيقونة مستقلة + مفتاح توقيع مستقل.
set -euo pipefail

export JAVA_HOME=/home/user/.toolchain/jdk17
export ANDROID_HOME=/home/user/.toolchain/android-sdk
export ANDROID_SDK_ROOT=$ANDROID_HOME
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"
export TMPDIR=/home/user/.tmp
export GRADLE_USER_HOME=/home/user/.gradlehome
mkdir -p "$TMPDIR"

ROOT=/home/user/sudan-online-store
ANDROID=$ROOT/android
KEYS=/home/user/sanad-signing-keys
OUT=/tmp/apkout
mkdir -p "$OUT"

build_app () {
  local key="$1" appid="$2" label="$3" iconbg="$4" splashbg="$5"
  local kdir="$KEYS/$key"
  local storepass keypass
  storepass=$(grep "Key store password" "$kdir/signing-key-info.txt" | sed 's/.*: //' | tr -d '\r\n')
  keypass=$(grep "Key password" "$kdir/signing-key-info.txt" | sed 's/.*: //' | tr -d '\r\n')
  local alias
  alias=$(grep "Key alias" "$kdir/signing-key-info.txt" | sed 's/.*: //' | tr -d '\r\n')

  # ملفخصائص لكل تطبيق — يتجنّب مشاكل الاقتباس في سطر الأوامر
  cat > "$ANDROID/sanad-build.properties" <<EOF
sanadAppId=$appid
sanadAppKey=$key
sanadAppLabel=$label
sanadIconBg=$iconbg
sanadSplashBg=$splashbg
sanadKeystore=$kdir/signing.keystore
sanadStorePassword=$storepass
sanadKeyAlias=$alias
sanadKeyPassword=$keypass
EOF

  # الأيقونة: نستبدل صور mipmap الخاصة بهذا التطبيق
  python3 "/home/user/prepare_icons.py" "$key"

  # إعدادات Capacitor لهذا التطبيق: يفتح وضعه مباشرة (كاشير/متجر/إدارة)
  python3 "/home/user/set_native_config.py" "$key" "$ANDROID/app/src/main/assets/capacitor.config.json"

  echo "=== building $key ($appid) ==="
  ( cd "$ANDROID" && bash ./gradlew --project-cache-dir="$TMPDIR/pc" -q --no-daemon assembleRelease -PsanadProps=$ANDROID/sanad-build.properties ) || {
    echo "BUILD FAILED: $key"; return 1; }
  cp "$ANDROID/app/build/outputs/apk/release/sanad-$key.apk" "$OUT/sanad-$key.apk"
  ls -l "$OUT/sanad-$key.apk"
}

build_app merchant sd.sanad.merchant "كاشير سند" "#0ea5e9" "#020617"
build_app client   sd.sanad.client   "متجر سند"  "#38bdf8" "#f8fafc"
build_app admin    sd.sanad.admin    "إدارة سند" "#0f172a" "#0f172a"
echo "ALL BUILT"
