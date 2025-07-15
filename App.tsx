import { useState } from 'react';
import { ChatSidebar } from './components/ChatSidebar';
import { ChatInterface } from './components/ChatInterface';

export default function App() {
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [projects, setProjects] = useState([
    {
      id: 'project-1',
      name: 'Research Project',
      chats: [
        { id: 'chat-1', name: 'AI Ethics Discussion', isFavourite: false },
        { id: 'chat-2', name: 'Machine Learning Basics', isFavourite: true }
      ]
    },
    {
      id: 'project-2', 
      name: 'Product Development',
      chats: [
        { id: 'chat-3', name: 'User Experience Design', isFavourite: false }
      ]
    }
  ]);
  
  const [allChats, setAllChats] = useState([
    { id: 'chat-4', name: 'General Questions', isFavourite: false },
    { id: 'chat-5', name: 'Technical Support', isFavourite: true }
  ]);

  const favouriteChats = [
    ...projects.flatMap(p => p.chats.filter(c => c.isFavourite)),
    ...allChats.filter(c => c.isFavourite)
  ];

  const handleNewProject = () => {
    const newProject = {
      id: `project-${Date.now()}`,
      name: 'New Project',
      chats: []
    };
    setProjects([...projects, newProject]);
  };

  const handleNewChat = (projectId?: string) => {
    const newChat = {
      id: `chat-${Date.now()}`,
      name: 'New Chat',
      isFavourite: false
    };

    if (projectId) {
      setProjects(projects.map(p => 
        p.id === projectId 
          ? { ...p, chats: [...p.chats, newChat] }
          : p
      ));
    } else {
      setAllChats([...allChats, newChat]);
    }
    
    setSelectedChat(newChat.id);
  };

  const toggleFavourite = (chatId: string) => {
    // Update in projects
    setProjects(projects.map(p => ({
      ...p,
      chats: p.chats.map(c => 
        c.id === chatId ? { ...c, isFavourite: !c.isFavourite } : c
      )
    })));
    
    // Update in all chats
    setAllChats(allChats.map(c => 
      c.id === chatId ? { ...c, isFavourite: !c.isFavourite } : c
    ));
  };

  return (
    <div className="flex h-screen bg-background">
      <ChatSidebar
        projects={projects}
        favouriteChats={favouriteChats}
        allChats={allChats.filter(c => !c.isFavourite)}
        selectedChat={selectedChat}
        onSelectChat={setSelectedChat}
        onNewProject={handleNewProject}
        onNewChat={handleNewChat}
        onToggleFavourite={toggleFavourite}
      />
      <ChatInterface
        selectedChat={selectedChat}
        onToggleFavourite={toggleFavourite}
      />
    </div>
  );
}