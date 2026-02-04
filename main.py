import os
import json
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import requests
import base64
import google.generativeai as genai
from dotenv import load_dotenv
from pathlib import Path

# Load env from parent directory if not in current
env_path = Path('.') / '.env'
if not env_path.exists():
    env_path = Path('..') / '.env'
load_dotenv(dotenv_path=env_path)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure Gemini
api_key = os.getenv("GOOGLE_API_KEY")
if not api_key:
    # Try getting it from the user's existing config if possible, or just warn
    print("Warning: GOOGLE_API_KEY not found in environment variables.")

if api_key:
    genai.configure(api_key=api_key)

import time

# Prioritizing stable, high-performance models based on availability in 2026.
MODELS_TO_TRY = [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-flash-latest',
    'gemini-pro-latest'
]


# Cache for the first found working model to speed up subsequent requests
_working_model = None

def get_best_model():
    global _working_model
    if _working_model:
        return _working_model
    
    if not api_key:
        return None
        
    try:
        available_models = [m.name for m in genai.list_models() if 'generateContent' in m.supported_generation_methods]
        print(f"DEBUG: Available Gemini models: {available_models}")
        
        for preferred in MODELS_TO_TRY:
            for available in available_models:
                # Check if preferred is in available name (e.g. 'gemini-2.0-flash' in 'models/gemini-2.0-flash')
                if preferred in available:
                    _working_model = available
                    print(f"DEBUG: Selected best model: {_working_model}")
                    return _working_model
        
        if available_models:
            # Fallback to the first flash model if possible
            flash_models = [m for m in available_models if 'flash' in m.lower()]
            _working_model = flash_models[0] if flash_models else available_models[0]
            print(f"DEBUG: No preferred model found. Using fallback: {_working_model}")
            return _working_model
    except Exception as e:
        print(f"DEBUG: Error listing models: {e}")
        # Fallback to a safe default if listing fails
        return 'gemini-1.5-flash'
    
    return None

class ChatRequest(BaseModel):
    message: str
    scenario: str = "Free Talk"

@app.post("/api/transcribe")
async def transcribe(file: UploadFile = File(...)):
    if not api_key:
        raise HTTPException(status_code=500, detail="API Key not configured")

    content = await file.read()
    b64_content = base64.b64encode(content).decode('utf-8')

    url = f"https://speech.googleapis.com/v1/speech:recognize?key={api_key}"
    
    # Configure for Browser-recorded WEBM (Opus)
    payload = {
        "config": {
            "encoding": "WEBM_OPUS",
            "languageCode": "nl-BE", # [INTEGRATION] Enforcing Flemish for Stitch UI
            "enableAutomaticPunctuation": True
        },
        "audio": {
            "content": b64_content
        }
    }

    try:
        response = requests.post(url, json=payload)
        # Check specific error response from Google
        if response.status_code != 200:
             print(f"Google Speech API Error: {response.text}")
             raise HTTPException(status_code=response.status_code, detail=f"Google Speech API Error: {response.text}")
             
        result = response.json()
        
        transcript = ""
        if "results" in result:
            for res in result["results"]:
                if "alternatives" in res:
                    transcript += res["alternatives"][0]["transcript"] + " "
        
        return {"transcript": transcript.strip()}

    except Exception as e:
        print(f"Transcription failed: {e}")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")

@app.post("/api/chat")
async def chat(request: ChatRequest):
    if not api_key:
        raise HTTPException(status_code=500, detail="API Key not configured. Please check your .env file.")
    
    # Define roleplay context based on scenario
    scenario_context = ""
    if request.scenario == "Cafe":
        scenario_context = "Je bent een ober in een gezellige Vlaamse brasserie. De klant bestelt iets te drinken of te eten. Wees beleefd maar hartelijk."
    elif request.scenario == "Job Interview":
        scenario_context = "Je bent een HR-manager bij een innovatief Vlaams bedrijf. Je neemt een sollicitatiegesprek af voor een nieuwe functie. Stel relevante vragen."
    elif request.scenario == "Supermarket":
        scenario_context = "Je bent een vriendelijke medewerker aan de kassa van een Vlaamse supermarkt. Je helpt de klant met afrekenen of een vraag over een product."
    elif request.scenario == "Doctor":
        scenario_context = "Je bent de assistent in een dokterspraktijk. Je helpt de patiënt met een afspraak of een medische vraag aan de telefoon."
    else:
        scenario_context = "Je bent een enthousiaste Vlaamse taalbuddy die houdt van een spontane babbel over hobby's, het weer of de actualiteit."

    prompt = f"""
    Role: Je bent 'Mijn Vlaamse Buddy', een behulpzame en deskundige taalcoach gespecialiseerd in het Vlaams (Belgisch-Nederlands).
    
    Setting: {request.scenario} ({scenario_context})
    
    Input van de gebruiker: "{request.message}"
    
    Opdracht:
    1. Analyseer de input op grammatica, zinsbouw en woordkeuze.
    2. Geef constructieve feedback (Feedback) over eventuele fouten of hoe het natuurlijker kan in Vlaanderen.
    3. Geef een "Beter Alternatief" (Correction) dat klinkt als een 'native speaker' uit Vlaanderen. Gebruik gerust typisch Vlaamse tussentaal of zinswendingen indien gepast.
    4. Reageer (Response) op een warme, aanmoedigende manier als een echte buddy, gebruikmakend van 'gij/u' waar passend voor de regio. Stel ook een vervolgvraag om het gesprek gaande te houden.
    
    BELANGRIJK: Reageer ALTIJD in het Nederlands/Vlaams.
    
    JSON Output Format:
    {{
        "feedback": "Korte, duidelijke uitleg over de verbetering.",
        "correction": "De verbeterde of natuurlijkere zin.",
        "response": "Je persoonlijke reactie en vervolgvraag."
    }}
    """
    
    last_error = None
    rate_limit_encountered = False
    
    # Try models starting with the best found model
    best_model = get_best_model()
    current_models = [best_model] + [m for m in MODELS_TO_TRY if m != best_model]
    
    for model_name in current_models:
        if not model_name: continue
        for attempt in range(2):
            try:
                print(f"DEBUG: Processing request with model {model_name}...")
                model = genai.GenerativeModel(model_name)
                # Use async generation to avoid blocking event loop
                response = await model.generate_content_async(prompt)
                print(f"DEBUG: Response received from {model_name}")
                text = response.text
                
                # Check for empty response
                if not text:
                    raise Exception("Empty response from API")

                # Clean up markdown code blocks
                if "```json" in text:
                    text = text.split("```json")[1].split("```")[0]
                elif "```" in text:
                    text = text.split("```")[1].split("```")[0]
                    
                return json.loads(text.strip())
                
            except Exception as e:
                print(f"Model {model_name} failed on attempt {attempt+1}: {e}")
                last_error = e
                
                # If rate limit (429), handle smart waiting
                if "429" in str(e):
                    rate_limit_encountered = True
                    # Try to parse retry delay from error message (simple heuristic)
                    wait_time = 5 # Default short wait
                    if "retry_delay" in str(e):
                        # Extract seconds if possible, otherwise safe wait
                        wait_time = 10
                    
                    print(f"Rate limit hit. Waiting {wait_time} seconds before retrying/next model...")
                    time.sleep(wait_time)
                    # Loop will continue to next attempt for this model
                else:
                    # If it's not a rate limit (e.g. 404), don't retry this model, break to next model
                    break
    
    # If we get here, all models failed
    print(f"All models failed. Last error: {last_error}")
    
    if rate_limit_encountered:
         raise HTTPException(status_code=429, detail="AI Usage Quota Exceeded. Please wait 30 seconds and try again.")
         
