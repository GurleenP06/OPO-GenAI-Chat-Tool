import { useState } from 'react';
import { Button } from './ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { ThumbsUp, ThumbsDown, Copy, ChevronDown, ChevronUp, Eye, Download } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

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
  highlighted_passages?: any;
}

interface ChatMessageProps {
  message: Message;
  messageIndex: number;
  onViewSource: (citation: Citation) => void;
  onCopyResponse: (content: string) => void;
  onFeedback: (type: 'up' | 'down') => void;
  onExport: (format: 'docx' | 'pdf') => void;
}

export function ChatMessage({ 
  message, 
  messageIndex,
  onViewSource, 
  onCopyResponse, 
  onFeedback,
  onExport 
}: ChatMessageProps) {
  const [showSources, setShowSources] = useState(false);

  const processCitations = (content: string, citations?: Citation[]) => {
    if (!citations || citations.length === 0) return content;
    
    // Replace [n] with styled citation boxes
    let processedContent = content;
    citations.forEach((_citation, index) => {
      const citationNum = index + 1;
      const citationPattern = new RegExp(`\\[${citationNum}\\]`, 'g');
      processedContent = processedContent.replace(
        citationPattern,
        `<CITATION_${citationNum}>`
      );
    });
    
    return processedContent;
  };

  const renderContent = (content: string) => {
    const processedContent = processCitations(content, message.citations);
    
    return (
      <ReactMarkdown
        components={{
          p: ({ children }) => <p className="mb-4 leading-relaxed">{children}</p>,
          ul: ({ children }) => <ul className="mb-4 ml-6 list-disc space-y-2">{children}</ul>,
          ol: ({ children }) => <ol className="mb-4 ml-6 list-decimal space-y-2">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          h1: ({ children }) => <h1 className="text-2xl font-bold mb-4">{children}</h1>,
          h2: ({ children }) => <h2 className="text-xl font-bold mb-3">{children}</h2>,
          h3: ({ children }) => <h3 className="text-lg font-semibold mb-2">{children}</h3>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          code: ({ children, ...props }) => {
            const inline = !props.className?.includes('language-');
            return inline ? (
              <code className="bg-gray-100 px-1 py-0.5 rounded text-sm">{children}</code>
            ) : (
              <pre className="bg-gray-100 p-3 rounded-lg overflow-x-auto mb-4">
                <code>{children}</code>
              </pre>
            );
          },
        }}
      >
        {processedContent.replace(/<CITATION_(\d+)>/g, (_, num) => {
          return `[CITATION${num}]`;
        })}
      </ReactMarkdown>
    );
  };

  const renderContentWithCitations = () => {
    const content = renderContent(message.content);
    
    // Post-process to add citation buttons
    const processedElement = (
      <div 
        className="prose prose-lg max-w-none"
        dangerouslySetInnerHTML={{
          __html: content.props.children.toString()
            .replace(/\[CITATION(\d+)\]/g, (_: string, num: string) => {
              return `<button 
                class="citation-button inline-flex items-center justify-center px-2 py-0.5 mx-1 text-xs font-semibold text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
                data-citation="${num}"
                style="min-width: 24px; height: 22px;"
              >${num}</button>`;
            })
        }}
        onClick={(e) => {
          const target = e.target as HTMLElement;
          if (target.classList.contains('citation-button')) {
            const citationNum = parseInt(target.getAttribute('data-citation') || '0');
            if (message.citations && message.citations[citationNum - 1]) {
              onViewSource(message.citations[citationNum - 1]);
            }
          }
        }}
      />
    );
    
    return processedElement;
  };

  if (message.type === 'user') {
    return (
      <div className="flex justify-end mb-6">
        <div className="bg-primary text-primary-foreground rounded-lg p-4 max-w-[80%]">
          <p className="text-base">{message.content}</p>
          <p className="text-xs opacity-70 mt-2">
            {message.timestamp.toLocaleTimeString()}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start mb-6">
      <div className="bg-muted rounded-lg p-6 max-w-[85%] space-y-4">
        {renderContentWithCitations()}
        
        <p className="text-sm text-muted-foreground">
          {message.timestamp.toLocaleTimeString()}
        </p>

        {/* Sources Section */}
        {message.citations && message.citations.length > 0 && (
          <div className="mt-4">
            <Collapsible open={showSources} onOpenChange={setShowSources}>
              <CollapsibleTrigger className="flex items-center gap-2 text-base font-medium text-blue-600 hover:text-blue-800 cursor-pointer">
                {showSources ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                Sources ({message.citations.length})
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3">
                <div className="space-y-3 border-t pt-3">
                  {message.citations.map((citation, index) => (
                    <div key={citation.id} className="bg-white border border-gray-200 rounded-lg p-4 text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="mb-1 font-semibold flex items-center gap-2">
                            <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-semibold text-white bg-blue-600 rounded min-w-[24px] h-[22px]">
                              {index + 1}
                            </span>
                            {citation.source}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onViewSource(citation)}
                          className="h-8 px-3"
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 border-t">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onFeedback('up')}
            className="h-9 px-3"
          >
            <ThumbsUp className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onFeedback('down')}
            className="h-9 px-3"
          >
            <ThumbsDown className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onCopyResponse(message.content)}
            className="h-9 px-3"
          >
            <Copy className="h-4 w-4 mr-1" />
            Copy
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" className="h-9 px-3">
                <Download className="h-4 w-4 mr-1" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => onExport('docx')}>
                Export as DOCX
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onExport('pdf')}>
                Export as PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
