"use client";

// Contact / feedback form. Two columns on desktop:
//   Left  — explainer + alternative ways to reach (links, response time)
//   Right — the form itself: topic selector + email + subject + message

import Navbar from "@/components/navbar";
import { useState } from "react";

type Topic = "general" | "bug" | "feature" | "feedback";

const TOPICS: { key: Topic; label: string; hint: string }[] = [
  { key: "general", label: "General", hint: "Hello, hi, anything else." },
  { key: "bug", label: "Bug Report", hint: "Something broken? Tell us what + where." },
  { key: "feature", label: "Feature Request", hint: "What should we build next?" },
  { key: "feedback", label: "Feedback", hint: "Likes, dislikes, vibes." },
];

export default function ContactUs() {
  const [topic, setTopic] = useState<Topic>("general");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !subject.trim() || !message.trim()) {
      setError("All fields required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/feedback", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          subject: `[${topic}] ${subject}`,
          message,
        }),
      });
      if (!res.ok) {
        const raw = await res.text();
        let msg = raw;
        try {
          msg = JSON.parse(raw)?.error ?? raw;
        } catch {}
        setError(`Submission failed: ${msg.slice(0, 200)}`);
        return;
      }
      setSubmitted(true);
      setSubject("");
      setMessage("");
    } catch (err) {
      setError(`Network error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen text-[color:var(--fg)]">
      <Navbar />
      <main className="relative z-10 max-w-5xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        {/* Header */}
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--neon-cyan)]">
            ┌─ Open Channel · /sys/contact
          </p>
          <h1 className="font-display font-black text-4xl sm:text-5xl lg:text-6xl mt-3 tracking-tight">
            <span className="text-[color:var(--fg)]">CONTACT</span>
            <span className="text-[color:var(--neon-magenta)] dark:glow-magenta">_</span>
          </h1>
          <p className="text-sm sm:text-base text-[color:var(--fg-muted)] mt-3 max-w-xl leading-relaxed">
            Bug, feature idea, or just want to say hi? Pick a topic on the
            right, drop us a line, and we&apos;ll respond as soon as we
            can. Real humans, no auto-responders.
          </p>
        </div>

        {/* Two-column body */}
        <div className="mt-10 grid gap-10 md:grid-cols-[1fr_1.4fr]">
          {/* ============== LEFT: ALTERNATIVE CHANNELS ============== */}
          <aside className="space-y-8">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--neon-cyan)] pb-2 border-b border-[color:var(--border)]">
                &gt; Response Time
              </p>
              <p className="mt-3 text-sm text-[color:var(--fg-muted)] leading-relaxed">
                Typical reply within{" "}
                <span className="text-[color:var(--neon-cyan)]">24 hours</span>{" "}
                on weekdays. Bug reports get a faster look — drop a video or
                gif if you can.
              </p>
            </div>

            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--neon-cyan)] pb-2 border-b border-[color:var(--border)]">
                &gt; Other Ways to Reach
              </p>
              <ul className="mt-3 space-y-3">
                <ContactMethod
                  label="Email"
                  value="malikatmiraaj@gmail.com"
                  href="mailto:malikatmiraaj@gmail.com"
                />
                <ContactMethod
                  label="GitHub issues"
                  value="bug reports + feature requests"
                  href="https://github.com/sammalik111/MiraajGames/issues"
                  external
                />
              </ul>
            </div>

            <div className="border border-dashed border-[color:var(--border)] p-4">
              <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-[color:var(--fg-muted)]">
                ⓘ Heads up
              </p>
              <p className="mt-2 text-sm text-[color:var(--fg-muted)] leading-relaxed">
                Submissions are stored in our feedback table for the admin
                team to triage. We don&apos;t share emails or post your
                message anywhere external.
              </p>
            </div>
          </aside>

          {/* ============== RIGHT: FORM ============== */}
          <section>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--neon-cyan)] pb-2 border-b border-[color:var(--border)]">
              &gt; New Message
            </p>

            {submitted ? (
              <div className="mt-6 border border-[color:var(--neon-lime)] bg-[color:var(--neon-lime)]/8 p-6">
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--neon-lime)]">
                  ✓ Sent
                </p>
                <h2 className="font-display font-bold text-2xl mt-2">
                  Thanks for the signal.
                </h2>
                <p className="mt-2 text-sm text-[color:var(--fg-muted)] leading-relaxed">
                  Your message landed. Expect a reply at{" "}
                  <span className="text-[color:var(--fg)]">{email || "your inbox"}</span>{" "}
                  within a day or so.
                </p>
                <button
                  onClick={() => {
                    setSubmitted(false);
                    setEmail("");
                  }}
                  className="mt-5 font-mono text-xs uppercase tracking-[0.22em] px-4 py-2 border border-[color:var(--border-strong)] hover:border-[color:var(--neon-cyan)] transition"
                >
                  Send another →
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-6 space-y-5">
                {/* Topic selector — chips */}
                <div>
                  <label className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--fg-muted)]">
                    Topic
                  </label>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {TOPICS.map((t) => {
                      const active = topic === t.key;
                      return (
                        <button
                          key={t.key}
                          type="button"
                          onClick={() => setTopic(t.key)}
                          className={`text-left p-3 border transition ${
                            active
                              ? "border-[color:var(--neon-cyan)] bg-[color:var(--neon-cyan)]/8"
                              : "border-[color:var(--border)] hover:border-[color:var(--neon-cyan)]"
                          }`}
                        >
                          <p
                            className={`font-mono text-[11px] uppercase tracking-[0.22em] ${
                              active
                                ? "text-[color:var(--neon-cyan)]"
                                : "text-[color:var(--fg)]"
                            }`}
                          >
                            {t.label}
                          </p>
                          <p className="font-mono text-[9px] text-[color:var(--fg-muted)] mt-1 leading-relaxed">
                            {t.hint}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--fg-muted)]">
                    Reply Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@domain.tld"
                    required
                    className="mt-2 w-full bg-[color:var(--surface-2)] border border-[color:var(--border-strong)] px-4 py-3 text-sm text-[color:var(--fg)] outline-none focus:border-[color:var(--neon-cyan)] transition"
                  />
                </div>

                {/* Subject */}
                <div>
                  <label className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--fg-muted)]">
                    Subject
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="One-line summary"
                    required
                    className="mt-2 w-full bg-[color:var(--surface-2)] border border-[color:var(--border-strong)] px-4 py-3 text-sm text-[color:var(--fg)] outline-none focus:border-[color:var(--neon-cyan)] transition"
                  />
                </div>

                {/* Message */}
                <div>
                  <label className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--fg-muted)]">
                    Message
                    <span className="ml-2 text-[color:var(--fg-muted)] normal-case tracking-normal">
                      ({message.length} / 2000)
                    </span>
                  </label>
                  <textarea
                    rows={6}
                    maxLength={2000}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Be specific. Steps to reproduce help a lot for bug reports."
                    required
                    className="mt-2 w-full resize-none bg-[color:var(--surface-2)] border border-[color:var(--border-strong)] px-4 py-3 text-sm text-[color:var(--fg)] outline-none focus:border-[color:var(--neon-cyan)] transition leading-relaxed"
                  />
                </div>

                {error && (
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--neon-magenta)]">
                    ✕ {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full font-mono text-xs uppercase tracking-[0.22em] px-4 py-3 bg-[color:var(--neon-cyan)] text-black hover:ring-cyan transition disabled:opacity-50"
                >
                  {submitting ? "Sending…" : "Send Message →"}
                </button>
              </form>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

function ContactMethod({
  label,
  value,
  href,
  external,
}: {
  label: string;
  value: string;
  href: string;
  external?: boolean;
}) {
  return (
    <li>
      <a
        href={href}
        target={external ? "_blank" : undefined}
        rel={external ? "noopener noreferrer" : undefined}
        className="block group"
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--fg-muted)] group-hover:text-[color:var(--neon-cyan)] transition">
          {label} {external && <span>↗</span>}
        </p>
        <p className="text-sm text-[color:var(--fg)] group-hover:text-[color:var(--neon-cyan)] transition mt-0.5 normal-case tracking-normal">
          {value}
        </p>
      </a>
    </li>
  );
}
