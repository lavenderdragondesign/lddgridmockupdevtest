@echo off
REM ==== LDD Grid Mockup 2 - GitHub Push Script ====

REM Navigate to repo folder
cd /d "C:\Users\Pete\Desktop\lddgridmockupbulkresize"

REM Make sure git is initialized (in case it’s a fresh folder)
git init

REM Add the GitHub repo as 'origin' if it’s not already set
git remote get-url origin >nul 2>&1
if errorlevel 1 (
    git remote add origin https://github.com/lavenderdragondesign/lddgridmockup2.git
    echo 🔗 Remote 'origin' added.
) else (
    echo 🔗 Remote 'origin' already exists.
)

REM Make sure we’re on the main branch
git checkout -B main

REM Stage all changes
git add -A

REM Commit with timestamp
git commit -m "Auto‑commit on %DATE% %TIME%"

REM Push to GitHub
git push -u origin main

echo.
echo ==============================
echo ✅ Push Complete!
echo ==============================
pause