'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Loader2, Menu, PanelLeftOpen } from 'lucide-react';
import type { RepoContext, ChatMessage } from '@/types';
import { generateId } from '@/lib/utils';
import { buildInitialMessage } from '@/lib/prompts';
import ChatInterface from '@/components/ChatInterface';
import Sidebar from '@/components/Sidebar';
import ExplorationUI from '@/components/ExplorationUI';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';

function ChatPageContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const repoUrl = searchParams.get('repo');
    const chatIdFromUrl = searchParams.get('id');
    const { user, isSignedIn } = useAuth();

    const [chatId, setChatId] = useState<string | null>(chatIdFromUrl);
    const [repoContext, setRepoContext] = useState<RepoContext | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isAnalyzing, setIsAnalyzing] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState('');
    const [analysisInfo, setAnalysisInfo] = useState<{ owner: string; repo: string; fileCount?: number; keyFiles?: string[]; hasPackageJson?: boolean } | null>(null);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [showExploration, setShowExploration] = useState(false);

    // Analyze repo on mount
    useEffect(() => {
        if (!repoUrl) {
            router.push('/');
            return;
        }

        const analyzeRepo = async () => {
            try {
                // Parse owner/repo from URL to show progress immediately
                const decodedUrl = decodeURIComponent(repoUrl);
                const match = decodedUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
                const owner = match ? match[1] : '';
                const repo = match ? match[2].replace(/\.git$/, '') : '';

                if (owner && repo) {
                    setAnalysisInfo({ owner, repo });
                }

                // If loading an existing chat
                if (chatIdFromUrl) {
                    const { data: chatData, error: chatError } = await supabase
                        .from('chats')
                        .select('*, messages(*)')
                        .eq('id', chatIdFromUrl)
                        .single();

                    if (!chatError && chatData) {
                        const savedMessages: ChatMessage[] = chatData.messages
                            .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                            .map((m: any) => ({
                                id: m.id,
                                role: m.role,
                                content: m.content,
                                timestamp: new Date(m.created_at)
                            }));

                        setMessages(savedMessages);
                        setChatId(chatIdFromUrl);
                    }
                }

                const response = await fetch('/api/analyze', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ repoUrl: decodedUrl }),
                });

                const data = await response.json();

                if (!data.success) {
                    setError(data.error || 'Failed to analyze repository');
                    setIsAnalyzing(false);
                    return;
                }

                setRepoContext(data.data);

                // Update analysis info with results
                setAnalysisInfo({
                    owner: data.data.owner,
                    repo: data.data.repo,
                    fileCount: data.data.fileTree?.length || 0,
                    keyFiles: data.data.keyFiles?.map((f: { path: string }) => f.path) || [],
                    hasPackageJson: !!data.data.packageJson,
                });

                // Only perform initial setup if it's a new chat
                if (!chatIdFromUrl) {
                    // Show exploration UI instead of auto-generating
                    setShowExploration(true);
                    setIsAnalyzing(false);
                } else {
                    setIsAnalyzing(false);
                }
            } catch (err) {
                console.error('Analysis error:', err);
                setError('Failed to connect to the server');
                setIsAnalyzing(false);
            }
        };

        analyzeRepo();
    }, [repoUrl, chatIdFromUrl, router]); // eslint-disable-line react-hooks/exhaustive-deps

    const sendMessageToAI = useCallback(async (
        context: RepoContext,
        existingMessages: ChatMessage[]
    ) => {
        setIsGenerating(true);

        try {
            // If user is signed in and we don't have a chatId, create a new chat
            let currentChatId = chatId;
            if (isSignedIn && user && !currentChatId) {
                const { data: newChat, error: chatError } = await supabase
                    .from('chats')
                    .insert({
                        user_id: user.id,
                        repo_name: `${context.owner}/${context.repo}`,
                        repo_url: repoUrl
                    })
                    .select()
                    .single();

                if (!chatError && newChat) {
                    currentChatId = newChat.id;
                    setChatId(newChat.id);
                    // Update URL with chatId without refreshing the page
                    const params = new URLSearchParams(window.location.search);
                    params.set('id', newChat.id);
                    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);

                    // Save initial assistant message and first user message
                    const messagesToSave = existingMessages.map(m => ({
                        chat_id: newChat.id,
                        role: m.role,
                        content: m.content,
                        created_at: new Date().toISOString()
                    }));
                    await supabase.from('messages').insert(messagesToSave);
                }
            } else if (isSignedIn && currentChatId) {
                // Save only the latest user message if chat already existed
                const lastUserMessage = existingMessages[existingMessages.length - 1];
                if (lastUserMessage.role === 'user') {
                    await supabase.from('messages').insert({
                        chat_id: currentChatId,
                        role: 'user',
                        content: lastUserMessage.content,
                        created_at: new Date().toISOString()
                    });
                }
            }

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: existingMessages.filter(m => m.role === 'user'),
                    repoContext: context,
                    style: 'professional',
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to get response');
            }

            const reader = response.body?.getReader();
            if (!reader) throw new Error('No response body');

            const decoder = new TextDecoder();
            let fullContent = '';

            const assistantMessage: ChatMessage = {
                id: generateId(),
                role: 'assistant',
                content: '',
                timestamp: new Date(),
            };

            setMessages(prev => [...prev, assistantMessage]);

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                fullContent += chunk;

                setMessages(prev =>
                    prev.map(m =>
                        m.id === assistantMessage.id
                            ? { ...m, content: fullContent }
                            : m
                    )
                );
            }

            // Save assistant message to Supabase
            if (isSignedIn && currentChatId) {
                await supabase.from('messages').insert({
                    chat_id: currentChatId,
                    role: 'assistant',
                    content: fullContent,
                    created_at: new Date().toISOString()
                });

                // Update updated_at for chat
                await supabase
                    .from('chats')
                    .update({ updated_at: new Date().toISOString() })
                    .eq('id', currentChatId);
            }

            setIsGenerating(false);
        } catch (err) {
            console.error('Chat error:', err);
            setError('Failed to get response. Please try again.');
            setIsGenerating(false);
        }
    }, [chatId, isSignedIn, user, repoUrl]);

    const handleSendMessage = async (content: string) => {
        if (!repoContext || isGenerating) return;

        // Hide exploration UI when user sends a message
        setShowExploration(false);

        const userMessage: ChatMessage = {
            id: generateId(),
            role: 'user',
            content,
            timestamp: new Date(),
        };

        const newMessages = [...messages, userMessage];
        setMessages(newMessages);

        await sendMessageToAI(repoContext, newMessages);
    };

    const handleExplorationPrompt = (prompt: string) => {
        handleSendMessage(prompt);
    };

    const handleSwitchRepo = () => {
        router.push('/');
    };

    if (error && !repoContext) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-4">
                <p className="text-error text-sm">{error}</p>
                <button
                    onClick={() => router.push('/')}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                    ← Try another repository
                </button>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col min-h-0">
            {/* Header */}


            {/* Chat or Exploration */}
            <div className="flex-1 flex flex-col min-h-0">
                <ChatInterface
                    messages={messages}
                    onSendMessage={handleSendMessage}
                    isGenerating={isGenerating}
                    isAnalyzing={isAnalyzing}
                    analysisInfo={analysisInfo || undefined}
                    showExploration={showExploration && !isAnalyzing && messages.length === 0}
                    explorationProps={analysisInfo ? {
                        owner: analysisInfo.owner,
                        repo: analysisInfo.repo,
                        onSelectPrompt: handleExplorationPrompt,
                        onSwitchRepo: handleSwitchRepo,
                    } : undefined}
                />
            </div>
        </div>
    );
}

export default function ChatPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
        }>
            <ChatPageContent />
        </Suspense>
    );
}
