import sqlite3
import csv
import argparse
import os
import logging
import time

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

import shutil
import tempfile

# Determine project root relative to this script
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
FINAL_DB_PATH = os.path.join(PROJECT_ROOT, "fpl.db")

# We write to a temp file in the SYSTEM TEMP dir (local SSD) to avoid network drive slowness
# This brings speed back up to ~50k/sec even if Y: is a network drive
TEMP_DB_PATH = os.path.join(tempfile.gettempdir(), "fpl_temp.db")

BATCH_SIZE = 50000

def init_db(conn, update_mode=False):
    """Initialize the database schema and set performance pragmas."""
    cursor = conn.cursor()
    logging.info("Initializing database schema...")
    
    # Aggressive Performance optimizations for bulk loading
    # We don't care about crash safety during import (we can just re-run it)
    cursor.execute("PRAGMA journal_mode = OFF;") 
    cursor.execute("PRAGMA synchronous = OFF;") 
    cursor.execute("PRAGMA cache_size = 100000;") # More memory
    cursor.execute("PRAGMA locking_mode = EXCLUSIVE;") 
    cursor.execute("PRAGMA temp_store = MEMORY;")
    
    # Create the main table if it doesn't exist
    if not update_mode:
        logging.info("Fresh import mode: ensuring clean state...")
        cursor.execute("DROP TABLE IF EXISTS teams") # Start fresh (faster inserts, correct schema)
        
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS teams (
            id INTEGER PRIMARY KEY,
            team_id INTEGER UNIQUE,
            team_name TEXT,
            manager_name TEXT,
            rank INTEGER,
            total_points INTEGER
        )
    """)
    
    # Drop indices if they exist (to speed up inserts) - ONLY in fresh mode
    # If using Atomic Rebuild (fresh mode), the file is empty anyway, so no indices to drop.
    # But checking doesn't hurt.
    
    if not update_mode:
        logging.info("Dropping indices for bulk insert performance...")
        cursor.execute("DROP INDEX IF EXISTS idx_team_name")
        cursor.execute("DROP INDEX IF EXISTS idx_manager_name")
    
    conn.commit()

def import_csv(csv_file, update_mode=False):
    """Import CSV data into the database using chunked processing."""
    if not os.path.exists(csv_file):
        logging.error(f"File not found: {csv_file}")
        return

    # If updating, we must use the FINAL DB. If fresh import, we use TEMP DB.
    # However, if we use TEMP DB, we can't "Resume" or "Update" easily unless we copy first.
    # Strategy: 
    #   - Fresh Import: Write to empty `fpl_temp.db`. Replace `fpl.db` at end.
    #   - Update: Write directly to `fpl.db`.
    
    target_db_path = FINAL_DB_PATH if update_mode else TEMP_DB_PATH
    
    if not update_mode:
        # Start with a fresh empty file for speed
        if os.path.exists(TEMP_DB_PATH):
            os.remove(TEMP_DB_PATH)
        logging.info(f"Creating fresh temporary database at: {TEMP_DB_PATH}")
    else:
        logging.info(f"Updating existing database at: {target_db_path}")

    conn = sqlite3.connect(target_db_path)
    
    try:
        init_db(conn, update_mode)

        logging.info(f"Importing data from {csv_file} in batches of {BATCH_SIZE}...")
        start_time = time.time()
        
        cursor = conn.cursor()
        
        with open(csv_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            
            batch_data = []
            total_imported = 0
            
            for row in reader:
                try:
                    batch_data.append((
                        int(row['Team ID']),
                        row['Team Name'],
                        row['Manager Name'],
                        row.get('Current Rank'),
                        row.get('Total Points')
                    ))
                except (ValueError, KeyError) as e:
                    continue # Skip bad rows

                if len(batch_data) >= BATCH_SIZE:
                    cursor.executemany("""
                    INSERT OR REPLACE INTO teams (team_id, team_name, manager_name, rank, total_points)
                    VALUES (?, ?, ?, ?, ?)
                    """, batch_data)
                    conn.commit()
                    total_imported += len(batch_data)
                    batch_data = []
                    
                    elapsed = time.time() - start_time
                    rate = total_imported / elapsed
                    logging.info(f"Imported {total_imported:,} rows... ({int(rate)} rows/sec)")

            # Insert remaining
            if batch_data:
                cursor.executemany("""
                    INSERT OR REPLACE INTO teams (team_id, team_name, manager_name, rank, total_points)
                    VALUES (?, ?, ?, ?, ?)
                """, batch_data)
                conn.commit()
                total_imported += len(batch_data)

            elapsed = time.time() - start_time
            logging.info(f"Successfully finished. Imported {total_imported:,} records in {elapsed:.2f}s.")
            
            # Verify count
            cursor.execute("SELECT COUNT(*) FROM teams")
            count = cursor.fetchone()[0]
            logging.info(f"Total teams in database: {count:,}")
            
            # Create indices AFTER insert
            logging.info("Verifying indices...")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_team_name ON teams(team_name)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_manager_name ON teams(manager_name)")
            
            # FTS5 Setup
            logging.info("Setting up FTS5 search index...")
            cursor.execute("""
                CREATE VIRTUAL TABLE IF NOT EXISTS teams_fts USING fts5(
                    team_name, 
                    manager_name, 
                    content='teams', 
                    content_rowid='id'
                )
            """)
            # Populate/Rebuild FTS index
            logging.info("Populating FTS index (this may take a while)...")
            cursor.execute("INSERT INTO teams_fts(teams_fts) VALUES('rebuild')")
            
            conn.commit()
            logging.info("Indices and FTS verified/created.")
            
    except Exception as e:
        logging.error(f"An error occurred: {e}")
        conn.rollback()
        conn.close()
        return # Do not move file if error
    
    conn.close()
    
    # If we used a temp file, move it to the final location
    if not update_mode:
        logging.info(f"Moving temporary DB to final location: {FINAL_DB_PATH}...")
        
        # Windows file locking hack: ensure connection is truly closed
        time.sleep(1) 
        
        try:
            if os.path.exists(FINAL_DB_PATH):
                os.remove(FINAL_DB_PATH) # Remove old production DB
            shutil.move(TEMP_DB_PATH, FINAL_DB_PATH)
            logging.info("Database moved successfully.")
        except Exception as e:
            logging.error(f"Failed to move database! Data is in {TEMP_DB_PATH}. Error: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Import FPL CSV to SQLite (Optimized)')
    parser.add_argument('csv_file', help='Path to the CSV file to import')
    parser.add_argument('--update', action='store_true', help='Update existing database instead of wiping it')
    
    args = parser.parse_args()
    
    import_csv(args.csv_file, args.update)

