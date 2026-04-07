import React, { useState, useRef } from 'react';
import { Mail, Send, Paperclip, X, CheckCircle, AlertTriangle } from 'lucide-react';

const ContactView: React.FC = () => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [attachment, setAttachment] = useState<File | null>(null);
    const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
    const [errorMsg, setErrorMsg] = useState('');
    const fileRef = useRef<HTMLInputElement>(null);

    const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            setErrorMsg('Image must be under 5MB.');
            return;
        }
        setAttachment(file);
        setErrorMsg('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !email || !subject || !message) return;

        setStatus('sending');
        setErrorMsg('');

        try {
            const formData = new FormData();
            formData.append('name', name);
            formData.append('email', email);
            formData.append('subject', subject);
            formData.append('message', message);
            if (attachment) formData.append('attachment', attachment);

            const res = await fetch('/api/contact', { method: 'POST', body: formData });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'Failed to send message.');
            }
            setStatus('success');
            setName(''); setEmail(''); setSubject(''); setMessage(''); setAttachment(null);
        } catch (err: any) {
            setErrorMsg(err.message || 'Something went wrong.');
            setStatus('error');
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 pt-4 pb-16 px-4 relative overflow-hidden">
            <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-fpl-green/8 rounded-full blur-[140px] pointer-events-none" />
            <div className="absolute bottom-1/3 right-1/4 w-[400px] h-[400px] bg-[#e90052]/6 rounded-full blur-[140px] pointer-events-none" />

            <div className="max-w-2xl mx-auto relative z-10">

                {/* Hero */}
                <div className="text-center mb-12 space-y-5">
                    <div className="flex items-center justify-center">
                        <div className="w-14 h-14 bg-fpl-green/10 border border-fpl-green/30 rounded-2xl flex items-center justify-center">
                            <Mail className="text-fpl-green w-7 h-7" />
                        </div>
                    </div>
                    <p className="text-fpl-green text-sm font-black uppercase tracking-[0.25em]">Get In Touch</p>
                    <h1 className="text-5xl md:text-6xl font-black text-white tracking-tight">
                        Contact <span className="text-transparent bg-clip-text bg-gradient-to-r from-fpl-green to-[#02efff]">Us</span>
                    </h1>
                    <p className="text-gray-400 text-base max-w-md mx-auto leading-relaxed">
                        Questions, feedback, or something broken? Drop us a message and we'll get back to you.
                    </p>
                </div>

                {/* Form */}
                {status === 'success' ? (
                    <div className="bg-fpl-green/10 border border-fpl-green/30 rounded-3xl p-10 text-center space-y-4">
                        <CheckCircle className="text-fpl-green w-12 h-12 mx-auto" />
                        <h3 className="text-white font-black text-xl">Message sent</h3>
                        <p className="text-gray-400 text-sm">We'll get back to you as soon as possible.</p>
                        <button
                            onClick={() => setStatus('idle')}
                            className="mt-2 text-fpl-green text-sm font-bold hover:underline"
                        >
                            Send another message
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="bg-slate-900/50 border border-white/10 rounded-3xl p-8 space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Name</label>
                                <input
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    required
                                    placeholder="Your name"
                                    className="w-full bg-slate-800/60 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 outline-none focus:border-fpl-green/40 transition-colors"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Email</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    required
                                    placeholder="your@email.com"
                                    className="w-full bg-slate-800/60 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 outline-none focus:border-fpl-green/40 transition-colors"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Subject</label>
                            <input
                                value={subject}
                                onChange={e => setSubject(e.target.value)}
                                required
                                placeholder="What's this about?"
                                className="w-full bg-slate-800/60 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 outline-none focus:border-fpl-green/40 transition-colors"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Message</label>
                            <textarea
                                value={message}
                                onChange={e => setMessage(e.target.value)}
                                required
                                rows={6}
                                placeholder="Tell us what's on your mind..."
                                className="w-full bg-slate-800/60 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 outline-none focus:border-fpl-green/40 transition-colors resize-none"
                            />
                        </div>

                        {/* Attachment */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Attachment <span className="text-gray-600 normal-case font-normal">(optional, max 5MB)</span></label>
                            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
                            {attachment ? (
                                <div className="flex items-center gap-3 bg-slate-800/60 border border-fpl-green/30 rounded-xl px-4 py-3">
                                    <Paperclip size={14} className="text-fpl-green shrink-0" />
                                    <span className="text-white text-sm flex-1 truncate">{attachment.name}</span>
                                    <button type="button" onClick={() => { setAttachment(null); if (fileRef.current) fileRef.current.value = ''; }}>
                                        <X size={14} className="text-gray-500 hover:text-white" />
                                    </button>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => fileRef.current?.click()}
                                    className="flex items-center gap-2 bg-slate-800/60 border border-white/10 hover:border-white/20 rounded-xl px-4 py-3 text-gray-500 hover:text-gray-300 text-sm transition-colors"
                                >
                                    <Paperclip size={14} />
                                    Attach an image
                                </button>
                            )}
                        </div>

                        {errorMsg && (
                            <div className="flex items-center gap-2 text-red-400 text-sm">
                                <AlertTriangle size={14} />
                                {errorMsg}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={status === 'sending'}
                            className="w-full py-3.5 bg-fpl-green text-slate-900 font-black text-sm uppercase tracking-widest rounded-xl hover:bg-fpl-green/90 transition-all shadow-[0_0_20px_rgba(0,255,135,0.25)] disabled:opacity-60 disabled:pointer-events-none flex items-center justify-center gap-2"
                        >
                            {status === 'sending' ? 'Sending...' : <><Send size={15} /> Send Message</>}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

export default ContactView;
