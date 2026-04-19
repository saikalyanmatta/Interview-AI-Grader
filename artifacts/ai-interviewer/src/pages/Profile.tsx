import { useState, useEffect, useRef } from "react";
import { useAuth } from "@workspace/replit-auth-web";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { User, Phone, FileText, Camera, Save, CheckCircle, Link as LinkIcon } from "lucide-react";
import { motion } from "framer-motion";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function fetchProfile() {
  const r = await fetch(`${BASE}/api/profile/me`, { credentials: "include" });
  if (!r.ok) throw new Error("Failed to fetch profile");
  return r.json();
}

async function updateProfile(data: Record<string, any>) {
  const r = await fetch(`${BASE}/api/profile/me`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error("Failed to update profile");
  return r.json();
}

export default function Profile() {
  const { user, isAuthenticated, login } = useAuth();
  const { toast } = useToast();
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
    fetchProfile().then((p) => {
      setProfile(p);
      setFirstName(p.firstName || "");
      setLastName(p.lastName || "");
      setBio(p.bio || "");
      setPhone(p.phone || "");
      setPublicResume(p.publicResume || "");
    }).catch(() => {});
  }, [isAuthenticated]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updated = await updateProfile({ firstName, lastName, bio, phone, publicResume });
      setProfile(updated);
      toast({ title: "Profile updated" });
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePhotoUpload = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 5MB", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      try {
        const updated = await updateProfile({ customProfileImage: base64 });
        setProfile(updated);
        toast({ title: "Photo updated" });
      } catch {
        toast({ title: "Failed to update photo", variant: "destructive" });
      }
    };
    reader.readAsDataURL(file);
  };

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col h-[60vh] items-center justify-center gap-4">
        <h2 className="text-2xl font-bold">Sign in to view profile</h2>
        <Button onClick={login} variant="gradient">Sign In</Button>
      </div>
    );
  }

  const profilePic = profile?.customProfileImage || profile?.profileImageUrl;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <div className="relative">
          <div className="h-20 w-20 rounded-full border-2 border-white/20 overflow-hidden bg-secondary flex items-center justify-center text-3xl">
            {profilePic ? (
              <img src={profilePic} alt="Profile" className="h-full w-full object-cover" />
            ) : (
              <span>{firstName?.[0] || user?.firstName?.[0] || "U"}</span>
            )}
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            className="absolute bottom-0 right-0 h-7 w-7 rounded-full bg-primary flex items-center justify-center hover:bg-primary/80 transition-colors"
          >
            <Camera className="h-3.5 w-3.5 text-white" />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handlePhotoUpload(f);
            }}
          />
        </div>
        <div>
          <h1 className="text-2xl font-display font-bold">{firstName} {lastName}</h1>
          <p className="text-muted-foreground text-sm">{user?.email}</p>
          {profile?.publicResume && (
            <div className="flex items-center gap-1 mt-1 text-xs text-primary">
              <LinkIcon className="h-3 w-3" />
              <span>Public profile active</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
        {(["info", "resume", "photo"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${tab === t ? "bg-white/10 text-white" : "text-muted-foreground hover:text-white"}`}
          >
            {t === "info" ? "Personal Info" : t === "resume" ? "Public Resume" : "Photo"}
          </button>
        ))}
      </div>

      <Card className="glass-panel border-white/10">
        <CardContent className="p-6 space-y-5">
          {tab === "info" && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">First Name</label>
                  <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="bg-black/20 border-white/10" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Last Name</label>
                  <Input value={lastName} onChange={(e) => setLastName(e.target.value)} className="bg-black/20 border-white/10" />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Bio</label>
                <Textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell employers a bit about yourself..."
                  className="bg-black/20 border-white/10 min-h-[100px]"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                  <Phone className="h-4 w-4" /> Mobile Number
                </label>
                <div className="flex gap-2">
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    className="bg-black/20 border-white/10 flex-1"
                  />
                  {profile?.isPhoneVerified === "true" ? (
                    <div className="flex items-center gap-1 text-emerald-400 text-sm px-3">
                      <CheckCircle className="h-4 w-4" /> Verified
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      className="border-white/10 shrink-0"
                      onClick={() => toast({ title: "Verification SMS sent", description: "Check your phone for a verification code." })}
                    >
                      Verify
                    </Button>
                  )}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Email</label>
                <Input value={user?.email || ""} disabled className="bg-black/10 border-white/10 opacity-60" />
                <p className="text-xs text-muted-foreground mt-1">Email is managed by your Google account.</p>
              </div>
            </>
          )}

          {tab === "resume" && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Public Resume
                </label>
                <p className="text-xs text-muted-foreground mb-3">
                  This resume is visible to employers who view your profile. It helps them understand your background.
                </p>
                <Textarea
                  value={publicResume}
                  onChange={(e) => setPublicResume(e.target.value)}
                  placeholder="Paste your resume text here to make it publicly visible to employers..."
                  className="bg-black/20 border-white/10 min-h-[300px] font-mono text-sm"
                />
              </div>
            </div>
          )}

          {tab === "photo" && (
            <div className="flex flex-col items-center gap-6 py-4">
              <div className="h-32 w-32 rounded-full border-2 border-white/20 overflow-hidden bg-secondary flex items-center justify-center text-5xl">
                {profilePic ? (
                  <img src={profilePic} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  <span>{firstName?.[0] || "U"}</span>
                )}
              </div>
              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">Upload a profile picture (max 5MB)</p>
                <Button variant="outline" className="border-white/20" onClick={() => fileRef.current?.click()}>
                  <Camera className="h-4 w-4 mr-2" /> Choose Photo
                </Button>
              </div>
              {profile?.profileImageUrl && !profile?.customProfileImage && (
                <p className="text-xs text-muted-foreground">Currently using your Google profile picture</p>
              )}
            </div>
          )}

          <div className="pt-4 border-t border-white/10 flex justify-end">
            <Button variant="gradient" onClick={handleSave} disabled={isSaving}>
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
