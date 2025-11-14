FROM python:3.11-slim

# Install FFmpeg for snapshot capture and metadata extraction
RUN apt-get update && apt-get install -y \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY snapshot.py .

# Create snapshot directory
RUN mkdir -p /var/snapshots /var/log

# Run the snapshot service
CMD ["python", "-u", "snapshot.py"]
