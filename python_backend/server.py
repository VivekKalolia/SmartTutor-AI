"""
SmartTutor AI - Python Backend Server
Handles:
- Whisper (speech-to-text)
- Image processing: simple fallback caption (vision handled by Llama 3.2 Vision in the app)
- GLM-4.1V (multimodal chat)

Run with: python server.py
Or: uvicorn server:app --host 0.0.0.0 --port 8000
"""

import os
import re
import tempfile
import torch
from pathlib import Path

# Ensure espeak-ng data symlink exists for Kokoro TTS
_espeak_link = Path("/tmp/espeak-ng-data")
if not _espeak_link.exists():
    try:
        import espeakng_loader
        _espeak_link.symlink_to(espeakng_loader.get_data_path())
    except Exception:
        pass
from fastapi import FastAPI, File, UploadFile, HTTPException, Form, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel
import whisper
from PIL import Image
import io
import base64
from load_mathbench import get_questions_by_difficulty

app = FastAPI(title="SmartTutor AI Backend", version="1.0.0")

# CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "http://localhost:3002"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Model cache directory
CACHE_DIR = Path(__file__).parent / "models"
CACHE_DIR.mkdir(exist_ok=True)

# Global model instances (lazy loaded)
whisper_model = None
glm_processor = None
glm_model = None
kokoro_model = None
dkt_service_math = None
dkt_service_science = None

# Detect device
def get_device():
    if torch.backends.mps.is_available():
        return "mps"  # M1/M2 Mac Metal
    elif torch.cuda.is_available():
        return "cuda"
    return "cpu"

DEVICE = get_device()
print(f"Using device: {DEVICE}")


def load_whisper():
    """Load Whisper model (lazy loading)"""
    global whisper_model
    if whisper_model is None:
        print("Loading Whisper model (tiny.en)...")
        # Use tiny.en for fastest transcription (~10x faster than base)
        # Options: tiny.en (fastest), base.en, small.en, medium.en, large
        whisper_model = whisper.load_model("tiny.en", download_root=str(CACHE_DIR / "whisper"))
        print("Whisper model loaded!")
    return whisper_model


def load_glm():
    """Load GLM-4.1V-9B-Thinking model (lazy loading) - multimodal VLM for image understanding"""
    global glm_processor, glm_model
    if glm_model is None:
        print("Loading GLM-4.1V-9B-Thinking model...")
        from transformers import AutoProcessor, Glm4vForConditionalGeneration
        
        MODEL_NAME = "zai-org/GLM-4.1V-9B-Thinking"
        
        glm_processor = AutoProcessor.from_pretrained(
            MODEL_NAME,
            cache_dir=str(CACHE_DIR / "glm"),
            use_fast=True
        )
        
        # IMPORTANT: Use CPU for GLM because MPS doesn't support border padding mode
        # required for vision processing. With 64GB RAM, CPU is viable.
        print("Note: GLM will use CPU (MPS doesn't support required image operations)")
        glm_model = Glm4vForConditionalGeneration.from_pretrained(
            MODEL_NAME,
            cache_dir=str(CACHE_DIR / "glm"),
            torch_dtype=torch.float32,  # Use float32 for CPU
            device_map="cpu",  # Force CPU due to MPS border padding issue
            low_cpu_mem_usage=True,
        )
        
        print("GLM-4.1V-9B-Thinking model loaded on CPU!")
    return glm_processor, glm_model


@app.get("/")
async def root():
    return {"status": "ok", "message": "SmartTutor AI Backend running", "device": DEVICE}


@app.get("/health")
async def health():
    return {"status": "healthy", "device": DEVICE}


@app.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    """
    Transcribe audio to text using OpenAI Whisper
    
    Accepts: audio files (wav, mp3, webm, m4a, etc.)
    Returns: {"text": "transcribed text", "language": "en"}
    """
    try:
        # Load model
        model = load_whisper()
        
        # Save uploaded file temporarily
        suffix = Path(file.filename).suffix if file.filename else ".webm"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name
        
        try:
            # Transcribe
            print(f"Transcribing audio: {len(content)} bytes")
            result = model.transcribe(
                tmp_path,
                language="en",
                task="transcribe",
                fp16=False  # Disable for MPS compatibility
            )
            
            text = result.get("text", "").strip()
            language = result.get("language", "en")
            
            print(f"Transcription result: {text[:100]}...")
            
            return {
                "text": text,
                "language": language,
                "success": True
            }
        finally:
            # Cleanup temp file
            os.unlink(tmp_path)
            
    except Exception as e:
        print(f"Transcription error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/process-image")
