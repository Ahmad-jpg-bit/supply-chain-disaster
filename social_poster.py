import os
import csv
import datetime
import requests
import sys

# Configuration
FB_PAGE_ID = os.environ.get("FB_PAGE_ID")
FB_ACCESS_TOKEN = os.environ.get("FB_ACCESS_TOKEN")
LI_PERSON_URN = os.environ.get("LI_PERSON_URN")  # e.g., urn:li:person:12345 or urn:li:organization:12345
LI_ACCESS_TOKEN = os.environ.get("LI_ACCESS_TOKEN")
CSV_FILE = "regent.content_calendar.csv"


def get_todays_post(csv_file):
    """
    Finds the post for today's day-of-month (1–30).
    Day 31 maps to row 30.
    """
    day_of_month = datetime.datetime.utcnow().day
    day_index = str(min(day_of_month, 30))

    with open(csv_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row['Day'] == day_index:
                return row
    return None


def post_to_facebook(caption, post_url, image_filename):
    if not FB_ACCESS_TOKEN or not FB_PAGE_ID:
        print("Skipping Facebook: Missing credentials.")
        return

    image_path = os.path.join("images", image_filename)

    if os.path.exists(image_path):
        # Photo post with image
        url = f"https://graph.facebook.com/{FB_PAGE_ID}/photos"
        payload = {'message': caption, 'access_token': FB_ACCESS_TOKEN}
        files = {'source': open(image_path, 'rb')}
        response = requests.post(url, data=payload, files=files)
    else:
        # Link post (no image required)
        url = f"https://graph.facebook.com/{FB_PAGE_ID}/feed"
        payload = {
            'message': caption,
            'link': post_url,
            'access_token': FB_ACCESS_TOKEN,
        }
        response = requests.post(url, data=payload)

    if response.status_code == 200:
        print("Successfully posted to Facebook!")
    else:
        print(f"Facebook Error: {response.text}")


def post_to_linkedin(caption, post_url, image_filename):
    if not LI_ACCESS_TOKEN or not LI_PERSON_URN:
        print("Skipping LinkedIn: Missing credentials.")
        return

    headers = {
        "Authorization": f"Bearer {LI_ACCESS_TOKEN}",
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
    }

    image_path = os.path.join("images", image_filename)

    if os.path.exists(image_path):
        # Image post via ugcPosts
        register_url = "https://api.linkedin.com/v2/assets?action=registerUpload"
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

        with open(image_path, 'rb') as img_file:
            up_response = requests.put(upload_url, data=img_file, headers={"Authorization": f"Bearer {LI_ACCESS_TOKEN}"})
            if up_response.status_code != 201:
                print(f"LinkedIn Image Upload Error: {up_response.text}")
                return

        post_data = {
            "author": LI_PERSON_URN,
            "lifecycleState": "PUBLISHED",
            "specificContent": {
                "com.linkedin.ugc.ShareContent": {
                    "shareCommentary": {"text": caption},
                    "shareMediaCategory": "IMAGE",
                    "media": [{
                        "status": "READY",
                        "description": {"text": "Supply Chain Disaster"},
                        "media": asset_id,
                        "title": {"text": "Supply Chain Disaster"}
                    }]
                }
            },
            "visibility": {"com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"}
        }
    else:
        # Article/link post — no image needed
        post_data = {
            "author": LI_PERSON_URN,
            "lifecycleState": "PUBLISHED",
            "specificContent": {
                "com.linkedin.ugc.ShareContent": {
                    "shareCommentary": {"text": caption},
                    "shareMediaCategory": "ARTICLE",
                    "media": [{
                        "status": "READY",
                        "originalUrl": post_url,
                    }]
                }
            },
            "visibility": {"com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"}
        }

    post_url_api = "https://api.linkedin.com/v2/ugcPosts"
    final_response = requests.post(post_url_api, json=post_data, headers=headers)
    if final_response.status_code == 201:
        print("Successfully posted to LinkedIn!")
    else:
        print(f"LinkedIn Post Error: {final_response.text}")


def main():
    print("Starting Social Media Automation...")

    post = get_todays_post(CSV_FILE)

    if not post:
        print("No post found for today.")
        return

    print(f"Found post for Day {post['Day']}: {post['Caption'][:60]}...")

    caption = f"{post['Caption']}\n\n{post['Hashtags']}"
    post_url = post.get('PostURL', 'https://www.supplychaindisaster.com')
    image_filename = f"day{post['Day']}.jpg"

    post_to_facebook(caption, post_url, image_filename)
    post_to_linkedin(caption, post_url, image_filename)


if __name__ == "__main__":
    main()
