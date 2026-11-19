# Browsy Local AI Companion Service

This companion service connects Browsy to a locally running [Ollama](https://ollama.com/) instance without sending user queries or webpage content to external cloud AI APIs.

## Hardware Profile & Recommended Model

On standard development machines with 16 GB RAM and multi-core CPU (such as AMD Ryzen or Intel Core i7):
- **Recommended Model:** `qwen2.5:1.5b` or `qwen2.5:3b` (or `llama3.2:1b` / `llama3.2:3b`).
- **RAM Footprint:** ~1.2 GB to ~2.2 GB VRAM/RAM.
- **Inference Speed:** 25–45 tokens/second (smooth CPU/GPU acceleration).
- **Format:** Strict JSON schema generation with zero hallucination.

## Quick Start

### 1. Install & Start Ollama
Download and install Ollama from [ollama.com](https://ollama.com/).
```bash
# Verify Ollama is running
ollama --version

# Pull recommended model
ollama pull qwen2.5:1.5b

# Start Ollama service (if not running as background app)
ollama serve
```

### 2. Start Browsy Companion Service
```bash
# Node.js implementation (Recommended, zero extra dependencies)
npm run companion

# Or directly:
node backend/companion-service.mjs

# Or Python implementation:
python backend/companion_service.py
```

The service runs strictly on the loopback interface: `http://127.0.0.1:8765`.