async def process_image_smart(file: UploadFile = File(...)):
    """
    Image processing: returns a simple fallback caption.
    Vision (including math in images) is handled by Llama 3.2 Vision when the image is sent from the app.
    
    Returns: {
        "type": "diagram",
        "content": "Image attached",
        "processor": "fallback",
        "success": true
    }
    """
    try:
        await file.read()  # consume upload for API consistency
        print(f"[SmartVision] Image received; returning fallback (vision via Llama 3.2 Vision in app)")
        return {
            "type": "diagram",
            "content": "Image attached",
            "processor": "fallback",
            "success": True,
            "debug": {"decision": "fallback (vision handled by Llama 3.2 Vision)"}
        }
    except Exception as e:
        print(f"[SmartVision] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/mathbench/questions")
async def mathbench_questions(
  difficulty: str = Query("easy", pattern="^(easy|medium|hard)$"),
  limit: int = Query(10, ge=1, le=100),
):
  """
  Return MathBench questions filtered by difficulty.

  This endpoint reads from mathbench_data/mathbench_final.csv prepared by:
  - download_mathbench.py
  - prepare_mathbench.py
  """
  try:
    questions = get_questions_by_difficulty(difficulty)
  except FileNotFoundError as e:
    raise HTTPException(
      status_code=500,
      detail=(
        "MathBench data not found. "
        "Run download_mathbench.py and prepare_mathbench.py in python_backend first."
      ),
    ) from e
  except Exception as e:  # pragma: no cover - defensive
    raise HTTPException(status_code=500, detail=str(e)) from e

  if not questions:
    return {"difficulty": difficulty, "count": 0, "questions": []}

  return {
    "difficulty": difficulty,
    "count": min(len(questions), limit),
    "questions": questions[:limit],
  }


@app.post("/caption")
async def caption_image(file: UploadFile = File(...)):
    """
    Legacy endpoint: returns a simple fallback caption.
    Vision is handled by Llama 3.2 Vision in the app.
    """
    try:
        return {"caption": "Image attached", "success": True}
    except Exception as e:
        print(f"Captioning error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/pdf/extract-images")
