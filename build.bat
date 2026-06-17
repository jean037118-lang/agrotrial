@echo off
title AgroTrial CRM - Build

node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERRO: Node.js nao encontrado. Instale em nodejs.org
    pause
    exit /b 1
)
echo OK: Node.js encontrado

rustc --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERRO: Rust nao encontrado. Instale em rustup.rs
    pause
    exit /b 1
)
echo OK: Rust encontrado

echo.
echo Instalando dependencias npm...
call npm install

echo.
echo Gerando icones...
python gerar-icones.py

echo.
echo Compilando instalador... aguarde 10-20 minutos...
call npm run tauri:build

if %errorlevel% neq 0 (
    echo.
    echo ERRO no build. Veja a mensagem acima.
    pause
    exit /b 1
)

echo.
echo SUCESSO! Instalador gerado em:
echo src-tauri\target\release\bundle\
explorer src-tauri\target\release\bundle
pause
