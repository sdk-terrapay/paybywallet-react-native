#!/usr/bin/env bash
# Removes android:allowBackup from the vendored PayByWallet .aar's <application>.
#
# The SDK sets allowBackup="true", a decision that belongs to the host app.
# React Native's app template sets it to "false", so with the attribute in place
# every app fails manifest merging. A library's own manifest cannot strip it
# (the .aar merges as a sibling at app level), so it is removed at the source.
#
# Run after replacing android/libs/payByWallet-release.aar. Idempotent.
set -euo pipefail
cd "$(dirname "$0")/../android/libs"
AAR=payByWallet-release.aar
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

unzip -q -o "$AAR" AndroidManifest.xml -d "$work"
if ! grep -q 'android:allowBackup' "$work/AndroidManifest.xml"; then
  echo "allowBackup already absent; nothing to do."
  exit 0
fi
sed -i.bak '/android:allowBackup=/d' "$work/AndroidManifest.xml"
(cd "$work" && zip -q "$OLDPWD/$AAR" AndroidManifest.xml)
echo "Patched $AAR"
