"use client";

import Navbar from "@/components/navbar";
import HudPanel from "@/components/HudPanel";
import DeleteAccountPopup from "@/components/deleteAccountPopup";
import ChangeAvatarPopup from "@/components/changeAvatarPopup";
import { useAuth } from "@/lib/useAuth";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { games } from "@/data/gameData";
import GameCard from "@/components/gameCard";
import ThemePicker from "@/components/ThemePicker";
import Link from "next/link";

interface ProfileStats {
  favoriteCount: number;
  gamesPlayed: number;
  achievements: number;
  points: number;
}

interface Friend {
  id: string;
  name: string;
  image?: string | null;
}

// Neon monogram avatar — picks a deterministic accent from the name.
function Avatar( { setShowAvatarForm, removeAvatar, name, image = null, size = 48 }: { setShowAvatarForm: (show: boolean) => void; removeAvatar: () => void; name: string; image?: string | null; size?: number }) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  const accents = ["var(--neon-cyan)", "var(--neon-magenta)", "var(--neon-yellow)", "var(--neon-lime)"];
  const accent = accents[name.charCodeAt(0) % accents.length];
  const thisUserId = useAuth().session?.user?.name;
  const myUser = thisUserId == name;

  if (image) {
    return (
      <div style={{ width: size, height: size }} className="relative">
        <img
          src={image}
          alt={name}
          className="object-cover flex-shrink-0 hud-clip"
          style={{
            height: size,
            fontSize: size * 0.34,
            background: accent,
            boxShadow: `0 0 14px -4px ${accent}`,
          }}
        />
        {myUser && (
          // option to remove avatar if one exists FOR MY PROFILE ONLY
          <button
            style={{
              width: size * 1.0,
              height: size * 0.25,
              fontSize: size * 0.08,
            }}
            onClick={removeAvatar}
            className="hud-clip flex items-center justify-center flex-shrink-0 font-display font-black border-2 border-[color:var(--border-strong)] mt-2 text-[10px] uppercase tracking-[0.22em] text-[color:var(--fg-muted)] hover:text-[color:var(--neon-cyan)] hover:ring-cyan transition px-3 py-1"
            >
              remove
            </button>
          )}
        </div>
      );
    }
  return (
    <div style={{ width: size, height: size }} className="relative">
      <div
        className="hud-clip flex items-center justify-center flex-shrink-0 font-display font-black text-black"
        style={{
          height: size,
          fontSize: size * 0.34,
          background: accent,
          boxShadow: `0 0 14px -4px ${accent}`,
        }}
      >
        {initials}
      </div>
      {/* only for the current user show an option to change avatar if there isnt one already */}
      {myUser && (
        <button 
        style={{
          height: size * 0.25,
          fontSize: size * 0.08,
        }}
        onClick={() => setShowAvatarForm(true)}
        className="hud-clip flex items-center justify-center flex-shrink-0 font-display font-black border-2 border-[color:var(--border-strong)] mt-2 text-[10px] uppercase tracking-[0.22em] text-[color:var(--fg-muted)] hover:text-[color:var(--neon-cyan)] hover:ring-cyan transition px-3 py-1"
        >
          add avatar 
        </button>
      )}
    </div>
  );
}

