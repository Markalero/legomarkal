FROM mcr.microsoft.com/playwright/python:v1.40.0-jammy

# Set the working directory
WORKDIR /app

# Copy requirements first to leverage Docker cache
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Install Playwright browser (Chromium)
RUN playwright install chromium

# Copy the rest of the application
COPY . .

# Expose port
EXPOSE 10000

# Start FastAPI application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "10000"]
