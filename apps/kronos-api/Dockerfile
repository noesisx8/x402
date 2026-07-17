# Kronos inference API (CPU). Clone upstream model package into /opt/kronos.
FROM python:3.11-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    KRONOS_REPO_PATH=/opt/kronos \
    KRONOS_DEVICE=cpu \
    KRONOS_WARM_ON_START=0 \
    HF_HOME=/models/hf \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PYTHONPATH=/opt/kronos:/app

RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Upstream Kronos (provides `model` package)
RUN git clone --depth 1 https://github.com/shiyu-coder/Kronos.git /opt/kronos

COPY requirements.txt .
# Prefer CPU wheels for torch — only our requirements (skip Kronos matplotlib pin war)
RUN pip install --no-cache-dir --extra-index-url https://download.pytorch.org/whl/cpu \
    -r requirements.txt

COPY app ./app

# Smoke-import FastAPI app at build time (does not load HF weights)
RUN python -c "from app.main import app; print('import_ok', app.title)"

EXPOSE 8080
ENV PORT=8080

# Shell form so $PORT expands (Railway Image/Dockerfile often uses exec form
# for overridden startCommand — keep the same pattern in railway.toml).
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}"]
