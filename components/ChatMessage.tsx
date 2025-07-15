import { useState } from 'react';
import { Button } from './ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { ThumbsUp, ThumbsDown, Copy, ChevronDown, ChevronUp, Eye, Download, ExternalLink } from 'lucide-react';

interface Citation {
  id: string;
  text: string;
  source: string;
  url: string;
  highlighted?: boolean;
}

interface Message {
  id: string;
  type: 'user' | 'ai';
  content: string;
  citations?: Citation[];
  timestamp: Date;
}

interface ChatMessageProps {
  message: Message;
  onViewSource: (citation: Citation) => void;
  onCopyResponse: (content: string) => void;
  onFeedback: (type: 'up' | 'down') => void;
}

export function ChatMessage({ message, onViewSource, onCopyResponse, onFeedback }: ChatMessageProps) {
  const [showSources, setShowSources] = useState(false);

  const formatContent = (content: string, citations?: Citation[]) => {
    if (!citations) return content;
    
    let formattedContent = content;
    citations.forEach((citation, index) => {
      const citationNumber = `[${index + 1}]`;
      formattedContent = formattedContent.replace(citationNumber, 
        `<sup class="text-blue-600 cursor-pointer hover:underline">${citationNumber}</sup>`
      );
    });
    
    // Handle bold formatting
    formattedContent = formattedContent.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    return formattedContent;
  };

  if (message.type === 'user') {
    return (
      <div className="flex justify-end">
        <div className="bg-primary text-primary-foreground rounded-lg p-4 max-w-[80%]">
          <p>{message.content}</p>
          <p className="text-xs opacity-70 mt-2">
            {message.timestamp.toLocaleTimeString()}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="bg-muted rounded-lg p-4 max-w-[80%] space-y-4">
        <div 
          className="prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ 
            __html: formatContent(message.content, message.citations) 
          }}
        />
        
        <p className="text-xs text-muted-foreground">
          {message.timestamp.toLocaleTimeString()}
        </p>

        {/* Sources Section */}
        {message.citations && message.citations.length > 0 && (
          <Collapsible open={showSources} onOpenChange={setShowSources}>
            <CollapsibleTrigger className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800">
              {showSources ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              Sources ({message.citations.length})
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3">
              <div className="space-y-3 border-t pt-3">
                {message.citations.map((citation, index) => (
                  <div key={citation.id} className="bg-background rounded p-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="mb-1">
                          <span className="text-blue-600">[{index + 1}]</span> {citation.source}
                        </p>
                        <p className="text-muted-foreground italic">"{citation.text}"</p>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onViewSource(citation)}
                          className="h-7 px-2"
                        >
                          <Eye className="h-3 w-3" />
                          View
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => console.log('Download:', citation.url)}
                          className="h-7 px-2"
                        >
                          <Download className="h-3 w-3" />
                          Download
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(citation.url, '_blank')}
                          className="h-7 px-2"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Original
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 border-t">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onFeedback('up')}
            className="h-8 px-2"
          >
            <ThumbsUp className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onFeedback('down')}
            className="h-8 px-2"
          >
            <ThumbsDown className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onCopyResponse(message.content)}
            className="h-8 px-2"
          >
            <Copy className="h-4 w-4" />
            Copy
          </Button>
        </div>
      </div>
    </div>
  );
}