"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Trophy, ArrowLeft, Medal, Users, Swords, 
  Clock, Sparkles, Crown
} from "lucide-react";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy, limit } from "firebase/firestore";
import { ALL_EMOTES, SEASON_REWARD_EMOTE_ID } from "@/lib/emote-data";

export default function LeaderboardPage() {
  const router = useRouter();
  const db = useFirestore();

  // Helper to get the most recent Monday 00:00 IST (Sunday 18:30 UTC)
  const getResetThreshold = () => {
    const now = new Date();
    const threshold = new Date(now);
    // Find most recent Sunday 18:30 UTC (which is Monday 00:00 IST)
    const day = now.getUTCDay();
    const diff = (day + 7 - 0) % 7; // Distance to previous Sunday
    threshold.setUTCDate(now.getUTCDate() - diff);
    threshold.setUTCHours(18, 30, 0, 0);
    
    // If current time is before this week's Sun 18:30 UTC, then it was last week
    if (threshold > now) {
      threshold.setUTCDate(threshold.getUTCDate() - 7);
    }
    return threshold.toISOString();
  };

  // Simplified query to avoid permission/index errors with complex filters.
  const leaderboardQuery = useMemoFirebase(() => {
    return query(
      collection(db, "userProfiles"),
      orderBy("weeklyWins", "desc"),
      limit(20)
    );
  }, [db]);

  const { data: topPlayersRaw, isLoading } = useCollection(leaderboardQuery);
  
  const topPlayers = useMemo(() => {
    if (!topPlayersRaw) return [];
    const thresholdStr = getResetThreshold();
    
    // Filter out users who haven't reset for the current week yet
    return topPlayersRaw
      .filter(player => (player.lastWeeklyReset || "") >= thresholdStr)
      .sort((a, b) => (b.weeklyWins || 0) - (a.weeklyWins || 0))
      .slice(0, 5);
  }, [topPlayersRaw]);

  const [timeLeft, setTimeLeft] = useState("");
  const rewardEmote = ALL_EMOTES.find(e => e.id === SEASON_REWARD_EMOTE_ID);

  useEffect(() => {
    const calculateTime = () => {
      const now = new Date();
      // Calculate NEXT Monday 00:00 IST (Sunday 18:30 UTC)
      const target = new Date(now);
      const day = now.getUTCDay();
      const diff = (7 - day) % 7; 
      target.setUTCDate(now.getUTCDate() + diff);
      target.setUTCHours(18, 30, 0, 0);

      // If we already passed Sunday 18:30 UTC this week, move to next week
      if (target <= now) {
        target.setUTCDate(target.getUTCDate() + 7);
      }
      
      const diffMs = target.getTime() - now.getTime();
      const d = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const h = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const m = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      setTimeLeft(`${d}D ${h}H ${m}M`);
    };

    calculateTime();
    const timer = setInterval(calculateTime, 60000);
    return () => clearInterval(timer);
  }, []);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#0a0a0b]"><Swords className="w-12 h-12 text-primary animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white p-4 flex flex-col items-center">
      <div className="w-full max-w-2xl space-y-8 py-8">
        <header className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/')} className="rounded-xl bg-white/5 hover:bg-white/10 shrink-0">
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <div className="flex flex-col">
            <h1 className="text-4xl font-black uppercase tracking-tighter">LEADERBOARD</h1>
            <span className="text-[10px] font-black text-primary tracking-[0.3em] uppercase flex items-center gap-2">
              <Sparkles className="w-3 h-3" /> SEASON 1 • COMPETITION
            </span>
          </div>
        </header>

        <section className="grid gap-6">
          <Card className="bg-primary/5 border-primary/20 rounded-[2rem] p-6 border-2 flex flex-col md:flex-row items-center gap-6 shadow-[0_0_40px_rgba(249,115,22,0.1)]">
            <div className="relative shrink-0">
              <div className="absolute inset-0 bg-primary/20 blur-[30px] rounded-full animate-pulse" />
              <img src={rewardEmote?.url} className="w-24 h-24 rounded-2xl object-cover relative z-10 border-2 border-primary shadow-2xl" alt="Season Reward" />
              <div className="absolute -top-2 -right-2 bg-primary text-black p-1 rounded-lg z-20 shadow-lg">
                <Crown className="w-5 h-5" />
              </div>
            </div>
            <div className="text-center md:text-left space-y-1">
              <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">CURRENT REWARD</p>
              <h2 className="text-2xl font-black uppercase text-white leading-none">{rewardEmote?.name}</h2>
              <p className="text-[10px] font-bold text-slate-500 uppercase leading-relaxed max-w-xs">
                FINISH AT RANK 1 THIS WEEK TO CLAIM THIS EXCLUSIVE EMOTE.
              </p>
            </div>
          </Card>

          <Card className="bg-[#161618] border-white/5 rounded-[2rem] overflow-hidden shadow-2xl">
            <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-white/5">
              <div>
                <CardTitle className="text-xl font-black uppercase">GLOBAL STANDINGS</CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  WEEKLY COMPETITION
                </CardDescription>
              </div>
              <Badge variant="outline" className="border-primary/50 text-primary font-black uppercase text-[10px] py-1 gap-2">
                <Clock className="w-3 h-3" /> RESET IN: {timeLeft || "---"}
              </Badge>
            </CardHeader>
            <CardContent className="px-0">
              <div className="space-y-1">
                {topPlayers.map((player: any, index: number) => (
                  <div key={player.id} className={`flex items-center gap-4 p-5 transition-all ${index === 0 ? 'bg-primary/10 border-y border-primary/20' : 'hover:bg-white/5'}`}>
                    <div className="w-10 flex justify-center items-center">
                      {index === 0 ? <Crown className="w-8 h-8 text-yellow-500 drop-shadow-lg" /> : 
                       index === 1 ? <Medal className="w-7 h-7 text-slate-300" /> :
                       index === 2 ? <Medal className="w-7 h-7 text-orange-600" /> :
                       <span className="text-2xl font-black text-white/20 italic">#{index + 1}</span>}
                    </div>
                    <div className="relative">
                      <img src={player.avatarUrl || `https://picsum.photos/seed/${player.id}/100/100`} className={`w-14 h-14 rounded-full border-2 object-cover ${index === 0 ? 'border-primary ring-4 ring-primary/20' : 'border-white/10'}`} alt={player.displayName} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black uppercase text-base truncate">{player.displayName}</p>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">ACTIVE DUELIST</p>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-black text-white tracking-tighter leading-none">{player.weeklyWins || 0}</p>
                      <p className="text-[8px] font-black text-primary uppercase tracking-widest">WEEKLY WINS</p>
                    </div>
                  </div>
                ))}

                {topPlayers.length === 0 && ( topPlayersRaw?.length !== 0 ? (
                  <div className="p-12 text-center opacity-30">
                    <Users className="w-12 h-12 mx-auto mb-4" />
                    <p className="text-xs font-black uppercase tracking-widest">AWAITING WEEKLY DATA...</p>
                  </div>
                ) : (
                  <div className="p-12 text-center opacity-30">
                    <Users className="w-12 h-12 mx-auto mb-4" />
                    <p className="text-xs font-black uppercase tracking-widest">NO DATA FOR CURRENT WEEK</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        <footer className="text-center pt-4">
          <p className="text-[8px] font-black uppercase tracking-[0.5em] text-slate-600">
            NEXT RESET: MONDAY 00:00 IST
          </p>
        </footer>
      </div>
    </div>
  );
}
