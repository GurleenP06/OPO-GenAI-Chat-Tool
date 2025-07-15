import { useState, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { ChatMessage } from './ChatMessage';
import { FeedbackDialog } from './FeedbackDialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { Send, Edit2, Download, Star, MessageSquare, Loader2, ExternalLink } from 'lucide-react';
import { api, type Message as APIMessage, type Citation as APICitation, type HighlightedPassage } from '@/lib/api';
import type { Message, Citation } from '@/types';

interface ChatInterfaceProps {
  selectedChat: string | null;
  onToggleFavorite: (chatId: string) => void;
  onRenameChat: (chatId: string, newName: string) => void;
  onRefreshChats: () => void;
}

export function ChatInterface({ 
  selectedChat, 
  onToggleFavorite, 
  onRenameChat,
  onRefreshChats 
}: ChatInterfaceProps) {
  const [query, setQuery] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [chatName, setChatName] = useState('New Chat');
  const [newChatName, setNewChatName] = useState('');
  const [showPdfViewer, setShowPdfViewer] = useState(false);
  const [selectedSource, setSelectedSource] = useState<Citation | null>(null);
  const [showFeedback, setShowFeedback] = useState<{ messageId: string; type: 'up' | 'down' } | null>(null);
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
      const uiMessages: Message[] = result.history.map((msg, index) => {
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
          timestamp: new Date()
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
      
      // Extract sources section from the response
      let mainContent = response.answer;
      let sourcesText = '';
      
      const sourcesIndex = response.answer.indexOf('\n\nSources:\n');
      if (sourcesIndex !== -1) {
        mainContent = response.answer.substring(0, sourcesIndex);
        sourcesText = response.answer.substring(sourcesIndex);
      }
      
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
        content: response.answer, // Keep full response including sources
        citations: citations.length > 0 ? citations : undefined,
        timestamp: new Date()
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

  const handleViewSource = async (citation: Citation) => {
    setSelectedSource(citation);
    setShowPdfViewer(true);
    // In a real implementation, you would load the document here
  };

  const handleCopyResponse = (content: string) => {
    navigator.clipboard.writeText(content);
  };

  const handleExport = async (format: 'txt' | 'docx' | 'pdf') => {
    if (!selectedChat) return;
    
    try {
      const blob = await api.exportChat(selectedChat, format);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chat_export_${new Date().toISOString().split('T')[0]}.${format}`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const handleFeedback = async (messageId: string, type: 'up' | 'down', feedback?: string) => {
    const message = messages.find(m => m.id === messageId);
    if (message && message.type === 'ai') {
      const previousMessage = messages[messages.findIndex(m => m.id === messageId) - 1];
      if (previousMessage && previousMessage.type === 'user') {
        try {
          await api.saveRating(
            previousMessage.content,
            message.content,
            type === 'up' ? 5 : 1
          );
        } catch (error) {
          console.error('Failed to save rating:', error);
        }
      }
    }
    setShowFeedback(null);
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
    <div className="flex-1 flex">
      {/* Main Chat Area */}
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
            >
              <Star className="h-4 w-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">
                  <Download className="h-4 w-4" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => handleExport('txt')}>
                  Export as TXT
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('docx')}>
                  Export as DOCX
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('pdf')}>
                  Export as PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
            {!loading && messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                onViewSource={handleViewSource}
                onCopyResponse={handleCopyResponse}
                onFeedback={(type) => setShowFeedback({ messageId: message.id, type })}
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
      </div>

      {/* PDF Viewer with highlighting */}
      {showPdfViewer && selectedSource && (
        <div className="w-[500px] border-l border-border bg-card flex flex-col">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="font-semibold">{selectedSource.source}</h3>
              <p className="text-sm text-muted-foreground">Source Document</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setShowPdfViewer(false)}>
              ×
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            <div className="prose prose-sm max-w-none">
              <div className="bg-yellow-100 border-l-4 border-yellow-500 p-4 mb-4">
                <p className="font-semibold mb-2">Highlighted Passage:</p>
                <p className="italic">{selectedSource.text}</p>
              </div>
              <div className="mt-6">
                <p className="text-sm text-muted-foreground mb-4">
                  Full document preview would be displayed here with the relevant passage highlighted.
                </p>
                <a 
                  href={selectedSource.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-primary hover:underline"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open original document
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Feedback Dialog */}
      {showFeedback && (
        <FeedbackDialog
          type={showFeedback.type}
          onClose={() => setShowFeedback(null)}
          onSubmit={(feedback) => {
            handleFeedback(showFeedback.messageId, showFeedback.type, feedback.customFeedback);
          }}
        />
      )}
    </div>
  );
}