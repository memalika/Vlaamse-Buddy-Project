import os
import google.generativeai as genai
from dotenv import load_dotenv
from pathlib import Path

# Load env explicitly
env_path = Path('.') / '.env'
if not env_path.exists():
    print("No .env found in current dir")
    # try parent
    env_path = Path('..') / '.env'

print(f"Loading env from: {env_path.absolute()}")
load_dotenv(dotenv_path=env_path)

api_key = os.getenv("GOOGLE_API_KEY")
if not api_key:
    print("ERROR: GOOGLE_API_KEY not found in env")
    exit(1)

print(f"API Key found: {api_key[:5]}...{api_key[-5:]}")

genai.configure(api_key=api_key)

print("Attempting to generate content with gemini-1.5-flash...")
try:
    model = genai.GenerativeModel('gemini-1.5-flash')
    response = model.generate_content("Hello, can you hear me?")
    print("Success!")
    print(f"Response: {response.text}")
except Exception as e:
    print(f"FAILED: {e}")
    
    # Try pro
    print("Retrying with gemini-pro...")
    try:
        model = genai.GenerativeModel('gemini-pro')
        response = model.generate_content("Hello?")
        print("Success with Pro!")
    except Exception as e2:
         print(f"Pro FAILED too: {e2}")
