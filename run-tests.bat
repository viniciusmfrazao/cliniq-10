@echo off
echo ========================================
echo   CliniQ - Testes Automatizados E2E
echo ========================================
echo.

echo [1/3] Instalando dependencias...
call npm install
if %errorlevel% neq 0 (
    echo ERRO: Falha ao instalar dependencias
    pause
    exit /b 1
)

echo.
echo [2/3] Instalando navegador Playwright...
call npx playwright install chromium
if %errorlevel% neq 0 (
    echo ERRO: Falha ao instalar Playwright
    pause
    exit /b 1
)

echo.
echo [3/3] Abrindo interface de testes...
call npx playwright test --ui

pause
