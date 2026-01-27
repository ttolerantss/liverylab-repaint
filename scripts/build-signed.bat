@echo off
REM Set these environment variables before running:
REM   AZURE_TENANT_ID
REM   AZURE_CLIENT_ID
REM   AZURE_CLIENT_SECRET

if "%AZURE_TENANT_ID%"=="" (
    echo Error: AZURE_TENANT_ID environment variable not set
    exit /b 1
)
if "%AZURE_CLIENT_ID%"=="" (
    echo Error: AZURE_CLIENT_ID environment variable not set
    exit /b 1
)
if "%AZURE_CLIENT_SECRET%"=="" (
    echo Error: AZURE_CLIENT_SECRET environment variable not set
    exit /b 1
)

node scripts/build-installer.js
