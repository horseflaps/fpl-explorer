import requests
import time
import csv
import json
import logging
import os
import argparse
from datetime import datetime

# Configure logging
logging.basicConfig(
    filename='scraper.log',
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
console = logging.StreamHandler()
console.setLevel(logging.INFO)
logging.getLogger('').addHandler(console)

BASE_URL = "https://fantasy.premierleague.com/api/leagues-classic/{}/standings/"

def get_last_processed_rank_and_count(filename):
    """
    Reads the CSV file to find the last processed rank and total entries.
    Returns (last_rank, total_entries)
    """
    if not os.path.exists(filename):
        return 0, 0
    
    count = 0
    last_rank = 0
    
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            header = next(reader, None) # Skip header
            for row in reader:
                count += 1
                if row and len(row) > 3:
                     # 'Current Rank' is at index 3 based on writerow below
                    try:
                        last_rank = int(row[3])
                    except ValueError:
                        pass
        return last_rank, count
    except Exception as e:
        logging.error(f"Error reading checkpoint file: {e}")
        return 0, 0

def scrape_league(league_id, output_format='csv', max_pages=None, resume=False):
    page = 1
    all_data = []
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    # If resuming, we need to find the latest matching file for this league
    if resume and output_format == 'csv':
        # Find latest file pattern: league_{id}_*.csv
        files = [f for f in os.listdir('.') if f.startswith(f"league_{league_id}_") and f.endswith('.csv')]
        if files:
            # Sort by modification time, newest first
            files.sort(key=lambda x: os.path.getmtime(x), reverse=True)
            output_file = files[0]
            logging.info(f"Resuming from file: {output_file}")
            
            last_rank, total_entries = get_last_processed_rank_and_count(output_file)
            
            # 50 entries per page. 
            # If we have 50 entries, we finished page 1, need to start page 2.
            # If we have 51 entries, we finished page 1, and started page 2 (maybe crashed?). 
            # Safest is to calculate page based on count.
            start_page = (total_entries // 50) + 1
            page = start_page
            logging.info(f"Found {total_entries} entries. Resuming at page {page}...")
            
        else:
            logging.warning("No existing file found to resume. Starting fresh.")
            output_file = f"league_{league_id}_{timestamp}.{output_format}"
            resume = False # Reset resume flag as we are starting fresh
    else:
        output_file = f"league_{league_id}_{timestamp}.{output_format}"
    
    # Initialize CSV header if needed (only if NOT resuming)
    if output_format == 'csv' and not resume:
        with open(output_file, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(['Team ID', 'Team Name', 'Manager Name', 'Current Rank', 'Total Points'])

    logging.info(f"Starting scrape for League ID: {league_id}")
    logging.info(f"Output file: {output_file}")

    while True:
        if max_pages and page > max_pages:
            logging.info(f"Reached max pages limit ({max_pages}). Stopping.")
            break

        try:
            url = BASE_URL.format(league_id)
            params = {'page_standings': page}
            
            logging.info(f"Fetching page {page}...")
            response = requests.get(url, params=params)
            
            if response.status_code != 200:
                logging.error(f"Failed to fetch page {page}. Status Code: {response.status_code}")
                # If we hit a 404 or specific error, we might want to stop
                if response.status_code == 404:
                    break
                time.sleep(5) # Wait a bit longer on error before retrying or moving on
                continue

            data = response.json()
            standings = data.get('standings', {})
            results = standings.get('results', [])
            
            if not results:
                logging.info("No more results found. Scrape complete.")
                break

            processed_results = []
            
            # If resuming, we might have partial data for this page or overlap if we are conservative.
            # However, FPL API is static enough for this usually.
            # We will just append. Duplicates can be handled by the database import later.
            
            for entry in results:
                row = {
                    'Team ID': entry.get('entry'),
                    'Team Name': entry.get('entry_name'),
                    'Manager Name': entry.get('player_name'),
                    'Current Rank': entry.get('rank'),
                    'Total Points': entry.get('total')
                }
                processed_results.append(row)

            # Write to file
            if output_format == 'csv':
                with open(output_file, 'a', newline='', encoding='utf-8') as f:
                    writer = csv.writer(f)
                    for row in processed_results:
                        writer.writerow([
                            row['Team ID'], 
                            row['Team Name'], 
                            row['Manager Name'], 
                            row['Current Rank'], 
                            row['Total Points']
                        ])
            else:
                all_data.extend(processed_results)

            logging.info(f"Page {page} processed. {len(results)} entries extracted.")
            
            if not standings.get('has_next'):
                logging.info("Last page reached.")
                break

            page += 1
            time.sleep(1)  # 1 second delay as requested

        except Exception as e:
            logging.error(f"An error occurred on page {page}: {str(e)}")
            time.sleep(5)
            # If we keep failing, we can break or just keep retrying. 
            # For now, we continue to try next iteration or same page? 
            # The loop doesn't increment page on exception? NO, it does NOT.
            # Wait... if exception happens, we loop again. Page is NOT incremented.
            # This allows retry of the SAME page. Good.

    # Final JSON write if applicable
    if output_format == 'json':
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(all_data, f, indent=4)
        logging.info("JSON file saved.")

    logging.info("Scraping finished.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Scrape FPL League Standings')
    parser.add_argument('league_id', type=int, nargs='?', default=314, help='League ID to scrape (default: 314)')
    parser.add_argument('--format', choices=['csv', 'json'], default='csv', help='Output format (default: csv)')
    parser.add_argument('--pages', type=int, default=None, help='Max pages to scrape (optional)')
    parser.add_argument('--resume', action='store_true', help='Resume from the last available CSV file')
    
    args = parser.parse_args()
    
    scrape_league(args.league_id, args.format, args.pages, args.resume)
