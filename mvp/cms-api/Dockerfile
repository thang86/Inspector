FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY app.py .
COPY init_db.sql .

# Expose port
EXPOSE 5000

# Run Flask app
CMD ["python", "-u", "app.py"]
