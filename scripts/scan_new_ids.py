import sqlite3
import requests
import time
import logging
import argparse
import random
from datetime import datetime

DB_NAME = r"T:\My Drive\FPL\db\fpl.db"
BASE_URL = "https://fantasy.premierleague.com/api/entry/{}/"
MAX_CONSECUTIVE_ERRORS = 50
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'application/json',
    'Accept-Language': 'en-GB,en;q=0.9',
    'Referer': 'https://fantasy.premierleague.com/',
}

def get_logger(worker_id):
    logger = logging.getLogger(f'worker-{worker_id}')
    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter(f'%(asctime)s - [W{worker_id}] - %(levelname)s - %(message)s'))
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
    return logger

def scan_new_teams(start=None, end=None, dry_run=False, worker_id=0):
    log = get_logger(worker_id)
    conn = sqlite3.connect(DB_NAME, timeout=30)
    cursor = conn.cursor()

    if start is None:
        try:
            cursor.execute("SELECT MAX(team_id) FROM teams")
            result = cursor.fetchone()
            max_id = result[0] if result[0] is not None else 0
            log.info(f"Current Max Team ID in DB: {max_id}")
            start = max_id + 1
        except sqlite3.OperationalError:
            log.error("Could not query database. Ensure 'teams' table exists.")
            return

    current_id = start
    consecutive_errors = 0
    new_teams_found = 0

    log.info(f"Starting scan from ID: {current_id}" + (f" to {end}" if end else ""))

    while consecutive_errors < MAX_CONSECUTIVE_ERRORS:
        if end is not None and current_id > end:
            log.info(f"Reached end of range ({end}). Stopping.")
            break

        try:
            url = BASE_URL.format(current_id)
            response = requests.get(url, headers=HEADERS, timeout=15)

            if response.status_code == 200:
                data = response.json()
                team_name = data.get('name')
                manager_first = data.get('player_first_name', '')
                manager_last = data.get('player_last_name', '')
                manager_name = f"{manager_first} {manager_last}".strip()
                rank = data.get('summary_overall_rank')
                points = data.get('summary_overall_points')

                log.info(f"Found new team! ID: {current_id} | Name: {team_name} | Rank: {rank}")

                if not dry_run:
                    cursor.execute("""
                        INSERT OR REPLACE INTO teams (team_id, team_name, manager_name, rank, total_points)
                        VALUES (?, ?, ?, ?, ?)
                    """, (current_id, team_name, manager_name, rank, points))
                    conn.commit()

                new_teams_found += 1
                consecutive_errors = 0

            elif response.status_code == 404:
                consecutive_errors += 1
                if consecutive_errors % 10 == 0:
                    log.info(f"ID {current_id} not found. Consecutive 404s: {consecutive_errors}")

            elif response.status_code == 429:
                log.warning(f"Rate limited (429) at ID {current_id}. Backing off 30s...")
                time.sleep(30)
                consecutive_errors += 1

            else:
                log.warning(f"Unexpected status {response.status_code} for ID {current_id}")
                consecutive_errors += 1

        except Exception as e:
            log.error(f"Error processing ID {current_id}: {e}")
            consecutive_errors += 1
            time.sleep(1)

        current_id += 1
        time.sleep(random.uniform(1, 2))

    log.info(f"Scan complete. Total new teams found: {new_teams_found}")
    conn.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Scan for new FPL teams')
    parser.add_argument('--start', type=int, default=None, help='ID to start from (default: max in DB + 1)')
    parser.add_argument('--end', type=int, default=None, help='ID to stop at (inclusive)')
    parser.add_argument('--worker', type=int, default=0, help='Worker ID label for log output')
    parser.add_argument('--dry-run', action='store_true', help='Do not write to database')
    args = parser.parse_args()

    scan_new_teams(start=args.start, end=args.end, dry_run=args.dry_run, worker_id=args.worker)
