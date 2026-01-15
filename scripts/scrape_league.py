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

def scrape_league(league_id, output_format='csv', max_pages=None):
    page = 1
    all_data = []
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_file = f"league_{league_id}_{timestamp}.{output_format}"
    
    # Initialize CSV header if needed
    if output_format == 'csv':
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
    
    args = parser.parse_args()
    
    scrape_league(args.league_id, args.format, args.pages)
