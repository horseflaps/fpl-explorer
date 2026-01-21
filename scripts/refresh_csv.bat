@echo off
:: Navigate to the project root directory (one level up from this script)
cd /d "%~dp0.."

echo [%date% %time%] Starting FPL Data Update...

:: 1. Run the Scraper (Defaults to League 314)
echo Running Scraper...
:: Options:
::   --pages N   : Scrape only first N pages (e.g. 1000 for top 50k players)
::   --resume    : Resume from last partial CSV if script crashed
:: Example: python scripts/scrape_league.py --resume
python scripts/scrape_league.py
:: Note: Remove "--pages 5" above to scrape the WHOLE league (takes a long time)

:: 2. Find the most recently created CSV file starting with "league_"
set "latest_csv="
for /f "delims=" %%x in ('dir /b /od league_*.csv') do set latest_csv=%%x

if not defined latest_csv (
    echo Error: No CSV file found. Scraper might have failed.
    exit /b 1
)

:: 3. Run the Importer with the new CSV
echo Importing %latest_csv%...
:: Options:
::   --update    : merging new data into existing DB instead of wiping it
:: Example: python scripts/import_db.py "%latest_csv%" --update
python scripts/import_db.py "%latest_csv%"

:: 4. Scan for New Teams (using existing DB max ID)
echo Scanning for new teams...
python scripts/scan_new_ids.py

echo [%date% %time%] Update Complete.
:: Uncomment the next line if you want the window to stay open when running manually
pause
