#!/bin/sh
set -e

# Configurar PATH para Homebrew no Xcode Cloud
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

echo "==> Verificando Node.js..."
if ! command -v node &> /dev/null; then
    echo "Node não encontrado, instalando via Homebrew..."
    brew install node
fi

echo "Node: $(node --version)"
echo "npm: $(npm --version)"

echo "==> Instalando dependências..."
cd $CI_PRIMARY_REPOSITORY_PATH
npm install

echo "==> Sincronizando Capacitor iOS..."
npx cap sync ios

echo "==> Concluído!"
