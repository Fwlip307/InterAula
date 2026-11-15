FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1
WORKDIR /app
COPY requirements.txt .
COPY wheels /wheels
RUN --mount=type=cache,target=/root/.cache/pip if [ -f /wheels/manifest.json ]; then pip install --no-index --find-links=/wheels -r requirements.txt; else pip install --only-binary=:all: --retries 8 --timeout 90 --progress-bar off -r requirements.txt; fi && useradd --uid 10001 --create-home app
COPY engine.py server.py ./
USER app
EXPOSE 8000
CMD ["python", "server.py", "--host", "0.0.0.0", "--port", "8000"]
