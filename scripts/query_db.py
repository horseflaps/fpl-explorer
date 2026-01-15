import sqlite3
import argparse
import os

DB_NAME = "fpl.db"

def query_db(search_term=None, limit=10):
    if not os.path.exists(DB_NAME):
        print(f"Error: {DB_NAME} not found.")
        return

    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()

    try:
        if search_term:
            print(f"Searching for '{search_term}'...")
            query = """
                SELECT * FROM teams 
                WHERE team_name LIKE ? OR manager_name LIKE ? 
                LIMIT ?
            """
            cursor.execute(query, (f'%{search_term}%', f'%{search_term}%', limit))
        else:
            print(f"Showing top {limit} teams...")
            query = "SELECT * FROM teams ORDER BY rank ASC LIMIT ?"
            cursor.execute(query, (limit,))

        results = cursor.fetchall()

        if not results:
            print("No results found.")
            return

        # Print header
        print(f"{'Rank':<8} {'ID':<10} {'Manager':<30} {'Team Name':<30} {'Points':<8}")
        print("-" * 90)

        for row in results:
            # row: id, team_id, team_name, manager_name, rank, total_points
            # Schema: table teams (id PK, team_id, team_name, manager_name, rank, total_points)
            # The row index might depend on the SELECT *. 
            # SQLite returns tuples in column order.
            # 0: id (PK), 1: team_id, 2: team_name, 3: manager_name, 4: rank, 5: total_points
            
            t_id = row[1]
            t_name = row[2]
            mgr_name = row[3]
            rank = row[4]
            pts = row[5]
            
            # Truncate long names for display
            if len(t_name) > 28: t_name = t_name[:25] + "..."
            if len(mgr_name) > 28: mgr_name = mgr_name[:25] + "..."

            print(f"{rank:<8} {t_id:<10} {mgr_name:<30} {t_name:<30} {pts:<8}")

    except Exception as e:
        print(f"Error: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Query FPL Database')
    parser.add_argument('search', nargs='?', help='Search term for Manager or Team Name')
    parser.add_argument('--limit', type=int, default=20, help='Max results to show')
    
    args = parser.parse_args()
    
    query_db(args.search, args.limit)
