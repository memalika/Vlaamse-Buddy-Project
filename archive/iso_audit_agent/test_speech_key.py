import os
import requests
import base64
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("GOOGLE_API_KEY")

if not api_key:
    print("No API Key found")
    exit(1)

print(f"Testing API Key: {api_key[:5]}...")

# Minimal dummy audio (ignored by STT essentially, just testing auth)
# This is NOT valid audio, but STT should return 200 with empty results OR 403 if auth fails
b64_audio = "UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA"

url = f"https://speech.googleapis.com/v1/speech:recognize?key={api_key}"

payload = {
    "config": {
        "encoding": "LINEAR16",
        "sampleRateHertz": 44100,
        "languageCode": "en-US"
    },
    "audio": {
        "content": b64_audio
    }
}

try:
    response = requests.post(url, json=payload)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Request failed: {e}")
