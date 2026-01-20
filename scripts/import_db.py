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

DB_NAME = "fpl.db"
BATCH_SIZE = 50000

def init_db(conn):
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
    
    # Create the main table
    cursor.execute("DROP TABLE IF EXISTS teams") # Start fresh (faster inserts, correct schema)
    cursor.execute("""
        CREATE TABLE teams (
            id INTEGER PRIMARY KEY,
            team_id INTEGER UNIQUE,
            team_name TEXT,
            manager_name TEXT,
            rank INTEGER
        )
    """)
    
    # Drop indices if they exist (to speed up inserts)
    logging.info("Dropping indices for bulk insert performance...")
    cursor.execute("DROP INDEX IF EXISTS idx_team_name")
    cursor.execute("DROP INDEX IF EXISTS idx_manager_name")
    cursor.execute("DROP INDEX IF EXISTS idx_rank")
    conn.commit()

def import_csv(csv_file):
    """Import CSV data into the database using chunked processing."""
    if not os.path.exists(csv_file):
        logging.error(f"File not found: {csv_file}")
        return

    conn = sqlite3.connect(DB_NAME)
    
    try:
        init_db(conn)

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
                        int(row['Current Rank'])
                    ))
                except (ValueError, KeyError) as e:
                    continue # Skip bad rows

                if len(batch_data) >= BATCH_SIZE:
                    cursor.executemany("""
                        INSERT OR REPLACE INTO teams (team_id, team_name, manager_name, rank)
                        VALUES (?, ?, ?, ?)
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
                    INSERT OR REPLACE INTO teams (team_id, team_name, manager_name, rank)
                    VALUES (?, ?, ?, ?)
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
            logging.info("Creating indices (this may take a minute)...")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_team_name ON teams(team_name)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_manager_name ON teams(manager_name)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_rank ON teams(rank)")
            conn.commit()
            logging.info("Indices created successfully.")
            
    except Exception as e:
        logging.error(f"An error occurred: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Import FPL CSV to SQLite (Optimized)')
    parser.add_argument('csv_file', help='Path to the CSV file to import')
    
    args = parser.parse_args()
    
    import_csv(args.csv_file)

    # Move DB to project root
    import shutil
    
    # Current script directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    # Project root (parent of script dir)
    project_root = os.path.dirname(script_dir)
    
    source_db = DB_NAME
    target_db = os.path.join(project_root, DB_NAME)
    
    if os.path.exists(source_db):
        logging.info(f"Moving {source_db} to {target_db}...")
        try:
            if os.path.exists(target_db):
                os.remove(target_db) # Ensure clean overwrite
            shutil.move(source_db, target_db)
            logging.info("Database moved successfully.")
        except Exception as e:
            logging.error(f"Failed to move database: {e}")
    else:
        logging.error(f"Database {source_db} not found after import.")
