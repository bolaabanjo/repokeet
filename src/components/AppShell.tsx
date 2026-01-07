'use client';

import { useState, Suspense } from 'react';
import Image from 'next/image';
import Sidebar from './Sidebar';
import { Logo } from './Logo';
import { PanelLeftOpen } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useSearchParams } from 'next/navigation';

interface AppShellProps {
    children: React.ReactNode;
}

function SidebarWrapper({ isOpen, onToggle }: { isOpen: boolean; onToggle: () => void }) {
    return (
        <Sidebar
            isOpen={isOpen}
            onToggle={onToggle}
            currentRepoName={undefined}
        />
    );
}

// HeaderContent uses useSearchParams, so it must be wrapped in Suspense
function HeaderContent({
    sidebarOpen,
    setSidebarOpen,
    user,
    loading,
    isSignedIn,
    signInWithGitHub,
    signOut
}: {
    sidebarOpen: boolean;
    setSidebarOpen: (open: boolean) => void;
    user: any;
    loading: boolean;
    isSignedIn: boolean;
    signInWithGitHub: () => void;
    signOut: () => void;
}) {
    const searchParams = useSearchParams();

    // Extract repo name from URL if present
    const repoUrl = searchParams?.get('repo');
    let repoName = null;
    if (repoUrl) {
        try {
            // fast parsing for display
            const url = new URL(repoUrl);
            const pathParts = url.pathname.split('/').filter(Boolean);
            if (pathParts.length >= 2) {
                repoName = `${pathParts[0]}/${pathParts[1]}`;
            }
        } catch (e) {
            // fallback if not a full URL
            repoName = repoUrl;
        }
    }

    return (
        <header className="flex-shrink-0 w-full px-4 py-4 flex items-center justify-between h-[69px]">
            <div className="flex items-center gap-3">
                {/* Toggle & Logo - Only show when sidebar is collapsed */}
                {!sidebarOpen && (
                    <>
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted/50"
                            title="Open sidebar"
                        >
                            <PanelLeftOpen className="w-5 h-5" />
                        </button>
                        <Logo width={100} height={28} />
                    </>
                )}
            </div>

            {/* Auth & Repo Name - Always visible here */}
            <div className="flex items-center gap-4">
                {repoName && (
                    <div className="hidden md:flex items-center text-sm font-medium text-muted-foreground">
                        {repoName}
                    </div>
                )}

                {loading ? (
                    <div className="h-9 w-24 rounded-full bg-muted/50 animate-pulse" />
                ) : isSignedIn && user ? (
                    <button
                        onClick={() => signOut()}
                        className="flex items-center gap-2.5 h-9 pl-1 pr-3 rounded-full border border-border/50 hover:border-border hover:bg-muted/30 transition-colors"
                    >
                        {user.user_metadata?.avatar_url ? (
                            <Image
                                src={user.user_metadata.avatar_url}
                                alt="Avatar"
                                width={24}
                                height={24}
                                className="rounded-full"
                            />
                        ) : (
                            <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium">
                                {user.user_metadata?.full_name?.charAt(0) || user.email?.charAt(0) || '?'}
                            </div>
                        )}
                        <span className="text-xs font-medium">
                            {user.user_metadata?.full_name?.split(' ')[0] || user.user_metadata?.user_name || 'User'}
                        </span>
                    </button>
                ) : (
                    <button
                        onClick={() => signInWithGitHub()}
                        className="flex items-center gap-2 h-9 px-3 text-xs font-medium rounded-full border border-border/50 hover:border-border hover:bg-muted/30 transition-colors"
                    >
                        <div className="relative w-3.5 h-3.5 dark:invert">
                            <Image
                                src="/github-mark.png"
                                alt="GitHub"
                                fill
                                className="object-contain"
                            />
                        </div>
                        Sign in
                    </button>
                )}
            </div>
        </header>
    );
}

export default function AppShell({ children }: AppShellProps) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const { user, isSignedIn, signInWithGitHub, signOut, loading } = useAuth();

    return (
        <div className="h-screen flex overflow-hidden">
            {/* Global Sidebar */}
            <Suspense fallback={null}>
                <SidebarWrapper
                    isOpen={sidebarOpen}
                    onToggle={() => setSidebarOpen(!sidebarOpen)}
                />
            </Suspense>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Header - PERSISTENT. This ensures no layout shift. Wrapped in Suspense. */}
                <Suspense fallback={
                    <header className="flex-shrink-0 w-full px-4 py-4 flex items-center justify-between h-[69px]">
                        <div className="flex items-center gap-3">
                            {/* Skeleton for logo/toggle if needed */}
                        </div>
                        <div className="h-9 w-24 rounded-full bg-muted/50 animate-pulse" />
                    </header>
                }>
                    <HeaderContent
                        sidebarOpen={sidebarOpen}
                        setSidebarOpen={setSidebarOpen}
                        user={user}
                        loading={loading}
                        isSignedIn={isSignedIn}
                        signInWithGitHub={signInWithGitHub}
                        signOut={signOut}
                    />
                </Suspense>

                {children}

                {/* Footer - PERSISTENT */}
                <footer className="flex-shrink-0 w-full px-6 py-4">
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>Repokeet</span>
                        <span>
                            Free · <a href="https://github.com/bolaabanjo/repokeet" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground transition-colors">GitHub</a> · Built on <a href="https://cencori.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground transition-colors">Cencori</a>
                        </span>
                    </div>
                </footer>
            </div>
        </div>
    );
}
