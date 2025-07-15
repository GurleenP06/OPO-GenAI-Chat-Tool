from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Optional, Dict
import config
import rag_model
import uuid
import json
import os
from datetime import datetime
import pandas as pd
from pathlib import Path

# Document generation imports
from docx import Document as DocxDocument
from docx.shared import Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
import markdown
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
from bs4 import BeautifulSoup
import re

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Data storage paths
DATA_DIR = Path("./chat_data")
DATA_DIR.mkdir(exist_ok=True)
PROJECTS_FILE = DATA_DIR / "projects.json"
CHATS_FILE = DATA_DIR / "chats.json"
RATINGS_FILE = DATA_DIR / "ratings.json"

# Initialize data files
for file_path in [PROJECTS_FILE, CHATS_FILE, RATINGS_FILE]:
    if not file_path.exists():
        with open(file_path, "w") as f:
            json.dump({} if file_path != RATINGS_FILE else [], f)

# In-memory storage
chat_sessions = {}
projects = {}
chat_metadata = {}

# Load existing data
def load_data():
    global projects, chat_metadata
    try:
        with open(PROJECTS_FILE, "r") as f:
            projects = json.load(f)
        with open(CHATS_FILE, "r") as f:
            chat_metadata = json.load(f)
    except:
        pass

load_data()

# Models
class Project(BaseModel):
    name: str
    description: Optional[str] = ""

class ChatMetadata(BaseModel):
    session_id: str
    name: str
    project_id: Optional[str] = None
    is_favorite: bool = False
    created_at: str
    updated_at: str

class RenameRequest(BaseModel):
    session_id: str
    new_name: str

class MoveToProjectRequest(BaseModel):
    session_id: str
    project_id: Optional[str]

class ToggleFavoriteRequest(BaseModel):
    session_id: str

class ExportRequest(BaseModel):
    session_id: str
    format: str  # 'docx', 'pdf', 'txt'

class QueryRequest(BaseModel):
    session_id: str
    query: str

class ChatHistoryRequest(BaseModel):
    session_id: str

class RatingRequest(BaseModel):
    question: str
    response: str
    rating: int

class DocumentViewRequest(BaseModel):
    filename: str
    highlights: List[Dict]  # List of passages to highlight

# Project endpoints
@app.post("/create_project/")
async def create_project(project: Project):
    project_id = str(uuid.uuid4())
    projects[project_id] = {
        "id": project_id,
        "name": project.name,
        "description": project.description,
        "created_at": datetime.now().isoformat()
    }
    save_projects()
    return {"project_id": project_id, "project": projects[project_id]}

@app.get("/list_projects/")
async def list_projects():
    return list(projects.values())

@app.delete("/delete_project/{project_id}")
async def delete_project(project_id: str):
    if project_id in projects:
        # Move all chats from this project to no project
        for chat_id, chat in chat_metadata.items():
            if chat.get("project_id") == project_id:
                chat["project_id"] = None
        del projects[project_id]
        save_projects()
        save_chats()
        return {"message": "Project deleted"}
    raise HTTPException(status_code=404, detail="Project not found")

# Enhanced chat endpoints
@app.post("/new_chat/")
async def new_chat(project_id: Optional[str] = None):
    session_id = str(uuid.uuid4())
    chat_sessions[session_id] = {"summary": "", "messages": []}
    
    chat_metadata[session_id] = {
        "session_id": session_id,
        "name": "New Chat",
        "project_id": project_id,
        "is_favorite": False,
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat()
    }
    save_chats()
    return {"session_id": session_id, "metadata": chat_metadata[session_id]}

@app.post("/rename_chat/")
async def rename_chat(request: RenameRequest):
    if request.session_id in chat_metadata:
        chat_metadata[request.session_id]["name"] = request.new_name
        chat_metadata[request.session_id]["updated_at"] = datetime.now().isoformat()
        save_chats()
        return {"message": "Chat renamed successfully"}
    raise HTTPException(status_code=404, detail="Chat not found")

