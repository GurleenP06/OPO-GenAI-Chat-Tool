import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { ChatMessage } from './ChatMessage';
import { FeedbackDialog } from './FeedbackDialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { Send, Edit2, Download, Copy, Star, MessageSquare } from 'lucide-react';

interface Message {
  id: string;
  type: 'user' | 'ai';
  content: string;
  citations?: Citation[];
  timestamp: Date;
}

interface Citation {
  id: string;
  text: string;
  source: string;
  url: string;
  highlighted?: boolean;
}

interface ChatInterfaceProps {
  selectedChat: string | null;
  onToggleFavourite: (chatId: string) => void;
}

export function ChatInterface({ selectedChat, onToggleFavourite }: ChatInterfaceProps) {
  const [query, setQuery] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [chatName, setChatName] = useState('AI Ethics Discussion');
  const [newChatName, setNewChatName] = useState('');
  const [showPdfViewer, setShowPdfViewer] = useState(false);
  const [selectedSource, setSelectedSource] = useState<Citation | null>(null);
  const [showFeedback, setShowFeedback] = useState<{ messageId: string; type: 'up' | 'down' } | null>(null);

  // Mock messages for demonstration
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'user',
      content: 'What are the main ethical considerations in AI development?',
      timestamp: new Date(Date.now() - 3600000)
    },
    {
      id: '2',
      type: 'ai',
      content: 'AI ethics involves several key considerations: **Fairness and bias prevention** [1], **transparency and explainability** [2], **privacy protection** [3], and **accountability in decision-making** [4]. These principles ensure AI systems are developed responsibly and serve society beneficially.',
      citations: [
        { id: '1', text: 'Fairness and bias prevention', source: 'AI Ethics Guidelines 2024', url: '/source1.pdf' },
        { id: '2', text: 'transparency and explainability', source: 'IEEE Standards on AI', url: '/source2.pdf' },
        { id: '3', text: 'privacy protection', source: 'GDPR and AI Systems', url: '/source3.pdf' },
        { id: '4', text: 'accountability in decision-making', source: 'AI Governance Framework', url: '/source4.pdf' }
      ],
      timestamp: new Date(Date.now() - 3590000)
    }
  ]);

  const handleSend = () => {
    if (!query.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: query,
      timestamp: new Date()
    };

    const aiMessage: Message = {
      id: (Date.now() + 1).toString(),
      type: 'ai',
      content: `Here's a response to your question about "${query}". This is a mock AI response with **highlighted key points** [1] and **relevant citations** [2] to demonstrate the interface functionality.`,
      citations: [
        { id: '1', text: 'highlighted key points', source: 'Mock Source Document 1', url: '/mock1.pdf' },
        { id: '2', text: 'relevant citations', source: 'Mock Source Document 2', url: '/mock2.pdf' }
      ],
      timestamp: new Date()
    };

    setMessages([...messages, userMessage, aiMessage]);
    setQuery('');
  };

  const handleRename = () => {
    if (isRenaming && newChatName.trim()) {
      setChatName(newChatName);
      setIsRenaming(false);
      setNewChatName('');
    } else {
      setIsRenaming(true);
      setNewChatName(chatName);
    }
  };

  const handleViewSource = (citation: Citation) => {
    setSelectedSource(citation);
    setShowPdfViewer(true);
  };

  const handleCopyResponse = (content: string) => {
    navigator.clipboard.writeText(content);
  };

  const handleExport = (format: 'pdf' | 'docx') => {
    console.log(`Exporting chat as ${format}`);
    // Mock export functionality
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
              onClick={() => onToggleFavourite(selectedChat)}
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
                <DropdownMenuItem onClick={() => handleExport('pdf')}>
                  Export as PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('docx')}>
                  Export as DOCX
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Messages Area */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-6 max-w-4xl mx-auto">
            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                onViewSource={handleViewSource}
                onCopyResponse={handleCopyResponse}
                onFeedback={(type) => setShowFeedback({ messageId: message.id, type })}
              />
            ))}
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
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                className="flex-1"
              />
              <Button onClick={handleSend} disabled={!query.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              <strong>Disclaimer:</strong> This tool is for informational purposes only. Do not enter any personal or sensitive information. Your feedback is confidential and used solely for improvement!
            </p>
          </div>
        </div>
      </div>

      {/* PDF Viewer */}
      {showPdfViewer && selectedSource && (
        <div className="w-96 border-l border-border bg-card">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h3>Source Preview</h3>
            <Button size="sm" variant="ghost" onClick={() => setShowPdfViewer(false)}>
              ×
            </Button>
          </div>
          <div className="p-4">
            <h4 className="mb-2">{selectedSource.source}</h4>
            <div className="bg-muted p-4 rounded text-sm">
              <p>PDF Preview would be displayed here with highlighted text:</p>
              <div className="mt-2 p-2 bg-yellow-100 rounded">
                <strong>Highlighted excerpt:</strong> {selectedSource.text}
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
            console.log('Feedback submitted:', feedback);
            setShowFeedback(null);
          }}
        />
      )}
    </div>
  );
}