import React, { useState } from 'react';
import { X, ChevronRight, Dna } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface Props {
    onClose: () => void;
}

const QUESTIONS = [
    {
        id: 'q1',
        title: 'How do you approach risk in FPL?',
        type: 'scale' as const,
        lowLabel: 'Play it safe',
        highLabel: 'Go big or go home',
    },
    {
        id: 'q2',
        title: 'How do you feel about "The Template"?',
        subtitle: 'Highly-owned players shared by top managers',
        type: 'scale' as const,
        lowLabel: 'I avoid it completely',
        highLabel: 'High ownership = less risk',
    },
    {
        id: 'q3',
        title: 'How willing are you to take a points hit?',
        type: 'scale' as const,
        lowLabel: 'Never — hits are wasteful',
        highLabel: 'Always — if it gets me points',
    },
    {
        id: 'q4',
        title: 'When you make a transfer, what are you thinking about?',
        type: 'scale' as const,
        lowLabel: 'This gameweek only',
        highLabel: '5+ gameweeks ahead',
    },
    {
        id: 'q5',
        title: "You're 50 points behind your Mini-League rival with 3 GWs to go. What's your move?",
        type: 'choice' as const,
        options: [
            { value: 1, label: 'A', sublabel: 'Captain the same player as them to protect the gap', tag: 'The Defensive Manager' },
            { value: 5, label: 'B', sublabel: 'Captain a 2% owned differential to try and swing it', tag: 'The Hunter' },
        ],
    },
    {
        id: 'q6',
        title: 'How do you evaluate a player?',
        type: 'scale' as const,
        lowLabel: 'Pure stats — xG, form, fixtures',
        highLabel: 'What I see on the pitch',
    },
    {
        id: 'q7',
        title: 'A player scores a hat-trick on Saturday. What do you do?',
        type: 'scale' as const,
        lowLabel: "Nothing — one good game proves nothing",
        highLabel: "He's straight in my team",
    },
];

type Archetype = 'maverick' | 'spreadsheet' | 'template' | 'kneejerk' | 'eyetest';

const ARCHETYPES: Record<Archetype, { name: string; phrase: string; description: string; color: string; border: string; glow: string; bg: string }> = {
    maverick: {
        name: 'The Maverick',
        phrase: '"If I\'m not first, I\'m last."',
        description: 'You live for the differential. High risk, low template, and you\'ll take a -8 if the logic is there. Your season is a rollercoaster — but when it lands, it lands big.',
        color: 'text-orange-400',
        border: 'border-orange-500',
        glow: 'shadow-[0_0_50px_rgba(249,115,22,0.35)]',
        bg: 'bg-orange-500/10',
    },
    spreadsheet: {
        name: 'The Spreadsheet Sage',
        phrase: '"The stats say he\'s due a goal."',
        description: 'Cold, calculated, and data-driven. You plan 5 gameweeks ahead, rarely knee-jerk, and trust the process even when it hurts. The long game is your game.',
        color: 'text-[#02efff]',
        border: 'border-[#02efff]',
        glow: 'shadow-[0_0_50px_rgba(2,239,255,0.35)]',
        bg: 'bg-[#02efff]/10',
    },
    template: {
        name: 'The Template King',
        phrase: '"Better safe than sorry."',
        description: 'You play the percentages and sleep well at night. High ownership means shared pain, and you\'re fine with that. Consistency is your strength.',
        color: 'text-fpl-green',
        border: 'border-fpl-green',
        glow: 'shadow-[0_0_50px_rgba(0,255,135,0.35)]',
        bg: 'bg-fpl-green/10',
    },
    kneejerk: {
        name: 'The Knee-jerker',
        phrase: '"He scored twice, I need him NOW."',
        description: 'You react fast and own it. Last week\'s points are this week\'s transfers. Your squad is always fresh — sometimes brilliant, sometimes chaotic.',
        color: 'text-red-400',
        border: 'border-red-500',
        glow: 'shadow-[0_0_50px_rgba(239,68,68,0.35)]',
        bg: 'bg-red-500/10',
    },
    eyetest: {
        name: 'The Eye-Test Purist',
        phrase: '"He looked sharp on Match of the Day."',
        description: 'You trust your eyes over any algorithm. If a player looks good on the pitch, that\'s enough. Your instincts are honed by years of watching football.',
        color: 'text-purple-400',
        border: 'border-purple-500',
        glow: 'shadow-[0_0_50px_rgba(168,85,247,0.35)]',
        bg: 'bg-purple-500/10',
    },
};

