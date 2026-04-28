"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Plus, Swords, LogIn, Trophy, Users, Download, 
  LogOut, Target, Heart, Info, 
  BarChart3, Smile, Sparkles, X, Coffee, PartyPopper, Crown,
  Gamepad2, Medal, Smartphone, Zap
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useAuth, useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from "@/firebase";
import { GoogleAuthProvider, signInWithRedirect, getRedirectResult } from "firebase/auth";
import { doc, setDoc, getDoc, updateDoc, collection, query, where, limit, getCountFromServer, arrayUnion, orderBy, getDocs } from "firebase/firestore";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { startOfDay } from "date-fns";
import { DEFAULT_EQUIPPED_IDS, UNLOCKED_EMOTE_IDS, ALL_EMOTES, SEASON_REWARD_EMOTE_ID } from "@/lib/emote-data";
import { FOOTBALLERS } from "@/lib/footballer-data";

export default function LandingPage() {
  const [roomCode, setRoomCode] = useState("");
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [completedQuest, setCompletedQuest] = useState<any>(null);

  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const userProfileRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(db, "userProfiles", user.uid);
  }, [db, user]);

  const { data: profileData } = useDoc(userProfileRef);

  const todayQuery = useMemoFirebase(() => {
    const today = startOfDay(new Date()).toISOString();
    return query(collection(db, "gameRooms"), where("createdAt", ">=", today), limit(50));
  }, [db]);
  const { data: todayRooms } = useCollection(todayQuery);

  const roomsToday = todayRooms?.length || 0;

  useEffect(() => {
    const fetchTotalPlayers = async () => {
      try {
        const coll = collection(db, "userProfiles");
        const snapshot = await getCountFromServer(coll);
        setTotalPlayers(snapshot.data().count);
      } catch (e) {
        setTotalPlayers(0);
      }
    };
    fetchTotalPlayers();
  }, [db]);

  // Handle Join Link param
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const searchParams = new URLSearchParams(window.location.search);
    const joinId = searchParams.get('join');
    if (joinId) {
      setRoomCode(joinId);
      if (!user && !isUserLoading) {
        toast({ 
          title: "ARENA LINK DETECTED", 
          description: "LOGIN FIRST TO JOIN THE DUEL ARENA.",
          variant: "default" 
        });
      }
    }
  }, [user, isUserLoading, toast]);

  const handleSeasonReset = useCallback(async () => {
    if (!user || !profileData) return;

    const now = new Date();
    // Dynamic Threshold: Most recent Sunday 18:30 UTC (Monday 00:00 IST)
    const threshold = new Date(now);
    const day = now.getUTCDay();
    threshold.setUTCDate(now.getUTCDate() - day);
    threshold.setUTCHours(18, 30, 0, 0);
    if (threshold > now) threshold.setUTCDate(threshold.getUTCDate() - 7);
    
    const lastResetStr = profileData.lastWeeklyReset;
    const lastReset = lastResetStr ? new Date(lastResetStr) : new Date(0);
    
    if (lastReset < threshold) {
      setIsSyncing(true);
      try {
        const lbQuery = query(collection(db, "userProfiles"), orderBy("weeklyWins", "desc"), limit(1));
        const lbSnap = await getDocs(lbQuery);
        const isWinner = !lbSnap.empty && lbSnap.docs[0].id === user.uid;
        
        const updatePayload: any = {
          weeklyWins: 0,
          lastWeeklyReset: now.toISOString()
        };

        if (isWinner) {
          updatePayload.unlockedEmoteIds = arrayUnion(SEASON_REWARD_EMOTE_ID);
          const emote = ALL_EMOTES.find(e => e.id === SEASON_REWARD_EMOTE_ID);
          setCompletedQuest({ title: 'THE CHAMPION (RANK 1)', emote });
        }

        await updateDoc(doc(db, "userProfiles", user.uid), updatePayload);
        toast({ title: "SEASON REFRESHED", description: "WEEKLY WINS RESET FOR NEW SEASON." });
      } catch (err) {
        console.error("Season reset error:", err);
      } finally {
        setIsSyncing(false);
      }
    }
  }, [user, profileData, db, toast]);

  const syncQuests = useCallback(async () => {
    if (!user || !profileData) return;
    const currentUnlocked = profileData.unlockedEmoteIds || UNLOCKED_EMOTE_IDS;
    
    if (profileData.totalWins >= 10 && !currentUnlocked.includes('ten_wins')) {
      const uRef = doc(db, "userProfiles", user.uid);
      await updateDoc(uRef, { unlockedEmoteIds: arrayUnion('ten_wins') });
      const emote = ALL_EMOTES.find(e => e.id === 'ten_wins');
      setCompletedQuest({ title: 'SEASONED DUELIST (10 WINS)', emote });
    }
    
    handleSeasonReset();
  }, [user, profileData, db, handleSeasonReset]);

  useEffect(() => {
    if (profileData) {
      syncQuests();
    }
  }, [profileData, syncQuests]);

  const preloadFlags = useCallback(() => {
    const uniqueCountryCodes = Array.from(new Set(FOOTBALLERS.map(f => f.countryCode)));
    uniqueCountryCodes.forEach(code => {
      const map: Record<string, string> = { 'en': 'gb-eng', 'eng': 'gb-eng', 'sc': 'gb-sct', 'sco': 'gb-sct', 'wa': 'gb-wls', 'wal': 'gb-wls', 'ni': 'gb-nir' };
      const finalCode = map[code.toLowerCase()] || code.toLowerCase();
      const img = new Image();
      img.src = `https://flagcdn.com/w640/${finalCode}.png`;
    });
    ALL_EMOTES.forEach(emote => {
      const img = new Image();
      img.src = emote.url;
    });
  }, []);

  useEffect(() => {
    if (!auth || typeof window === 'undefined') return;
    getRedirectResult(auth).then(async (result) => {
      if (result && result.user) {
        const loggedUser = result.user;
        const userRef = doc(db, "userProfiles", loggedUser.uid);
        const userSnap = await getDoc(userRef);
        startAssetSync(loggedUser.uid, loggedUser.displayName, loggedUser.photoURL, !userSnap.exists());
      }
    }).catch(err => {
      console.error("Redirect login error:", err);
    });
  }, [auth, db]);

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    setIsActionLoading(true);
    try {
      await signInWithRedirect(auth, provider);
    } catch (error: any) {
      console.error("Google login error:", error);
      toast({ variant: "destructive", title: "Login failed", description: "Google authentication error." });
      setIsActionLoading(false);
    }
  };

  const startAssetSync = async (uid: string, displayName: string | null, photoURL: string | null, isNew: boolean) => {
    setIsSyncing(true);
    setSyncProgress(0);
    preloadFlags();
    
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 15;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        setTimeout(async () => {
          const userRef = doc(db, "userProfiles", uid);
          if (isNew) {
            await setDoc(userRef, {
              id: uid,
              googleId: uid,
              displayName: displayName || "Player",
              avatarUrl: photoURL || `https://picsum.photos/seed/${uid}/200/200`,
              totalGamesPlayed: 0,
              totalWins: 0,
              totalLosses: 0,
              weeklyWins: 0,
              winStreak: 0,
              lastWeeklyReset: new Date().toISOString(),
              equippedEmoteIds: DEFAULT_EQUIPPED_IDS,
              unlockedEmoteIds: UNLOCKED_EMOTE_IDS,
              createdAt: new Date().toISOString(),
              lastLoginAt: new Date().toISOString()
            }, { merge: true });
          } else {
            await updateDoc(userRef, { lastLoginAt: new Date().toISOString() });
          }
          setIsSyncing(false);
          setShowManual(true);
        }, 500);
      }
      setSyncProgress(progress);
    }, 100);
  };

  const handleCreateRoom = async () => {
    if (!user) return;
    setIsActionLoading(true);
    try {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const roomRef = doc(db, "gameRooms", code);
      await setDoc(roomRef, {
        id: code,
        creatorId: user.uid,
        player1Id: user.uid,
        player2Id: null,
        participantIds: [user.uid],
        status: 'Lobby',
        mode: '1v1',
        healthOption: 100,
        player1CurrentHealth: 100,
        player2CurrentHealth: 100,
        maxRounds: 10,
        timePerRound: 60,
        currentRoundNumber: 1,
        usedFootballerIds: [],
        gameVersion: 'FDv1.0',
        createdAt: new Date().toISOString(),
        lastActionAt: new Date().toISOString()
      });
      router.push(`/lobby/${code}`);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: "Could not create duel." });
      setIsActionLoading(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!user || !roomCode) return;
    setIsActionLoading(true);
    try {
      const roomRef = doc(db, "gameRooms", roomCode.trim());
      const roomSnap = await getDoc(roomRef);
      if (!roomSnap.exists()) {
        toast({ variant: "destructive", title: "Not Found", description: "Invalid code." });
        setIsActionLoading(false);
        return;
      }
      const data = roomSnap.data();
      if (data.status !== 'Lobby' && !data.participantIds.includes(user.uid)) {
        toast({ variant: "destructive", title: "Full", description: "Match in progress." });
        setIsActionLoading(false);
        return;
      }
      if (data.mode === '1v1' && data.participantIds.length >= 2 && !data.participantIds.includes(user.uid)) {
        toast({ variant: "destructive", title: "Full", description: "Room is for 1v1 only." });
        setIsActionLoading(false);
        return;
      }
      if (data.participantIds.length >= 100 && !data.participantIds.includes(user.uid)) {
        toast({ variant: "destructive", title: "Full", description: "Party is at max capacity." });
        setIsActionLoading(false);
        return;
      }
      if (!data.participantIds.includes(user.uid)) {
        const update: any = { participantIds: arrayUnion(user.uid), lastActionAt: new Date().toISOString() };
        if (data.mode === '1v1' && !data.player2Id) {
          update.player2Id = user.uid;
          update.player2CurrentHealth = data.healthOption;
        }
        await updateDoc(roomRef, update);
      }
      router.push(`/lobby/${roomCode.trim()}`);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Join Failed", description: "Check connection." });
      setIsActionLoading(false);
    }
  };

  if (isUserLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#0a0a0b]"><Swords className="w-12 h-12 text-primary animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[#0a0a0b] relative overflow-x-hidden text-white">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/20 blur-[120px] rounded-full pointer-events-none" />

      <Dialog open={!!completedQuest} onOpenChange={() => setCompletedQuest(null)}>
        <DialogContent className="bg-black/95 border-primary/20 p-8 text-center flex flex-col items-center gap-6 max-w-sm rounded-[3rem] overflow-hidden">
          <PartyPopper className="w-16 h-16 text-primary animate-bounce" />
          <h2 className="text-2xl font-black text-white uppercase">SEASON REWARD!</h2>
          <p className="text-primary text-sm font-black uppercase tracking-widest">{completedQuest?.title}</p>
          <img src={completedQuest?.emote?.url} className="w-24 h-24 rounded-2xl object-cover shadow-2xl border-2 border-primary/50" alt="reward" />
          <Button onClick={() => setCompletedQuest(null)} className="w-full bg-primary text-black font-black uppercase rounded-2xl h-12">CLAIM</Button>
        </DialogContent>
      </Dialog>

      {(isSyncing || showManual) && (
        <div className="fixed inset-0 z-[100] bg-black/98 flex flex-col items-center justify-center p-6 backdrop-blur-3xl animate-in fade-in duration-500 overflow-hidden">
          <div className="w-full max-w-lg space-y-6 text-center flex flex-col items-center relative">
            {!isSyncing && (
              <Button variant="ghost" size="icon" onClick={() => setShowManual(false)} className="absolute -top-12 right-0 text-slate-500 hover:text-white">
                <X className="w-6 h-6" />
              </Button>
            )}
            <Smartphone className="w-12 h-12 text-primary mx-auto relative z-10" />
            <h2 className="text-3xl font-black uppercase text-primary">{isSyncing ? "SYNCING SEASON" : "WELCOME TO ARENA"}</h2>
            <ScrollArea className="h-[55vh] w-full bg-white/5 p-6 rounded-[2rem] border border-white/10 text-left">
              <div className="space-y-6 text-xs font-bold leading-relaxed text-slate-300 uppercase">
                {isSyncing ? (
                  <div className="space-y-4 text-center py-8">
                     <p className="text-sm italic">PRE-FETCHING STADIUM ASSETS & PLAYER CARDS...</p>
                     <p className="opacity-50">STABILIZING LEADERBOARD DATA FOR THE NEW WEEK.</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-4"><h3 className="text-primary text-sm flex items-center gap-2"><Zap className="w-4 h-4" /> THE BASICS</h3><p className="normal-case text-slate-400">Identify the footballer from career clues before your opponents do.</p></div>
                    <div className="space-y-4"><h3 className="text-secondary text-sm flex items-center gap-2"><Zap className="w-4 h-4" /> INTELLIGENT SYSTEM</h3><p className="normal-case text-slate-400 italic">Minor typos are allowed based on name length (e.g., "Messy" for "Messi"). Spell as close as possible for points!</p></div>
                    <div className="space-y-4"><h3 className="text-primary text-sm flex items-center gap-2"><Heart className="w-4 h-4" /> MODES</h3><p className="normal-case text-slate-400">1v1 Duel (HP based) or Party Arena (Points based, up to 100 players).</p></div>
                    <div className="space-y-4"><h3 className="text-primary text-sm flex items-center gap-2"><Trophy className="w-4 h-4" /> LEADERBOARD</h3><p className="normal-case text-slate-400">Weekly rankings reset every Monday at 00:00 IST. Rank 1 wins exclusive rewards.</p></div>
                  </>
                )}
              </div>
            </ScrollArea>
            {isSyncing ? (
              <div className="w-full space-y-2 px-4">
                <Progress value={syncProgress} className="h-2 bg-white/5" />
                <p className="text-primary text-[10px] font-black uppercase tracking-widest animate-pulse">FILES LOADING... {Math.round(syncProgress)}%</p>
              </div>
            ) : (
              <Button onClick={() => setShowManual(false)} className="w-full h-14 bg-primary text-black font-black uppercase rounded-2xl shadow-xl">ENTER ARENA</Button>
            )}
          </div>
        </div>
      )}

      {showSupport && (
        <div className="fixed inset-0 z-[110] bg-black/98 flex flex-col items-center justify-center p-6 backdrop-blur-3xl animate-in fade-in duration-500 overflow-hidden">
          <div className="w-full max-w-lg space-y-6 text-center flex flex-col items-center relative">
            <Button variant="ghost" size="icon" onClick={() => setShowSupport(false)} className="absolute -top-12 right-0 text-slate-500 hover:text-white"><X className="w-6 h-6" /></Button>
            <div className="bg-white/5 p-8 rounded-[2.5rem] border border-white/10 space-y-6 flex flex-col items-center w-full">
              <Coffee className="w-10 h-10 text-primary" />
              <h2 className="text-2xl font-black uppercase text-primary">SUPPORT THE DEV</h2>
              <ScrollArea className="h-[40vh] w-full text-left pr-4">
                <div className="space-y-6 text-xs font-bold uppercase text-slate-300">
                  <p className="normal-case text-slate-400">I’m <span className="text-white font-black">Barnik (BrokenAqua)</span>, an 18-year-old creator. This project is fueled by passion and AI innovation. Every coffee helps keep the servers running!</p>
                  <div className="flex flex-col items-center gap-4 py-4 bg-white/5 rounded-2xl">
                    <img src="https://res.cloudinary.com/speed-searches/image/upload/v1772129990/photo_2026-02-26_23-45-57_isa851.jpg" className="w-48 h-48 rounded-2xl bg-white p-2 shadow-2xl" alt="QR" />
                    <p className="text-[10px] font-black uppercase text-primary">SCAN TO SUPPORT</p>
                  </div>
                </div>
              </ScrollArea>
              <Button onClick={() => setShowSupport(false)} className="w-full h-14 bg-primary text-black font-black uppercase rounded-2xl shadow-xl flex gap-2">BACK TO ARENA</Button>
            </div>
          </div>
        </div>
      )}

      <div className="relative z-10 w-full max-w-md mx-auto space-y-10 py-8 flex flex-col items-center">
        <header className="text-center space-y-4 w-full">
          <div className="inline-flex p-4 rounded-3xl bg-primary/20 text-primary border border-primary/20 mb-2 animate-bounce"><Swords className="w-12 h-12" /></div>
          <h1 className="text-6xl font-black text-white uppercase leading-none">FOOTY DECODE</h1>
        </header>

        {!user ? (
          <Card className="bg-[#161618] border-white/5 shadow-2xl rounded-[2.5rem] overflow-hidden w-full">
            <CardHeader className="text-center pb-2"><CardTitle className="text-2xl font-black text-white uppercase">AUTHENTICATION</CardTitle></CardHeader>
            <CardContent className="pt-4 space-y-3">
              <Button disabled={isActionLoading} onClick={handleGoogleLogin} className="w-full h-16 bg-white text-black font-black text-lg gap-3 rounded-2xl hover:scale-[1.02] transition-transform">
                {isActionLoading ? <Swords className="w-6 h-6 animate-spin text-black" /> : "GOOGLE SIGN IN"}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6 w-full">
            <div className="flex flex-col gap-4 bg-white/5 p-6 rounded-[2.5rem] border border-white/5 backdrop-blur-md shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <img src={user.photoURL || `https://picsum.photos/seed/${user.uid}/100/100`} className="w-14 h-14 rounded-full ring-2 ring-primary object-cover" alt="Profile" />
                    <div className="absolute -bottom-1 -right-1 bg-primary text-black rounded-full p-1 border-2 border-[#0a0a0b]"><Sparkles className="w-3 h-3" /></div>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-black text-base uppercase truncate max-w-[140px]">{user.displayName}</span>
                    <span className="text-[9px] text-primary font-black uppercase flex items-center gap-1 bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20 w-fit"><Crown className="w-2 h-2" /> {profileData?.winStreak || 0} STREAK</span>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => auth.signOut()} className="text-slate-500 hover:text-red-500"><LogOut className="w-5 h-5" /></Button>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/5">
                <div className="flex flex-col"><span className="text-[8px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1"><Gamepad2 className="w-3 h-3" /> MATCHES</span><span className="text-xl font-black text-white">{profileData?.totalGamesPlayed || 0}</span></div>
                <div className="flex flex-col items-end"><span className="text-[8px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1"><Medal className="w-3 h-3" /> TOTAL WINS</span><span className="text-xl font-black text-primary">{profileData?.totalWins || 0}</span></div>
              </div>
            </div>

            <div className="grid gap-3">
              <Button disabled={isActionLoading} onClick={handleCreateRoom} className="w-full h-12 text-sm font-black bg-primary rounded-xl uppercase shadow-lg hover:scale-[1.02] transition-all group">
                {!isActionLoading && "CREATE ARENA"}
                {isActionLoading && roomCode === "" ? "CREATING ARENA..." : (isActionLoading ? "PLEASE WAIT..." : "")}
                {!isActionLoading && <Plus className="ml-2 w-4 h-4 group-hover:rotate-90 transition-transform" />}
              </Button>
              <div className="flex gap-2">
                <Input placeholder="CODE" className="h-14 bg-[#161618] text-center font-black tracking-widest text-2xl rounded-xl border-white/10" value={roomCode} onChange={(e) => setRoomCode(e.target.value)} maxLength={6} disabled={isActionLoading} />
                <Button disabled={isActionLoading || !roomCode} onClick={handleJoinRoom} variant="secondary" className="h-14 px-8 font-black rounded-xl uppercase text-lg shadow-xl">
                   {isActionLoading && roomCode !== "" ? <Swords className="w-4 h-4 animate-spin" /> : "JOIN"}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button onClick={() => router.push('/quests')} variant="outline" className="h-16 bg-white/5 rounded-2xl font-black uppercase border-white/10"><Target className="w-5 h-5 mr-2 text-primary" /> QUESTS</Button>
              <Button onClick={() => router.push('/leaderboard')} variant="outline" className="h-16 bg-white/5 rounded-2xl font-black uppercase border-white/10"><BarChart3 className="w-5 h-5 mr-2 text-secondary" /> LEADERBOARD</Button>
              <Button onClick={() => router.push('/emotes')} variant="outline" className="h-16 bg-white/5 rounded-2xl font-black uppercase border-white/10"><Smile className="w-5 h-5 mr-2 text-primary" /> EMOTES</Button>
              <Button onClick={() => setShowManual(true)} variant="outline" className="h-16 bg-white/5 rounded-2xl font-black uppercase border-white/10"><Info className="w-5 h-5 mr-2 text-primary" /> INFO</Button>
            </div>

            <Button variant="link" className="w-full text-slate-500 font-black uppercase text-[10px] tracking-widest" onClick={() => setShowSupport(true)}><Heart className="w-3 h-3 mr-2 text-red-500 fill-red-500" /> SUPPORT THE DEV</Button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 w-full">
           <div className="bg-white/5 p-6 rounded-[2rem] border border-white/5 flex flex-col items-center"><Trophy className="text-secondary w-8 h-8 mb-2" /><span className="text-[10px] uppercase font-black text-slate-500 tracking-widest">DUELS TODAY</span><span className="text-2xl font-black">{roomsToday}</span></div>
           <div className="bg-white/5 p-6 rounded-[2rem] border border-white/5 flex flex-col items-center"><Users className="text-primary w-8 h-8 mb-2" /><span className="text-[10px] uppercase font-black text-slate-500 tracking-widest">PLAYERS</span><span className="text-2xl font-black">{totalPlayers}</span></div>
        </div>

        <footer className="text-center pt-4 opacity-40">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2">
            MADE WITH ❤️ IN INDIA
          </p>
        </footer>
      </div>
    </div>
  );
}
