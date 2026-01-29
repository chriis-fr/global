# PDF Parsing Service

FastAPI service for parsing PDF files and extracting field candidates.

## Setup

1. Install Python dependencies:
```bash
pip install -r requirements.txt
```

2. Run the service:
```bash
python main.py
```

Or with uvicorn directly:
```bash
uvicorn main:app --reload --port 8000
```

The service will run on `http://localhost:8000`

## API Endpoints

### POST /parse
Parse a PDF file and extract field candidates.

**Request:**
- Content-Type: multipart/form-data
- Body: `file` (PDF file)

**Response:**
```json
{
  "success": true,
  "fields": [
    {
      "value": "Invoice Number: INV-001",
      "confidence": 0.8,
      "source": "layout",
      "position": {
        "page": 1,
        "x": 100,
        "y": 50,
        "width": 200,
        "height": 15
      }
    }
  ]
}
```

## Environment Variables

- `PORT`: Server port (default: 8000)
