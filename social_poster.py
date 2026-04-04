import os
import csv
import datetime
import requests
import sys

# Configuration
FB_PAGE_ID = os.environ.get("FB_PAGE_ID")
FB_ACCESS_TOKEN = os.environ.get("FB_ACCESS_TOKEN")
LI_PERSON_URN = os.environ.get("LI_PERSON_URN") # e.g., urn:li:person:12345 or urn:li:organization:12345
LI_ACCESS_TOKEN = os.environ.get("LI_ACCESS_TOKEN")
CSV_FILE = "regent.content_calendar.csv" # Default, can be an arg

def get_todays_post(csv_file):
    """
    Finds the post for the current day index (1-30).
    In a real scenario, you might map specific dates to rows.
    Here, we assume the script runs daily and cycles through 1-30 based on day of month.
    """
    day_of_month = datetime.datetime.now().day
    # Ensure we stay within 1-30 range even for 31st
    day_index = str(day_of_month if day_of_month <= 30 else 30) 
    
    with open(csv_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row['Day'] == day_index:
                return row
    return None

def post_to_facebook(caption, image_filename):
    if not FB_ACCESS_TOKEN or not FB_PAGE_ID:
        print("Skipping Facebook: Missing credentials.")
        return

    url = f"https://graph.facebook.com/{FB_PAGE_ID}/photos"
    # Assuming images are in an 'images' folder
    image_path = os.path.join("images", image_filename)
    
    if not os.path.exists(image_path):
        print(f"Error: Image {image_path} not found.")
        return

    payload = {
        'message': caption,
        'access_token': FB_ACCESS_TOKEN
    }
    files = {
        'source': open(image_path, 'rb')
    }

    response = requests.post(url, data=payload, files=files)
    if response.status_code == 200:
        print("Successfully posted to Facebook!")
    else:
        print(f"Facebook Error: {response.text}")

def post_to_linkedin(caption, image_filename):
    if not LI_ACCESS_TOKEN or not LI_PERSON_URN:
        print("Skipping LinkedIn: Missing credentials.")
        return

    # 1. Register Upload
    register_url = "https://api.linkedin.com/v2/assets?action=registerUpload"
    headers = {
        "Authorization": f"Bearer {LI_ACCESS_TOKEN}",
        "Content-Type": "application/json"
    }
    register_data = {
        "registerUploadRequest": {
            "recipes": ["urn:li:digitalmediaRecipe:feedshare-image"],
            "owner": LI_PERSON_URN,
            "serviceRelationships": [{
                "relationshipType": "OWNER",
                "identifier": "urn:li:userGeneratedContent"
            }]
        }
    }
    
    reg_response = requests.post(register_url, json=register_data, headers=headers)
    if reg_response.status_code != 200:
        print(f"LinkedIn Register Error: {reg_response.text}")
        return
        
    upload_url = reg_response.json()['value']['uploadMechanism']['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest']['uploadUrl']
    asset_id = reg_response.json()['value']['asset']

    # 2. Upload Image
    image_path = os.path.join("images", image_filename)
    if not os.path.exists(image_path):
         print(f"Error: Image {image_path} not found.")
         return

    with open(image_path, 'rb') as img_file:
        up_response = requests.put(upload_url, data=img_file, headers={"Authorization": f"Bearer {LI_ACCESS_TOKEN}"})
        if up_response.status_code != 201:
            print(f"LinkedIn Image Upload Error: {up_response.text}")
            return

    # 3. Create Post
    post_url = "https://api.linkedin.com/v2/ugcPosts"
    post_data = {
        "author": LI_PERSON_URN,
        "lifecycleState": "PUBLISHED",
        "specificContent": {
            "com.linkedin.ugc.ShareContent": {
                "shareCommentary": {
                    "text": caption
                },
                "shareMediaCategory": "IMAGE",
                "media": [
                    {
                        "status": "READY",
                        "description": {"text": "Image Description"},
                        "media": asset_id,
                        "title": {"text": "Post Image"}
                    }
                ]
            }
        },
        "visibility": {
            "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
        }
    }

    final_response = requests.post(post_url, json=post_data, headers=headers)
    if final_response.status_code == 201:
        print("Successfully posted to LinkedIn!")
    else:
        print(f"LinkedIn Post Error: {final_response.text}")

def main():
    print("Starting Social Media Automation...")
    
    # 1. Get Today's Content
    # You can change the CSV filename here or pass it as an argument
    post = get_todays_post(CSV_FILE)
    
    if not post:
        print("No post found for today (or CSV date mismatch).")
        return

    print(f"Found post for Day {post['Day']}: {post['Caption'][:30]}...")
    
    caption = f"{post['Caption']}\n\n{post['Hashtags']}"
    # Assuming you add an 'ImageFilename' column to your CSV or derive it
    # For now, let's assume valid filenames are row based e.g. day1.jpg
    image_filename = f"day{post['Day']}.jpg" 

    # 2. Post to Platforms
    post_to_facebook(caption, image_filename)
    post_to_linkedin(caption, image_filename)

if __name__ == "__main__":
    main()
