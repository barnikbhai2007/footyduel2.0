"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Smile, ArrowLeft, Save, CheckCircle2, Lock, Sparkles, Trophy, Crown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useFirestore, useUser, useDoc, useMemoFirebase } from "@/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { ALL_EMOTES, DEFAULT_EQUIPPED_IDS, UNLOCKED_EMOTE_IDS, SEASON_REWARD_EMOTE_ID } from "@/lib/emote-data";

export default function EmotesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, isUserLoading } = useUser();
  const db = useFirestore();

  const userRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(db, "userProfiles", user.uid);
  }, [db, user]);

  const { data: profile, isLoading: isProfileLoading } = useDoc(userRef);
  const [equippedIds, setEquippedIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Merge logic: Base Emotes + Unlocked from DB + Wins requirement
  const unlockedList = Array.from(new Set([
    ...UNLOCKED_EMOTE_IDS, 
    ...(profile?.unlockedEmoteIds || []),
    ...(profile?.totalWins >= 10 ? ['ten_wins'] : [])
  ]));

  useEffect(() => {
    if (profile) {
      setEquippedIds(profile.equippedEmoteIds || DEFAULT_EQUIPPED_IDS);
    }
  }, [profile]);

  useEffect(() => {
    if (!isUserLoading && !user) router.push('/');
  }, [user, isUserLoading, router]);

  const toggleEmote = (emoteId: string) => {
    const isCurrentlyEquipped = equippedIds.includes(emoteId);
    
    if (!isCurrentlyEquipped) {
      if (!unlockedList.includes(emoteId)) {
        toast({ variant: "destructive", title: "LOCKED", description: "COMPLETE QUESTS OR WIN SEASONS TO UNLOCK." });
        return;
      }
      if (equippedIds.length >= 6) {
        toast({ variant: "destructive", title: "LIMIT REACHED", description: "MAX 6 EMOTES ALLOWED." });
        return;
      }
    }

    setEquippedIds(prev => prev.includes(emoteId) ? prev.filter(id => id !== emoteId) : [...prev, emoteId]);
  };

  const handleSave = async () => {
    if (!userRef) return;
    setIsSaving(true);
    try {
      await updateDoc(userRef, { equippedEmoteIds: equippedIds });
      toast({ title: "LOADOUT SAVED", description: "EMOTES READY FOR DUEL." });
    } catch (error) {
      toast({ variant: "destructive", title: "SAVE FAILED", description: "CHECK CONNECTION." });
    } finally {
      setIsSaving(false);
    }
  };

  if (isUserLoading || isProfileLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#0a0a0b]"><Smile className="w-12 h-12 text-primary animate-spin" /></div>;
  }

  // Filter out Rank One from Locked list - it's a hidden reward
  const visibleEmotes = ALL_EMOTES.filter(e => {
    if (e.id === SEASON_REWARD_EMOTE_ID) {
      return unlockedList.includes(e.id); // Only show Rank One if owned
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white p-4 flex flex-col items-center">
      <div className="w-full max-w-2xl space-y-8 py-8">
        <header className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <Button variant="ghost" size="icon" onClick={() => router.push('/')} className="bg-white/5 rounded-xl">
              <ArrowLeft className="w-6 h-6" />
            </Button>
            <h1 className="text-2xl md:text-4xl font-black uppercase">EMOTE LOADOUT</h1>
          </div>
          <Button onClick={handleSave} disabled={isSaving} className="w-full md:w-auto bg-primary text-black font-black uppercase rounded-2xl h-12 px-6">
            <Save className="w-5 h-5 mr-2" /> {isSaving ? "SAVING..." : "SAVE"}
          </Button>
        </header>

        <section className="grid gap-6">
          <Card className="bg-[#161618] border-white/5 rounded-[2rem] overflow-hidden shadow-2xl">
            <CardHeader>
              <CardTitle className="text-xl font-black uppercase">EQUIPPED ({equippedIds.length}/6)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                {equippedIds.map(id => {
                  const emote = ALL_EMOTES.find(e => e.id === id);
                  return (
                    <div key={id} onClick={() => toggleEmote(id)} className="relative aspect-square rounded-2xl border-2 border-primary overflow-hidden cursor-pointer group">
                      <img src={emote?.url} className="w-full h-full object-cover transition-transform group-hover:scale-110" alt={emote?.name} />
                      {id === SEASON_REWARD_EMOTE_ID && (
                        <div className="absolute top-1 right-1 bg-primary text-black p-0.5 rounded shadow-lg">
                          <Crown className="w-3 h-3" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 px-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" /> COLLECTION
            </h3>
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {visibleEmotes.map(emote => {
                const isEquipped = equippedIds.includes(emote.id);
                const isUnlocked = unlockedList.includes(emote.id);
                return (
                  <div key={emote.id} onClick={() => toggleEmote(emote.id)} className={`relative aspect-square rounded-2xl overflow-hidden cursor-pointer transition-all ${isEquipped ? 'ring-4 ring-primary' : 'bg-[#161618] border border-white/5'} ${!isUnlocked ? 'grayscale opacity-40' : ''}`}>
                    <img src={emote.url} className="w-full h-full object-cover" alt={emote.name} />
                    {isEquipped && <div className="absolute inset-0 flex items-center justify-center bg-black/40"><CheckCircle2 className="w-8 h-8 text-primary" /></div>}
                    {!isUnlocked && <div className="absolute inset-0 flex items-center justify-center bg-black/40"><Lock className="w-6 h-6 text-white/60" /></div>}
                    {emote.id === SEASON_REWARD_EMOTE_ID && (
                      <div className="absolute top-2 right-2 bg-primary text-black p-1 rounded shadow-lg">
                        <Crown className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}