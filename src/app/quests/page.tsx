"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Target, Sparkles, Trophy, ShieldCheck, Flame, Star, Crown, CheckCircle2 } from "lucide-react";
import { RARITIES } from "@/lib/footballer-data";
import { ALL_EMOTES, UNLOCKED_EMOTE_IDS } from "@/lib/emote-data";
import { useUser, useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { doc } from "firebase/firestore";

export default function QuestsPage() {
  const router = useRouter();
  const { user } = useUser();
  const db = useFirestore();

  const userRef = useMemoFirebase(() => user ? doc(db, "userProfiles", user.uid) : null, [db, user]);
  const { data: profile } = useDoc(userRef);

  // Merge defaults to ensure base emotes are never treated as locked
  const unlockedIdsFromDb = profile?.unlockedEmoteIds || UNLOCKED_EMOTE_IDS;
  
  const totalWeight = RARITIES.reduce((acc, r) => acc + r.weight, 0);

  const quests = [
    {
      id: "q1",
      title: "PLATINUM DISCOVERY",
      description: "Encounter CRISTIANO RONALDO during a duel reveal.",
      rewardId: "ronaldo_platinum",
      icon: <Star className="w-5 h-5 text-cyan-400" />,
      requirementMet: false // Card based, checked in-game
    },
    {
      id: "q2",
      title: "DIAMOND MAESTRO",
      description: "Encounter LIONEL MESSI during a duel reveal.",
      rewardId: "messi_diamond",
      icon: <Sparkles className="w-5 h-5 text-indigo-400" />,
      requirementMet: false // Card based, checked in-game
    },
    {
      id: "q3",
      title: "GOLDEN FINISHER",
      description: "Encounter ERLING HAALAND during a duel reveal.",
      rewardId: "haaland_gold",
      icon: <Flame className="w-5 h-5 text-yellow-500" />,
      requirementMet: false // Card based, checked in-game
    },
    {
      id: "q4",
      title: "SILVER SPEEDSTER",
      description: "Encounter KYLIAN MBAPPÉ during a duel reveal.",
      rewardId: "mbappe_silver",
      icon: <ShieldCheck className="w-5 h-5 text-slate-300" />,
      requirementMet: false // Card based, checked in-game
    },
    {
      id: "q5",
      title: "MASTER SKILLER",
      description: "Encounter NEYMAR JR during a duel reveal.",
      rewardId: "neymar_master",
      icon: <Target className="w-5 h-5 text-purple-500" />,
      requirementMet: false // Card based, checked in-game
    },
    {
      id: "q6",
      title: "SEASONED DUELIST",
      description: "Reach a career total of 10 VICTORIES.",
      rewardId: "ten_wins",
      icon: <Trophy className="w-5 h-5 text-primary" />,
      requirementMet: (profile?.totalWins || 0) >= 10
    },
    {
      id: "q7",
      title: "KING OF THE ARENA",
      description: "Achieve RANK 1 when the Global Season resets (Monday 00:00 IST).",
      rewardId: "rank_one",
      icon: <Crown className="w-5 h-5 text-secondary" />,
      requirementMet: false // Time based
    }
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white p-4 flex flex-col items-center">
      <div className="w-full max-w-2xl space-y-8 py-8">
        <header className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/')} className="rounded-xl bg-white/5 hover:bg-white/10 shrink-0">
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <div className="flex flex-col">
            <h1 className="text-4xl font-black uppercase tracking-tighter">QUESTS</h1>
            <span className="text-[10px] font-black text-primary tracking-[0.3em] uppercase flex items-center gap-2">
              <Sparkles className="w-3 h-3" /> SEASON 1 CHALLENGES
            </span>
          </div>
        </header>

        <section className="grid gap-6">
          <Card className="bg-[#161618] border-white/5 rounded-[2rem] overflow-hidden shadow-2xl">
            <CardHeader>
              <CardTitle className="text-xl font-black uppercase">RARITY INTELLIGENCE</CardTitle>
              <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                DROP PROBABILITIES & TIER STYLES
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {RARITIES.map((rarity) => {
                  const percentage = ((rarity.weight / totalWeight) * 100).toFixed(1);
                  return (
                    <div key={rarity.type} className={`flex items-center justify-between p-3 rounded-xl bg-gradient-to-r ${rarity.bg} border border-white/10`}>
                      <span className="text-xs font-black uppercase tracking-tighter text-white">{rarity.type}</span>
                      <Badge variant="outline" className="bg-black/40 text-[10px] border-none text-white font-black">
                        {percentage}% CHANCE
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 px-2 flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" /> ACTIVE CHALLENGES
            </h3>
            <div className="grid gap-4">
              {quests.map((quest) => {
                const emote = ALL_EMOTES.find(e => e.id === quest.rewardId);
                const isUnlocked = unlockedIdsFromDb.includes(quest.rewardId) || quest.requirementMet;
                
                return (
                  <Card key={quest.id} className={`bg-[#161618] border-white/5 rounded-3xl overflow-hidden transition-all group ${isUnlocked ? 'border-primary/40 bg-primary/5' : 'hover:border-white/10'}`}>
                    <CardContent className="p-0 flex items-stretch">
                      <div className={`w-16 flex items-center justify-center shrink-0 ${isUnlocked ? 'bg-primary/20' : 'bg-white/5'}`}>
                        {isUnlocked ? <CheckCircle2 className="w-6 h-6 text-primary" /> : quest.icon}
                      </div>
                      <div className="flex-1 p-5 flex flex-col md:flex-row items-center gap-4">
                        <div className="flex-1 space-y-1 text-center md:text-left">
                          <div className="flex items-center justify-center md:justify-start gap-2">
                            <h4 className="text-sm font-black uppercase text-white">{quest.title}</h4>
                            {isUnlocked && <Badge className="bg-primary text-black text-[8px] font-black uppercase py-0 px-2">COMPLETED</Badge>}
                          </div>
                          <p className={`text-[10px] font-medium leading-relaxed uppercase ${isUnlocked ? 'text-slate-400' : 'text-slate-500'}`}>
                            {quest.description}
                          </p>
                        </div>
                        <div className={`flex items-center gap-3 p-2 rounded-2xl border shrink-0 ${isUnlocked ? 'bg-primary/10 border-primary/20' : 'bg-black/40 border-white/5'}`}>
                          <img src={emote?.url} className={`w-12 h-12 rounded-lg object-cover ${isUnlocked ? '' : 'grayscale opacity-50'}`} alt="reward" />
                          <div className="pr-2">
                            <span className="block text-[8px] font-black text-primary uppercase">{isUnlocked ? 'CLAIMED' : 'REWARD'}</span>
                            <span className="block text-[10px] font-black text-white uppercase truncate max-w-[80px]">{emote?.name}</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        <footer className="text-center pt-8 opacity-40">
          <p className="text-[8px] font-black uppercase tracking-[0.5em] flex items-center justify-center gap-2">
            COMPLETE QUESTS TO CUSTOMIZE YOUR DUEL PERSONA
          </p>
        </footer>
      </div>
    </div>
  );
}