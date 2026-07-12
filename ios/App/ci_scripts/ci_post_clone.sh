#!/bin/sh
set -e

export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

echo "==> Verificando Node.js..."
if command -v node &> /dev/null; then
    echo "Node já disponível: $(node --version)"
else
    echo "Instalando Node 22 via Homebrew..."
    # Node 22 LTS — mais estável e menos deps que o latest
    brew install node@22
    export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
fi

echo "Node: $(node --version)"
echo "npm: $(npm --version)"

echo "==> Instalando dependências..."
cd "$CI_PRIMARY_REPOSITORY_PATH"
npm install --legacy-peer-deps

echo "==> Criando pasta out (necessária pro cap sync)..."
mkdir -p out
echo '<html><body>Clinike</body></html>' > out/index.html

echo "==> Sincronizando Capacitor iOS..."
npx cap sync ios

echo "==> Permitindo resolução automática de pacotes SPM (Package.swift muda a cada 'cap sync', Package.resolved commitado sempre fica desatualizado)..."
defaults delete com.apple.dt.Xcode IDEPackageOnlyUseVersionsFromResolvedFile 2>/dev/null || true
defaults delete com.apple.dt.Xcode IDEDisableAutomaticPackageResolution 2>/dev/null || true

echo "==> Concluído!"
