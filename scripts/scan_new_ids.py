import sqlite3
import requests
import time
import logging
import argparse
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

DB_NAME = "fpl.db"
BASE_URL = "https://fantasy.premierleague.com/api/entry/{}/"
MAX_CONSECUTIVE_ERRORS = 50

def scan_new_teams(dry_run=False):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    # 1. Find the current max ID
    try:
        cursor.execute("SELECT MAX(team_id) FROM teams")
        result = cursor.fetchone()
        max_id = result[0] if result[0] is not None else 0
        logging.info(f"Current Max Team ID in DB: {max_id}")
    except sqlite3.OperationalError:
        logging.error("Could not query database. Ensure 'teams' table exists.")
        return

    current_id = max_id + 1
    consecutive_errors = 0
    new_teams_found = 0
    
    logging.info(f"Starting scan from ID: {current_id}")
    
    while consecutive_errors < MAX_CONSECUTIVE_ERRORS:
        try:
            url = BASE_URL.format(current_id)
            response = requests.get(url)
            
            if response.status_code == 200:
                data = response.json()
                team_name = data.get('name')
                manager_first = data.get('player_first_name', '')
                manager_last = data.get('player_last_name', '')
                manager_name = f"{manager_first} {manager_last}".strip()
                rank = data.get('summary_overall_rank')
                points = data.get('summary_overall_points')
                
                logging.info(f"Found new team! ID: {current_id} | Name: {team_name} | Rank: {rank}")
                
                if not dry_run:
                    cursor.execute("""
                        INSERT OR REPLACE INTO teams (team_id, team_name, manager_name, rank, total_points)
                        VALUES (?, ?, ?, ?, ?)
                    """, (current_id, team_name, manager_name, rank, points))
                    conn.commit()
                
                new_teams_found += 1
                consecutive_errors = 0 # Reset error count on success
                
            elif response.status_code == 404:
                # Team doesn't exist (yet/anymore)
                consecutive_errors += 1
                if consecutive_errors % 10 == 0:
                    logging.info(f"ID {current_id} not found. Consecutive 404s: {consecutive_errors}")
            else:
                logging.warning(f"Unexpected status {response.status_code} for ID {current_id}")
                # Treat as error? Or retry? For now, count as error to avoid infinite loops on 500s
                consecutive_errors += 1
                
        except Exception as e:
            logging.error(f"Error processing ID {current_id}: {e}")
            consecutive_errors += 1
            time.sleep(1) # Back off slightly on error
            
        current_id += 1
        # Moderate rate limiting
        time.sleep(0.1) 
        
    logging.info(f"Scan complete. Stopped after {MAX_CONSECUTIVE_ERRORS} consecutive missing IDs.")
    logging.info(f"Total new teams found: {new_teams_found}")
    conn.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Scan for new FPL teams')
    parser.add_argument('--dry-run', action='store_true', help='Do not write to database')
    args = parser.parse_args()
    
    scan_new_teams(args.dry_run)
