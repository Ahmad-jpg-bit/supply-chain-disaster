import json

try:
    with open("error.log", "r", encoding="utf-8") as f:
        content = f.read()
        try:
            data = json.loads(content)
            print("Error Message:", data.get("error", {}).get("message"))
            print("Error Type:", data.get("error", {}).get("type"))
            print("Error Code:", data.get("error", {}).get("code"))
        except json.JSONDecodeError:
            print("Could not decode JSON using json.loads. Raw content:")
            print(content[:200])
except Exception as e:
    print(f"Error reading file: {e}")
