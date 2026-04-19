import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@workspace/replit-auth-web";
import { motion } from "framer-motion";
import { User, Phone, FileText, Camera, Save, CheckCircle, Link as LinkIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const fadeUp = { hidden: { opacity: 0, y: 16 }, show: (i: number) => ({ opacity: 1, y: 0, transition: { duration: 0.4, delay: i * 0.07 } }) };

export default function Profile() {
  const { user, isAuthenticated, login } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [bio, setBio] = useState("");
  const [phone, setPhone] = useState("");
  const [publicResume, setPublicResume] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [tab, setTab] = useState<"info" | "resume" | "photo">("info");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetch(`${BASE}/api/profile/me`, { credentials: "include" })
      .then(r => r.json())
      .then(p => {
        setProfile(p);
        setFirstName(p.firstName || "");
        setLastName(p.lastName || "");
        setBio(p.bio || "");
        setPhone(p.phone || "");
        setPublicResume(p.publicResume || "");
      })
      .catch(() => {});
  }, [isAuthenticated]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const r = await fetch(`${BASE}/api/profile/me`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, bio, phone, publicResume }),
      });
      if (!r.ok) throw new Error("Save failed");
      const updated = await r.json();
      setProfile(updated);
      toast.success("Profile updated successfully");
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    }
    setIsSaving(false);
  };

  const handlePhotoUpload = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) { toast.error("File too large — max 5MB"); return; }
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      try {
        const r = await fetch(`${BASE}/api/profile/me`, {
          method: "PATCH", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customProfileImage: base64 }),
        });
        const updated = await r.json();
        setProfile(updated);
        toast.success("Profile photo updated");
      } catch { toast.error("Failed to update photo"); }
    };
    reader.readAsDataURL(file);
  };

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col h-[60vh] items-center justify-center gap-5">
        <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <User className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-2xl font-display font-bold">Sign in to view your profile</h2>
        <button onClick={login} className="px-6 py-3 rounded-xl font-semibold btn-gradient">Sign In</button>
      </div>
    );
  }

  const profilePic = profile?.customProfileImage || profile?.profileImageUrl;
  const displayName = `${firstName} ${lastName}`.trim() || user?.firstName || "User";

  return (
    <div className="container mx-auto px-4 py-10 max-w-3xl">
      <motion.div initial="hidden" animate="show" variants={fadeUp} custom={0} className="flex items-center gap-5 mb-8">
        <div className="relative">
          <div className="h-20 w-20 rounded-2xl border border-border overflow-hidden bg-secondary flex items-center justify-center text-3xl font-display font-bold text-primary">
            {profilePic ? <img src={profilePic} alt="Profile" className="h-full w-full object-cover" /> : displayName[0]?.toUpperCase()}
          </div>
          <button onClick={() => fileRef.current?.click()}
            className="absolute -bottom-1.5 -right-1.5 h-7 w-7 rounded-full bg-primary flex items-center justify-center hover:bg-primary/90 transition-colors shadow-lg"
          >
            <Camera className="h-3.5 w-3.5 text-white" />
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f); }} />
        </div>
        <div>
          <h1 className="text-2xl font-display font-bold">{displayName}</h1>
          <p className="text-muted-foreground text-sm">{user?.email}</p>
          {profile?.publicResume && (
            <div className="flex items-center gap-1 mt-1 text-xs text-primary">
              <LinkIcon className="h-3 w-3" />Public profile active
            </div>
          )}
        </div>
      </motion.div>

      <motion.div initial="hidden" animate="show" variants={fadeUp} custom={1} className="flex gap-1 p-1 rounded-xl bg-secondary/50 border border-border w-fit mb-6">
        {(["info", "resume", "photo"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${tab === t ? "bg-background border border-border shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            {t === "info" ? "Personal Info" : t === "resume" ? "Public Resume" : "Photo"}
          </button>
        ))}
      </motion.div>

      <motion.div initial="hidden" animate="show" variants={fadeUp} custom={2} className="glass-panel rounded-2xl p-6">
        {tab === "info" && (
          <div className="grid gap-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">First Name</label>
                <input value={firstName} onChange={e => setFirstName(e.target.value)}
                  className="w-full rounded-xl bg-secondary/50 border border-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Last Name</label>
                <input value={lastName} onChange={e => setLastName(e.target.value)}
                  className="w-full rounded-xl bg-secondary/50 border border-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Bio</label>
              <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3}
                placeholder="Tell employers a bit about yourself..."
                className="w-full rounded-xl bg-secondary/50 border border-border px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 flex items-center gap-2"><Phone className="h-4 w-4" />Mobile Number</label>
              <div className="flex gap-2">
                <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 (555) 000-0000"
                  className="flex-1 rounded-xl bg-secondary/50 border border-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                {profile?.isPhoneVerified === "true" ? (
                  <div className="flex items-center gap-1 text-emerald-500 text-sm px-3"><CheckCircle className="h-4 w-4" />Verified</div>
                ) : (
                  <button onClick={() => toast.info("Verification SMS sent")} className="px-4 py-2.5 rounded-xl text-sm font-medium border border-border bg-secondary/50 hover:bg-secondary transition-colors">
                    Verify
                  </button>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Email</label>
              <input value={user?.email || ""} disabled
                className="w-full rounded-xl bg-secondary/30 border border-border px-4 py-2.5 text-sm opacity-60 cursor-not-allowed" />
              <p className="text-xs text-muted-foreground mt-1">Email is managed by your account provider.</p>
            </div>
          </div>
        )}

        {tab === "resume" && (
          <div className="grid gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 flex items-center gap-2"><FileText className="h-4 w-4" />Public Resume</label>
              <p className="text-xs text-muted-foreground mb-3">This resume is visible to employers who view your profile via your scheduled interview results.</p>
              <textarea value={publicResume} onChange={e => setPublicResume(e.target.value)} rows={14}
                placeholder="Paste your resume text to make it publicly visible to employers..."
                className="w-full rounded-xl bg-secondary/50 border border-border px-4 py-3 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
          </div>
        )}

        {tab === "photo" && (
          <div className="flex flex-col items-center gap-6 py-6">
            <div className="h-32 w-32 rounded-2xl border border-border overflow-hidden bg-secondary flex items-center justify-center text-5xl font-display font-bold text-primary">
              {profilePic ? <img src={profilePic} alt="Profile" className="h-full w-full object-cover" /> : displayName[0]?.toUpperCase()}
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-3">Upload a profile picture (max 5MB)</p>
              <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium border border-border bg-secondary/50 hover:bg-secondary transition-colors text-sm">
                <Camera className="h-4 w-4" />Choose Photo
              </button>
            </div>
            {profile?.profileImageUrl && !profile?.customProfileImage && (
              <p className="text-xs text-muted-foreground">Currently using your account profile picture</p>
            )}
          </div>
        )}

        <div className="pt-5 mt-5 border-t border-border flex justify-end">
          <button onClick={handleSave} disabled={isSaving}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold btn-gradient disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSaving ? <><Loader2 className="h-4 w-4 animate-spin" />Saving...</> : <><Save className="h-4 w-4" />Save Changes</>}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
