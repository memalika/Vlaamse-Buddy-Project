---
title: My Vlaamse Buddy
emoji: 🤖
colorFrom: green
colorTo: yellow
sdk: docker
pinned: false
---

# My Vlaamse Buddy 🇧🇪

A premium, interactive web application to practice Flemish (Dutch) conversation with AI feedback on pronunciation, grammar, and CEFR levels.

## Features
- **Real-time Speech Recognition**: Speak naturally in Flemish.
- **AI Feedback**: Get instant corrections on grammar, phrasing, and pronunciation.
- **CEFR Assessment**: Automatic classification of your Dutch level (A1-C2).
- **Voice Response**: The AI replies in spoken Dutch.
- **Premium UI**: Modern, dark-mode design with roleplay scenarios (Cafe, Job Interview, etc.).

## Setup

1. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Environment Variables**:
   Ensure you have a `.env` file in the project directory with your Google API key:
   ```
   GOOGLE_API_KEY=your_api_key_here
   ```

3. **Run the Application**:
   ```bash
   python main.py
   ```

4. **Start Practicing**:
   Open your browser and navigate to: [http://127.0.0.1:8000](http://127.0.0.1:8000)

## Deployment
This project is configured for deployment as a Docker container (e.g., on Hugging Face Spaces).

```bash
docker build -t vlaamse-buddy .
docker run -p 7860:7860 --env-file .env vlaamse-buddy
```
