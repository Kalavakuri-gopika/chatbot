import os

def fix_imports():
    app_dir = "app"
    fixed_count = 0
    
    if not os.path.exists(app_dir):
        print(f"Error: Could not find '{app_dir}' folder in current directory. Please run this script from the 'backend/' directory.")
        return
        
    for root, _, files in os.walk(app_dir):
        for file in files:
            if file.endswith(".py"):
                filepath = os.path.join(root, file)
                with open(filepath, "r", encoding="utf-8") as f:
                    content = f.read()
                
                # Replace absolute imports
                new_content = content.replace("from backend.app.", "from app.")
                new_content = new_content.replace("import backend.app.", "import app.")
                
                if content != new_content:
                    with open(filepath, "w", encoding="utf-8") as f:
                        f.write(new_content)
                    print(f"Fixed imports in: {filepath}")
                    fixed_count += 1
                    
    print(f"Completed! Fixed imports in {fixed_count} files.")

if __name__ == "__main__":
    fix_imports()
