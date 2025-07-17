// frontend/src/components/ChatInterface.tsx
import { useState, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { ChatMessage } from './ChatMessage';
import { FeedbackDialog } from './FeedbackDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Send, Edit2, Star, MessageSquare, Loader2, X } from 'lucide-react';
import { api, type APIMessage, type HighlightedPassage } from '@/lib/api';
import type { Message, Citation } from '@/types';

interface ChatInterfaceProps {
  selectedChat: string | null;
  onToggleFavorite: (chatId: string) => void;
  onRenameChat: (chatId: string, newName: string) => void;
  onRefreshChats: () => void;
  isFavorite?: boolean;
}

export function ChatInterface({ 
  selectedChat, 
  onToggleFavorite, 
  onRenameChat,
  onRefreshChats,
  isFavorite = false
}: ChatInterfaceProps) {
  const [query, setQuery] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [chatName, setChatName] = useState('New Chat');
  const [newChatName, setNewChatName] = useState('');
  const [showDocumentViewer, setShowDocumentViewer] = useState(false);
  const [selectedSource, setSelectedSource] = useState<Citation | null>(null);
  const [documentContent, setDocumentContent] = useState<string>('');
  const [documentHighlights, setDocumentHighlights] = useState<any[]>([]);
  const [showFeedback, setShowFeedback] = useState<{ messageId: string; messageIndex: number; type: 'up' | 'down' } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [thinking, setThinking] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedChat) {
      loadChatHistory();
    }
  }, [selectedChat]);

  useEffect(() => {
    // Scroll to bottom when new messages are added
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  const loadChatHistory = async () => {
    if (!selectedChat) return;
    
    try {
      setLoading(true);
      const result = await api.getChatHistory(selectedChat);
      
      // Convert API messages to UI messages
      const uiMessages: Message[] = result.history.map((msg: APIMessage, index: number) => {
        const citations: Citation[] = [];
        
        if (msg.citations) {
          Object.entries(msg.citations).forEach(([num, citation]) => {
            citations.push({
              id: num,
              text: citation.filename,
              source: citation.filename,
              url: citation.source_url
            });
          });
        }
        
        return {
          id: `${selectedChat}-${index}`,
          type: msg.role === 'user' ? 'user' : 'ai',
          content: msg.message,
          citations: citations.length > 0 ? citations : undefined,
          timestamp: new Date(),
          highlighted_passages: msg.highlighted_passages
        };
      });
      
      setMessages(uiMessages);
      
      // Set chat name from first user message if available
      const firstUserMessage = uiMessages.find(m => m.type === 'user');
      if (firstUserMessage) {
        setChatName(firstUserMessage.content.slice(0, 50) + (firstUserMessage.content.length > 50 ? '...' : ''));
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!query.trim() || !selectedChat) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: query,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setQuery('');
    setThinking(true);

    try {
      const response = await api.generate(selectedChat, userMessage.content);
      
      // Convert citations
      const citations: Citation[] = [];
      if (response.citations) {
        Object.entries(response.citations).forEach(([num, citation]) => {
          citations.push({
            id: num,
            text: citation.filename,
            source: citation.filename,
            url: citation.source_url
          });
        });
      }

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: response.answer,
        citations: citations.length > 0 ? citations : undefined,
        timestamp: new Date(),
        highlighted_passages: response.highlighted_passages
      };

      setMessages(prev => [...prev, aiMessage]);
      onRefreshChats(); // Refresh sidebar to update chat names
    } catch (error) {
      console.error('Failed to generate response:', error);
      // Add error message
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: 'Sorry, I encountered an error while generating a response. Please try again.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setThinking(false);
    }
  };

  const handleRename = () => {
    if (isRenaming && newChatName.trim() && selectedChat) {
      onRenameChat(selectedChat, newChatName);
      setChatName(newChatName);
      setIsRenaming(false);
      setNewChatName('');
    } else {
      setIsRenaming(true);
      setNewChatName(chatName);
    }
  };

  const handleViewSource = async (citation: Citation, messageId: string) => {
    setSelectedSource(citation);
    
    // Find the message to get highlighted passages
    const message = messages.find(m => m.id === messageId);
    if (message && message.highlighted_passages && message.highlighted_passages[citation.id]) {
      const passages = message.highlighted_passages[citation.id] || [];
      
      try {
        // Fetch the document with highlights
        const result = await api.viewDocument(citation.source, passages);
        setDocumentContent(result.content);
        setDocumentHighlights(result.highlights);
        setShowDocumentViewer(true);
      } catch (error) {
        console.error('Failed to load document:', error);
        // Still show the viewer with just the passages
        setDocumentContent('');
        setDocumentHighlights([]);
        setShowDocumentViewer(true);
      }
    } else {
      // No highlights, just show the document viewer
      setDocumentContent('');
      setDocumentHighlights([]);
      setShowDocumentViewer(true);
    }
  };

  const handleCopyResponse = (content: string) => {
    navigator.clipboard.writeText(content);
  };

  const handleExport = async (messageIndex: number, format: 'docx' | 'pdf') => {
    if (!selectedChat) return;
    
    try {
      const blob = await api.exportMessage(selectedChat, messageIndex, format);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ai_response_${new Date().toISOString().split('T')[0]}.${format}`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const handleFeedback = async (messageId: string, messageIndex: number, type: 'up' | 'down', feedback?: { selectedReason?: string; customFeedback?: string }) => {
    const message = messages[messageIndex];
    if (message && message.type === 'ai') {
      const previousMessage = messages[messageIndex - 1];
      if (previousMessage && previousMessage.type === 'user') {
        try {
          await api.saveRating({
            question: previousMessage.content,
            response: message.content,
            feedback_type: type === 'up' ? 'positive' : 'negative',
            selected_reason: feedback?.selectedReason,
            custom_feedback: feedback?.customFeedback
          });
        } catch (error) {
          console.error('Failed to save rating:', error);
        }
      }
    }
    setShowFeedback(null);
  };

  const renderDocumentWithHighlights = () => {
    if (!documentContent) {
      // Just show the highlighted passages if no full document
      const message = messages.find(m => m.id === selectedSource?.id);
      const passages = message?.highlighted_passages?.[selectedSource?.id || ''] || [];
      
      return (
        <div className="space-y-4">
          <h4 className="font-semibold mb-3">Highlighted Passages:</h4>
          {passages.map((passage, idx) => (
            <div key={idx} className="bg-yellow-100 border-l-4 border-yellow-500 p-4 rounded">
              <p className="text-sm">{passage.passage}</p>
            </div>
          ))}
        </div>
      );
    }

    // Render document with highlights
    let processedContent = documentContent;
    const sortedHighlights = [...documentHighlights].sort((a, b) => b.start - a.start);
    
    sortedHighlights.forEach(highlight => {
      const before = processedContent.slice(0, highlight.start);
      const highlightedText = processedContent.slice(highlight.start, highlight.end);
      const after = processedContent.slice(highlight.end);
      
      processedContent = before + 
        `<mark class="bg-yellow-200 px-1 rounded">${highlightedText}</mark>` + 
        after;
    });

    return (
      <div 
        className="prose prose-sm max-w-none"
        dangerouslySetInnerHTML={{ __html: processedContent }}
      />
    );
  };

  if (!selectedChat) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Select a chat to start conversation</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Chat Header */}
      <div className="p-4 border-b border-border bg-card flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isRenaming ? (
            <div className="flex items-center gap-2">
              <Input
                value={newChatName}
                onChange={(e) => setNewChatName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                className="h-8"
              />
              <Button size="sm" onClick={handleRename}>Save</Button>
              <Button size="sm" variant="outline" onClick={() => setIsRenaming(false)}>Cancel</Button>
            </div>
          ) : (
            <>
              <h1>{chatName}</h1>
              <Button size="sm" variant="ghost" onClick={handleRename}>
                <Edit2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => selectedChat && onToggleFavorite(selectedChat)}
            className={isFavorite ? 'text-yellow-500' : ''}
          >
            <Star className={`h-4 w-4 ${isFavorite ? 'fill-current' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-6 max-w-4xl mx-auto" ref={scrollAreaRef}>
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          )}
          {!loading && messages.map((message, index) => (
            <ChatMessage
              key={message.id}
              message={message}
              messageIndex={index}
              onViewSource={(citation) => handleViewSource(citation, message.id)}
              onCopyResponse={handleCopyResponse}
              onFeedback={(type) => setShowFeedback({ messageId: message.id, messageIndex: index, type })}
              onExport={(format) => handleExport(index, format)}
            />
          ))}
          {thinking && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Thinking...</span>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Query Input */}
      <div className="p-4 border-t border-border bg-card">
        <div className="max-w-4xl mx-auto">
          <div className="flex gap-2 mb-3">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask your question here..."
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              className="flex-1 h-12 text-base"
              disabled={thinking}
            />
            <Button onClick={handleSend} disabled={!query.trim() || thinking} className="h-12 px-6">
              {thinking ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            <strong>Disclaimer:</strong> This tool is for informational purposes only. Do not enter any personal or sensitive information.
          </p>
        </div>
      </div>

      {/* Document Viewer Dialog */}
      <Dialog open={showDocumentViewer} onOpenChange={setShowDocumentViewer}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{selectedSource?.source}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 p-4">
            {renderDocumentWithHighlights()}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Feedback Dialog */}
      {showFeedback && (
        <FeedbackDialog
          type={showFeedback.type}
          onClose={() => setShowFeedback(null)}
          onSubmit={(feedback) => {
            handleFeedback(showFeedback.messageId, showFeedback.messageIndex, showFeedback.type, feedback);
          }}
        />
      )}
    </div>
  );
}