@app.post("/move_to_project/")
async def move_to_project(request: MoveToProjectRequest):
    if request.session_id in chat_metadata:
        chat_metadata[request.session_id]["project_id"] = request.project_id
        chat_metadata[request.session_id]["updated_at"] = datetime.now().isoformat()
        save_chats()
        return {"message": "Chat moved successfully"}
    raise HTTPException(status_code=404, detail="Chat not found")

@app.post("/toggle_favorite/")
async def toggle_favorite(request: ToggleFavoriteRequest):
    if request.session_id in chat_metadata:
        chat_metadata[request.session_id]["is_favorite"] = not chat_metadata[request.session_id]["is_favorite"]
        chat_metadata[request.session_id]["updated_at"] = datetime.now().isoformat()
        save_chats()
        return {"is_favorite": chat_metadata[request.session_id]["is_favorite"]}
    raise HTTPException(status_code=404, detail="Chat not found")

@app.get("/list_chats/")
async def list_chats():
    """Return organized chat list with projects."""
    organized_chats = {
        "favorites": [],
        "projects": {},
        "no_project": []
    }
    
    # Get chat summaries
    for session_id, metadata in chat_metadata.items():
        chat_info = {
            **metadata,
            "summary": chat_sessions.get(session_id, {}).get("summary", "New Chat")
        }
        
        if metadata["is_favorite"]:
            organized_chats["favorites"].append(chat_info)
        
        if metadata["project_id"]:
            project_id = metadata["project_id"]
            if project_id not in organized_chats["projects"]:
                organized_chats["projects"][project_id] = {
                    "project": projects.get(project_id, {"name": "Unknown Project"}),
                    "chats": []
                }
            organized_chats["projects"][project_id]["chats"].append(chat_info)
        else:
            organized_chats["no_project"].append(chat_info)
    
    return organized_chats

# Enhanced generate endpoint with citations
@app.post("/generate/")
async def generate_response(request: QueryRequest):
    session_id = request.session_id

    if session_id not in chat_sessions:
        chat_sessions[session_id] = {"summary": "", "messages": []}

    chat_sessions[session_id]["messages"].append({"role": "user", "message": request.query})

    # Update chat name if it's the first message
    if not chat_sessions[session_id]["summary"]:
        chat_sessions[session_id]["summary"] = request.query[:30] + ("..." if len(request.query) > 30 else "")
        if session_id in chat_metadata and chat_metadata[session_id]["name"] == "New Chat":
            chat_metadata[session_id]["name"] = chat_sessions[session_id]["summary"]
            save_chats()

    # Generate response with citations
    response_data = rag_model.generate_response_with_citations(
        request.query, 
        history=chat_sessions[session_id]["messages"]
    )
    
    chat_sessions[session_id]["messages"].append({
        "role": "assistant", 
        "message": response_data['response'],
        "citations": response_data.get('citations', {}),
        "highlighted_passages": response_data.get('highlighted_passages', {})
    })
    
    # Update last updated time
    if session_id in chat_metadata:
        chat_metadata[session_id]["updated_at"] = datetime.now().isoformat()
        save_chats()
    
    return {
        "session_id": session_id, 
        "answer": response_data['response'],
        "citations": response_data.get('citations', {}),
        "highlighted_passages": response_data.get('highlighted_passages', {})
    }

