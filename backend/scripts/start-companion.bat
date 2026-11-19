@echo off
@chcp 65001 >nul
setlocal enabledelayedexpansion

title Browsy Local AI Companion Service

echo ======================================================================
echo    [START] BROWSY LOCAL AI COMPANION SERVICE LAUNCHER (Windows)
echo ======================================================================
echo.

REM 1. Check if port 8765 is already in use
netstat -ano | findstr :8765 | findstr LISTENING >nul 2>&1
if !ERRORLEVEL! equ 0 (
    echo [!] Notice: Port 8765 is already in use by an active process.
    echo     A Browsy Companion Service instance appears to already be running.
    echo.
    echo     To restart the service, run:
    echo     backend\scripts\stop-companion.bat
    echo.
    pause
    exit /b 0
)

REM 2. Check for Ollama daemon on loopback (optional AI acceleration)
echo [*] Checking Ollama daemon availability on http://127.0.0.1:11434...
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri 'http://127.0.0.1:11434/api/tags' -TimeoutSec 1 -UseBasicParsing; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
if !ERRORLEVEL! equ 0 (
    echo [OK] Ollama is running and accessible on loopback!
) else (
    echo [i] Ollama is not currently detected on http://127.0.0.1:11434.
    echo     Browsy will run in Deterministic Mode (fast in-browser NLU).
    echo     To enable local LLM inference, start Ollama in a separate terminal:
    echo     ollama serve
)
echo.

REM 3. Detect Node.js runtime (Primary zero-dependency runner)
where node >nul 2>&1
if !ERRORLEVEL! equ 0 (
    echo [*] Starting Node.js Companion Service on http://127.0.0.1:8765...
    echo     Press Ctrl+C at any time to shut down the service.
    echo.
    cd /d "%~dp0\..\.."
    node backend\companion-service.mjs
    goto :end
)

REM 4. Fallback: Detect Python 3 runtime
where python >nul 2>&1
if !ERRORLEVEL! equ 0 (
    echo [*] Node.js not detected. Starting Python Companion Service on http://127.0.0.1:8765...
    echo     Press Ctrl+C at any time to shut down the service.
    echo.
    cd /d "%~dp0\..\.."
    python backend\companion_service.py
    goto :end
)

REM 5. Neither runtime detected
echo [X] Error: Neither Node.js nor Python was found on your PATH.
echo.
echo     To run the optional local AI companion service:
echo     - Install Node.js (v18+) from https://nodejs.org
echo       OR
echo     - Install Python (3.9+) from https://python.org
echo.
echo     NOTE: Browsy extension works 100%% out-of-the-box in Deterministic Mode
echo     even without running this companion service!
echo.
pause

:end
