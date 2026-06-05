#!/bin/sh
set -e

echo "==> Installing Node.js dependencies..."
cd $CI_PRIMARY_REPOSITORY_PATH
npm install

echo "==> Syncing Capacitor iOS..."
npx cap sync ios

echo "==> Done!"