function determineArchetype(answers: Record<string, number>): Archetype {
    const ideals: Record<Archetype, Record<string, number>> = {
        maverick:    { q1: 5, q2: 1, q3: 5, q4: 3, q5: 5, q6: 3, q7: 2 },
        spreadsheet: { q1: 2, q2: 2, q3: 3, q4: 5, q5: 3, q6: 1, q7: 1 },
        template:    { q1: 1, q2: 5, q3: 1, q4: 3, q5: 1, q6: 2, q7: 2 },
        kneejerk:    { q1: 3, q2: 3, q3: 4, q4: 1, q5: 5, q6: 3, q7: 5 },
        eyetest:     { q1: 3, q2: 2, q3: 3, q4: 3, q5: 3, q6: 5, q7: 4 },
    };
    const weights: Record<string, number> = { q1: 2, q2: 3, q3: 2, q4: 2, q5: 3, q6: 3, q7: 3 };

    const scores = (Object.keys(ideals) as Archetype[]).map(archetype => ({
        archetype,
        score: Object.keys(weights).reduce((sum, q) => sum + weights[q] * (5 - Math.abs(answers[q] - ideals[archetype][q])), 0),
    }));

    return scores.reduce((best, curr) => curr.score > best.score ? curr : best).archetype;
}

const ManagerDNAQuiz: React.FC<Props> = ({ onClose }) => {
    const { token, refreshUser } = useAuth();
    const [step, setStep] = useState(0); // 0 = intro, 1-7 = questions, 8 = result
    const [answers, setAnswers] = useState<Record<string, number>>({});
    const [result, setResult] = useState<Archetype | null>(null);
    const [saving, setSaving] = useState(false);

    const currentQ = QUESTIONS[step - 1];
    const totalSteps = QUESTIONS.length;
    const currentAnswer = currentQ ? answers[currentQ.id] : undefined;

    const handleAnswer = (value: number) => {
        if (!currentQ) return;
        setAnswers(prev => ({ ...prev, [currentQ.id]: value }));
    };

    const handleNext = async () => {
        if (step === 0) { setStep(1); return; }
        if (step < totalSteps) { setStep(s => s + 1); return; }

        // Last question — compute result and save
        const dna = determineArchetype(answers);
        setResult(dna);
        setStep(totalSteps + 1);

        setSaving(true);
        try {
            await fetch('/api/user/manager-dna', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ dna }),
            });
            await refreshUser();
        } catch {}
        setSaving(false);
    };

    const canProgress = step === 0 || currentAnswer !== undefined;

    // Result screen
    if (result) {
        const info = ARCHETYPES[result];
        return (
            <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                <div className={`bg-slate-950 border-2 ${info.border} rounded-3xl w-full max-w-md ${info.glow} animate-in zoom-in-95 duration-300`}>
                    <div className={`h-1.5 rounded-t-3xl ${info.bg} border-b ${info.border}`} />
                    <div className="p-8 text-center space-y-5">
                        <div className={`w-16 h-16 mx-auto rounded-2xl ${info.bg} border ${info.border} flex items-center justify-center`}>
                            <Dna className={`w-8 h-8 ${info.color}`} />
                        </div>
                        <div>
                            <p className={`text-xs font-black uppercase tracking-[0.2em] mb-2 ${info.color}`}>Your Manager DNA</p>
                            <h2 className={`text-3xl font-black ${info.color}`}>{info.name}</h2>
                            <p className="text-gray-400 text-sm italic mt-2">{info.phrase}</p>
                        </div>
                        <p className="text-gray-300 text-sm leading-relaxed">{info.description}</p>
                        <button
                            onClick={onClose}
                            disabled={saving}
                            className={`w-full py-3 rounded-xl font-black text-sm uppercase tracking-wider transition-all ${info.bg} border ${info.border} ${info.color} hover:brightness-125 disabled:opacity-50`}
                        >
                            {saving ? 'Saving...' : 'Let the Wolf know →'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="bg-slate-950 border border-fpl-green/30 rounded-3xl w-full max-w-lg shadow-[0_0_40px_rgba(0,255,135,0.1)] animate-in zoom-in-95 duration-300">
                <div className="h-1 bg-gradient-to-r from-fpl-green to-[#02efff] rounded-t-3xl" />

                <div className="p-7">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                            <Dna className="text-fpl-green w-5 h-5" />
                            <span className="text-xs font-black uppercase tracking-widest text-fpl-green">Manager DNA</span>
                        </div>
                        <button onClick={onClose} className="text-gray-600 hover:text-gray-400 transition-colors">
                            <X size={18} />
                        </button>
                    </div>

                    {/* Intro */}
                    {step === 0 && (
                        <div className="space-y-4">
                            <h2 className="text-2xl font-black text-white leading-tight">What kind of FPL manager are you?</h2>
                            <p className="text-gray-400 text-sm leading-relaxed">
                                Answer 7 quick questions and the Wolf will determine your <span className="text-fpl-green font-semibold">Manager DNA</span> — your true FPL archetype. This helps us tailor every analysis to how you actually play.
                            </p>
                            <div className="grid grid-cols-1 gap-2 pt-2">
                                {(['The Maverick', 'The Spreadsheet Sage', 'The Template King', 'The Knee-jerker', 'The Eye-Test Purist'] as const).map(name => (
                                    <div key={name} className="flex items-center gap-2 text-xs text-gray-500">
                                        <div className="w-1 h-1 rounded-full bg-fpl-green/40" />
                                        {name}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Question */}
                    {step >= 1 && currentQ && (
                        <div className="space-y-5">
                            {/* Progress */}
                            <div className="flex items-center gap-2">
                                <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-fpl-green to-[#02efff] transition-all duration-300"
                                        style={{ width: `${((step - 1) / totalSteps) * 100}%` }}
                                    />
                                </div>
                                <span className="text-xs text-gray-500 shrink-0">{step}/{totalSteps}</span>
                            </div>

                            <div>
                                <h3 className="text-lg font-black text-white leading-snug">{currentQ.title}</h3>
                                {currentQ.type === 'scale' && 'subtitle' in currentQ && currentQ.subtitle && (
                                    <p className="text-sm text-gray-400 mt-1">{currentQ.subtitle}</p>
                                )}
                            </div>

                            {currentQ.type === 'scale' && (
                                <div className="space-y-3">
                                    <div className="flex gap-2">
                                        {[1, 2, 3, 4, 5].map(v => (
                                            <button
                                                key={v}
                                                onClick={() => handleAnswer(v)}
                                                className={`flex-1 py-3 rounded-xl font-black text-sm transition-all border ${
                                                    currentAnswer === v
                                                        ? 'bg-fpl-green text-slate-900 border-fpl-green shadow-[0_0_15px_rgba(0,255,135,0.3)]'
                                                        : 'bg-slate-800/50 border-slate-700 text-gray-400 hover:border-fpl-green/40 hover:text-white'
                                                }`}
                                            >
                                                {v}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="flex justify-between text-sm text-gray-400">
                                        <span>{currentQ.lowLabel}</span>
                                        <span className="text-right">{currentQ.highLabel}</span>
                                    </div>
                                </div>
                            )}

                            {currentQ.type === 'choice' && (
                                <div className="space-y-3">
                                    {currentQ.options!.map(opt => (
                                        <button
                                            key={opt.value}
                                            onClick={() => handleAnswer(opt.value)}
                                            className={`w-full text-left p-4 rounded-xl border transition-all ${
                                                currentAnswer === opt.value
                                                    ? 'bg-fpl-green/10 border-fpl-green text-white shadow-[0_0_15px_rgba(0,255,135,0.15)]'
                                                    : 'bg-slate-800/50 border-slate-700 text-gray-400 hover:border-fpl-green/40 hover:text-white'
                                            }`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <span className={`font-black text-lg shrink-0 ${currentAnswer === opt.value ? 'text-fpl-green' : 'text-gray-600'}`}>
                                                    {opt.label}
                                                </span>
                                                <div>
                                                    <p className="text-sm font-semibold">{opt.sublabel}</p>
                                                    <p className={`text-xs mt-0.5 ${currentAnswer === opt.value ? 'text-fpl-green' : 'text-gray-600'}`}>{opt.tag}</p>
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-between mt-7">
                        <button onClick={onClose} className="text-left">
                            <p className="text-sm text-gray-500 hover:text-gray-300 transition-colors">Skip for now</p>
                            <p className="text-xs text-gray-600 mt-0.5">Available in My Account</p>
                        </button>
                        <button
                            onClick={handleNext}
                            disabled={!canProgress}
                            className="flex items-center gap-2 px-5 py-2.5 bg-fpl-green hover:bg-fpl-green/90 text-slate-900 font-black text-sm rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(0,255,135,0.2)]"
                        >
                            {step === 0 ? 'Start' : step === totalSteps ? 'Reveal my DNA' : 'Next'}
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ManagerDNAQuiz;
