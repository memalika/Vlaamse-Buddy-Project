FROM python:3.11-slim

# Create a non-root user
RUN useradd -m -u 1000 user
USER user
ENV PATH="/home/user/.local/bin:$PATH"

WORKDIR /app

# Copy the requirements file
COPY --chown=user requirements.txt ./requirements.txt
RUN pip install --no-cache-dir --user -r requirements.txt

# Copy everything else
COPY --chown=user . .

# Hugging Face default port
ENV PORT=8000

# We assume the code is directly in the root folder now
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
