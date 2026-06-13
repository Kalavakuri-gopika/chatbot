import os
from pypdf import PdfReader

uploads_dir = "data/uploads"
for filename in os.listdir(uploads_dir):
    if filename.lower().endswith(".pdf"):
        filepath = os.path.join(uploads_dir, filename)
        print(f"\n=================== FILE: {filename} ===================")
        try:
            reader = PdfReader(filepath)
            for i, page in enumerate(reader.pages):
                print(f"--- Page {i+1} ---")
                text = page.extract_text()
                print(text)
        except Exception as e:
            print(f"Error reading {filename}: {e}")
