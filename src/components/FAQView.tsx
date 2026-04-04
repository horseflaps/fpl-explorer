import React, { useState } from 'react';
import { ChevronDown, HelpCircle, ArrowRight } from 'lucide-react';

const faqs = [
    {
        q: 'Do I need the Chrome extension to use the platform?',
        a: `No — but you'll get much more value with it. Without the extension you can still search any FPL manager by name or entry ID, load their team, run AI analysis, and use all the data tools (Players, Teams, Fixtures, Standings, Gameweek Live). The extension simply means your own team loads automatically every time you visit, and higher membership tiers can apply transfers on your behalf.`,
    },
    {
        q: 'Is my FPL password or personal data at risk?',
        a: `Never. The extension does not capture your password — it reads an authentication token that the official FPL website generates after you log in (the same way any browser stores a session). This token is transmitted securely to our server only to fetch your team data, and is never logged or stored beyond the active session. We only persist your FPL entry ID, your saved team snapshots, and your hashed account password. We do not sell or share any personal data.`,
    },
    {
        q: 'How does the AI decide which transfers to recommend?',
        a: `The Wolf sends a detailed prompt to Google's Gemini model containing: your full 15-player squad, current bank balance, free transfers remaining, chip availability (Wildcard, Free Hit, Bench Boost, Triple Captain), upcoming fixture difficulty for the next 3–6 gameweeks, player form, price trends, xG/xA data, and your mini-league standings. Gemini analyses this context and returns a structured recommendation covering which players to bring in and out, who to captain, and whether a chip should be played — along with the reasoning for every decision.`,
    },
    {
        q: 'How often is the data updated?',
        a: `Player prices, squad data, and fixtures are sourced directly from the official FPL API and are as fresh as FPL's own data. Live gameweek scores update in near real-time during active gameweeks. News articles displayed in the platform are scraped from football media sources and refreshed on a scheduled interval throughout the day.`,
    },
    {
        q: 'What is a "free transfer" and how does the Wolf count them?',
        a: `In FPL you receive one free transfer per gameweek. If you don't use it, it rolls over — and as of the 2024/25 season you can bank up to a maximum of five. Each additional transfer beyond your free allowance costs 4 points. The Wolf tracks your transfer history to calculate exactly how many free transfers you have available, factors in any penalty cost for extra moves, and recommends accordingly — for example, suggesting you hold transfers if banking them sets up a stronger overhaul in an upcoming blank or double gameweek.`,
    },
    {
        q: 'Can I use the platform to analyse other managers — like rivals in my mini-league?',
        a: `Yes. On the Analyse tab you can search any FPL manager by their display name or numeric entry ID. You can also enter a mini-league ID to browse all participants and load any of their squads. This is useful for tracking what your rivals own, spotting differentials, or seeing whether a rival is likely to captain the same player as you.`,
    },
    {
        q: 'What is the difference between the Scout, Co-Pilot, and Autopilot tiers?',
        a: `All three tiers include full AI analysis. The difference is execution. Scout (free) gives you the recommendations and you act on them manually on the FPL website. Co-Pilot (£5/month) lets you trigger the analysis when you're ready and then has the Wolf apply the transfers directly to your FPL team — you approve before anything is confirmed. Autopilot (£10/month) is fully automated: the Wolf runs analysis before every gameweek deadline and applies the optimal moves without you needing to do anything, then sends you a detailed email log of every decision.`,
    },
    {
        q: 'Does the platform work on mobile?',
        a: `The web app is fully responsive and works on mobile browsers. However, the Chrome extension — which enables automatic FPL account sync — requires a desktop Chrome browser. On mobile you can still use all data tools and manually search teams. For the full connected experience, set up the extension on desktop first; your account link will then persist across devices.`,
    },
    {
        q: 'What are FPL chips and does the Wolf know when to use them?',
        a: `FPL chips are one-time boosts available during the season: Wildcard (reset your squad for free, used twice per season), Free Hit (temporary wildcard for one gameweek), Bench Boost (all 15 players score points that week), and Triple Captain (captain scores 3× instead of 2×). The Wolf is aware of which chips you've used and which remain, and factors them into its recommendation — for example, flagging a "Double Gameweek" as a strong Bench Boost or Triple Captain opportunity, or suggesting a Wildcard if your squad has structural issues across multiple positions.`,
    },
    {
        q: 'How do I get the best results from the AI analysis?',
        a: `A few tips: (1) Make sure your FPL account is connected so the Wolf has your real team, bank balance, and chip status — not a guessed approximation. (2) Run analysis a few days before the gameweek deadline when the fixture picture is clear and team news is emerging. (3) Read the full reasoning, not just the headline pick — understanding why the Wolf recommends a player helps you judge whether a last-minute injury or team news changes the conclusion. (4) Use the Players and Fixtures tabs to verify the underlying data yourself before confirming any transfer.`,
    },
];

