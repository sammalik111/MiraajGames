"use client";

import Navbar from "@/components/navbar";
import HudPanel  from "@/components/HudPanel";
import { useState } from "react";


export default function ContactUs() {
    const [currentEmail, setCurrentEmail] = useState("");
    const [currentSubject, setCurrentSubject] = useState("");
    const [currentMessage, setCurrentMessage] = useState("");


    const handleSubmit =  async() => {
        // return alert(`Email: ${currentEmail}\nSubject: ${currSubject}\nMessage: ${currentMessage}\n\nThis is a demo form, so the message won't actually be sent anywhere, but we appreciate you taking the time to fill it out!`)
        try {
            const res = await fetch("/api/admin/feedback", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: currentEmail, subject: currentSubject, message: currentMessage }),
            });
            if (!res.ok) throw new Error();
            alert("Thanks! submitted feedback");
            
        } catch {
            alert("Unable to submit feedback"); // TODO: better error handling UI
        } 
    };

    return (
        <div className="min-h-screen text-[color:var(--fg)]">
        <Navbar />

        <main className="relative z-10 max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
            <section className="grid gap-10 md:grid-cols-[1.3fr_1fr] items-center">
                <div className="space-y-7">
                    <div className="space-y-4">
                        <h1 className="font-display font-black text-5xl sm:text-6xl lg:text-7xl leading-[0.95] tracking-tight">
                            Contact Us
                        </h1>
                        <p className="max-w-xl text-lg leading-8 text-[color:var(--fg-muted)]">
                            For inquiries, support, or feature requests, please reach out to us, we love all feedback!
                        </p>
                        <br />
                        <HudPanel className="mt-6" innerClassName="p-6 space-y-4">
                            {[
                            { label: "Email", value: currentEmail, set: setCurrentEmail },
                            { label: "Subject", value: currentSubject, set: setCurrentSubject },
                            { label: "Message", value: currentMessage, set: setCurrentMessage },
                            ].map(({ label, value, set }) => (
                            <div key={label}>
                                <label className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--fg-muted)]">
                                {label}
                                </label>
                                <input
                                type="text"
                                value={value}
                                onChange={(e) => set(e.target.value)}
                                className="mt-2 w-full bg-[color:var(--surface-2)] border border-[color:var(--border-strong)] px-4 py-3 text-sm text-[color:var(--fg)] outline-none focus:border-[color:var(--neon-cyan)] transition"
                                />
                            </div>
                            ))}
                            <button
                            onClick={handleSubmit}
                            className="w-full font-mono text-xs uppercase tracking-[0.2em] px-4 py-3 bg-[color:var(--neon-cyan)] text-black hover:ring-cyan transition"
                            >
                            Submit Request
                            </button>
                        </HudPanel>
                    </div>
                </div>
            </section>
        </main>
        </div>
    );
}
