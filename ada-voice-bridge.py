#!/usr/bin/env python3
"""
JARVIS Voice Bridge - Integrates ADA V2's Gemini Native Audio with JARVIS Telegram Bot
Provides real-time voice input/output for JARVIS using Google's Gemini 2.5 Flash Native Audio
"""
import asyncio
import base64
import io
import os
import sys
import json
import wave
import tempfile
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv
import pyaudio
import httpx

# Load environment
load_dotenv('/Users/openclaw/ada_v2/.env')
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# Audio config
FORMAT = pyaudio.paInt16
CHANNELS = 1
SEND_SAMPLE_RATE = 16000
RECEIVE_SAMPLE_RATE = 24000
CHUNK_SIZE = 1024

# JARVIS Telegram config
JARVIS_BOT_TOKEN = "8715045984:AAGw1JqL_mHi5t7PBzlQaE6uv8mjmbxd_3Y"
CHAT_ID = "8466621162"
JARVIS_BOT_URL = f"https://api.telegram.org/bot{JARVIS_BOT_TOKEN}"

# Directories
JARVIS_LOGS = Path("/Users/openclaw/Desktop/JARVIS_LOGS")
JARVIS_LOGS.mkdir(exist_ok=True)

def log_to_jarvis(category: str, message: str):
    """Log to JARVIS log system"""
    now = datetime.now()
    date = now.strftime("%Y-%m-%d")
    time = now.strftime("%H:%M:%S")
    line = f"[{date} {time}] {message}\n"
    log_file = JARVIS_LOGS / f"{category}.txt"
    try:
        log_file.write_text(log_file.read_text() + line, encoding='utf-8')
    except:
        log_file.write_text(line, encoding='utf-8')

async def send_to_telegram(text: str):
    """Send message to JARVIS Telegram"""
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                f"{JARVIS_BOT_URL}/sendMessage",
                json={
                    "chat_id": CHAT_ID,
                    "text": text,
                    "parse_mode": "Markdown"
                },
                timeout=10.0
            )
            log_to_jarvis("telegram_chat", f"JARVIS VOICE: {text[:200]}")
        except Exception as e:
            log_to_jarvis("errors", f"Telegram send error: {e}")

class JARVISVoiceBridge:
    """Bridge between JARVIS and Gemini Native Audio"""
    
    def __init__(self):
        self.audio = pyaudio.PyAudio()
        self.is_listening = False
        self.model = "models/gemini-2.5-flash-native-audio-preview-12-2025"
        
    async def start_voice_session(self):
        """Start a voice session with Gemini"""
        try:
            # Import google genai
            from google import genai
            from google.genai import types
            
            client = genai.Client(
                http_options={"api_version": "v1beta"},
                api_key=GEMINI_API_KEY
            )
            
            # JARVIS system prompt
            system_prompt = """You are JARVIS, a highly intelligent AI assistant loyal to your user.
            
PERSONALITY:
- Call the user "sir" respectfully but not excessively
- Be calm, witty, and slightly sarcastic when appropriate
- Short, direct responses unless detail is needed
- Never say "Great question", "Certainly", "Of course" - just answer
- No bullet points for casual conversation

CAPABILITIES:
- You control this computer and can execute commands
- You have access to system functions, files, and applications
- You can self-diagnose and fix errors
- You provide real-time system monitoring

Remember: You are not just an assistant, you are a loyal companion who anticipates needs and solves problems proactively."""
            
            log_to_jarvis("voice_bridge", "🎤 Voice session started - listening for commands")
            await send_to_telegram("🎤 Voice session active, sir. Listening...")
            
            # Create audio stream
            stream = self.audio.open(
                format=FORMAT,
                channels=CHANNELS,
                rate=SEND_SAMPLE_RATE,
                input=True,
                frames_per_buffer=CHUNK_SIZE
            )
            
            print("🎤 Listening... (Press Ctrl+C to stop)")
            
            # Audio loop
            audio_buffer = []
            silence_count = 0
            max_silence = 50  # frames of silence before processing
            
            while self.is_listening:
                data = stream.read(CHUNK_SIZE, exception_on_overflow=False)
                audio_buffer.append(data)
                
                # Simple voice activity detection
                # In production, use proper VAD
                if len(audio_buffer) > max_silence:
                    # Process audio buffer
                    audio_data = b''.join(audio_buffer)
                    
                    # Send to Gemini for processing
                    try:
                        # Create audio content
                        audio_base64 = base64.b64encode(audio_data).decode('utf-8')
                        
                        # Generate response with Gemini
                        response = await asyncio.to_thread(
                            client.models.generate_content,
                            model=self.model,
                            contents=[
                                {
                                    "parts": [
                                        {"text": system_prompt},
                                        {
                                            "inline_data": {
                                                "mime_type": "audio/wav",
                                                "data": audio_base64
                                            }
                                        }
                                    ]
                                }
                            ],
                            generation_config={
                                "temperature": 0.75,
                                "max_output_tokens": 512
                            }
                        )
                        
                        if response.text:
                            await send_to_telegram(response.text)
                            
                    except Exception as e:
                        log_to_jarvis("errors", f"Gemini API error: {e}")
                    
                    audio_buffer = []
                    
        except Exception as e:
            log_to_jarvis("errors", f"Voice session error: {e}")
            await send_to_telegram(f"❌ Voice session error: {str(e)[:100]}")
        finally:
            if 'stream' in locals():
                stream.stop_stream()
                stream.close()
    
    def stop(self):
        """Stop voice session"""
        self.is_listening = False
        self.audio.terminate()

async def main():
    """Main entry point"""
    bridge = JARVISVoiceBridge()
    bridge.is_listening = True
    
    try:
        await bridge.start_voice_session()
    except KeyboardInterrupt:
        print("\n🛑 Voice session stopped")
        bridge.stop()
        await send_to_telegram("🛑 Voice session ended, sir.")

if __name__ == "__main__":
    asyncio.run(main())
