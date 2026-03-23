# SmartTutor AI - Python Backend

This backend provides **OpenAI Whisper** for speech-to-text and **Salesforce BLIP2** for image captioning.

## Requirements

- Python 3.9+
- ffmpeg (for audio processing)
- ~6GB disk space for models

## Quick Setup (One-Time)

```bash
# 1. Navigate to python_backend
cd python_backend

# 2. Run setup script
chmod +x setup.sh
./setup.sh
```

## Manual Setup

```bash
# 1. Create virtual environment
python3 -m venv venv
source venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Install ffmpeg (if not installed)
brew install ffmpeg  # macOS
```

## Running the Server

```bash
cd python_backend
source venv/bin/activate
python server.py
```

The server runs on **http://localhost:8000**

## API Endpoints

### Speech-to-Text (Whisper)
```bash
POST /transcribe
Content-Type: multipart/form-data

# Form field: file (audio file)
```

### Image Captioning (BLIP2)
```bash
POST /caption
Content-Type: multipart/form-data

# Form field: file (image file)
```

### Health Check
```bash
GET /health
```

## First Run

On first run, the server will download:
- **Whisper base.en** (~150MB) - Optimized for English
- **BLIP2-opt-2.7b** (~5GB) - Image captioning model

Models are cached locally in `python_backend/models/` for offline use.

## Model Options

### Whisper Models (in `server.py`)
| Model | Size | Quality |
|-------|------|---------|
| tiny.en | ~40MB | Fastest, lower quality |
| base.en | ~150MB | Good balance (default) |
| small.en | ~500MB | Better quality |
| medium.en | ~1.5GB | High quality |
| large | ~3GB | Best quality, multilingual |

### BLIP2 Models
| Model | Size | Quality |
|-------|------|---------|
| blip2-opt-2.7b | ~5GB | Fast, good quality (default) |
| blip2-opt-6.7b-coco | ~13GB | Better quality |

To change models, edit `server.py`:
```python
# Whisper (line ~54)
whisper_model = whisper.load_model("small.en")

# BLIP2 (line ~63)
MODEL_NAME = "Salesforce/blip2-opt-6.7b-coco"
```

## Offline Mode

After initial model download, you can enable offline mode:

1. Edit `server.py`
2. Uncomment line: `os.environ['TRANSFORMERS_OFFLINE'] = '1'`

## Troubleshooting

### "ModuleNotFoundError: No module named 'whisper'"
```bash
pip install openai-whisper
```

### "ffmpeg not found"
```bash
brew install ffmpeg  # macOS
sudo apt install ffmpeg  # Ubuntu
```

### CUDA out of memory
The server auto-detects MPS (Apple Silicon) or CUDA. For CPU-only:
```python
# Edit server.py, force CPU
DEVICE = "cpu"
```

## Integration with Next.js

The frontend automatically calls this backend for:
- 🎤 **Voice Recording** → Whisper transcription
- 📷 **Image Upload** → BLIP2 captioning

Make sure this server is running when using these features!

