import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, Shield, Calendar, Activity, Trophy, Shirt } from 'lucide-react';
import type { Event } from '../types/fpl';

interface LayoutProps {
    children: React.ReactNode;
    currentGameweek?: Event;
}

const Layout: React.FC<LayoutProps> = ({ children, currentGameweek }) => {
    const navItems = [
        { path: '/', label: 'Home', icon: LayoutDashboard },
        { path: '/my-team', label: 'My Team', icon: Shirt },
        { path: '/players', label: 'Players', icon: Users },
        { path: '/teams', label: 'Teams', icon: Shield },
        { path: '/fixtures', label: 'Fixtures', icon: Calendar },
        { path: '/gameweek', label: 'Gameweek', icon: Activity },
        { path: '/standings', label: 'Standings', icon: Trophy },
    ] as const;

    return (
        <div className="min-h-screen bg-[url('https://resources.premierleague.com/premierleague/photo/2023/12/22/a894560a-0490-449e-8798-7c050a490ca9/pl-background.png')] bg-fixed bg-cover bg-center bg-no-repeat bg-slate-950 attachment-fixed text-white font-sans">
            {/* Overlay */}
            <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-0 pointer-events-none" />

            <div className="relative z-10 flex min-h-screen">
                {/* Sidebar */}
                <aside className="hidden md:flex flex-col w-80 border-r border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 h-screen overflow-y-auto">
                    <div className="p-6 border-b border-slate-800/50">
                        <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#00ff87] to-[#02efff]">
                            FantasyPremierWolf
                        </h1>
                        <p className="text-xs text-[#02efff] mt-1 uppercase tracking-widest font-bold">Alpha Strategy Tool</p>
                    </div>

                    <nav className="flex-1 p-4 space-y-2">
                        {navItems.map((item) => (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                className={({ isActive }) => `w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${isActive
                                    ? 'bg-fpl-green text-slate-900 shadow-lg shadow-fpl-green/20 font-bold'
                                    : 'text-gray-400 hover:text-white hover:bg-slate-800'
                                    }`}
                            >
                                {({ isActive }) => (
                                    <>
                                        <item.icon size={20} className={`${isActive ? 'text-slate-900' : 'group-hover:text-fpl-green transition-colors'}`} />
                                        <span className="font-semibold">{item.label}</span>
                                    </>
                                )}
                            </NavLink>
                        ))}
                    </nav>

                    <div className="p-4 border-t border-slate-800/50 bg-slate-900/30">
                        <div className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-bold">Current Gameweek</div>
                        <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
                            <div className="text-lg font-bold text-white mb-1">
                                {currentGameweek?.name || 'Pre-Season'}
                            </div>
                            <div className="text-xs text-gray-400">
                                {currentGameweek?.deadline_time ? new Date(currentGameweek.deadline_time).toLocaleDateString() : 'Date TBD'}
                            </div>
                        </div>
                    </div>
                </aside>

                {/* Mobile Header (visible only on small screens) */}
                {/* For simplicity we will stick to basic rendering first, can enhance mobile later */}

                {/* Main Content */}
                <main className="flex-1 overflow-y-auto h-screen scroll-smooth">
                    {/* Sticky Banner Wrapper */}
                    <div className="sticky top-0 z-20 bg-slate-950/80 backdrop-blur-xl border-b border-white/5">
                        <div className="max-w-7xl mx-auto p-4 md:p-8 pb-4 md:pb-6">
                            {/* Top Banner */}
                            <div className="rounded-2xl overflow-hidden shadow-[0_0_25px_rgba(0,255,135,0.2)] border border-white/10">
                                <img
                                    src="/banner.png"
                                    alt="FantasyPremierWolf Banner"
                                    className="w-full h-auto object-cover"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="max-w-7xl mx-auto p-4 md:p-8 pt-6 md:pt-8">
                        {/* Page Header placeholder if needed, mostly handled by views */}
                        <div className="mb-8 md:hidden">
                            <h1 className="text-3xl font-black text-white">FantasyPremierWolf</h1>
                        </div>
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
};

export default Layout;
