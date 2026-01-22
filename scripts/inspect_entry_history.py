import requests
import json

def inspect_history(entry_id=380850): # Using a known active ID (or random)
    url = f"https://fantasy.premierleague.com/api/entry/{entry_id}/history/"
    print(f"Fetching {url}...")
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }
    try:
        r = requests.get(url, headers=headers)
        r.raise_for_status()
        data = r.json()
        
        with open("history_dump.json", "w") as f:
            json.dump(data, f, indent=2)
            print("Dumped history to history_dump.json")
            
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    inspect_history()