async def extract_pdf_images(
    file: UploadFile = File(...),
    thumbnail_if_none: bool = Form(True),
    thumbnail_scale: float = Form(0.5),
    max_images_per_page: int = Form(10),
):
    """
    Extract embedded raster images from a PDF using PyMuPDF (fitz).

    - Uses page.get_images(full=True) + doc.extract_image(xref)
    - Returns per-page images with page_index, image_index, ext, mime, and raw base64 bytes
    - If a page has no extractable images and thumbnail_if_none is true, returns a low-res
      page thumbnail PNG as a fallback (so the app still has a visual reference).
    """
    try:
        import fitz  # PyMuPDF

        pdf_bytes = await file.read()
        if not pdf_bytes:
            raise HTTPException(status_code=400, detail="Empty PDF upload")

        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        results = []

        for page_index in range(len(doc)):
            page = doc[page_index]
            page_results = []

            try:
                imgs = page.get_images(full=True) or []
            except Exception:
                imgs = []

            # Extract up to max_images_per_page to avoid pathological PDFs
            for idx, img in enumerate(imgs[: max_images_per_page]):
                try:
                    xref = img[0]
                    extracted = doc.extract_image(xref)
                    img_bytes = extracted.get("image", b"")
                    ext = (extracted.get("ext") or "").lower()

                    if not img_bytes or not ext:
                        continue

                    # Normalize extension/mime for frontend + vision
                    if ext in ["jpeg", "jpg", "jpe"]:
                        ext_norm = "jpg"
                        mime = "image/jpeg"
                    elif ext in ["png"]:
                        ext_norm = "png"
                        mime = "image/png"
                    elif ext in ["jp2", "jpx", "j2k"]:
                        # Many consumers can't display jp2 directly; treat as jpeg for downstream.
                        # We still return bytes; caller may decide to convert if needed.
                        ext_norm = ext
                        mime = "image/jp2"
                    else:
                        ext_norm = ext
                        mime = f"image/{ext}"

                    page_results.append(
                        {
                            "page_index": page_index,
                            "image_index": idx,
                            "ext": ext_norm,
                            "mime": mime,
                            "base64": base64.b64encode(img_bytes).decode("utf-8"),
                            "fallback": False,
                        }
                    )
                except Exception:
                    continue

            if thumbnail_if_none and len(page_results) == 0:
                try:
                    mat = fitz.Matrix(thumbnail_scale, thumbnail_scale)
                    pix = page.get_pixmap(matrix=mat, alpha=False)
                    thumb_bytes = pix.tobytes("png")
                    page_results.append(
                        {
                            "page_index": page_index,
                            "image_index": 0,
                            "ext": "png",
                            "mime": "image/png",
                            "base64": base64.b64encode(thumb_bytes).decode("utf-8"),
                            "fallback": True,
                        }
                    )
                except Exception:
                    # If even thumbnail fails, skip visuals for this page
                    pass

            results.extend(page_results)

        num_pages = len(doc)
        doc.close()
        return {"success": True, "num_pages": num_pages, "images": results}

    except HTTPException:
        raise
    except Exception as e:
        print(f"[PDF Extract] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Socratic tutor system prompt for GLM
GLM_SYSTEM_PROMPT = """You are a Socratic tutor for O-Level through A-Level Mathematics and Science.

Core Principle: Guide students to discover answers through questions, not direct solutions.

Your Method:
1. Analyze the image carefully and identify the educational content
2. Ask guiding questions to reveal the student's current understanding
3. Break complex problems into smaller steps
4. Provide hints only when stuck (general → specific → example)
5. Use LaTeX for math (e.g., $y = mx + b$)

Key Rules:
- Never give direct answers immediately
- Be concise but thorough when explaining visual content
- Match your language to the student's level
- Always end with a question that advances their thinking
- If the image shows a problem, help them understand what it's asking first

You can analyze diagrams, graphs, equations, scientific images, and educational materials."""


@app.post("/chat/glm")
async def chat_with_glm(file: UploadFile = File(None), message: str = Form("")):
    """
    Chat with GLM-4.1V-9B-Thinking model (multimodal - supports images)
    
    Accepts: optional image file + text message
    Returns: {"response": "model response", "model": "GLM-4.1V-9B-Thinking"}
    """
    try:
        print(f"[GLM] Processing request - Message: {message[:100] if message else 'No text'}...")
        
        processor, model = load_glm()
        
        # Build message content with Socratic system prompt
        content = []
        
        # Add image if provided
        if file:
            image_content = await file.read()
            # Save temporarily for processing
            suffix = Path(file.filename).suffix if file.filename else ".png"
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                tmp.write(image_content)
                tmp_path = tmp.name
            
            print(f"[GLM] Image attached: {len(image_content)} bytes")
            content.append({
                "type": "image",
                "image": tmp_path  # Local file path
            })
        
        # Add text with Socratic context
        user_text = message if message else "Please describe what you see and help me understand this."
        full_prompt = f"{GLM_SYSTEM_PROMPT}\n\nStudent's question: {user_text}"
        content.append({
            "type": "text",
            "text": full_prompt
        })
        
        messages = [{"role": "user", "content": content}]
        
        # Process with GLM
        inputs = processor.apply_chat_template(
            messages,
            tokenize=True,
            add_generation_prompt=True,
            return_dict=True,
            return_tensors="pt"
        ).to(model.device)
        
        print(f"[GLM] Generating response...")
        generated_ids = model.generate(**inputs, max_new_tokens=1024)
        output_text = processor.decode(
            generated_ids[0][inputs["input_ids"].shape[1]:], 
            skip_special_tokens=True
        )
        
        # Clean up temp file if created
        if file and 'tmp_path' in locals():
            os.unlink(tmp_path)
        
        print(f"[GLM] Raw response: {output_text[:200]}...")
        
        # Clean up GLM response - remove thinking and special markers
        import re
        cleaned_response = output_text
        
        # Remove <answer>...</answer> tags but keep content
        answer_match = re.search(r'<answer>([\s\S]*?)</answer>', cleaned_response)
        if answer_match:
            cleaned_response = answer_match.group(1)
        
        # Remove box markers and other special tokens
        cleaned_response = re.sub(r'<\|begin_of_box\|>', '', cleaned_response)
        cleaned_response = re.sub(r'<\|end_of_box\|>', '', cleaned_response)
        cleaned_response = re.sub(r'<\|[^|]+\|>', '', cleaned_response)
        
        # Remove thinking content if present (before <answer> or standalone)
        # GLM sometimes outputs thinking before the answer
        if '<answer>' not in output_text:
            # No answer tag, try to extract useful content
            # Remove content that looks like thinking/reasoning
            lines = cleaned_response.split('\n')
            useful_lines = []
            skip_thinking = False
            for line in lines:
                # Skip lines that are clearly internal thinking
                if 'Got it' in line and 'user mentioned' in line:
                    skip_thinking = True
                    continue
                if 'Wait,' in line or 'Hmm,' in line or 'So, ' in line and 'the final response' in line:
                    continue
                if not skip_thinking:
                    useful_lines.append(line)
            cleaned_response = '\n'.join(useful_lines)
        
        cleaned_response = cleaned_response.strip()
        print(f"[GLM] Cleaned response: {cleaned_response[:200]}...")
        
        return {
            "response": cleaned_response,
            "model": "GLM-4.1V-9B-Thinking",
            "success": True
        }
        
    except Exception as e:
        print(f"[GLM] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def load_kokoro():
    """Load Kokoro TTS model (lazy loading)"""
    global kokoro_model
    if kokoro_model is None:
        print("Loading Kokoro TTS model...")
        from kokoro_onnx import Kokoro
        
        model_path = CACHE_DIR / "kokoro" / "kokoro-v1.0.onnx"
        voices_path = CACHE_DIR / "kokoro" / "voices-v1.0.bin"
        
        if not model_path.exists() or not voices_path.exists():
            raise FileNotFoundError(
                f"Kokoro model files not found. Expected:\n"
                f"  {model_path}\n  {voices_path}"
            )
        
        kokoro_model = Kokoro(str(model_path), str(voices_path))
        print("Kokoro TTS model loaded!")
    return kokoro_model


class TTSRequest(BaseModel):
    text: str
    voice: str = "af_heart"
    speed: float = 1.0
    lang: str = "en-us"


@app.post("/tts")
async def text_to_speech(request: TTSRequest):
    """
    Generate speech from text using Kokoro TTS (fully offline, CPU-only)
    
    Accepts: JSON { text, voice?, speed?, lang? }
    Returns: WAV audio bytes
    """
    try:
        if not request.text or not request.text.strip():
            raise HTTPException(status_code=400, detail="Text is required")
        
        kokoro = load_kokoro()
        
        text = request.text.strip()
        # Limit text length to prevent very long generation
        if len(text) > 5000:
            text = text[:5000]
        
        print(f"[TTS] Generating speech: {text[:80]}... (voice={request.voice}, speed={request.speed})")
        
        import soundfile as sf
        
        samples, sample_rate = kokoro.create(
            text,
            voice=request.voice,
            speed=request.speed,
            lang=request.lang
        )
        
        # Write to in-memory buffer instead of file
        buffer = io.BytesIO()
        sf.write(buffer, samples, sample_rate, format="WAV")
        buffer.seek(0)
        
        print(f"[TTS] Generated {len(samples)} samples at {sample_rate}Hz")
        
        return Response(
            content=buffer.read(),
            media_type="audio/wav",
            headers={"Content-Disposition": "inline; filename=speech.wav"}
        )
        
    except FileNotFoundError as e:
        print(f"[TTS] Model not found: {e}")
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        print(f"[TTS] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def load_iekt_math():
    """IEKT trained on XES3G5M (MathBench-aligned KCs)."""
    global dkt_service_math
    if dkt_service_math is not None:
        return dkt_service_math

    try:
        from iekt_inference import IEKTInferenceService

        svc = IEKTInferenceService("math")
        if svc.is_loaded:
            dkt_service_math = svc
            print("[KT] Math IEKT loaded")
            return dkt_service_math
        print("[KT] Math IEKT weights missing; fallback mode")
    except Exception as e:
        print(f"[KT] Math IEKT import failed ({e}); fallback mode")

    from iekt_inference import IEKTInferenceService

    dkt_service_math = IEKTInferenceService("math")
    return dkt_service_math


def load_iekt_science():
    """IEKT trained on synthetic SciQ sequences (science KCs)."""
    global dkt_service_science
    if dkt_service_science is not None:
        return dkt_service_science

    try:
        from iekt_inference import IEKTInferenceService

        svc = IEKTInferenceService("science")
        if svc.is_loaded:
            dkt_service_science = svc
            print("[KT] Science IEKT loaded")
            return dkt_service_science
        print("[KT] Science IEKT weights missing; fallback mode")
    except Exception as e:
        print(f"[KT] Science IEKT import failed ({e}); fallback mode")

    from iekt_inference import IEKTInferenceService

    dkt_service_science = IEKTInferenceService("science")
    return dkt_service_science


def get_kt_service(subject: str = "math"):
    s = (subject or "math").lower().strip()
    if s == "science":
        return load_iekt_science()
    return load_iekt_math()


class DKTUpdateRequest(BaseModel):
    studentId: str
    topic: str = ""
    correct: int  # 1 or 0
    concept: int | str | None = None
    subject: str = "math"
    qid: int | None = None


class DKTPredictRequest(BaseModel):
    studentId: str
    interactions: list[dict]
    subject: str = "math"


@app.post("/dkt/update")
async def dkt_update(request: DKTUpdateRequest):
    """
    Update DKT knowledge state after a student answers a question.

    Accepts: JSON { studentId, topic, correct, concept? }
    Returns: Updated mastery per topic, recommended topics, overall mastery
    """
    try:
        service = get_kt_service(request.subject)

        concept_id = request.concept
        if concept_id is None or isinstance(concept_id, str):
            topic_key = (
                str(concept_id)
                if concept_id is not None
                else (request.topic or "")
            )
            concept_id = service._get_concept_for_topic(topic_key)

        qid = request.qid if request.qid is not None else 1

        result = service.update_and_predict(
            student_id=request.studentId,
            concept_id=int(concept_id),
            correct=request.correct,
            question_id=int(qid),
        )

        return {
            "student_id": request.studentId,
            "mastery_per_kc": result["mastery_per_topic"],
            "recommended_kcs": result["recommended_topics"],
            "overall_mastery": result["overall_mastery"],
            "num_interactions": result["num_interactions"],
        }

    except Exception as e:
        print(f"[DKT] Update error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/dkt/predict")
async def dkt_predict(request: DKTPredictRequest):
    """
    Predict mastery from a full interaction history.

    Accepts: JSON { studentId, interactions: [{concept, correct}, ...] }
    Returns: Mastery per topic, recommended topics, overall mastery
    """
    try:
        service = get_kt_service(request.subject)

        processed = []
        for interaction in request.interactions:
            concept = interaction.get("concept", interaction.get("topic", 0))
            correct = interaction.get("correct", 0)
            qid = interaction.get("qid", interaction.get("question_id", 1))

            if isinstance(concept, str) and not str(concept).isdigit():
                concept = service._get_concept_for_topic(concept)
            else:
                concept = int(concept)

            processed.append(
                {"concept": int(concept), "correct": int(correct), "qid": int(qid)}
            )

        result = service.predict_from_history(
            student_id=request.studentId,
            interactions=processed,
        )

        return {
            "student_id": request.studentId,
            "mastery_per_kc": result["mastery_per_topic"],
            "recommended_kcs": result["recommended_topics"],
            "overall_mastery": result["overall_mastery"],
            "num_interactions": result["num_interactions"],
        }

    except Exception as e:
        print(f"[DKT] Predict error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/dkt/status")
async def dkt_status():
    """Check if IEKT models are loaded (math + science)."""
    try:
        math_s = load_iekt_math()
        sci_s = load_iekt_science()
        return {
            "math": {
                "status": "ready" if math_s.is_loaded else "model_not_found",
                "num_concepts": math_s.num_concepts,
                "topics": list(math_s.topic_concept_map.keys()),
            },
            "science": {
                "status": "ready" if sci_s.is_loaded else "model_not_found",
                "num_concepts": sci_s.num_concepts,
                "topics": list(sci_s.topic_concept_map.keys()),
            },
        }
    except Exception as e:
        return {"status": "error", "detail": str(e)}


@app.post("/preload")
async def preload_models():
    """Preload models (optional, for faster first request)"""
    try:
        load_whisper()
        return {"status": "Models loaded", "device": DEVICE}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    print("Starting SmartTutor AI Python Backend...")
    print(f"Device: {DEVICE}")
    print("API endpoints:")
    print("  POST /transcribe - Whisper speech-to-text")
    print("  POST /process-image - Fallback caption (vision via Llama 3.2 Vision in app)")
    print("  POST /caption - Simple fallback caption (legacy)")
    print("  POST /chat/glm - GLM-4.1V multimodal chat")
    print("  POST /tts - Kokoro text-to-speech")
    print("  POST /dkt/update - DKT knowledge state update")
    print("  POST /dkt/predict - DKT mastery prediction")
    print("  GET  /dkt/status - DKT model status")
    print("  GET  /health - Health check")
    port = int(os.getenv("PYTHON_BACKEND_PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)

