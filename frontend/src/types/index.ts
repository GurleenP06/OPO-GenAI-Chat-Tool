// frontend/src/types/index.ts
export interface Project {
  id: string;
  name: string;
  description?: string;
  created_at: string;
}

export interface Chat {
  id: string;
  name: string;
  isFavorite: boolean;
  projectId?: string;
  createdAt: string;
  updatedAt: string;
  summary?: string;
}

export interface HighlightedPassage {
  filename: string;
  source_url: string;
  passage: string;
  passage_index: number;
  full_text: string;
}

export interface Message {
  id: string;
  type: 'user' | 'ai';
  content: string;
  citations?: Citation[];
  timestamp: Date;
  highlighted_passages?: Record<string, HighlightedPassage[]>;
}

export interface Citation {
  id: string;
  text: string;
  source: string;
  url: string;
  highlighted?: boolean;
}
