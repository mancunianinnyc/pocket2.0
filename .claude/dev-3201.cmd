@echo off
set "PATH=%APPDATA%\fnm\node-versions\v24.14.0\installation;%PATH%"
cd /d "C:\Users\rossg\Claude Workspace\personal-library"
corepack pnpm dev --port 3201
