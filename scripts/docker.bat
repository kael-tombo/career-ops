@echo off
REM Career-OPS Docker Management Script
REM Usage: scripts\docker.bat [command]

echo.
echo ╔══════════════════════════════════════╗
echo ║   Career-OPS Docker Manager         ║
echo ╚══════════════════════════════════════╝
echo.

set "CMD=%1"

if "%CMD%"=="" (
  echo Commands:
  echo   up          Start all services ^(detached^)
  echo   up:api      Start API only
  echo   up:dash     Start dashboard only
  echo   up:daemon   Start daemon only
  echo   build       Build all images
  echo   build:api   Build API image
  echo   build:dash  Build dashboard image
  echo   build:daemon Build daemon image
  echo   logs        View all logs
  echo   logs:api    View API logs
  echo   logs:dash   View dashboard logs
  echo   logs:daemon View daemon logs
  echo   stop        Stop all services
  echo   restart     Restart all services
  echo   ps          List running services
  echo   down        Remove all containers/networks
  echo   clean       Remove everything ^(incl volumes^)
  echo   exec:api    Shell into API container
  echo   exec:dash   Shell into dashboard container
  echo   exec:daemon Shell into daemon container
  goto :eof
)

if "%CMD%"=="up" (
  if not exist ".env.docker" (
    echo ⚠️  No .env.docker found. Copying from template...
    copy .env.docker.example .env.docker >nul
  )
  echo 🚀 Starting all services...
  docker compose up -d
  echo.
  echo 📡 API:       http://localhost:3001
  echo 🖥️  Dashboard: http://localhost:3000
  echo 🤖 Daemon:    http://localhost:4173
  goto :eof
)

if "%CMD%"=="build" (
  echo 🔨 Building all images...
  docker compose build
  goto :eof
)

if "%CMD%"=="build:api" (
  echo 🔨 Building API image...
  docker compose build api
  goto :eof
)

if "%CMD%"=="build:dash" (
  echo 🔨 Building dashboard image...
  docker compose build dashboard
  goto :eof
)

if "%CMD%"=="build:daemon" (
  echo 🔨 Building daemon image...
  docker compose build daemon
  goto :eof
)

if "%CMD%"=="up:api" (docker compose up -d api & goto :eof)
if "%CMD%"=="up:dash" (docker compose up -d dashboard & goto :eof)
if "%CMD%"=="up:daemon" (docker compose up -d daemon & goto :eof)
if "%CMD%"=="logs" (docker compose logs -f & goto :eof)
if "%CMD%"=="logs:api" (docker compose logs -f api & goto :eof)
if "%CMD%"=="logs:dash" (docker compose logs -f dashboard & goto :eof)
if "%CMD%"=="logs:daemon" (docker compose logs -f daemon & goto :eof)
if "%CMD%"=="stop" (docker compose stop & goto :eof)
if "%CMD%"=="restart" (docker compose restart & goto :eof)
if "%CMD%"=="ps" (docker compose ps & goto :eof)
if "%CMD%"=="down" (docker compose down & goto :eof)
if "%CMD%"=="clean" (docker compose down -v & goto :eof)
if "%CMD%"=="exec:api" (docker compose exec api /bin/bash & goto :eof)
if "%CMD%"=="exec:dash" (docker compose exec dashboard /bin/sh & goto :eof)
if "%CMD%"=="exec:daemon" (docker compose exec daemon /bin/bash & goto :eof)

echo Unknown command: %CMD%
echo Run with no arguments to see available commands.
