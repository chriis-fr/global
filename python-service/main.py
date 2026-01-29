from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
import pdfplumber
import json
import io
import re
from typing import List, Dict, Any, Optional

app = FastAPI()

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "PDF Parsing Service", "status": "running"}

def extract_lines_with_layout(pdf_bytes: bytes) -> List[Dict[str, Any]]:
    """
    Extract text lines with layout information (position, font, etc.)
    This is layer 1: Raw text extraction with layout awareness
    """
    lines = []
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for page_num, page in enumerate(pdf.pages, start=1):
            # Extract words with positions
            words = page.extract_words()
            
            # Group words into lines based on Y position
            current_line = []
            current_y = None
            line_height = None
            
            for word in words:
                word_y = word.get('top', 0)
                word_text = word.get('text', '')
                
                # If Y position changed significantly (new line), save previous line
                if current_y is None or abs(word_y - current_y) > 5:
                    if current_line:
                        # Calculate line properties
                        line_text = ' '.join([w.get('text', '') for w in current_line])
                        if line_text.strip():
                            x0 = min([w.get('x0', 0) for w in current_line])
                            x1 = max([w.get('x1', 0) for w in current_line])
                            y0 = min([w.get('top', 0) for w in current_line])
                            y1 = max([w.get('bottom', 0) for w in current_line])
                            
                            lines.append({
                                "value": line_text.strip(),
                                "page": page_num,
                                "position": {
                                    "x": x0,
                                    "y": y0,
                                    "width": x1 - x0,
                                    "height": y1 - y0,
                                },
                                "confidence": 0.9,
                                "source": "layout"
                            })
                    
                    # Start new line
                    current_line = [word]
                    current_y = word_y
                    line_height = word.get('bottom', 0) - word.get('top', 0)
                else:
                    current_line.append(word)
            
            # Save last line
            if current_line:
                line_text = ' '.join([w.get('text', '') for w in current_line])
                if line_text.strip():
                    x0 = min([w.get('x0', 0) for w in current_line])
                    x1 = max([w.get('x1', 0) for w in current_line])
                    y0 = min([w.get('top', 0) for w in current_line])
                    y1 = max([w.get('bottom', 0) for w in current_line])
                    
                    lines.append({
                        "value": line_text.strip(),
                        "page": page_num,
                        "position": {
                            "x": x0,
                            "y": y0,
                            "width": x1 - x0,
                            "height": y1 - y0,
                        },
                        "confidence": 0.9,
                        "source": "layout"
                    })
    
    return lines

def extract_tables(pdf_bytes: bytes) -> List[Dict[str, Any]]:
    """
    Extract tables using pdfplumber's table detection
    This handles structured data like invoice line items
    """
    table_fields = []
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for page_num, page in enumerate(pdf.pages, start=1):
            tables = page.extract_tables()
            for table_idx, table in enumerate(tables):
                # First row is usually headers
                if len(table) > 0:
                    headers = table[0] if table[0] else []
                    
                    # Process data rows
                    for row_idx, row in enumerate(table[1:], start=1):
                        if not row:
                            continue
                        
                        # Create a structured representation
                        row_data = {}
                        row_text_parts = []
                        
                        for col_idx, cell in enumerate(row):
                            cell_value = str(cell).strip() if cell else ""
                            if cell_value:
                                row_text_parts.append(cell_value)
                                if col_idx < len(headers):
                                    header = str(headers[col_idx]).strip() if headers[col_idx] else f"col_{col_idx}"
                                    row_data[header] = cell_value
                        
                        if row_text_parts:
                            # Add as both structured and text
                            row_text = " | ".join(row_text_parts)
                            table_fields.append({
                                "value": row_text,
                                "page": page_num,
                                "position": {
                                    "page": page_num,
                                    "x": 0,
                                    "y": 0,
                                    "width": 0,
                                    "height": 0
                                },
                                "confidence": 0.95,
                                "source": "table",
                                "table_data": row_data,  # Structured data
                                "table_index": table_idx,
                                "row_index": row_idx
                            })
    
    return table_fields

