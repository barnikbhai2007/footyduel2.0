"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Copy, Users, Play, ShieldAlert, Crown, Swords, 
  UserX, Settings2, Info, Heart, Zap, BookOpen, 
  Target, Clock, AlertTriangle, CheckCircle2, Share2
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useFirestore, useUser, useDoc, useMemoFirebase } from "@/firebase";
import { doc, updateDoc, onSnapshot, arrayUnion } from "firebase/firestore";

export default function LobbyPage() {
  const { roomId: roomIdFromParams } = useParams();
  const roomIdStr = roomIdFromParams as string;
  const router = useRouter();
  const { toast } = useToast();
  const { user, isUserLoading } = useUser();
  const db = useFirestore();

  const roomRef = useMemoFirebase(() => {
    if (!user || !roomIdStr) return null;
    return doc(db, "gameRooms", roomIdStr);
  }, [db, roomIdStr, user]);
  
  const { data: room, isLoading } = useDoc(roomRef);

  const [participants, setParticipants] = useState<any[]>([]);
  const isLeader = room?.creatorId === user?.uid;

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push(`/?join=${roomIdStr}`);
    }
  }, [user, isUserLoading, router, roomIdStr]);

  useEffect(() => {
    if (room && user && roomRef && !room.participantIds.includes(user.uid)) {
      const performAutoJoin = async () => {
        const ids = room.participantIds || [];
        
        if (room.mode === '1v1' && ids.length >= 2) {
          toast({ variant: "destructive", title: "ARENA FULL", description: "THIS DUEL ALREADY HAS 2 PLAYERS." });
          router.push('/');
          return;
        }
        
        if (room.mode === 'Party' && ids.length >= 100) {
          toast({ variant: "destructive", title: "ARENA FULL", description: "PARTY AT MAX CAPACITY (100)." });
          router.push('/');
          return;
        }

        const update: any = { 
          participantIds: arrayUnion(user.uid), 
          lastActionAt: new Date().toISOString() 
        };
        
        if (room.mode === '1v1' && !room.player2Id) {
          update.player2Id = user.uid;
          update.player2CurrentHealth = room.healthOption;
        }
        
        try {
          await updateDoc(roomRef, update);
          toast({ title: "ARENA JOINED", description: "YOU ARE NOW IN THE LOBBY." });
        } catch (err) {
          console.error("Auto-join failed:", err);
        }
      };
      performAutoJoin();
    }
  }, [room, user, roomRef, router, toast]);

  useEffect(() => {
    if (!room || !user) return;

    const unsubs: (() => void)[] = [];
    
    const ids = room.participantIds || [];
    ids.forEach((uid: string) => {
      const unsub = onSnapshot(doc(db, "userProfiles", uid), (snap) => {
        const data = snap.data();
        if (data) {
          setParticipants(prev => {
            const others = prev.filter(p => p.id !== uid);
            return [...others, { ...data, id: uid }].sort((a, b) => {
              if (a.id === room.creatorId) return -1;
              if (b.id === room.creatorId) return 1;
              return 0;
            });
          });
        }
      });
      unsubs.push(unsub);
    });

    if (room.status === 'InProgress') {
      router.push(`/game/${roomIdStr}`);
    }

    return () => unsubs.forEach(u => u());
  }, [room?.participantIds, room?.status, db, roomIdStr, router, user, room?.creatorId]);

  const copyCode = () => {
    navigator.clipboard.writeText(roomIdStr);
    toast({ title: "COPIED!", description: "ROOM CODE ADDED TO CLIPBOARD." });
  };

  const handleShare = async () => {
    const shareUrl = window.location.href;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'Join my FootyDuel Arena!',
          text: `Use code ${roomIdStr} to join the match.`,
          url: shareUrl,
        });
      } catch (err) {}
    } else {
      navigator.clipboard.writeText(shareUrl);
      toast({ title: "LINK COPIED!", description: "SHARE IT WITH YOUR SQUAD." });
    }
  };

  const updateSetting = async (field: string, val: any) => {
    if (!isLeader || !roomRef) return;
    await updateDoc(roomRef, { [field]: val });
  };

  const startGame = async () => {
    if ((room.participantIds?.length || 0) < 2) {
      toast({ variant: "destructive", title: "WAIT!", description: "NEED AT LEAST 2 PLAYERS TO START." });
      return;
    }
    
    if (room.mode === 'Party' && (!room.maxRounds || !room.timePerRound)) {
      toast({ variant: "destructive", title: "MISSING SETUP", description: "CHOOSE ROUNDS AND TIME LIMIT." });
      return;
    }

    const update: any = { 
      status: 'InProgress',
      startedAt: new Date().toISOString(),
      lastActionAt: new Date().toISOString()
    };

    if (room.mode === 'Party') {
      const scores: Record<string, number> = {};
      room.participantIds.forEach((id: string) => scores[id] = 0);
      update.scores = scores;
    }

    await updateDoc(roomRef, update);
  };

  if (isUserLoading || isLoading || !room) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0b]">
        <Swords className="w-12 h-12 text-primary animate-spin" />
      </div>
    );
  }

  const isPartyMode = room.mode === 'Party';
  const maxSlots = isPartyMode ? 100 : 2;

  return (
    <div className="min-h-screen bg-[#0a0a0b] p-4 flex flex-col items-center">
      <div className="w-full max-w-lg space-y-6">
        <header className="flex justify-between items-center py-4 gap-4">
          <div className="flex flex-col min-w-0">
            <h1 className="text-2xl font-black text-primary uppercase leading-tight truncate">FOOTY DUEL</h1>
            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">VERSION 1.0 • ARENA</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={handleShare} className="bg-white/5 border-white/10 rounded-xl h-10 px-3 hover:bg-white/10">
              <Share2 className="w-4 h-4 text-primary" />
            </Button>
            <div className="bg-primary/10 border border-primary/30 rounded-xl px-3 h-10 flex items-center gap-2 shadow-xl">
              <span className="text-[10px] font-black text-primary uppercase">CODE:</span>
              <span className="text-sm font-black text-white tracking-widest">{roomIdStr}</span>
            </div>
          </div>
        </header>

        <Card className="bg-[#161618] border-none shadow-2xl rounded-[2rem] overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2 bg-white/5">
            <CardTitle className="text-lg font-black flex items-center gap-2 uppercase italic">
              <Users className="w-5 h-5 text-secondary" /> {isPartyMode ? 'PARTY' : 'DUEL'} LOBBY ({participants.length}/{maxSlots})
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={copyCode} className="text-[10px] text-muted-foreground gap-1 font-black uppercase hover:bg-white/5">
              <Copy className="w-3 h-3" /> COPY CODE
            </Button>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <ScrollArea className="max-h-64 pr-3">
              <div className={`grid ${isPartyMode ? 'grid-cols-3 md:grid-cols-5' : 'grid-cols-2'} gap-3`}>
                {participants.slice(0, maxSlots).map((p) => (
                  <div key={p.id} className="flex flex-col items-center gap-1 p-2 rounded-2xl bg-white/5 border border-white/5 relative group animate-in fade-in zoom-in">
                    {p.id === room.creatorId && <Crown className="w-3 h-3 text-yellow-500 absolute -top-1 left-1/2 -translate-x-1/2 drop-shadow-md" />}
                    <img src={p.avatarUrl || `https://picsum.photos/seed/${p.id}/100/100`} className="w-12 h-12 rounded-full border-2 border-primary/20 object-cover shadow-lg" alt={p.displayName} />
                    <span className="text-[8px] font-black truncate w-full text-center uppercase tracking-tight text-white/80">{p.displayName}</span>
                  </div>
                ))}
                {Array.from({ length: Math.min(10 - (participants.length % 10 === 0 && participants.length > 0 ? 10 : participants.length % 10), Math.max(0, maxSlots - participants.length)) }).map((_, i) => (
                  <div key={`empty-${i}`} className="flex flex-col items-center justify-center p-2 rounded-2xl bg-white/5 border border-dashed border-white/10 opacity-30">
                    <UserX className="w-6 h-6 mb-1 text-slate-500" />
                    <span className="text-[6px] font-black uppercase">EMPTY</span>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="space-y-4 pt-4 border-t border-white/5">
              <div className="flex items-center gap-2 mb-2">
                <Settings2 className="w-4 h-4 text-primary" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">MATCH CONFIGURATION</span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                    <Swords className="w-3 h-3 text-primary" /> GAME MODE
                  </label>
                  {isLeader ? (
                    <Select value={room.mode || '1v1'} onValueChange={(val) => updateSetting('mode', val)}>
                      <SelectTrigger className="bg-[#0a0a0b] border-none h-12 rounded-xl font-bold uppercase text-left">
                        <SelectValue placeholder="Select Mode" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#161618] border-white/10 text-white">
                        <SelectItem value="1v1">1v1 DUEL</SelectItem>
                        <SelectItem value="Party">PARTY ARENA</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="h-12 bg-[#0a0a0b] rounded-xl flex items-center px-4 font-black uppercase text-sm">{room.mode || '1v1'}</div>
                  )}
                </div>

                {!isPartyMode && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                      <Heart className="w-3 h-3 text-red-500" /> MATCH HEALTH
                    </label>
                    {isLeader ? (
                      <Select value={room.healthOption?.toString() || '100'} onValueChange={(val) => {
                        const h = parseInt(val);
                        updateDoc(roomRef!, { healthOption: h, player1CurrentHealth: h, player2CurrentHealth: h });
                      }}>
                        <SelectTrigger className="bg-[#0a0a0b] border-none h-12 rounded-xl font-bold uppercase text-left">
                          <SelectValue placeholder="Select Health" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#161618] border-white/10 text-white">
                          <SelectItem value="50">50 HP (BLITZ)</SelectItem>
                          <SelectItem value="100">100 HP (STANDARD)</SelectItem>
                          <SelectItem value="150">150 HP (PRO)</SelectItem>
                          <SelectItem value="200">200 HP (ELITE)</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="h-12 bg-[#0a0a0b] rounded-xl flex items-center px-4 font-black uppercase text-sm">{room.healthOption} HP</div>
                    )}
                  </div>
                )}

                {isPartyMode && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                      <Zap className="w-3 h-3 text-yellow-500" /> TOTAL ROUNDS
                    </label>
                    {isLeader ? (
                      <Select value={room.maxRounds?.toString() || ''} onValueChange={(val) => updateSetting('maxRounds', parseInt(val))}>
                        <SelectTrigger className="bg-[#0a0a0b] border-none h-12 rounded-xl font-bold uppercase text-left">
                          <SelectValue placeholder="Select Rounds" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#161618] border-white/10 text-white">
                          <SelectItem value="5">5 ROUNDS</SelectItem>
                          <SelectItem value="10">10 ROUNDS</SelectItem>
                          <SelectItem value="15">15 ROUNDS</SelectItem>
                          <SelectItem value="20">20 ROUNDS</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="h-12 bg-[#0a0a0b] rounded-xl flex items-center px-4 font-black uppercase text-sm">{room.maxRounds || '---'} ROUNDS</div>
                    )}
                  </div>
                )}

                {isPartyMode && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                      <Clock className="w-3 h-3 text-cyan-500" /> TIME LIMIT
                    </label>
                    {isLeader ? (
                      <Select value={room.timePerRound?.toString() || ''} onValueChange={(val) => updateSetting('timePerRound', parseInt(val))}>
                        <SelectTrigger className="bg-[#0a0a0b] border-none h-12 rounded-xl font-bold uppercase text-left">
                          <SelectValue placeholder="Select Time" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#161618] border-white/10 text-white">
                          <SelectItem value="60">1 MINUTE</SelectItem>
                          <SelectItem value="120">2 MINUTES</SelectItem>
                          <SelectItem value="180">3 MINUTES</SelectItem>
                          <SelectItem value="300">5 MINUTES</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="h-12 bg-[#0a0a0b] rounded-xl flex items-center px-4 font-black uppercase text-sm">{room.timePerRound ? `${room.timePerRound / 60} MIN` : '---'}</div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-white/5">
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="w-4 h-4 text-secondary" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">RULES & HOW TO PLAY</span>
              </div>
              
              <ScrollArea className="h-32 rounded-2xl bg-white/5 p-4 border border-white/5">
                <div className="space-y-4 text-[10px] font-bold uppercase leading-relaxed text-slate-300">
                  {isPartyMode ? (
                    <>
                      <div className="flex items-start gap-2">
                        <Target className="w-3 h-3 text-primary shrink-0" />
                        <p>SCORE MAX <span className="text-white">100 POINTS</span> PER ROUND. POINTS DECREASE THE LONGER YOU TAKE TO GUESS.</p>
                      </div>
                      <div className="flex items-start gap-2">
                        <Zap className="w-3 h-3 text-primary shrink-0" />
                        <p>ALL <span className="text-white">5 HINTS REVEAL IN 10 SECONDS</span> (ONE EVERY 2S). BE FAST!</p>
                      </div>
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" />
                        <p>WRONG GUESSES DEDUCT <span className="text-red-500">30 POINTS</span>. (SCORE WON'T DROP BELOW 0).</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-3 h-3 text-red-500 shrink-0" />
                        <p>WRONG ANSWERS DEDUCT <span className="text-red-500">10 HP</span>. REACHING 0 HP ENDS THE MATCH.</p>
                      </div>
                      <div className="flex items-start gap-2">
                        <Clock className="w-3 h-3 text-primary shrink-0" />
                        <p>HINTS REVEAL EVERY <span className="text-white">5 SECONDS</span>. 15S TIMER STARTS AFTER FIRST GUESS.</p>
                      </div>
                      <div className="flex items-start gap-2">
                        <Info className="w-3 h-3 text-primary shrink-0" />
                        <p>SKIPPING AWARDS 0 POINTS BUT ENDS YOUR TURN FOR THE ROUND.</p>
                      </div>
                    </>
                  )}
                  <div className="flex items-start gap-2 border-t border-white/10 pt-2">
                    <Info className="w-3 h-3 text-secondary shrink-0" />
                    <p className="normal-case italic text-slate-400">Intelligent system: Minor typos are allowed based on name length. Try to get correct spellings if possible.</p>
                  </div>
                </div>
              </ScrollArea>
            </div>
          </CardContent>
        </Card>

        {isLeader ? (
          <Button onClick={startGame} disabled={participants.length < 2} className="w-full h-16 text-xl font-black bg-primary hover:bg-primary/90 shadow-2xl rounded-2xl uppercase group">
            <Play className="w-6 h-6 mr-2 group-hover:scale-110 transition-transform" /> START MATCH
          </Button>
        ) : (
          <div className="p-6 bg-muted/50 rounded-[2rem] flex items-center gap-4 text-muted-foreground border border-dashed border-white/10">
            <ShieldAlert className="w-8 h-8 text-primary animate-pulse" />
            <p className="text-[10px] font-black uppercase tracking-widest leading-relaxed text-center">
              WAITING FOR THE DUEL LEADER TO INITIATE THE MATCH...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
