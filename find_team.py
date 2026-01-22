import sqlite3

try:
    conn = sqlite3.connect('fpl.db')
    cursor = conn.cursor()
    cursor.execute("SELECT team_id, team_name, manager_name FROM teams WHERE team_name LIKE '%flapjacks%'")
    results = cursor.fetchall()
    print("Found Teams:", results)
    conn.close()
except Exception as e:
    print("Error:", e)