const FAQItem: React.FC<{ item: typeof faqs[0]; index: number }> = ({ item, index }) => {
    const [open, setOpen] = useState(false);

    return (
        <div
            className={`border rounded-2xl overflow-hidden transition-all duration-300 ${open ? 'border-fpl-green/40 bg-fpl-green/5' : 'border-white/10 bg-slate-900/40 hover:border-white/20'}`}
        >
            <button
                className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left"
                onClick={() => setOpen(!open)}
            >
                <div className="flex items-center gap-4">
                    <span className="text-xs font-black text-fpl-green tabular-nums w-5 shrink-0">
                        {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="text-white font-semibold text-sm md:text-base leading-snug">{item.q}</span>
                </div>
                <ChevronDown
                    className={`text-gray-400 shrink-0 transition-transform duration-300 ${open ? 'rotate-180 text-fpl-green' : ''}`}
                    size={20}
                />
            </button>
            {open && (
                <div className="px-6 pb-6">
                    <div className="ml-9 border-l-2 border-fpl-green/30 pl-5">
                        <p className="text-gray-300 text-sm leading-relaxed">{item.a}</p>
                    </div>
                </div>
            )}
        </div>
    );
};

const FAQView: React.FC = () => {
    return (
        <div className="min-h-screen bg-slate-950 pt-16 pb-16 px-4 relative overflow-hidden">
            {/* Background glows */}
            <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-fpl-green/8 rounded-full blur-[140px] pointer-events-none" />
            <div className="absolute bottom-1/3 left-1/4 w-[400px] h-[400px] bg-[#e90052]/6 rounded-full blur-[140px] pointer-events-none" />

            <div className="max-w-3xl mx-auto relative z-10">

                {/* Hero */}
                <div className="text-center mb-16 space-y-5">
                    <div className="flex items-center justify-center">
                        <div className="w-14 h-14 bg-fpl-green/10 border border-fpl-green/30 rounded-2xl flex items-center justify-center">
                            <HelpCircle className="text-fpl-green w-7 h-7" />
                        </div>
                    </div>
                    <p className="text-fpl-green text-sm font-black uppercase tracking-[0.25em]">Support</p>
                    <h1 className="text-5xl md:text-6xl font-black text-white tracking-tight">
                        Frequently Asked <span className="text-transparent bg-clip-text bg-gradient-to-r from-fpl-green to-[#02efff]">Questions</span>
                    </h1>
                    <p className="text-gray-400 text-base max-w-xl mx-auto leading-relaxed">
                        Everything you need to know about FantasyPremierWolf, answered clearly.
                    </p>
                </div>

                {/* FAQ list */}
                <div className="space-y-3 mb-16">
                    {faqs.map((faq, i) => (
                        <FAQItem key={i} item={faq} index={i} />
                    ))}
                </div>

                {/* Bottom CTA */}
                <div className="bg-slate-900/50 border border-white/10 rounded-3xl p-8 text-center space-y-4">
                    <h3 className="text-white font-black text-xl">Still have a question?</h3>
                    <p className="text-gray-400 text-sm">Check the full How It Works guide for a deep-dive into every feature.</p>
                    <a
                        href="/how-it-works"
                        className="inline-flex items-center gap-2 px-7 py-3.5 bg-fpl-green text-slate-900 font-black text-sm uppercase tracking-widest rounded-xl hover:bg-fpl-green/90 transition-all shadow-[0_0_20px_rgba(0,255,135,0.25)]"
                    >
                        How It Works <ArrowRight size={15} />
                    </a>
                </div>
            </div>
        </div>
    );
};

export default FAQView;
