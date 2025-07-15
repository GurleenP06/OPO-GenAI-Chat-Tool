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

export interface Message {
  id: string;
  type: 'user' | 'ai';
  content: string;
  citations?: Citation[];
  timestamp: Date;
}

export interface Citation {
  id: string;
  text: string;
  source: string;
  url: string;
  highlighted?: boolean;
}