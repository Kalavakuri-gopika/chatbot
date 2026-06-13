import json
import re

db_path = "data/fallback_vector_db.json"
try:
    with open(db_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    print(f"Total chunks in fallback DB: {len(data)}")
    for i, doc in enumerate(data):
        print(f"\n--- Chunk {i} (Source: {doc['metadata'].get('source')}) ---")
        print(doc['page_content'])
except Exception as e:
    print("Error reading fallback DB:", e)
