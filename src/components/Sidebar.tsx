'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { Plus, MessageSquare, User, LogIn, X, PanelLeftClose, PanelLeftOpen, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThemeToggle } from './ThemeToggle';
import { Logo } from './Logo';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';

interface ChatHistoryItem {
    id: string;
    repoName: string;
    timestamp: Date;
}

interface SidebarProps {
    isOpen: boolean;
    onToggle: () => void;
    currentRepoName?: string;
}

export default function Sidebar({ isOpen, onToggle, currentRepoName }: SidebarProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const chatSessionId = searchParams.get('id');
    const { user, isSignedIn, signInWithGitHub, signOut } = useAuth();

    const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);

    useEffect(() => {
        if (!user) {
            setChatHistory([]);
            return;
        }

        const fetchChatHistory = async () => {
            setIsLoadingHistory(true);
            try {
                const { data, error } = await supabase
                    .from('chats')
                    .select('*')
                    .eq('user_id', user.id)
                    .order('updated_at', { ascending: false });

                if (error) throw error;

                if (data) {
                    setChatHistory(data.map(chat => ({
                        id: chat.id,
                        repoName: chat.repo_name,
                        repoUrl: chat.repo_url,
                        timestamp: new Date(chat.created_at)
                    })));
                }
            } catch (err) {
                console.error('Error fetching chat history:', err);
            } finally {
                setIsLoadingHistory(false);
            }
        };

        fetchChatHistory();
    }, [user]);

    const handleNewChat = () => {
        router.push('/');
        if (window.innerWidth < 768) onToggle();
    };

    const handleSelectChat = (chat: any) => {
        const encodedUrl = encodeURIComponent(chat.repoUrl);
        router.push(`/chat?repo=${encodedUrl}&id=${chat.id}`);
        if (window.innerWidth < 768) onToggle();
    };

    const handleDeleteChat = async (e: React.MouseEvent, chatIdToDelete: string) => {
        e.stopPropagation();
        if (!confirm('Are you sure you want to delete this chat?')) return;

        try {
            const { error } = await supabase
                .from('chats')
                .delete()
                .eq('id', chatIdToDelete);

            if (error) throw error;

            setChatHistory(prev => prev.filter(chat => chat.id !== chatIdToDelete));

            // If the deleted chat is the current one, go back to home
            if (chatSessionId === chatIdToDelete) {
                router.push('/');
            }
        } catch (err) {
            console.error('Error deleting chat:', err);
        }
    };

    // Don't render anything when collapsed - AppShell handles the header
    if (!isOpen) {
        return null;
    }

    return (
        <>
            {/* Mobile Overlay */}
            <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
                onClick={onToggle}
            />

            {/* Sidebar - only shown when open */}
            <aside className="fixed md:relative inset-y-0 left-0 z-50 w-64 bg-background border-r border-border flex flex-col">
                {/* Logo & Toggle */}
                <div className="flex items-center justify-between px-5 py-5">
                    <Logo width={100} height={28} />
                    <div className="flex items-center gap-1">
                        <button
                            onClick={onToggle}
                            className="p-1 -mr-1 text-muted-foreground hover:text-foreground transition-colors"
                            title="Collapse sidebar"
                        >
                            <PanelLeftClose className="w-5 h-5" />
                        </button>
                        <button
                            onClick={onToggle}
                            className="md:hidden p-1 -mr-1 text-muted-foreground hover:text-foreground"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* New Chat Button */}
                <div className="px-3 pb-4">
                    <button
                        onClick={handleNewChat}
                        className="w-full flex items-center gap-2.5 px-4 py-3 text-sm rounded-xl border border-white/10 hover:bg-white/5 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        New chat
                    </button>
                </div>

                {/* Current Chat */}
                {currentRepoName && (
                    <div className="px-3 pb-2">
                        <div className="flex items-center gap-2.5 px-4 py-2.5 text-sm rounded-xl bg-white/5">
                            <span className="truncate text-sm">{currentRepoName}</span>
                        </div>
                    </div>
                )}

                {/* Chat History */}
                <div className="flex-1 overflow-y-auto px-3">
                    {isSignedIn ? (
                        isLoadingHistory ? (
                            <div className="px-4 py-6 text-xs text-muted-foreground/60 text-center animate-pulse">
                                Loading history...
                            </div>
                        ) : chatHistory.length > 0 ? (
                            <div className="space-y-1">
                                <span className="px-4 text-[10px] uppercase tracking-widest text-muted-foreground/60">
                                    Recent
                                </span>
                                {chatHistory.map((chat) => (
                                    <div key={chat.id} className="group flex items-center gap-1">
                                        <button
                                            onClick={() => handleSelectChat(chat)}
                                            className={cn(
                                                "flex-1 flex items-center gap-2.5 px-4 py-2.5 text-sm rounded-xl hover:bg-white/5 transition-colors text-left overflow-hidden",
                                                chatSessionId === chat.id ? "bg-white/5 border border-white/5" : ""
                                            )}
                                        >
                                            <span className={cn(
                                                "truncate transition-colors",
                                                chatSessionId === chat.id ? "text-foreground font-medium" : "text-muted-foreground/60 group-hover:text-muted-foreground"
                                            )}>
                                                {chat.repoName}
                                            </span>
                                        </button>
                                        <button
                                            onClick={(e) => handleDeleteChat(e, chat.id)}
                                            className="p-2 opacity-0 group-hover:opacity-100 text-muted-foreground/60 hover:text-error transition-all"
                                            title="Delete chat"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="px-4 py-6 text-xs text-muted-foreground/60 text-center">
                                No chat history yet
                            </div>
                        )
                    ) : (
                        <div className="px-4 py-6 text-xs text-muted-foreground/60 text-center">
                            Sign in to save history
                        </div>
                    )}
                </div>

                {/* Auth Section */}
                <div className="p-3 flex items-center gap-2">
                    {isSignedIn ? (
                        <button
                            onClick={() => signOut()}
                            className="flex-1 flex items-center gap-3 px-4 py-3 text-sm rounded-xl hover:bg-white/5 transition-colors overflow-hidden group"
                            title="Sign out"
                        >
                            {user?.user_metadata?.avatar_url ? (
                                <Image
                                    src={user.user_metadata.avatar_url}
                                    alt="Avatar"
                                    width={32}
                                    height={32}
                                    className="rounded-full flex-shrink-0"
                                />
                            ) : (
                                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 group-hover:bg-white/20 transition-colors">
                                    <User className="w-4 h-4" />
                                </div>
                            )}
                            <span className="truncate text-sm">
                                {user?.user_metadata?.full_name || user?.user_metadata?.user_name || user?.email?.split('@')[0]}
                            </span>
                        </button>
                    ) : (
                        <button
                            onClick={() => signInWithGitHub()}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm rounded-xl bg-white/10 hover:bg-white/15 transition-colors border border-white/10"
                        >
                            <LogIn className="w-4 h-4" />
                            Sign in
                        </button>
                    )}
                    <ThemeToggle />
                </div>
            </aside>
        </>
    );
}
