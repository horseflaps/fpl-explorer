import sqlite3
import csv
import argparse
import os
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

DB_NAME = "fpl.db"

def init_db(cursor):
    """Initialize the database schema."""
    logging.info("Initializing database schema...")
    
    # Create the main table
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
    
    # Create indices for fast searching
    logging.info("Creating indices...")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_team_name ON teams(team_name)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_manager_name ON teams(manager_name)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_rank ON teams(rank)")

def import_csv(csv_file):
    """Import CSV data into the database."""
    if not os.path.exists(csv_file):
        logging.error(f"File not found: {csv_file}")
        return

    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()

    try:
        init_db(cursor)

        logging.info(f"Importing data from {csv_file}...")
        
        with open(csv_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            
            # Prepare data for bulk insert
            rows_to_insert = []
            for row in reader:
                rows_to_insert.append((
                    int(row['Team ID']),
                    row['Team Name'],
                    row['Manager Name'],
                    int(row['Current Rank']),
                    int(row['Total Points'])
                ))
            
            # Batch insert using executemany for performance
            cursor.executemany("""
                INSERT OR REPLACE INTO teams (team_id, team_name, manager_name, rank, total_points)
                VALUES (?, ?, ?, ?, ?)
            """, rows_to_insert)
            
            conn.commit()
            logging.info(f"Successfully imported {len(rows_to_insert)} records.")
            
            # Verify count
            cursor.execute("SELECT COUNT(*) FROM teams")
            count = cursor.fetchone()[0]
            logging.info(f"Total teams in database: {count}")
            
    except Exception as e:
        logging.error(f"An error occurred: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Import FPL CSV to SQLite')
    parser.add_argument('csv_file', help='Path to the CSV file to import')
    
    args = parser.parse_args()
    
    import_csv(args.csv_file)
