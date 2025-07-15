import { useState, useEffect } from 'react';
import { ChatSidebar } from './components/ChatSidebar';
import { ChatInterface } from './components/ChatInterface';
import { api, type Chat as APIChat, type Project as APIProject, type OrganizedChats } from './lib/api';

export default function App() {
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [organizedChats, setOrganizedChats] = useState<OrganizedChats>({
    favorites: [],
    projects: {},
    no_project: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadChats();
  }, []);

  const loadChats = async () => {
    try {
      setLoading(true);
      const chats = await api.listChats();
      setOrganizedChats(chats);
    } catch (error) {
      console.error('Failed to load chats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNewProject = async () => {
    const name = prompt('Enter project name:');
    if (name) {
      try {
        await api.createProject(name);
        await loadChats();
      } catch (error) {
        console.error('Failed to create project:', error);
      }
    }
  };

  const handleNewChat = async (projectId?: string) => {
    try {
      const result = await api.newChat(projectId);
      setSelectedChat(result.session_id);
      await loadChats();
    } catch (error) {
      console.error('Failed to create chat:', error);
    }
  };

  const handleToggleFavorite = async (chatId: string) => {
    try {
      await api.toggleFavorite(chatId);
      await loadChats();
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (confirm('Are you sure you want to delete this project? All chats in this project will be moved to "All Chats".')) {
      try {
        await api.deleteProject(projectId);
        await loadChats();
      } catch (error) {
        console.error('Failed to delete project:', error);
      }
    }
  };

  const handleRenameChat = async (chatId: string, newName: string) => {
    try {
      await api.renameChat(chatId, newName);
      await loadChats();
    } catch (error) {
      console.error('Failed to rename chat:', error);
    }
  };

  const handleMoveToProject = async (chatId: string, projectId?: string) => {
    try {
      await api.moveToProject(chatId, projectId);
      await loadChats();
    } catch (error) {
      console.error('Failed to move chat:', error);
    }
  };

  const handleDeleteChat = async (chatId: string) => {
    try {
      await api.deleteChat(chatId);
      if (selectedChat === chatId) {
        setSelectedChat(null);
      }
      await loadChats();
    } catch (error) {
      console.error('Failed to delete chat:', error);
    }
  };

  // Check if the selected chat is a favorite
  const isSelectedChatFavorite = () => {
    if (!selectedChat) return false;
    
    // Check in favorites
    const favoriteChat = organizedChats.favorites.find(chat => chat.session_id === selectedChat);
    if (favoriteChat) return true;
    
    // Check in projects
    for (const projectData of Object.values(organizedChats.projects)) {
      const chat = projectData.chats.find(c => c.session_id === selectedChat);
      if (chat && chat.is_favorite) return true;
    }
    
    // Check in no_project
    const noProjectChat = organizedChats.no_project.find(chat => chat.session_id === selectedChat);
    if (noProjectChat && noProjectChat.is_favorite) return true;
    
    return false;
  };

  return (
    <div className="flex h-screen bg-background">
      <ChatSidebar
        organizedChats={organizedChats}
        selectedChat={selectedChat}
        onSelectChat={setSelectedChat}
        onNewProject={handleNewProject}
        onNewChat={handleNewChat}
        onToggleFavorite={handleToggleFavorite}
        onDeleteProject={handleDeleteProject}
        onMoveToProject={handleMoveToProject}
        onDeleteChat={handleDeleteChat}
        loading={loading}
      />
      <ChatInterface
        selectedChat={selectedChat}
        onToggleFavorite={handleToggleFavorite}
        onRenameChat={handleRenameChat}
        onRefreshChats={loadChats}
        isFavorite={isSelectedChatFavorite()}
      />
    </div>
  );
}
