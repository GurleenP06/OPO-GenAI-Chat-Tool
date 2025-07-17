// frontend/src/components/ChatSidebar.tsx
import { useState } from 'react';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { Plus, ChevronDown, ChevronRight, MessageSquare, Star, Folder, MoreVertical, Trash2, FolderOpen } from 'lucide-react';
import type { OrganizedChats } from '@/lib/api';

interface ChatSidebarProps {
  organizedChats: OrganizedChats;
  selectedChat: string | null;
  onSelectChat: (chatId: string) => void;
  onNewProject: () => void;
  onNewChat: (projectId?: string) => void;
  onToggleFavorite: (chatId: string) => void;
  onDeleteProject: (projectId: string) => void;
  onMoveToProject: (chatId: string, projectId?: string) => void;
  onDeleteChat: (chatId: string) => void;
  loading?: boolean;
}

export function ChatSidebar({
  organizedChats,
  selectedChat,
  onSelectChat,
  onNewProject,
  onNewChat,
  onToggleFavorite,
  onDeleteProject,
  onMoveToProject,
  onDeleteChat,
  loading = false
}: ChatSidebarProps) {
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['favorites', 'no-project'])
  );

  const toggleProject = (projectId: string) => {
    const newExpanded = new Set(expandedProjects);
    if (newExpanded.has(projectId)) {
      newExpanded.delete(projectId);
    } else {
      newExpanded.add(projectId);
    }
    setExpandedProjects(newExpanded);
  };

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  // Sort projects by creation date (newest first)
  const sortedProjects = Object.entries(organizedChats.projects).sort(([, a], [, b]) => {
    return new Date(b.project.created_at).getTime() - new Date(a.project.created_at).getTime();
  });

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
          {/* Favorites Section */}
          {organizedChats.favorites.length > 0 && (
            <div>
              <Collapsible
                open={expandedSections.has('favorites')}
                onOpenChange={() => toggleSection('favorites')}
              >
                <CollapsibleTrigger className="flex items-center gap-2 text-sidebar-foreground hover:text-sidebar-primary-foreground text-sm p-2 rounded hover:bg-sidebar-accent w-full">
                  {expandedSections.has('favorites') ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                  <Star className="h-4 w-4" />
                  <span>Favorites</span>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-1 mt-1">
                  {organizedChats.favorites.map((chat) => (
                    <div
                      key={chat.session_id}
                      className={`flex items-center gap-2 p-2 rounded cursor-pointer text-sm group ${
                        selectedChat === chat.session_id
                          ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                          : 'text-sidebar-foreground hover:bg-sidebar-accent'
                      }`}
                      onClick={() => onSelectChat(chat.session_id)}
                    >
                      <MessageSquare className="h-3 w-3" />
                      <span className="truncate flex-1">{chat.name}</span>
                      <DropdownMenu>
                        <DropdownMenuTrigger 
                          className="opacity-0 group-hover:opacity-100 p-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="h-3 w-3" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleFavorite(chat.session_id);
                            }}
                          >
                            <Star className="h-4 w-4 mr-2 fill-yellow-400" />
                            Remove from Favorites
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm('Are you sure you want to delete this chat?')) {
                                onDeleteChat(chat.session_id);
                              }
                            }}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Chat
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}

          {/* Projects Section - sorted by newest first */}
          {sortedProjects.map(([projectId, projectData]) => (
            <div key={projectId}>
              <Collapsible
                open={expandedProjects.has(projectId)}
                onOpenChange={() => toggleProject(projectId)}
              >
                <div className="flex items-center justify-between group">
                  <CollapsibleTrigger className="flex items-center gap-2 text-sidebar-foreground hover:text-sidebar-primary-foreground text-sm p-2 rounded hover:bg-sidebar-accent flex-1">
                    {expandedProjects.has(projectId) ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                    <Folder className="h-4 w-4" />
                    <span className="truncate">{projectData.project.name}</span>
                  </CollapsibleTrigger>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="opacity-0 group-hover:opacity-100 p-1">
                      <MoreVertical className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => onNewChat(projectId)}>
                        <Plus className="h-4 w-4 mr-2" />
                        New Chat
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => onDeleteProject(projectId)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Project
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <CollapsibleContent className="pl-6 space-y-1">
                  {projectData.chats.map((chat) => (
                    <div
                      key={chat.session_id}
                      className={`flex items-center gap-2 p-2 rounded cursor-pointer text-sm group ${
                        selectedChat === chat.session_id
                          ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                          : 'text-sidebar-foreground hover:bg-sidebar-accent'
                      }`}
                      onClick={() => onSelectChat(chat.session_id)}
                    >
                      <MessageSquare className="h-3 w-3" />
                      <div className="flex-1 overflow-hidden">
                        <div className="truncate">{chat.name}</div>
                        <div className="text-xs opacity-60">{formatDate(chat.updated_at)}</div>
                      </div>
                      {chat.is_favorite && (
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger 
                          className="opacity-0 group-hover:opacity-100 p-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="h-3 w-3" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleFavorite(chat.session_id);
                            }}
                          >
                            <Star className={`h-4 w-4 mr-2 ${chat.is_favorite ? 'fill-yellow-400' : ''}`} />
                            {chat.is_favorite ? 'Remove from Favorites' : 'Add to Favorites'}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            const availableProjects = Object.entries(organizedChats.projects)
                              .filter(([id]) => id !== projectId);
                            if (availableProjects.length === 0) {
                              onMoveToProject(chat.session_id, undefined);
                            } else {
                              const projectNames = availableProjects.map(([id, data]) => data.project.name);
                              const selected = prompt(`Move to which project?\n\nAvailable projects:\n${projectNames.join('\n')}\n\nEnter project name (or leave empty for "All Chats"):`);
                              if (selected !== null) {
                                if (selected === '') {
                                  onMoveToProject(chat.session_id, undefined);
                                } else {
                                  const project = availableProjects.find(([id, data]) => data.project.name === selected);
                                  if (project) {
                                    onMoveToProject(chat.session_id, project[0]);
                                  }
                                }
                              }
                            }
                          }}>
                            <FolderOpen className="h-4 w-4 mr-2" />
                            Move to Project
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm('Are you sure you want to delete this chat?')) {
                                onDeleteChat(chat.session_id);
                              }
                            }}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Chat
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            </div>
          ))}

          {/* All Chats Section */}
          {organizedChats.no_project.length > 0 && (
            <div>
              <Collapsible
                open={expandedSections.has('no-project')}
                onOpenChange={() => toggleSection('no-project')}
              >
                <CollapsibleTrigger className="flex items-center gap-2 text-sidebar-foreground hover:text-sidebar-primary-foreground text-sm p-2 rounded hover:bg-sidebar-accent w-full">
                  {expandedSections.has('no-project') ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                  <MessageSquare className="h-4 w-4" />
                  <span>All Chats</span>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-1 mt-1">
                  {organizedChats.no_project.map((chat) => (
                    <div
                      key={chat.session_id}
                      className={`flex items-center gap-2 p-2 rounded cursor-pointer text-sm group ${
                        selectedChat === chat.session_id
                          ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                          : 'text-sidebar-foreground hover:bg-sidebar-accent'
                      }`}
                      onClick={() => onSelectChat(chat.session_id)}
                    >
                      <MessageSquare className="h-3 w-3" />
                      <div className="flex-1 overflow-hidden">
                        <div className="truncate">{chat.name}</div>
                        <div className="text-xs opacity-60">{formatDate(chat.updated_at)}</div>
                      </div>
                      {chat.is_favorite && (
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger 
                          className="opacity-0 group-hover:opacity-100 p-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="h-3 w-3" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleFavorite(chat.session_id);
                            }}
                          >
                            <Star className={`h-4 w-4 mr-2 ${chat.is_favorite ? 'fill-yellow-400' : ''}`} />
                            {chat.is_favorite ? 'Remove from Favorites' : 'Add to Favorites'}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            const availableProjects = Object.entries(organizedChats.projects);
                            if (availableProjects.length === 0) {
                              alert('No projects available. Create a project first.');
                              return;
                            }
                            const projectNames = availableProjects.map(([id, data]) => data.project.name);
                            const selected = prompt(`Move to which project?\n\nAvailable projects:\n${projectNames.join('\n')}\n\nEnter project name:`);
                            if (selected) {
                              const project = availableProjects.find(([id, data]) => data.project.name === selected);
                              if (project) {
                                onMoveToProject(chat.session_id, project[0]);
                              }
                            }
                          }}>
                            <FolderOpen className="h-4 w-4 mr-2" />
                            Move to Project
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm('Are you sure you want to delete this chat?')) {
                                onDeleteChat(chat.session_id);
                              }
                            }}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Chat
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}

          {/* Empty state */}
          {loading && (
            <div className="text-center text-sidebar-foreground text-sm py-8">
              Loading chats...
            </div>
          )}

          {!loading && organizedChats.favorites.length === 0 && 
           Object.keys(organizedChats.projects).length === 0 && 
           organizedChats.no_project.length === 0 && (
            <div className="text-center text-sidebar-foreground text-sm py-8">
              No chats yet. Start a new conversation!
            </div>
          )}
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
