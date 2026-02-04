import requests
import json

# Create a minimal valid WEBM dummy file (or just enough bytes to pass mime check)
# This is a very crude approximation, Gemini might reject it as invalid audio, but we test the NETWORK path.
# Better: use a hardcoded small valid webm base64 if possible.
# For now, let's try sending a text file masquerading as audio to see if it hits the API logic at least.
# Actually, let's try to not crash the server.
files = {
    'file': ('test_audio.webm', b'\x1a\x45\xdf\xa3', 'audio/webm') # Minimal EBML header signature
}

url = "http://localhost:8000/api/analyze_audio"
data = {"scenario": "Free Talk"}

print(f"Sending request to {url}...")
try:
    response = requests.post(url, files=files, data=data)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Request failed: {e}")
