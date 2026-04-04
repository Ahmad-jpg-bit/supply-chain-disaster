import requests
import json

ACCESS_TOKEN = "EAAL9tuRCy2YBQp8DSFhDF6ED3aCzU9oe67qLhs8sAL2xxXGnjx9GVCF0ZAqLwatZCW6MtZBQgCcOjdc4hqXBnIxWaESX3AptSqEGkZBguaWEujYTFApPs8ZBtUEthGZA1Uzydqqs9CXOYBwlIpVfJKBJjZACy7qfiSOCtrEXWwK13KqTWuJlykQejNLXGv4eepCNbg06AhLbeZCvNRofot6Boa7Hbaf9ZBHHO"

def check_token():
    try:
        url = f"https://graph.facebook.com/me?fields=id,name,permissions&access_token={ACCESS_TOKEN}"
        response = requests.get(url)
        
        try:
            data = response.json()
        except:
            print(f"RAW RESP: {response.text[:200]}")
            return

        if "error" in data:
            print(f"ERROR: {data['error'].get('message')}")
            print(f"CODE: {data['error'].get('code')}")
            print(f"TYPE: {data['error'].get('type')}")
        else:
            print(f"SUCCESS: Page Name: {data.get('name')}")
            print(f"SUCCESS: Page ID: {data.get('id')}")
            
            # Check permissions
            debug_url = f"https://graph.facebook.com/debug_token?input_token={ACCESS_TOKEN}&access_token={ACCESS_TOKEN}"
            debug_res = requests.get(debug_url)
            if debug_res.status_code == 200:
                scopes = debug_res.json().get('data', {}).get('scopes', [])
                if 'pages_manage_posts' in scopes:
                     print("PERMISSIONS: OK (pages_manage_posts present)")
                else:
                     print(f"PERMISSIONS: MISSING (Scopes: {scopes})")

    except Exception as e:
        print(f"EXCEPTION: {e}")

if __name__ == "__main__":
    check_token()
