#!/usr/bin/env bash
# Debug APK: portrait Gwent. Requires ANDROID_HOME and JDK 17+.
set -euo pipefail
cd "$(dirname "$0")"

VERSION="$(node -p "require('./package.json').version")"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/android-sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"

if [[ ! -d "$ANDROID_HOME" ]]; then
  echo "Нет Android SDK в ANDROID_HOME=$ANDROID_HOME" >&2
  exit 1
fi

if [[ -f package-lock.json ]]; then
  npm ci
else
  npm install
fi

npx cap sync android

(
  cd android
  chmod +x gradlew
  ./gradlew --no-daemon assembleDebug
)

APK="android/app/build/outputs/apk/debug/app-debug.apk"
mkdir -p artifacts
cp "$APK" "artifacts/gwent-classic-portrait-$VERSION.apk"
echo "APK: $(pwd)/$APK"
echo "Копия: $(pwd)/artifacts/gwent-classic-portrait-$VERSION.apk"
ls -lh "$APK" "artifacts/gwent-classic-portrait-$VERSION.apk"
