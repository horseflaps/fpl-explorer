@echo off
:: Navigate to the project root directory
cd /d "%~dp0.."

echo [%date% %time%] Starting FPL New Team Scan...

:: Scan for new teams (finds IDs > max_id in DB)
:: This script automatically writes new teams directly to fpl.db
echo Scanning for new teams...
python scripts/scan_new_ids.py

echo [%date% %time%] Scan Complete.

echo Rebuilding FTS search index...
python -c "import sqlite3; db = sqlite3.connect('T:/My Drive/FPL/db/fpl.db'); db.execute(\"INSERT INTO teams_fts(teams_fts) VALUES('rebuild')\"); db.commit(); db.close(); print('FTS index rebuilt.')"

echo [%date% %time%] All done.
pause
