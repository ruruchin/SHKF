FROM pytorch/pytorch:2.2.2-cuda12.1-cudnn8-runtime

WORKDIR /app
COPY requirements.txt requirements-serve.txt ./
RUN pip install --no-cache-dir -r requirements.txt -r requirements-serve.txt

COPY . .
ENV PYTHONUNBUFFERED=1
ENV KONSTANCIA_API_KEY=""

EXPOSE 8080
CMD ["uvicorn", "serve_api:app", "--host", "0.0.0.0", "--port", "8080"]
