import io
import torch
import scipy.io.wavfile
import numpy as np
import urllib.parse
from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from transformers import pipeline

app = FastAPI()

# 1. Setup CORS so your Vite app can talk to this server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"], 
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Assistant-Text"],
)

# 2. Load Models (These will download on the first run)
# 'device=0' uses GPU if you have one, otherwise use 'device=-1' for CPU
print("Loading LLM...")
chat_pipe = pipeline("text-generation", model="TinyLlama/TinyLlama-1.1B-Chat-v1.0", device=-1)

print("Loading TTS...")
tts_pipe = pipeline("text-to-speech", model="facebook/mms-tts-eng", device=-1)

class Query(BaseModel):
    text: str

@app.post("/ask")
async def ask_agent(query: Query):
    try:
        # Step A: Generate text response
        # We use a chat template to tell the model how to behave
        messages = [
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": query.text},
        ]
        prompt = chat_pipe.tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
        
        chat_outputs = chat_pipe(prompt, max_new_tokens=500, do_sample=True, temperature=0.7)
        # Extract only the assistant's new text
        full_text = chat_outputs[0]["generated_text"]
        answer_text = full_text.split("<|assistant|>")[-1].strip()

        # Step B: Generate Audio from the text
        audio_output = tts_pipe(answer_text)
        
        # Step C: Convert the numpy array to WAV bytes
        byte_io = io.BytesIO()
        # audio_output["audio"] can be a list or array; normalize to a numpy array
        raw_audio = audio_output.get("audio")
        if isinstance(raw_audio, list) or isinstance(raw_audio, tuple):
            arr = np.asarray(raw_audio[0])
        else:
            arr = np.asarray(raw_audio)

        # Ensure array is 2D (samples, channels) because some scipy versions expect that
        if arr.ndim == 1:
            arr = arr.reshape(-1, 1)

        scipy.io.wavfile.write(
            byte_io,
            rate=int(audio_output["sampling_rate"]),
            data=arr
        )
        # Include the assistant's text in a response header so the frontend can display it
        # URL-encode the text to make it safe for headers
        safe_text = urllib.parse.quote(answer_text or "")
        return Response(content=byte_io.getvalue(), media_type="audio/wav", headers={"X-Assistant-Text": safe_text})
    except Exception:
        # Return the full traceback in the response for local debugging
        import traceback
        tb = traceback.format_exc()
        return Response(content=tb, media_type="text/plain", status_code=500)


if __name__ == "__main__":
    # Run a production ASGI server so this script blocks and listens for requests
    # Install uvicorn if you don't have it: pip install uvicorn[standard]
    import uvicorn

    # Bind to 0.0.0.0 so it's reachable from other hosts/containers if needed.
    # Change host/port as appropriate for your environment.
    uvicorn.run(app, host="0.0.0.0", port=8000)