# Document viewing endpoint
@app.post("/view_document/")
async def view_document(request: DocumentViewRequest):
    """Return document content with highlight positions."""
    try:
        # Read the text file
        text_path = Path(config.TXT_DIRECTORY) / "Text" / request.filename
        if not text_path.exists():
            raise HTTPException(status_code=404, detail="Document not found")
        
        with open(text_path, "r", encoding="utf-8") as f:
            content = f.read()
        
        # Process highlights
        highlights = []
        for highlight in request.highlights:
            passage = highlight.get('passage', '')
            if passage in content:
                start = content.find(passage)
                end = start + len(passage)
                highlights.append({
                    'start': start,
                    'end': end,
                    'passage': passage
                })
        
        return {
            'content': content,
            'highlights': highlights,
            'filename': request.filename
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Export functionality
def markdown_to_docx(markdown_text: str, chat_history: List[Dict]) -> str:
    """Convert markdown text to DOCX format."""
    doc = DocxDocument()
    
    # Add title
    title = doc.add_heading('Chat Export', 0)
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    
    # Add metadata
    doc.add_paragraph(f"Exported on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    doc.add_paragraph("")
    
    # Add chat history
    for msg in chat_history:
        role = msg['role'].capitalize()
        content = msg['message']
        
        # Add role heading
        p = doc.add_paragraph()
        run = p.add_run(f"{role}: ")
        run.bold = True
        
        # Parse markdown and add content
        # Simple markdown parsing - you might want to use a proper markdown parser
        lines = content.split('\n')
        for line in lines:
            if line.startswith('# '):
                doc.add_heading(line[2:], level=1)
            elif line.startswith('## '):
                doc.add_heading(line[3:], level=2)
            elif line.startswith('- '):
                doc.add_paragraph(line[2:], style='List Bullet')
            elif line.strip():
                doc.add_paragraph(line)
        
        doc.add_paragraph("")  # Add spacing
    
    # Save to temporary file
    temp_path = DATA_DIR / f"export_{uuid.uuid4()}.docx"
    doc.save(temp_path)
    return str(temp_path)

@app.post("/export_chat/")
async def export_chat(request: ExportRequest):
    """Export chat in requested format."""
    if request.session_id not in chat_sessions:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    chat_history = chat_sessions[request.session_id]["messages"]
    
    if request.format == "txt":
        # Export as plain text
        content = ""
        for msg in chat_history:
            content += f"{msg['role'].upper()}: {msg['message']}\n\n"
        
        temp_path = DATA_DIR / f"export_{uuid.uuid4()}.txt"
        with open(temp_path, "w", encoding="utf-8") as f:
            f.write(content)
        
        return FileResponse(
            path=temp_path,
            filename=f"chat_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt",
            media_type="text/plain"
        )
    
    elif request.format == "docx":
        # Export as DOCX
        docx_path = markdown_to_docx("", chat_history)
        return FileResponse(
            path=docx_path,
            filename=f"chat_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.docx",
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )
    
    elif request.format == "pdf":
        # For PDF, we'll need to implement PDF generation
        # This is a placeholder - you'll need to add PDF generation logic
        raise HTTPException(status_code=501, detail="PDF export not yet implemented")
    
    else:
        raise HTTPException(status_code=400, detail="Invalid export format")

# Original endpoints maintained for compatibility
@app.post("/get_chat_history/")
async def get_chat_history(request: ChatHistoryRequest):
    session_id = request.session_id
    history = chat_sessions.get(session_id, {"messages": []})["messages"]
    return {"session_id": session_id, "history": history}

@app.post("/save_rating/")
async def save_rating(request: RatingRequest):
    try:
        with open(RATINGS_FILE, "r") as f:
            ratings = json.load(f)
        
        ratings.append({
            "question": request.question,
            "response": request.response,
            "rating": request.rating,
            "timestamp": datetime.now().isoformat()
        })
        
        with open(RATINGS_FILE, "w") as f:
            json.dump(ratings, f, indent=4)
        
        return {"message": "Rating saved successfully"}
    except Exception as e:
        return {"error": str(e)}

# Helper functions
def save_projects():
    with open(PROJECTS_FILE, "w") as f:
        json.dump(projects, f, indent=4)

def save_chats():
    with open(CHATS_FILE, "w") as f:
        json.dump(chat_metadata, f, indent=4)

# Cleanup endpoint for temporary files
@app.on_event("startup")
async def startup_event():
    # Clean up old export files
    for file in DATA_DIR.glob("export_*."):
        if file.is_file():
            file.unlink()

@app.delete("/delete_chat/{session_id}")
async def delete_chat(session_id: str):
    if session_id in chat_sessions:
        del chat_sessions[session_id]
    if session_id in chat_metadata:
        del chat_metadata[session_id]
    save_chats()
    return {"message": "Chat deleted successfully"}