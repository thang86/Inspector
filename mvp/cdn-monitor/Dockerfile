FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY monitor.py .

# Create log directory
RUN mkdir -p /var/log

# Run monitor
CMD ["python", "-u", "monitor.py"]
