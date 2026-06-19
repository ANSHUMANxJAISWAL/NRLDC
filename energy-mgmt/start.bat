@echo off
title Energy Management Portal Launcher
echo ==============================================
echo   Starting Energy Management Application...
echo ==============================================

:: Launch Backend in a new window
echo Launching Backend server (port 5000)...
start "Energy Management Backend" cmd /k "cd backend && npm run dev"

:: Launch Frontend in a new window
echo Launching Frontend dev server (Vite)...
start "Energy Management Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo Both services have been launched in separate terminal windows.
echo Keep this window open if you want to reference these logs, or press any key to close.
echo.
pause
