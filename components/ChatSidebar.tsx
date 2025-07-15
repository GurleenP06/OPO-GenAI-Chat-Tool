import { useState } from 'react';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { Plus, ChevronDown, ChevronRight, MessageSquare, Star, Folder } from 'lucide-react';

interface Chat {
  id: string;
  name: string;
  isFavourite: boolean;
}

interface Project {
  id: string;
  name: string;
  chats: Chat[];
}

interface ChatSidebarProps {
  projects: Project[];
  favouriteChats: Chat[];
  allChats: Chat[];
  selectedChat: string | null;
  onSelectChat: (chatId: string) => void;
  onNewProject: () => void;
  onNewChat: (projectId?: string) => void;
  onToggleFavourite: (chatId: string) => void;
}

export function ChatSidebar({
  projects,
  favouriteChats,
  allChats,
  selectedChat,
  onSelectChat,
  onNewProject,
  onNewChat,
  onToggleFavourite
}: ChatSidebarProps) {
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

  const toggleProject = (projectId: string) => {
    const newExpanded = new Set(expandedProjects);
    if (newExpanded.has(projectId)) {
      newExpanded.delete(projectId);
    } else {
      newExpanded.add(projectId);
    }
    setExpandedProjects(newExpanded);
  };

  return (
    <div className="w-80 border-r border-border bg-sidebar flex flex-col">
      <div className="p-4 border-b border-sidebar-border">
        <h2 className="text-sidebar-foreground mb-4">OPO GenAI Chat Tool</h2>
        <Button 
          onClick={onNewProject}
          className="w-full justify-start gap-2"
          variant="outline"
        >
          <Plus className="h-4 w-4" />
          Create New Project
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* Projects Section */}
          <div>
            <h3 className="text-sidebar-foreground mb-3 flex items-center gap-2">
              <Folder className="h-4 w-4" />
              Projects
            </h3>
            <div className="space-y-2">
              {projects.map((project) => (
                <Collapsible
                  key={project.id}
                  open={expandedProjects.has(project.id)}
                  onOpenChange={() => toggleProject(project.id)}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <CollapsibleTrigger className="flex items-center gap-2 text-sidebar-foreground hover:text-sidebar-primary-foreground text-sm p-2 rounded hover:bg-sidebar-accent flex-1">
                        {expandedProjects.has(project.id) ? (
                          <ChevronDown className="h-3 w-3" />
                        ) : (
                          <ChevronRight className="h-3 w-3" />
                        )}
                        <span className="truncate">{project.name}</span>
                      </CollapsibleTrigger>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onNewChat(project.id)}
                        className="h-6 w-6 p-0"
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <CollapsibleContent className="pl-6">
                      <div className="space-y-1">
                        {project.chats.map((chat) => (
                          <div
                            key={chat.id}
                            className={`flex items-center gap-2 p-2 rounded cursor-pointer text-sm ${
                              selectedChat === chat.id
                                ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                                : 'text-sidebar-foreground hover:bg-sidebar-accent'
                            }`}
                            onClick={() => onSelectChat(chat.id)}
                          >
                            <MessageSquare className="h-3 w-3" />
                            <span className="truncate flex-1">{chat.name}</span>
                            {chat.isFavourite && (
                              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                            )}
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              ))}
            </div>
          </div>

          {/* Favourites Section */}
          <div>
            <h3 className="text-sidebar-foreground mb-3 flex items-center gap-2">
              <Star className="h-4 w-4" />
              Favourites
            </h3>
            <div className="space-y-1">
              {favouriteChats.map((chat) => (
                <div
                  key={chat.id}
                  className={`flex items-center gap-2 p-2 rounded cursor-pointer text-sm ${
                    selectedChat === chat.id
                      ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent'
                  }`}
                  onClick={() => onSelectChat(chat.id)}
                >
                  <MessageSquare className="h-3 w-3" />
                  <span className="truncate flex-1">{chat.name}</span>
                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                </div>
              ))}
              {favouriteChats.length === 0 && (
                <p className="text-sidebar-foreground text-sm p-2 text-muted-foreground">
                  No favourite chats yet
                </p>
              )}
            </div>
          </div>

          {/* All Chats Section */}
          <div>
            <h3 className="text-sidebar-foreground mb-3 flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              All Chats
            </h3>
            <div className="space-y-1">
              {allChats.map((chat) => (
                <div
                  key={chat.id}
                  className={`flex items-center gap-2 p-2 rounded cursor-pointer text-sm ${
                    selectedChat === chat.id
                      ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent'
                  }`}
                  onClick={() => onSelectChat(chat.id)}
                >
                  <MessageSquare className="h-3 w-3" />
                  <span className="truncate flex-1">{chat.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </ScrollArea>

      <div className="p-4 border-t border-sidebar-border">
        <Button 
          onClick={() => onNewChat()}
          className="w-full justify-start gap-2"
          variant="outline"
        >
          <MessageSquare className="h-4 w-4" />
          Start New Chat
        </Button>
      </div>
    </div>
  );
}