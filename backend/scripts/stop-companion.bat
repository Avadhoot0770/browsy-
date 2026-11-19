@echo off
@chcp 65001 >nul
setlocal enabledelayedexpansion

title Stop Browsy Companion Service

echo ======================================================================
echo    [STOP] BROWSY COMPANION SERVICE (Windows)
echo ======================================================================
echo.

set "FOUND=0"

REM Find any process listening on port 8765
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8765 ^| findstr LISTENING') do (
    set "PID=%%a"
    if defined PID (
        set "FOUND=1"
        echo [*] Found process listening on port 8765 with PID: !PID!
        taskkill /F /PID !PID! >nul 2>&1
        if !ERRORLEVEL! equ 0 (
            echo [OK] Successfully terminated process !PID!.
        ) else (
            echo [!] Process !PID! already exited or could not be terminated.
        )
    )
)

if "!FOUND!"=="0" (
    echo [i] No active process was found listening on port 8765.
)

REM Re-verify port
netstat -ano | findstr :8765 | findstr LISTENING >nul 2>&1
if !ERRORLEVEL! equ 0 (
    echo [!] Warning: Port 8765 is still in use by an unstopped process.
) else (
    echo [OK] Port 8765 is free. Browsy companion service is stopped.
)

echo.
pause
