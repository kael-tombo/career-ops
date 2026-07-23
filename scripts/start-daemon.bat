@echo off
REM Start Career-OPS 24/7 Daemon
REM Usage: scripts\start-daemon.bat [--run-once]

if "%1"=="--run-once" (
  echo Running pipeline once then exiting...
  node daemon.mjs --run-once
) else if "%1"=="--stop" (
  echo Stopping daemon...
  node daemon.mjs --stop
) else if "%1"=="--status" (
  node daemon.mjs --status
) else (
  echo Starting Career-OPS Autonomous Daemon...
  echo   Mode: %SAFE_MODE%
  echo   Pipeline interval: %PIPELINE_INTERVAL%s
  echo   Min score: %MIN_SCORE%
  echo.
  node daemon.mjs
)