export default function Profile() {
  const router = useRouter();
  const { userId, status, authed, loading, signOut } = useAuth();

  const [profileStats, setProfileStats] = useState<ProfileStats | null>(null);
  const [userData, setUserData] = useState<{ name: string; email: string; image: string | null } | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [showNicknameForm, setShowNicknameForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newNickname, setNewNickname] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [showDeletePopup, setShowDeletePopup] = useState(false);
  const [showAvatarForm, setShowAvatarForm] = useState(false);
  

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
  }, [status, router]);

  // Single source of truth for all on-mount fetches. Profile, friends,
  // and favorites all kick off SIMULTANEOUSLY via Promise.all instead of
  // chaining — the page is interactive in one round-trip's worth of
  // wait, not three. Re-runnable so any mutation handler (avatar,
  // nickname, password) can refresh in one call.
  const loadProfile = useCallback(async () => {
    if (!userId) return;
    setLoadingProfile(true);
    setLoadingFriends(true);

    const [profileRes, friendsRes, favsRes] = await Promise.all([
      fetch(`/api/auth/profile?userID=${userId}`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch(`/api/friends/getFriends?userID=${userId}`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch(`/api/auth/favorites`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ]);

    if (profileRes) {
      setProfileStats(profileRes.stats);
      setUserData(profileRes.user);
    }
    if (friendsRes) {
      setFriends(friendsRes.friends ?? []);
    }
    if (favsRes && Array.isArray(favsRes.favorites)) {
      const mine = favsRes.favorites.find(
        (f: { userId: string }) => f.userId === userId,
      );
      setFavoriteIds(mine?.favorites ?? []);
    }
    setLoadingProfile(false);
    setLoadingFriends(false);
  }, [userId]);

  useEffect(() => {
    if (!authed || !userId) return;
    loadProfile();
  }, [authed, userId, loadProfile]);

  const handleNicknameChange = async (command: "POST" | "DELETE") => {
    try {
      const res = await fetch("/api/auth/changeNickname", {
        method: command,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newNickname }),
      });
      if (!res.ok) throw new Error();

      setShowNicknameForm(false);
      await loadProfile();
    } catch {
      alert("Unable to update nickname"); // TODO: better error handling UI
    }
  };

  const removeAvatar = async () => {
    try {
      const res = await fetch("/api/auth/changeAvatar", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        console.error("Failed to remove avatar");
        return;
      }
      await loadProfile();
    } catch {
      console.error("Network error. Please try again.");
    }
  };


  const handlePasswordChange = async () => {
    setPasswordMessage(null);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPasswordMessage(data.error || "Unable to update password");
        return;
      }
      setPasswordMessage("Password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setPasswordMessage("Unable to update password");
    }
  };

  // Sticky-section-nav active indicator. IntersectionObserver watches
  // each section's ID and highlights whichever is "in view" so the user
  // gets a sense of place as they scroll. Doesn't gate any rendering —
  // all sections are always in the DOM, this is purely visual feedback.
  const [activeSection, setActiveSection] = useState<string>("friends");
  useEffect(() => {
    const ids = ["friends", "account", "appearance", "favorites"];
    const sections = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => !!el);
    if (sections.length === 0) return;

    // rootMargin of -50%/-40% means a section becomes "active" once its
    // top crosses the upper-mid of the viewport — feels natural while
    // scrolling.
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
          );
        if (visible.length > 0) {
          setActiveSection(visible[0].target.id);
        }
      },
      { rootMargin: "-50% 0px -40% 0px" },
    );
    sections.forEach((s) => obs.observe(s));
    return () => obs.disconnect();
  }, [loadingProfile]);

  if (loading) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="flex items-center justify-center py-40">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-[color:var(--fg-muted)]">
            <span className="blink">●</span> Establishing link...
          </p>
        </div>
      </div>
    );
  }

  const userName = userData?.name || "Unknown User";
  const userEmail = userData?.email || "Unknown Email";
  const userImage = userData?.image || null;
  const favCount = profileStats?.favoriteCount ?? 0;
  const tier = favCount > 3 ? "Pro" : "Starter";

  const favoriteGames = games.filter((g) => favoriteIds.includes(g.id));

  return (
    <div className="min-h-screen text-[color:var(--fg)]">
      <Navbar />
      <main className="relative z-10 max-w-5xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-10">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--neon-cyan)]">
            ┌─ Section 01 · Operator Profile
          </p>
          <h1 className="font-display font-black text-4xl sm:text-5xl mt-3 tracking-tight text-[color:var(--fg)]">
            <span className="text-[color:var(--neon-magenta)] dark:glow-magenta">//</span>{" "}
            {userName.toUpperCase()}
          </h1>
        </div>

        {/* Identity card */}
        <HudPanel innerClassName="p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center gap-6">
            <Avatar setShowAvatarForm={setShowAvatarForm} removeAvatar={removeAvatar} name={userName} image={userImage} size={88} />
            <div className="flex-1 min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--fg-muted)]">
                &gt; Handle
              </p>
              <h2 className="font-display font-bold text-2xl sm:text-3xl text-[color:var(--fg)] mt-1 truncate">
                {userName}
              </h2>
              <p className="text-sm text-[color:var(--fg-muted)] mt-1 truncate">{userEmail}</p>
              {userId && (
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[color:var(--fg-muted)] mt-3">
                  id&nbsp;::&nbsp;
                  <span className="text-[color:var(--neon-cyan)] dark:glow-cyan normal-case tracking-normal">
                    {userId}
                  </span>
                </p>
              )}
            </div>
            <div className="hud-chip self-start sm:self-center">
              <span className="text-[color:var(--neon-cyan)]">●</span> Tier · {tier}
            </div>
          </div>

          {/* Stat rail */}
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-6 border-t border-[color:var(--border)]">
            {[
              { label: "Games Played", value: profileStats?.gamesPlayed, accent: "cyan" },
              { label: "Achievements", value: profileStats?.achievements, accent: "magenta" },
              { label: "Points", value: profileStats?.points, accent: "yellow" },
              { label: "Favorites", value: profileStats?.favoriteCount, accent: "lime" },
            ].map((stat) => (
              <div key={stat.label} className="border-l-2 border-[color:var(--border-strong)] pl-3">
                <dt className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--fg-muted)]">
                  {stat.label}
                </dt>
                <dd
                  className={`font-display font-bold text-2xl mt-1 text-${stat.accent} dark:glow-${stat.accent}`}
                >
                  {loadingProfile ? "—" : (stat.value ?? "—")}
                </dd>
              </div>
            ))}
          </dl>
        </HudPanel>


        { showAvatarForm && (
          <ChangeAvatarPopup
            onClose={() => setShowAvatarForm(false)}
            onUpdated={loadProfile}
          />
        )}

        {/* Sticky section nav — sticks to the top of the viewport once
            the user scrolls past the identity card. Active section is
            highlighted via the IntersectionObserver effect above. New
            sections drop in here + as a <section id="..."> below — no
            extra fetches, no conditional rendering. */}
        <nav
          aria-label="Profile sections"
          className="sticky top-0 z-20 mt-10 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-2 bg-[color:var(--bg)]/85 backdrop-blur-xl border-y border-[color:var(--border)]"
        >
          <ul className="flex gap-1 overflow-x-auto -mx-1 px-1 [scrollbar-width:none]">
            {[
              { id: "friends", label: "Friends" },
              { id: "account", label: "Account" },
              { id: "appearance", label: "Theme" },
              { id: "favorites", label: "Favorites" },
            ].map((item) => {
              const active = activeSection === item.id;
              return (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    className={`relative block whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.22em] px-3 py-2 transition ${
                      active
                        ? "text-[color:var(--neon-cyan)]"
                        : "text-[color:var(--fg-muted)] hover:text-[color:var(--fg)]"
                    }`}
                  >
                    {item.label}
                    {active && (
                      <span
                        aria-hidden
                        className="absolute left-2 right-2 -bottom-px h-0.5 bg-[color:var(--neon-cyan)]"
                      />
                    )}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Friends */}
        <section id="friends" className="mt-10 scroll-mt-20">
          <div className="flex items-end justify-between pb-4 border-b border-[color:var(--border)]">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--neon-cyan)]">
                ┌─ Network · Allies
              </p>
              <h3 className="font-display font-bold text-2xl mt-2 text-[color:var(--fg)]">
                Friends
              </h3>
            </div>
            {!loadingFriends && friends.length > 0 && (
              <span className="hud-chip">{friends.length} linked</span>
            )}
          </div>

          <div className="mt-6">
            {loadingFriends ? (
              <div className="flex gap-5 overflow-x-auto pb-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex flex-col items-center gap-2 flex-shrink-0 animate-pulse">
                    <div className="w-14 h-14 hud-clip bg-[color:var(--surface-2)]" />
                    <div className="h-2 w-12 bg-[color:var(--surface-2)]" />
                  </div>
                ))}
              </div>
            ) : friends.length === 0 ? (
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-[color:var(--fg-muted)]">
                &gt; No allies linked.{" "}
                <Link href="/messages" className="text-[color:var(--neon-cyan)] dark:glow-cyan hover:underline">
                  Find some in Messages
                </Link>
              </p>
            ) : (
              <div className="flex gap-5 overflow-x-auto pb-2">
                {friends.map((friend) => (
                  <Link
                    key={friend.id}
                    href={`/profile/${friend.id}`}
                    className="flex flex-col items-center gap-2 flex-shrink-0 group"
                  >
                    <Avatar setShowAvatarForm={setShowAvatarForm} removeAvatar={removeAvatar} name={friend.name} image={friend.image} size={60} />
                    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--fg-muted)] group-hover:text-[color:var(--neon-cyan)] transition-colors max-w-[72px] truncate text-center">
                      {friend.name}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Account */}
        <section id="account" className="mt-12 scroll-mt-20">
          <div className="flex items-end justify-between pb-4 border-b border-[color:var(--border)]">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--neon-cyan)]">
                ┌─ Account · Controls
              </p>
              <h3 className="font-display font-bold text-2xl mt-2 text-[color:var(--fg)]">
                Settings
              </h3>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {/* change password option */}
            <button
              onClick={() => setShowPasswordForm((v) => !v)}
              className="font-mono text-xs uppercase tracking-[0.2em] px-4 py-3 border border-[color:var(--border-strong)] text-[color:var(--fg)] hover:ring-cyan transition"
            >
              {showPasswordForm ? "Close · Password Form" : "Change Password"}
            </button>
            {/* change nickname option */}
            <button
              onClick={() => setShowNicknameForm((v) => !v)}
              className="font-mono text-xs uppercase tracking-[0.2em] px-4 py-3 border border-[color:var(--border-strong)] text-[color:var(--fg)] hover:ring-cyan transition"
            >
              {showNicknameForm ? "Close · Nickname Form" : "Change Nickname"}
            </button>
            {/* sign out option */}
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="font-mono text-xs uppercase tracking-[0.2em] px-4 py-3 border border-[color:var(--neon-magenta)] text-[color:var(--neon-magenta)] hover:ring-magenta transition"
            >
              Disconnect · Sign Out
            </button>
            {/* delete account option */}
            <button
              onClick={() => setShowDeletePopup(true)}
              className="font-mono text-xs uppercase tracking-[0.2em] px-4 py-3 border border-[color:var(--neon-magenta)] text-[color:var(--neon-magenta)] hover:ring-magenta transition"
            >
              Delete Account
            </button>
          </div>

          {showDeletePopup && (
            <DeleteAccountPopup onClose={() => setShowDeletePopup(false)} />
          )}

          {showNicknameForm && (
            <HudPanel className="mt-6" innerClassName="p-6 space-y-4">
              {[
                { label: "New Nickname", value: newNickname, set: setNewNickname },
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
                onClick={() => handleNicknameChange("POST")}
                className="w-full font-mono text-xs uppercase tracking-[0.2em] px-4 py-3 bg-[color:var(--neon-cyan)] text-black hover:ring-cyan transition"
              >
                Change Nickname →
              </button>
              <button
                onClick={() => handleNicknameChange("DELETE")}
                className="w-full font-mono text-xs uppercase tracking-[0.2em] px-4 py-3  border border-[color:var(--neon-magenta)] text-[color:var(--neon-magenta)] hover:ring-magenta transition "
              >
                Remove Nickname →
              </button>
            </HudPanel>
          )}

          {showPasswordForm && (
            <HudPanel className="mt-6" innerClassName="p-6 space-y-4">
              {[
                { label: "Current Password", value: currentPassword, set: setCurrentPassword },
                { label: "New Password", value: newPassword, set: setNewPassword },
                { label: "Confirm Password", value: confirmPassword, set: setConfirmPassword },
              ].map(({ label, value, set }) => (
                <div key={label}>
                  <label className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--fg-muted)]">
                    {label}
                  </label>
                  <input
                    type="password"
                    value={value}
                    onChange={(e) => set(e.target.value)}
                    className="mt-2 w-full bg-[color:var(--surface-2)] border border-[color:var(--border-strong)] px-4 py-3 text-sm text-[color:var(--fg)] outline-none focus:border-[color:var(--neon-cyan)] transition"
                  />
                </div>
              ))}
              <button
                onClick={handlePasswordChange}
                className="w-full font-mono text-xs uppercase tracking-[0.2em] px-4 py-3 bg-[color:var(--neon-cyan)] text-black hover:ring-cyan transition"
              >
                Commit New Key →
              </button>
              {passwordMessage && (
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[color:var(--fg-muted)]">
                  &gt; {passwordMessage}
                </p>
              )}
            </HudPanel>
          )}

        </section>

        {/* Appearance — full theme picker. The user picks one of the
            four themes (cyberpunk, solarpunk, minimal, city) and a
            light/dark mode; both persist in localStorage and are
            applied to <html> by the boot script in layout.tsx. */}
        <section id="appearance" className="mt-12 scroll-mt-20">
          <div className="flex items-end justify-between pb-4 border-b border-[color:var(--border)]">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--neon-cyan)]">
                ┌─ System · Appearance
              </p>
              <h3 className="font-display font-bold text-2xl mt-2 text-[color:var(--fg)]">
                Theme
              </h3>
            </div>
            <span className="hud-chip">visual</span>
          </div>
          <p className="mt-4 max-w-2xl text-sm text-[color:var(--fg-muted)] leading-relaxed">
            Pick a visual style for the whole app. Each theme rewires
            colors, shapes, glow, decoration, and animation — components
            stay the same so your data and layouts don&apos;t move, but
            the entire UI changes character.
          </p>
          <div className="mt-6">
            <ThemePicker mode="inline" />
          </div>
        </section>

        {/* Favorites */}
        <section id="favorites" className="mt-12 scroll-mt-20">
          <div className="flex items-end justify-between pb-4 border-b border-[color:var(--border)]">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--neon-cyan)]">
                ┌─ Cache · Favorites
              </p>
              <h3 className="font-display font-bold text-2xl mt-2 text-[color:var(--fg)]">
                Saved Cabinets
              </h3>
            </div>
            <span className="hud-chip">{favoriteGames.length} saved</span>
          </div>

          {favoriteGames.length === 0 ? (
            <p className="mt-6 font-mono text-xs uppercase tracking-[0.2em] text-[color:var(--fg-muted)]">
              &gt; Cache empty. Mark cabinets with ☆ from the library.
            </p>
          ) : (
            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              {favoriteGames.map((game) => (
                <GameCard
                  key={game.id}
                  id={game.id}
                  title={game.title}
                  description={game.description}
                  creator={game.creator}
                  theme={game.theme}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