@app.post("/api/analyze_audio")
async def analyze_audio(file: UploadFile = File(...), scenario: str = Form("Free Talk")):
    if not api_key:
        raise HTTPException(status_code=500, detail="API Key not configured")

    # Save temp file because Gemini API often needs a file path or defined mime type
    # For Flash, we can pass bytes directly with mime_type
    content = await file.read()
    
    # Prompt for multimodal analysis
    prompt = f"""
    Role: Je bent 'Mijn Vlaamse Buddy', een deskundige expert in de Vlaamse taal en uitspraak.
    
    Scenario: {scenario}
    
    Jouw opdrachten bij het luisteren naar de audio:
    1. Transcribeer de audio nauwkeurig (Transcript).
    2. Analyseer de UITSPRAAK (Pronunciation) diepgaand. Geef een score op 100 en wees specifiek: let op de harde 'g', de tweeklanken 'ui'/'ij', en de zachte 'l'. Geef concrete coaching tips.
    3. Controleer de grammatica en zinsbouw. Is dit hoe een Vlaming het zou zeggen?
    4. Bepaal het CEFR-niveau (A1-C2) met een korte, bemoedigende verantwoording.
    5. Geef een "Beter Alternatief" dat 100% natuurlijk en Vlaams klinkt.
    6. Reageer (Response) enthousiast op de inhoud van wat de gebruiker zei, in het Vlaams.
    
    JSON Output Format:
    {{
        "transcript": "Exacte transcriptie",
        "pronunciation_score": 85,
        "pronunciation_feedback": "Specifieke tips over klanken en intonatie.",
        "grammar_correction": "De gecorrigeerde of verbeterde zin.",
        "grammar_feedback": "Uitleg over grammatica- of woordkeuzefouten.",
        "better_alternative": "De meest natuurlijke Vlaamse manier om dit te verwoorden.",
        "cefr_level": "B2",
        "cefr_feedback": "Korte motivatie van het niveau.",
        "response": "Jouw gesprekspartner-reactie in het Vlaams."
    }}
    """
    
    # Use robust model selection
    best_model = get_best_model()
    current_models = [best_model] + [m for m in MODELS_TO_TRY if m != best_model]
    
    last_error = None
    for model_name in current_models:
        if not model_name: continue
        for attempt in range(2):
            try:
                print(f"DEBUG: Analyzing audio with {model_name} (attempt {attempt+1})...")
                
                model = genai.GenerativeModel(model_name)
                
                # Pass audio bytes and prompt
                response = await model.generate_content_async([
                    prompt,
                    {
                        "mime_type": "audio/webm",
                        "data": content
                    }
                ])
                
                text = response.text
                print(f"DEBUG: Response length: {len(text)}")
                
                # Clean markdown
                if "```json" in text:
                    text = text.split("```json")[1].split("```")[0]
                elif "```" in text:
                    text = text.split("```")[1].split("```")[0]
                    
                return json.loads(text.strip())

            except Exception as e:
                last_error = e
                error_str = str(e)
                print(f"Model {model_name} failed (attempt {attempt+1}): {error_str}")
                
                if "429" in error_str:
                    # Rate limit - wait and retry
                    print("Rate limit hit, waiting 10 seconds...")
                    time.sleep(10)
                else:
                    # Other error - try next model
                    break
    
    # All models failed - raise error
    print(f"CRITICAL: All models failed or rate limited at analyze_audio. Last error: {last_error}")
    raise HTTPException(status_code=500, detail=f"AI Analyse mislukt: {str(last_error)}")

# Keep old endpoints for compatibility if needed, but UI will switch to this one.


# Mount static files
# Resolve static directory relative to this file
static_dir = Path(__file__).parent / "static"
app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
