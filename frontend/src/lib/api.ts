const API_BASE = '/api';

export interface Project {
  id: string;
  name: string;
  description?: string;
  created_at: string;
}

export interface ChatMetadata {
  session_id: string;
  name: string;
  project_id?: string;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

export interface Chat extends ChatMetadata {
  summary: string;
}

export interface Message {
  id: string;
  type: 'user' | 'ai';
  content: string;
  citations?: Citation[];
  timestamp: Date;
  highlighted_passages?: Record<string, any[]>;
}

export interface Citation {
  filename: string;
  source_url: string;
}

export interface HighlightedPassage {
  filename: string;
  source_url: string;
  passage: string;
  passage_index: number;
  full_text: string;
}

export interface OrganizedChats {
  favorites: Chat[];
  projects: Record<string, {
    project: Project;
    chats: Chat[];
  }>;
  no_project: Chat[];
}

export interface GenerateResponse {
  session_id: string;
  answer: string;
  citations: Record<string, Citation>;
  highlighted_passages: Record<string, HighlightedPassage[]>;
}

class APIClient {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    return response.json();
  }

  // Project endpoints
  async createProject(name: string, description?: string): Promise<{ project_id: string; project: Project }> {
    return this.request('/create_project/', {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    });
  }

  async listProjects(): Promise<Project[]> {
    return this.request('/list_projects/');
  }

  async deleteProject(projectId: string): Promise<{ message: string }> {
    return this.request(`/delete_project/${projectId}`, {
      method: 'DELETE',
    });
  }

  // Chat endpoints
  async newChat(projectId?: string): Promise<{ session_id: string; metadata: ChatMetadata }> {
    return this.request('/new_chat/', {
      method: 'POST',
      body: JSON.stringify({ project_id: projectId }),
    });
  }

  async deleteChat(sessionId: string): Promise<{ message: string }> {
    return this.request(`/delete_chat/${sessionId}`, {
      method: 'DELETE',
    });
  }

  async listChats(): Promise<OrganizedChats> {
    return this.request('/list_chats/');
  }

  async renameChat(sessionId: string, newName: string): Promise<{ message: string }> {
    return this.request('/rename_chat/', {
      method: 'POST',
      body: JSON.stringify({ session_id: sessionId, new_name: newName }),
    });
  }

  async moveToProject(sessionId: string, projectId?: string): Promise<{ message: string }> {
    return this.request('/move_to_project/', {
      method: 'POST',
      body: JSON.stringify({ session_id: sessionId, project_id: projectId }),
    });
  }

  async toggleFavorite(sessionId: string): Promise<{ is_favorite: boolean }> {
    return this.request('/toggle_favorite/', {
      method: 'POST',
      body: JSON.stringify({ session_id: sessionId }),
    });
  }

  async getChatHistory(sessionId: string): Promise<{ session_id: string; history: Message[] }> {
    return this.request('/get_chat_history/', {
      method: 'POST',
      body: JSON.stringify({ session_id: sessionId }),
    });
  }

  // Generate endpoint
  async generate(sessionId: string, query: string): Promise<GenerateResponse> {
    return this.request('/generate/', {
      method: 'POST',
      body: JSON.stringify({ session_id: sessionId, query }),
    });
  }

  // Document viewing
  async viewDocument(filename: string, highlights: HighlightedPassage[]): Promise<{
    content: string;
    highlights: Array<{ start: number; end: number; passage: string }>;
    filename: string;
  }> {
    return this.request('/view_document/', {
      method: 'POST',
      body: JSON.stringify({ filename, highlights }),
    });
  }

// Export chat - now exports a specific message
  async exportMessage(sessionId: string, messageIndex: number, format: 'docx' | 'pdf'): Promise<Blob> {
    const response = await fetch(`${API_BASE}/export_chat/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ session_id: sessionId, message_index: messageIndex, format }),
    });

    if (!response.ok) {
      throw new Error(`Export failed: ${response.statusText}`);
    }

    return response.blob();
  }

  // Compatibility wrapper for old export method
  async exportChat(sessionId: string, format: string): Promise<Blob> {
    // This method is kept for compatibility but should not be used
    // Use exportMessage instead
    throw new Error('Use exportMessage instead of exportChat');
  }

  // Rating
  async saveRating(question: string, response: string, rating: number): Promise<{ message: string }> {
    return this.request('/save_rating/', {
      method: 'POST',
      body: JSON.stringify({ question, response, rating }),
    });
  }
}

export const api = new APIClient();