def pattern_match_fields(lines: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Layer 2: Semantic grouping using pattern matching
    Identify common invoice/document fields
    """
    pattern_fields = []
    
    # Common patterns for invoices/documents
    patterns = {
        "invoice_number": [
            r"invoice\s*#?\s*:?\s*([A-Z0-9\-]+)",
            r"invoice\s+number\s*:?\s*([A-Z0-9\-]+)",
            r"inv\s*#?\s*:?\s*([A-Z0-9\-]+)",
        ],
        "date": [
            r"date\s*:?\s*(\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4})",
            r"(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4})",
        ],
        "due_date": [
            r"due\s+date\s*:?\s*(\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4})",
            r"due\s*:?\s*(\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4})",
        ],
        "total": [
            r"total\s*:?\s*\$?\s*([\d,]+\.?\d*)",
            r"amount\s+due\s*:?\s*\$?\s*([\d,]+\.?\d*)",
        ],
        "subtotal": [
            r"subtotal\s*:?\s*\$?\s*([\d,]+\.?\d*)",
            r"sub-total\s*:?\s*\$?\s*([\d,]+\.?\d*)",
        ],
        "tax": [
            r"tax\s*\(?vat\)?\s*:?\s*\$?\s*([\d,]+\.?\d*)",
            r"vat\s*:?\s*\$?\s*([\d,]+\.?\d*)",
        ],
        "client_name": [
            r"bill\s+to\s*:?\s*(.+)",
            r"client\s*:?\s*(.+)",
            r"customer\s*:?\s*(.+)",
        ],
        "company_name": [
            r"from\s*:?\s*(.+)",
            r"company\s*:?\s*(.+)",
        ],
        "email": [
            r"([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})",
        ],
        "phone": [
            r"phone\s*:?\s*([\+]?[\d\s\-\(\)]+)",
            r"tel\s*:?\s*([\+]?[\d\s\-\(\)]+)",
        ],
    }
    
    for line_obj in lines:
        line_text = line_obj.get("value", "").upper()
        
        for field_type, regex_list in patterns.items():
            for pattern in regex_list:
                match = re.search(pattern, line_text, re.IGNORECASE)
                if match:
                    extracted_value = match.group(1) if match.groups() else match.group(0)
                    
                    pattern_fields.append({
                        "value": extracted_value.strip(),
                        "page": line_obj.get("page", 1),
                        "position": line_obj.get("position", {}),
                        "confidence": 0.85,
                        "source": "pattern",
                        "field_type": field_type,  # Hint for mapping
                        "original_line": line_obj.get("value", "")
                    })
                    break  # Only match first pattern that works
    
    return pattern_fields

def extract_amounts(lines: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Extract only monetary amounts (with $ or in total/subtotal/tax context).
    Do NOT extract every number - only amounts that look like money.
    """
    amount_fields = []
    # Only match lines that contain currency or amount keywords
    amount_keywords = re.compile(
        r'(total|subtotal|amount|tax|vat|due|balance|price|fee)\s*:?\s*\$?\s*([\d,]+\.?\d{0,2})',
        re.IGNORECASE
    )
    # Or explicit currency: $123.45 or USD 123.45
    currency_amount = re.compile(r'\$\s*([\d,]+\.?\d{0,2})|(?:USD|KES|EUR|GBP)\s*([\d,]+\.?\d{0,2})', re.IGNORECASE)
    
    seen_amounts = set()
    
    for line_obj in lines:
        line_text = line_obj.get("value", "")
        
        # Match "Total: 1234.56" style
        for m in amount_keywords.finditer(line_text):
            amount = (m.group(2) or "").replace(',', '').strip()
            if amount and amount not in seen_amounts:
                try:
                    if float(amount) > 0:
                        seen_amounts.add(amount)
                        amount_fields.append({
                            "value": amount,
                            "page": line_obj.get("page", 1),
                            "position": line_obj.get("position", {}),
                            "confidence": 0.95,
                            "source": "amount",
                            "field_type": "total",
                            "original_line": line_text
                        })
                except ValueError:
                    pass
        
        # Match $123.45 or USD 123.45
        for m in currency_amount.finditer(line_text):
            amount = (m.group(1) or m.group(2) or "").replace(',', '').strip()
            if amount and amount not in seen_amounts:
                try:
                    if float(amount) > 0:
                        seen_amounts.add(amount)
                        amount_fields.append({
                            "value": amount,
                            "page": line_obj.get("page", 1),
                            "position": line_obj.get("position", {}),
                            "confidence": 0.95,
                            "source": "amount",
                            "field_type": "total",
                            "original_line": line_text
                        })
                except ValueError:
                    pass
    
    return amount_fields

def build_document_ast(
    layout_fields: List[Dict[str, Any]],
    pattern_fields: List[Dict[str, Any]],
    table_fields: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Build a neutral, org-agnostic Document AST from extracted data.
    Mapping config will point into this structure (e.g. meta.reference_numbers.task_order).
    """
    meta = {"title": "", "reference_numbers": {}}
    parties = {"issuer": "", "recipient": ""}
    items = []
    dates = {"due": "", "signed": ""}
    raw_lines = []

    # From pattern fields, fill meta/parties/dates
    for f in pattern_fields:
        ft = f.get("field_type", "")
        val = (f.get("value") or "").strip()
        if not val:
            continue
        if ft == "invoice_number":
            meta["reference_numbers"]["invoice_number"] = val
        elif ft == "date":
            dates["signed"] = val
        elif ft == "due_date":
            dates["due"] = val
        elif ft == "client_name":
            parties["recipient"] = val
        elif ft == "company_name":
            parties["issuer"] = val
        elif ft in ("total", "subtotal", "tax"):
            meta["reference_numbers"].setdefault(ft, val)

    # Task order / contract from layout (e.g. "Task Order: #TS1-ND-0013", "Contract Number: YT-0013/25")
    for line_obj in layout_fields:
        line = (line_obj.get("value") or "").strip()
        raw_lines.append(line)
        lower = line.lower()
        if "task order" in lower or "t.o" in lower:
            m = re.search(r"#?\s*([A-Z0-9\-]+)", line, re.IGNORECASE)
            if m:
                meta["reference_numbers"]["task_order"] = m.group(1).strip()
        if "contract" in lower and "number" in lower:
            parts = line.split(":", 1)
            if len(parts) > 1:
                meta["reference_numbers"]["contract"] = parts[1].strip()
        if line.upper().startswith("FOR:") and len(line) > 5:
            name = line[4:].strip()
            if not parties["issuer"]:
                parties["issuer"] = name
            else:
                parties["recipient"] = name

    # Title: first meaningful layout line
    for line_obj in layout_fields:
        line = (line_obj.get("value") or "").strip()
        if len(line) > 2 and not line.lower().startswith(("deliverable", "#", "date")):
            meta["title"] = line
            break

    # Items from table rows
    for f in table_fields:
        td = f.get("table_data") or {}
        row = {
            "label": td.get("Description") or td.get("description") or td.get("Deliverable") or f.get("value", ""),
            "quantity": 1,
            "unit_price": None,
            "status": td.get("Status") or td.get("status") or "",
        }
        for k, v in td.items():
            k_lower = k.lower()
            if "desc" in k_lower:
                row["label"] = v or row["label"]
            elif "qty" in k_lower or "quantity" in k_lower:
                try:
                    row["quantity"] = int(float(v))
                except (ValueError, TypeError):
                    pass
            elif "price" in k_lower or "amount" in k_lower:
                try:
                    row["unit_price"] = float(str(v).replace(",", ""))
                except (ValueError, TypeError):
                    pass
            elif "status" in k_lower:
                row["status"] = v or row["status"]
        if row["label"] or row["status"]:
            items.append(row)

    return {
        "meta": meta,
        "parties": parties,
        "items": items,
        "dates": dates,
        "raw_lines": raw_lines[:50],
    }

@app.post("/parse")
async def parse_pdf(file: UploadFile = File(...)):
    """
    Parse PDF and extract field candidates using multi-layer approach:
    1. Layout-aware text extraction
    2. Table extraction
    3. Pattern matching
    4. Amount extraction
    """
    try:
        # Read PDF file
        pdf_bytes = await file.read()
        
        # Layer 1: Extract lines with layout information
        layout_fields = extract_lines_with_layout(pdf_bytes)
        
        # Layer 2: Extract tables
        table_fields = extract_tables(pdf_bytes)
        
        # Layer 3: Pattern matching for common fields
        pattern_fields = pattern_match_fields(layout_fields)
        
        # Layer 4: Extract only monetary amounts (not every number)
        amount_fields = extract_amounts(layout_fields)
        
        # Combine fields: pattern-matched + table rows + amounts + meaningful layout lines only
        all_fields = []
        seen_values = set()
        
        # 1. Pattern-matched fields (metadata: invoice #, dates, client, etc.)
        for f in pattern_fields:
            v = (f.get("value") or "").strip().lower()
            if v and v not in seen_values:
                all_fields.append(f)
                seen_values.add(v)
        
        # 2. Table rows (deliverables / line items) - one row per field
        for f in table_fields:
            v = (f.get("value") or "").strip().lower()
            if v and len(v) > 3 and v not in seen_values:
                all_fields.append(f)
                seen_values.add(v)
        
        # 3. Monetary amounts only
        for f in amount_fields:
            v = (f.get("value") or "").strip()
            if v and v not in seen_values:
                all_fields.append(f)
                seen_values.add(v)
        
        # 4. Layout lines: only include if meaningful (skip headers, very short, or already in tables)
        skip_prefixes = ("deliverable", "#", "date", "description", "due", "status", "index")
        for field in layout_fields:
            field_value = (field.get("value") or "").strip()
            field_lower = field_value.lower()
            # Skip empty, very short, or header-like lines
            if not field_value or len(field_value) < 4:
                continue
            if field_lower in seen_values:
                continue
            if any(field_lower.startswith(p) and len(field_value) < 25 for p in skip_prefixes):
                continue
            # Skip lines that are just numbers (already captured elsewhere)
            if field_value.replace(".", "").replace(",", "").replace(" ", "").isdigit():
                continue
            all_fields.append(field)
            seen_values.add(field_lower)
        
        # Sort: pattern first, then table, then layout
        def order_key(x):
            s = x.get("source", "")
            if s == "pattern":
                return 0
            if s == "table":
                return 1
            if s == "amount":
                return 2
            return 3
        all_fields.sort(key=lambda x: (order_key(x), -x.get("confidence", 0)))
        
        # Build neutral Document AST for org-specific mapping
        document_ast = build_document_ast(layout_fields, pattern_fields, table_fields)
        
        return {
            "success": True,
            "fields": all_fields,
            "document_ast": document_ast,
            "stats": {
                "total_fields": len(all_fields),
                "pattern_fields": len(pattern_fields),
                "table_fields": len(table_fields),
                "amount_fields": len(amount_fields),
                "layout_included": len([f for f in all_fields if f.get("source") == "layout"])
            }
        }
    
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"Error parsing PDF: {error_trace}")
        return {
            "success": False,
            "error": str(e),
            "traceback": error_trace
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
