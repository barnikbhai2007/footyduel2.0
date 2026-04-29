"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Trophy, Clock, Swords, CheckCircle2, Loader2, 
  PartyPopper, Smile, AlertTriangle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useFirestore, useUser, useDoc, useMemoFirebase, useCollection } from "@/firebase";
import { 
  doc, updateDoc, arrayUnion, 
  increment, collection, 
  query, orderBy, limit, addDoc, runTransaction, serverTimestamp, onSnapshot, setDoc 
} from "firebase/firestore";
import { FOOTBALLERS, Footballer, getRandomFootballer, getRandomRarity, RARITIES } from "@/lib/footballer-data";
import { ALL_EMOTES, DEFAULT_EQUIPPED_IDS, UNLOCKED_EMOTE_IDS } from "@/lib/emote-data";
import { validateAnswer } from "@/ai/flows/validate-answer-flow";
import { useSoundEffect } from "@/hooks/useSoundEffect";

type GameState = 'countdown' | 'playing' | 'finalizing' | 'reveal' | 'result';
type RevealStep = 'none' | 'flag-in' | 'flag-out' | 'position-in' | 'position-out' | 'club-in' | 'club-out' | 'white-flash' | 'card-in';

const REVEAL_CARD_IMG = "https://res.cloudinary.com/speed-searches/image/upload/v1772119870/photo_2026-02-26_20-32-22_cutwwy.jpg";

export default function GamePage() {
  const params = useParams();
  const roomId = params?.roomId as string;
  const router = useRouter();
  const { toast } = useToast();
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const { playSound } = useSoundEffect();

  const [hasInteracted, setHasInteracted] = useState(false);
  const videoDesktopRef = useRef<HTMLVideoElement>(null);
  const videoMobileRef = useRef<HTMLVideoElement>(null);

  const handleInteraction = () => {
    setHasInteracted(true);
    playSound('click');
    if (videoDesktopRef.current) {
      videoDesktopRef.current.muted = false;
    }
    if (videoMobileRef.current) {
      videoMobileRef.current.muted = false;
    }
  };
  
  const revealTriggered = useRef(false);
  const isInitializingRound = useRef(false);
  const lastProcessedRound = useRef<number>(0);
  const revealTimeouts = useRef<NodeJS.Timeout[]>([]);
  const previousGuessCount = useRef<number>(0);

  const roomRef = useMemoFirebase(() => {
    if (!user || !roomId) return null;
    return doc(db, "gameRooms", roomId);
  }, [db, roomId, user]);
  
  const { data: room, isLoading: isRoomLoading } = useDoc(roomRef);
  const { data: profile } = useDoc(useMemoFirebase(() => user ? doc(db, "userProfiles", user.uid) : null, [db, user]));

  const [gameState, setGameState] = useState<GameState>('countdown');
  const [revealStep, setRevealStep] = useState<RevealStep>('none');
  const [countdown, setCountdown] = useState(5);
  const [autoNextRoundCountdown, setAutoNextRoundCountdown] = useState<number | null>(null);
  const [targetPlayer, setTargetPlayer] = useState<Footballer | null>(null);
  const [visibleHints, setVisibleHints] = useState<number>(1);
  const [guessInput, setGuessInput] = useState("");
  const [isGuessing, setIsGuessing] = useState(false);
  const [roundTimer, setRoundTimer] = useState<number | null>(null);
  const [currentRarity, setCurrentRarity] = useState<any>(null);
  const [activeEmotes, setActiveEmotes] = useState<{id: string, emoteId: string, senderId: string, senderName: string, createdAt: number}[]>([]);
  const [showGameOverPopup, setShowGameOverPopup] = useState(false);
  const [gameOverTimer, setGameOverTimer] = useState(5);
  const [completedQuest, setCompletedQuest] = useState<any>(null);
  const [participantProfiles, setParticipantProfiles] = useState<Record<string, any>>({});
  
  const currentRoundNumber = room?.currentRoundNumber || 1;
  const currentRoundId = `round_${currentRoundNumber}`;
  
  const roundRef = useMemoFirebase(() => {
    if (!user || !roomId) return null;
    return doc(db, "gameRooms", roomId, "gameRounds", currentRoundId);
  }, [db, roomId, currentRoundId, user]);
  
  const { data: roundData, isLoading: isRoundLoading } = useDoc(roundRef);

  const emotesQuery = useMemoFirebase(() => {
    if (!roomId) return null;
    return query(collection(db, "gameRooms", roomId, "emotes"), orderBy("createdAt", "desc"), limit(5));
  }, [db, roomId]);
  const { data: recentEmotes } = useCollection(emotesQuery);

  useEffect(() => {
    if (!room?.participantIds) return;
    const unsubs = room.participantIds.map((uid: string) => 
      onSnapshot(doc(db, "userProfiles", uid), (snap) => {
        if (snap.exists()) {
          setParticipantProfiles(prev => ({ ...prev, [uid]: snap.data() }));
        }
      })
    );
    return () => unsubs.forEach(u => u());
  }, [room?.participantIds, db]);

  const checkAndUnlockQuest = useCallback(async (emoteId: string, questTitle: string) => {
    if (!user || !profile) return;
    const currentUnlocked = profile.unlockedEmoteIds || UNLOCKED_EMOTE_IDS;
    if (currentUnlocked.includes(emoteId)) return;

    try {
      const uRef = doc(db, "userProfiles", user.uid);
      await updateDoc(uRef, { unlockedEmoteIds: arrayUnion(emoteId) });
      const emote = ALL_EMOTES.find(e => e.id === emoteId);
      setCompletedQuest({ title: questTitle, emote });
      playSound('success');
    } catch (e) {}
  }, [user, profile, db, playSound]);

  useEffect(() => {
    if (gameState === 'result' || gameState === 'reveal' || gameState === 'finalizing') {
      if (activeEmotes.length > 0) setActiveEmotes([]);
      return;
    }

    if (recentEmotes && recentEmotes.length > 0) {
      const now = Date.now();
      const freshEmotesFromDb = recentEmotes
        .filter(e => {
          const createdAt = e.createdAt?.toMillis ? e.createdAt.toMillis() : (e.createdAt?.seconds ? e.createdAt.seconds * 1000 : now);
          return now - createdAt < 3000;
        })
        .map(e => ({ 
          id: e.id, 
          emoteId: e.emoteId, 
          senderId: e.senderId,
          senderName: participantProfiles[e.senderId]?.displayName || "PLAYER",
          createdAt: e.createdAt?.toMillis ? e.createdAt.toMillis() : (e.createdAt?.seconds ? e.createdAt.seconds * 1000 : now)
        }));
      
      setActiveEmotes(prev => {
        const existingIds = new Set(prev.map(p => p.id));
        const filtered = freshEmotesFromDb.filter(n => !existingIds.has(n.id));
        if (filtered.length === 0) return prev;
        
        filtered.forEach(emote => {
          if (emote.senderId !== user?.uid) {
            playSound('pop');
          }
          setTimeout(() => {
            setActiveEmotes(current => current.filter(item => item.id !== emote.id));
          }, 6000);
        });

        return [...prev, ...filtered];
      });
    }
  }, [recentEmotes, gameState, participantProfiles, user, playSound]);

  useEffect(() => {
    let timerId: NodeJS.Timeout;
    if (room?.status === 'Completed' && !showGameOverPopup) {
       setShowGameOverPopup(true);
       setGameOverTimer(5);
    }

    if (showGameOverPopup) {
      timerId = setInterval(() => {
        setGameOverTimer((prev) => {
          if (prev <= 1) {
            clearInterval(timerId);
            router.push(`/result/${roomId}`);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => { if (timerId) clearInterval(timerId); };
  }, [room?.status, roomId, router, showGameOverPopup]);

  useEffect(() => {
    if (roundData?.timerStartedAt && gameState === 'playing' && roundData.roundNumber === currentRoundNumber) {
      const startTime = new Date(roundData.timerStartedAt).getTime();
      let maxTime = 15;
      if (room?.mode === 'Party') {
        maxTime = room?.timePerRound === '30_after_guess' ? 30 : (room?.timePerRound || 60);
      } else if (room?.mode === '1v1' || room?.mode === 'Solo Leveling') {
        maxTime = 30;
      }
      
      const tick = () => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const remaining = Math.max(0, maxTime - elapsed);
        setRoundTimer(remaining);
        
        if (remaining <= 15 && remaining > 0 && !revealTriggered.current) {
          playSound('submit'); // play a sound tick
          // Add a red visual warning to body if not already there, we can do it via a state, but since we want it reactive we will do it below in rendering.
        }
        
        if (remaining === 0 && !revealTriggered.current) {
          handleRevealTrigger();
        }
      };
      tick();
      const interval = setInterval(tick, 1000);
      return () => clearInterval(interval);
    }
  }, [roundData?.timerStartedAt, gameState, currentRoundNumber, room?.timePerRound, room?.mode, playSound]);

  useEffect(() => {
    if (currentRoundNumber !== lastProcessedRound.current) {
      lastProcessedRound.current = currentRoundNumber;
      revealTriggered.current = false;
      isInitializingRound.current = false;
      revealTimeouts.current.forEach(t => clearTimeout(t));
      revealTimeouts.current = [];
      previousGuessCount.current = 0;
      setRevealStep('none');
      setGameState(currentRoundNumber === 1 ? 'countdown' : 'playing');
      setGuessInput("");
      setRoundTimer(null);
      setVisibleHints(1);
      setTargetPlayer(null);
      setAutoNextRoundCountdown(null);
      setActiveEmotes([]); 
      if (currentRoundNumber === 1) setCountdown(5);
    }
  }, [currentRoundNumber]);

  const startNewRoundLocally = useCallback(async () => {
    if (isInitializingRound.current || !room || !roundRef || !roomRef) return;
    isInitializingRound.current = true;

    try {
      await runTransaction(db, async (transaction) => {
        const roundSnap = await transaction.get(roundRef);
        if (roundSnap.exists()) return; 

        const roomSnap = await transaction.get(roomRef);
        if (!roomSnap.exists()) return;
        const roomData = roomSnap.data();

        const player = getRandomFootballer(roomData.usedFootballerIds || [], roomData.gameVersion || 'FDv1.0');
        const rarity = getRandomRarity();
        const now = new Date().toISOString();

        transaction.set(roundRef, {
          id: currentRoundId,
          gameRoomId: roomId,
          roundNumber: currentRoundNumber,
          footballerId: player.id,
          rarity: rarity.type,
          hintsRevealedCount: 1,
          guesses: {},
          roundEndedAt: null,
          timerStartedAt: (roomData.mode === 'Party' && roomData.timePerRound !== '30_after_guess') || roomData.mode === 'Solo Leveling' ? now : null,
          resultsProcessed: false,
          scoreChanges: {}
        });
        
        transaction.update(roomRef, { 
          usedFootballerIds: arrayUnion(player.id),
          lastActionAt: now
        });
      });
    } catch (err) {
      console.error("Round init conflict:", err);
    } finally {
      isInitializingRound.current = false;
    }
  }, [db, room, roomId, currentRoundId, currentRoundNumber, roundRef, roomRef]);

  useEffect(() => {
    if (room?.status === 'InProgress' && !roundData && !isRoundLoading && !isInitializingRound.current) {
      startNewRoundLocally();
    }
  }, [room?.status, roundData, isRoundLoading, startNewRoundLocally]);

  useEffect(() => {
    if (roundData && roundData.roundNumber === currentRoundNumber && (gameState === 'playing' || gameState === 'reveal')) {
      const player = FOOTBALLERS.find(f => f.id === roundData.footballerId);
      setTargetPlayer(player || null);
      
      const r = RARITIES.find(rarity => rarity.type === roundData.rarity);
      if (r) setCurrentRarity(r);
      
      const allParticipants = room?.participantIds || [];
      const guesses = roundData.guesses || {};
      
      // Feature: Check if someone guessed and play sound + popup
      const newGuessCount = Object.keys(guesses).length;
      if (newGuessCount > previousGuessCount.current) {
        // Find who guessed
        Object.keys(guesses).forEach(uid => {
          if (!previousGuessCount.current) return; // don't toaster if round just loaded it
          if (uid !== user?.uid && user && !participantProfiles[uid]?.hasGuessedBefore) {
             const userProfile = participantProfiles[uid];
             if (userProfile && guesses[uid]) {
                toast({ title: "ARENA ACTIVITY", description: `${userProfile.displayName || 'A PLAYER'} GUESSED/SKIPPED!`, duration: 2000 });
                playSound('pop'); 
             }
          }
        });
      }
      previousGuessCount.current = newGuessCount;

      const everyoneVoted = allParticipants.length > 0 && allParticipants.every((uid: string) => !!guesses[uid]);
      
      // Early Skip Logic for Party Mode: Everyone Locked In -> Skip Timer
      if (everyoneVoted && !revealTriggered.current && gameState === 'playing') {
        handleRevealTrigger();
      }
    }
  }, [roundData, gameState, currentRoundNumber, room?.participantIds, room?.mode]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (gameState === 'countdown' && countdown > 0) {
      timer = setTimeout(() => {
        playSound('pop');
        setCountdown(countdown - 1)
      }, 1000);
    } else if (gameState === 'countdown' && countdown === 0) {
      playSound('success');
      setGameState('playing');
    }
    
    if (gameState === 'playing' && targetPlayer && visibleHints < targetPlayer.hints.length) {
      const isParty = room?.mode === 'Party';
      const interval = isParty ? 2000 : 5000;
      timer = setTimeout(() => {
        playSound('pop');
        setVisibleHints(prev => prev + 1);
      }, interval);
    }
    return () => clearTimeout(timer);
  }, [gameState, countdown, visibleHints, targetPlayer, room?.mode, playSound]);

  useEffect(() => {
    if (gameState === 'result' && autoNextRoundCountdown === null) {
      // Play sound based on result
      const myGuess = roundData?.guesses?.[user?.uid || ""];
      if (myGuess?.isCorrect) playSound('success');
      else playSound('error');

      setAutoNextRoundCountdown(5);
    }

    let timer: NodeJS.Timeout;
    if (autoNextRoundCountdown !== null && autoNextRoundCountdown > 0) {
      timer = setTimeout(() => setAutoNextRoundCountdown(autoNextRoundCountdown - 1), 1000);
    } else if (autoNextRoundCountdown === 0) {
      handleNextRound();
    }
    return () => clearTimeout(timer);
  }, [gameState, autoNextRoundCountdown, roundData, user, playSound]);

  const handleGuess = async () => {
    if (!guessInput.trim() || !roundRef || !roundData || gameState !== 'playing' || revealTriggered.current || isGuessing || !user) return;
    
    playSound('submit');
    setIsGuessing(true);
    let isCorrect = false;
    
    if (targetPlayer) {
      try {
        const result = await validateAnswer({ correctName: targetPlayer.name, userGuess: guessInput });
        isCorrect = result.isCorrect;
      } catch (err) {
        console.error("Answer check failed:", err);
      }
    }
    
    const now = new Date().toISOString();
    const update: any = { [`guesses.${user.uid}`]: { text: guessInput, isCorrect, guessedAt: now } };
    
    if (!roundData.timerStartedAt && (room?.mode === '1v1' || (room?.mode === 'Party' && room?.timePerRound === '30_after_guess'))) {
      update.timerStartedAt = now;
    }
    
    await updateDoc(roundRef, update);
    if (roomRef) await updateDoc(roomRef, { lastActionAt: now });
    
    toast({ title: "DECISION LOCKED", description: `GUESS: ${guessInput.toUpperCase()}` });
    setIsGuessing(false);
  };

  const handleSkip = async () => {
    if (!roundRef || gameState !== 'playing' || revealTriggered.current || !user) return;
    playSound('submit');
    const now = new Date().toISOString();
    const update: any = { [`guesses.${user.uid}`]: { text: "SKIPPED", isCorrect: false, guessedAt: now } };
    
    if (!roundData?.timerStartedAt && (room?.mode === '1v1' || (room?.mode === 'Party' && room?.timePerRound === '30_after_guess'))) {
      update.timerStartedAt = now;
    }
    
    await updateDoc(roundRef, update);
    if (roomRef) await updateDoc(roomRef, { lastActionAt: now });
    toast({ title: "ROUND SKIPPED" });
  };

  const handleRevealTrigger = () => {
    if (revealTriggered.current) return;
    revealTriggered.current = true;
    setGameState('finalizing');
    const t = setTimeout(() => handleRevealSequence(), 2000);
    revealTimeouts.current.push(t);
  };

  const handleRevealSequence = async () => {
    setGameState('reveal');
    setRevealStep('none');
    setActiveEmotes([]); 
    
    if (user && targetPlayer) {
      const questCards = ["Cristiano Ronaldo", "Lionel Messi", "Erling Haaland", "Kylian Mbappe", "Neymar Jr"];
      const emoteIds = ["ronaldo_platinum", "messi_diamond", "haaland_gold", "mbappe_silver", "neymar_master"];
      const titles = ["CR7 EMOTE UNLOCKED", "MESSI EMOTE UNLOCKED", "HAALAND EMOTE UNLOCKED", "MBAPPE EMOTE UNLOCKED", "NEYMAR EMOTE UNLOCKED"];
      
      const cardIdx = questCards.indexOf(targetPlayer.name);
      if (cardIdx !== -1) checkAndUnlockQuest(emoteIds[cardIdx], titles[cardIdx]);
    }
    
    const steps = [
      { s: 'flag-in', t: 1800 },
      { s: 'flag-out', t: 2600 },
      { s: 'position-in', t: 3300 },
      { s: 'position-out', t: 4100 },
      { s: 'club-in', t: 4600 },
      { s: 'club-out', t: 5400 },
      { s: 'white-flash', t: 7000 },
      { s: 'card-in', t: 7600 }
    ];

    steps.forEach(step => {
      const t = setTimeout(() => setRevealStep(step.s as RevealStep), step.t);
      revealTimeouts.current.push(t);
    });
    
    const finalT = setTimeout(() => {
      setGameState('result');
      calculateRoundResults(); 
    }, 10000); 
    revealTimeouts.current.push(finalT);
  };

  const handleNextRound = async () => {
     if (!room || !roomRef) return;
     
     let isGameOver = false;
     if (room.mode === 'Party') {
       const maxRounds = room.maxRounds || 10;
       isGameOver = currentRoundNumber >= maxRounds;
     } else if (room.mode === 'Solo Leveling') {
       const p1 = room.participantIds?.[0];
       const currentScore = room.scores?.[p1] || 0;
       isGameOver = currentScore >= (room.soloGoal || 100);
     } else {
       isGameOver = room.player1CurrentHealth <= 0 || room.player2CurrentHealth <= 0;
     }

     if (isGameOver) {
       await updateDoc(roomRef, { status: 'Completed', finishedAt: new Date().toISOString() });
       return;
     }

     await runTransaction(db, async (transaction) => {
       const freshRoomSnap = await transaction.get(roomRef);
       if (!freshRoomSnap.exists()) return;
       const roomData = freshRoomSnap.data();
       
       if (roomData.currentRoundNumber === currentRoundNumber) {
         transaction.update(roomRef, { 
           currentRoundNumber: currentRoundNumber + 1,
           lastActionAt: new Date().toISOString()
         });
       }
     });
  };

  const calculateRoundResults = async () => {
    if (!roundData || !targetPlayer || !room || !roomRef || !roundRef) return;

    await runTransaction(db, async (transaction) => {
      const freshRoundSnap = await transaction.get(roundRef);
      const freshRoomSnap = await transaction.get(roomRef);
      
      if (!freshRoundSnap.exists() || !freshRoomSnap.exists()) return;
      const rData = freshRoundSnap.data();
      const rmData = freshRoomSnap.data();

      if (rData.resultsProcessed) return;

      const guesses = rData.guesses || {};
      const timerStart = new Date(rData.timerStartedAt || 0).getTime();
      let maxTimeSeconds = 15;
      if (rmData.mode === 'Party') {
        maxTimeSeconds = rmData.timePerRound === '30_after_guess' ? 30 : (rmData.timePerRound || 60);
      } else if (rmData.mode === '1v1' || rmData.mode === 'Solo Leveling') {
        maxTimeSeconds = 30;
      }
      const maxTime = maxTimeSeconds * 1000;
      
      const updates: any = { lastActionAt: new Date().toISOString() };
      const roundScoreChanges: Record<string, number> = {};

      const now = new Date();
      const resetPoint = new Date(now);
      const day = now.getUTCDay();
      resetPoint.setUTCDate(now.getUTCDate() - day);
      resetPoint.setUTCHours(18, 30, 0, 0);
      if (resetPoint > now) resetPoint.setUTCDate(resetPoint.getUTCDate() - 7);

      if (rmData.mode === 'Party') {
        const scores = { ...(rmData.scores || {}) };
        rmData.participantIds.forEach((uid: string) => {
          const g = guesses[uid];
          let pts = 0;
          if (g?.isCorrect) {
            const guessedAt = new Date(g.guessedAt).getTime();
            const elapsed = Math.max(0, guessedAt - timerStart);
            pts = Math.max(10, Math.round(100 * (1 - (elapsed / maxTime))));
          } else if (g && g.text !== "SKIPPED") {
            pts = -30;
          }
          scores[uid] = Math.max(0, (scores[uid] || 0) + pts);
          roundScoreChanges[uid] = pts;
        });
        updates.scores = scores;
      } else if (rmData.mode === 'Solo Leveling') {
        const p1 = rmData.participantIds[0];
        const g1 = guesses[p1];
        let pts = 0;
        if (g1?.isCorrect) {
          pts = 10;
        } else if (g1 && g1.text !== "SKIPPED") {
          pts = -5;
        } else if (!g1) {
          pts = -5; // time out is wrong
        }
        const scores = { ...(rmData.scores || {}) };
        scores[p1] = Math.max(0, (scores[p1] || 0) + pts);
        updates.scores = scores;
        roundScoreChanges[p1] = pts;
      } else {
        const p1 = rmData.participantIds[0];
        const p2 = rmData.participantIds[1];
        const g1 = guesses[p1];
        const g2 = guesses[p2];

        let s1 = g1?.isCorrect ? 10 : (g1?.text === "SKIPPED" || !g1 ? 0 : -10);
        let s2 = g2?.isCorrect ? 10 : (g2?.text === "SKIPPED" || !g2 ? 0 : -10);
        
        const diff = s1 - s2;
        let p1Health = rmData.player1CurrentHealth;
        let p2Health = rmData.player2CurrentHealth;
        
        if (diff > 0) p2Health = Math.max(0, p2Health - diff);
        else if (diff < 0) p1Health = Math.max(0, p1Health - Math.abs(diff));
        
        updates.player1CurrentHealth = p1Health;
        updates.player2CurrentHealth = p2Health;
        roundScoreChanges[p1] = s1;
        roundScoreChanges[p2] = s2;

        if (p1Health <= 0 || p2Health <= 0) {
          updates.status = 'Completed';
          updates.finishedAt = new Date().toISOString();
          const winnerId = p1Health > 0 ? p1 : (p2Health > 0 ? p2 : null);
          updates.winnerId = winnerId;
          updates.endReason = 'HP_DEPLETED';
          
          const h2hId = [p1, p2].sort().join('_');
          const h2hRef = doc(db, "battleHistories", h2hId);
          const h2hSnap = await transaction.get(h2hRef);
          
          if (!h2hSnap.exists()) {
            transaction.set(h2hRef, {
              id: h2hId,
              player1Id: p1,
              player2Id: p2,
              [p1 === winnerId ? 'player1Wins' : 'player2Wins']: 1,
              [p1 !== winnerId ? 'player1Wins' : 'player2Wins']: 0,
              totalMatches: 1
            });
          } else {
            transaction.update(h2hRef, {
              [uid === winnerId ? (uid === p1 ? 'player1Wins' : 'player2Wins') : '']: increment(1),
              totalMatches: increment(1)
            });
          }

          for (const uid of rmData.participantIds) {
            const pRef = doc(db, "userProfiles", uid);
            const pSnap = await transaction.get(pRef);
            if (!pSnap.exists()) continue;
            
            const pData = pSnap.data();
            const lastReset = pData.lastWeeklyReset ? new Date(pData.lastWeeklyReset) : new Date(0);
            
            const profileUpdate: any = {
              totalGamesPlayed: increment(1),
              lastLoginAt: now.toISOString()
            };

            if (lastReset < resetPoint) {
              profileUpdate.weeklyWins = (winnerId === uid ? 1 : 0);
              profileUpdate.lastWeeklyReset = now.toISOString();
            } else if (winnerId === uid) {
              profileUpdate.weeklyWins = increment(1);
              profileUpdate.totalWins = increment(1);
              profileUpdate.winStreak = increment(1);
            } else {
              profileUpdate.totalLosses = increment(1);
              profileUpdate.winStreak = 0;
            }
            
            transaction.update(pRef, profileUpdate);
          }
        }
      }
      
      transaction.update(roomRef, updates);
      transaction.update(roundRef, { 
        scoreChanges: roundScoreChanges,
        resultsProcessed: true,
        roundEndedAt: new Date().toISOString()
      });
    });
  };

  const handleForfeit = async () => {
    if (!roomRef || !user || !room || room.status !== 'InProgress') return;
    await updateDoc(roomRef, { 
      status: 'Completed', 
      finishedAt: new Date().toISOString(), 
      winnerId: room.participantIds.find(id => id !== user.uid), 
      endReason: 'FORFEIT' 
    });
  };

  const sendEmote = async (emoteId: string) => {
    if (!roomId || !user || gameState === 'result' || gameState === 'reveal') return; 
    await addDoc(collection(db, "gameRooms", roomId, "emotes"), { emoteId, senderId: user.uid, createdAt: serverTimestamp() });
  };

  if (isUserLoading || isRoomLoading || !room) return <div className="min-h-screen flex items-center justify-center bg-background"><Swords className="w-12 h-12 text-primary animate-spin" /></div>;

  if (!hasInteracted) {
    return (
      <div className="fixed inset-0 z-[9999] bg-[#0a0a0b] flex flex-col items-center justify-center space-y-6 p-6">
         <div className="relative">
           <Swords className="w-24 h-24 text-primary animate-bounce drop-shadow-[0_0_30px_rgba(249,115,22,0.8)]" />
           <div className="absolute inset-0 animate-ping opacity-50 rounded-full border border-primary/50"></div>
         </div>
         <h1 className="text-5xl md:text-6xl font-black text-white uppercase italic text-center tracking-tighter drop-shadow-2xl">ARENA READY</h1>
         <p className="text-sm font-black text-primary uppercase tracking-[0.3em]">TAP TO INITIALIZE AUDIO & ENTER</p>
         <Button onClick={handleInteraction} className="mt-8 h-16 w-full max-w-sm text-2xl font-black rounded-2xl bg-primary text-black hover:bg-primary/90 shadow-[0_0_40px_rgba(249,115,22,0.4)] hover:shadow-[0_0_60px_rgba(249,115,22,0.6)] transition-all">ENTER MATCH</Button>
      </div>
    );
  }

  const myGuess = roundData?.guesses?.[user?.uid || ""] || null;
  const iHaveGuessed = !!myGuess;
  const participantIds = room.participantIds || [];
  const guessedCount = Object.keys(roundData?.guesses || {}).length;

  const getFlagUrl = (code: string) => {
    const map: Record<string, string> = { 'en': 'gb-eng', 'eng': 'gb-eng', 'sc': 'gb-sct', 'sco': 'gb-sct', 'wa': 'gb-wls', 'wal': 'gb-wls', 'ni': 'gb-nir' };
    return `https://flagcdn.com/w640/${map[code.toLowerCase()] || code.toLowerCase()}.png`;
  };

  if (gameState === 'reveal') {
    return (
      <div className="fixed inset-0 z-50 bg-[#0a0a0a] flex flex-col items-center justify-center overflow-hidden font-sans">
        {/* Dynamic Backgrounds */}
        <video ref={videoDesktopRef} className="absolute inset-0 w-full h-full object-cover opacity-70 hidden md:block" playsInline autoPlay src="https://res.cloudinary.com/speed-searches/video/upload/v1777384239/Untitled_design_2_a65v9l.mp4" />
        <video ref={videoMobileRef} className="absolute inset-0 w-full h-full object-cover opacity-70 md:hidden" playsInline autoPlay src="https://res.cloudinary.com/speed-searches/video/upload/v1777384026/Untitled_Youtube_Shorts_uttq1h.mp4" />
        
        <div className="relative z-20 flex flex-col items-center justify-center w-full h-full p-6 text-center">
          
          {/* White Flash Effect */}
          <div className={`absolute inset-0 bg-white pointer-events-none transition-opacity duration-500 ease-in-out ${revealStep === 'white-flash' ? 'opacity-100' : 'opacity-0'}`} />

          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none w-full h-full p-4">
            
            {/* Flag */}
            <div className={`absolute transition-all duration-300 ease-in-out transform ${
              revealStep === 'flag-in' ? 'opacity-100 scale-100 blur-none' :
              revealStep === 'flag-out' ? 'opacity-0 scale-110 blur-sm' :
              'opacity-0 scale-90 blur-sm'
            }`}>
              {targetPlayer && <img src={getFlagUrl(targetPlayer.countryCode)} className="w-[80vw] max-w-[400px] shadow-[0_0_80px_rgba(255,255,255,1)]" alt="flag" />}
            </div>

            {/* Position */}
            <div className={`absolute transition-all duration-300 ease-in-out flex flex-col items-center justify-center ${
              revealStep === 'position-in' ? 'opacity-100 scale-100 blur-none' :
              revealStep === 'position-out' ? 'opacity-0 scale-110 blur-sm' :
              'opacity-0 scale-90 blur-sm'
            }`}>
              {targetPlayer && <span className="text-[140px] md:text-[220px] font-black italic uppercase text-yellow-400 drop-shadow-[0_0_100px_rgba(255,165,0,0.8)] tracking-tighter leading-none">{targetPlayer.position}</span>}
            </div>

            {/* Club */}
            <div className={`absolute transition-all duration-300 ease-in-out flex flex-col items-center justify-center ${
              revealStep === 'club-in' ? 'opacity-100 scale-100 blur-none' :
              revealStep === 'club-out' ? 'opacity-0 scale-110 blur-sm' :
              'opacity-0 scale-90 blur-sm'
            }`}>
              {targetPlayer && (
                <>
                  <div className="w-[40vw] max-w-[180px] aspect-square flex flex-col items-center justify-center overflow-hidden mb-6 filter drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)]">
                    <img src={`/api/clubs?name=${encodeURIComponent(targetPlayer.club)}`} className="w-full h-full object-contain" alt="club" />
                  </div>
                  <span className="text-[32px] md:text-[48px] font-black italic uppercase text-white drop-shadow-[0_0_30px_rgba(0,0,0,0.8)] tracking-tight max-w-[90vw] text-center leading-none">{targetPlayer.club}</span>
                </>
              )}
            </div>

          </div>
          
          {/* Final Card */}
          {revealStep === 'card-in' && currentRarity && targetPlayer && (
            <div className="relative z-50 animate-in fade-in zoom-in slide-in-from-bottom-20 duration-500 ease-out">
              <div className={`w-[260px] h-[380px] md:w-[320px] md:h-[480px] rounded-3xl shadow-[0_0_120px_rgba(0,0,0,0.9)] flex flex-col border-[4px] md:border-[6px] overflow-hidden relative bg-gradient-to-br ${currentRarity.bg} border-yellow-400/60`}>
                <img src={REVEAL_CARD_IMG} className="absolute inset-0 w-full h-full object-cover opacity-80 mix-blend-overlay" alt="background" />
                
                <div className="mt-auto relative z-20 pb-6 px-4 pt-16 flex flex-col h-full justify-end bg-gradient-to-t from-black/90 via-black/40 to-transparent">
                  
                  <div className="flex justify-between items-end mb-4">
                    <div className="flex flex-col gap-3">
                      <img src={getFlagUrl(targetPlayer.countryCode)} className="w-[48px] md:w-[56px] shadow-[0_0_30px_rgba(0,0,0,0.8)] border border-white/20" alt="flag" />
                      <div className="w-[48px] h-[48px] md:w-[56px] md:h-[56px] overflow-hidden flex items-center justify-center">
                        <img src={`/api/clubs?name=${encodeURIComponent(targetPlayer.club)}`} className="w-full h-full object-contain filter drop-shadow-md" alt="club" />
                      </div>
                    </div>
                    <span className="text-[70px] md:text-[90px] font-black italic text-yellow-400 drop-shadow-[0_0_50px_rgba(0,0,0,0.8)] leading-[0.8] tracking-tighter">{targetPlayer.position}</span>
                  </div>

                  <div className="bg-gradient-to-r from-transparent via-black/80 to-transparent py-3 border-y border-white/20 flex justify-center text-center w-[120%] -ml-[10%]">
                    <span className="text-[24px] md:text-[32px] font-black uppercase italic text-white leading-[0.9] tracking-tight">{targetPlayer.name}</span>
                  </div>

                </div>

              </div>
            </div>
          )}

        </div>
      </div>
    );
  }

  const winnerName = room?.winnerId ? participantProfiles[room.winnerId]?.displayName : "NOBODY";
  const endReasonText = room?.endReason === 'FORFEIT' ? 'OPPONENT FORFEITED' : 'TOTAL HP EXHAUSTED';

  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
      {roundTimer !== null && roundTimer <= 15 && roundTimer > 0 && (
         <div className="absolute inset-0 pointer-events-none bg-red-600/20 animate-[pulse_1s_ease-in-out_infinite] z-0 z-[1]" />
      )}
      
      {/* Ensure UI remains above the pulse */}
      <div className="relative z-10 flex flex-col flex-1 pointer-events-auto">
      {activeEmotes.map(emote => {
        const data = ALL_EMOTES.find(e => e.id === emote.emoteId);
        return (
          <div key={emote.id} className="fixed bottom-40 right-10 z-[60] flex flex-col items-center gap-1 emote-float pointer-events-none">
            <Badge className="bg-primary text-black text-[10px] font-black uppercase px-3 py-0.5 shadow-xl border-2 border-[#0a0a0b] scale-110">
              {emote.senderId === user?.uid ? "YOU" : emote.senderName}
            </Badge>
            <img src={data?.url} className="w-20 h-20 rounded-2xl shadow-2xl border-4 border-primary object-cover bg-black" alt="emote" />
          </div>
        );
      })}

      <Dialog open={!!completedQuest} onOpenChange={() => setCompletedQuest(null)}>
        <DialogContent className="bg-black/95 border-primary/20 p-8 text-center flex flex-col items-center gap-6 max-w-sm rounded-[3rem] overflow-hidden">
          <PartyPopper className="w-16 h-16 text-primary animate-bounce" />
          <h2 className="text-2xl font-black text-white uppercase">QUEST COMPLETE!</h2>
          <p className="text-primary text-sm font-black uppercase">{completedQuest?.title}</p>
          <Button onClick={() => setCompletedQuest(null)} className="w-full bg-primary text-black font-black uppercase rounded-2xl h-12">CLAIM REWARD</Button>
        </DialogContent>
      </Dialog>
      
      {showGameOverPopup && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500 backdrop-blur-2xl">
           <Trophy className="w-20 h-20 text-yellow-500 mb-6 animate-bounce" />
           <h2 className="text-5xl font-black text-white uppercase mb-2">MATCH ENDED</h2>
           <p className="text-primary text-2xl font-black uppercase mb-8 italic">{winnerName} VICTORIOUS</p>
           <Badge variant="outline" className="text-white border-white/20 uppercase mb-8 px-4 py-1">{endReasonText}</Badge>
           <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">REDIRECTING TO RESULTS IN {gameOverTimer}S...</p>
        </div>
      )}

      <header className="p-4 bg-card/60 backdrop-blur-xl border-b border-white/10 flex items-center justify-between sticky top-0 z-30">
        <div className="flex flex-col min-w-0 flex-1">
          {room.mode === '1v1' ? (
            <div className="space-y-1">
              <div className="flex justify-between items-center px-1"><span className="text-[8px] font-black uppercase truncate max-w-[60px]">{user?.displayName}</span><span className="text-[10px] font-black text-primary">{room.player1CurrentHealth} HP</span></div>
              <Progress value={room.player1CurrentHealth} className="h-1 bg-white/10" />
            </div>
          ) : (
            <div className="flex items-center gap-1.5 flex-wrap">
              {participantIds.map(uid => (
                <div key={uid} className={`relative shrink-0 transition-all duration-300 ${roundData?.guesses?.[uid] ? 'scale-110' : 'scale-90 opacity-50'}`}>
                  <img src={participantProfiles[uid]?.avatarUrl || `https://picsum.photos/seed/${uid}/100/100`} className={`w-7 h-7 rounded-full border-2 ${roundData?.guesses?.[uid] ? 'border-primary shadow-[0_0_10px_rgba(249,115,22,0.5)]' : 'border-white/10'}`} alt="p" />
                  {roundData?.guesses?.[uid] && <div className="absolute -top-1 -right-1 bg-primary text-black rounded-full p-0.5"><CheckCircle2 className="w-2 h-2" /></div>}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-col items-center gap-1 mx-4">
          <Badge className="bg-primary text-black font-black px-3 py-0.5 text-[10px] uppercase">RD {currentRoundNumber}</Badge>
          <button onClick={handleForfeit} className="text-[8px] text-red-500 font-black uppercase hover:underline">FORFEIT</button>
        </div>
        <div className="flex flex-col min-w-0 flex-1 items-end">
          {room.mode === '1v1' ? (
            <div className="space-y-1 w-full">
              <div className="flex justify-between items-center px-1"><span className="text-[10px] font-black text-primary">{room.player2CurrentHealth} HP</span><span className="text-[8px] font-black uppercase truncate max-w-[60px]">{participantProfiles[room.player2Id || ""]?.displayName || "WAITING..."}</span></div>
              <Progress value={room.player2CurrentHealth} className="h-1 bg-white/10" />
            </div>
          ) : (
            <div className="text-right">
              <p className="text-[8px] font-black text-slate-500 uppercase">LOCK-IN</p>
              <span className="text-sm font-black text-primary italic leading-none">{guessedCount}/{participantIds.length}</span>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 p-4 flex flex-col gap-6 max-w-lg mx-auto w-full pb-[280px] overflow-y-auto">
        {gameState === 'countdown' ? (
          <div className="flex-1 flex flex-col items-center justify-center space-y-4 p-4 text-center">
             <div className="text-[10rem] font-black text-primary animate-ping leading-none">{countdown}</div>
             <p className="text-2xl font-black uppercase tracking-widest text-white/90">PREPARE TO DUEL</p>
          </div>
        ) : gameState === 'finalizing' ? (
          <div className="flex-1 flex flex-col items-center justify-center space-y-6 text-center">
             <Swords className="w-16 h-16 text-primary animate-bounce" />
             <span className="text-3xl font-black text-white uppercase">DUEL LOCKDOWN</span>
             <p className="text-xs font-black text-primary uppercase tracking-widest">FINALISING INTELLIGENCE...</p>
          </div>
        ) : gameState === 'result' ? (
          <div className="flex-1 flex flex-col items-center justify-center p-4 space-y-8 animate-in fade-in zoom-in duration-500">
            <h2 className="text-4xl font-black text-white uppercase italic tracking-tighter">ROUND SUMMARY</h2>
            
            {room.mode === 'Party' ? (
              <ScrollArea className="w-full max-h-[40vh] bg-white/5 p-4 rounded-3xl border border-white/10 relative">
                <div className="space-y-3">
                  {(() => {
                    const currentScores: Record<string, number> = room.scores || {};
                    const scoreChanges: Record<string, number> = roundData?.scoreChanges || {};
                    
                    const oldScores = participantIds.map(uid => ({
                      uid, score: (currentScores[uid] || 0) - (scoreChanges[uid] || 0)
                    })).sort((a,b) => b.score - a.score);
                    
                    const newScores = participantIds.map(uid => ({
                      uid, score: (currentScores[uid] || 0)
                    })).sort((a,b) => b.score - a.score);
                    
                    const myRankIndex = newScores.findIndex(s => s.uid === user?.uid);
                    
                    return (
                      <>
                        {newScores.slice(0, 10).map(({ uid, score }, idx) => {
                          const oldIdx = oldScores.findIndex(s => s.uid === uid);
                          const rankChange = oldIdx - idx;
                          const scoreChange = scoreChanges[uid] || 0;
                          
                          return (
                            <div key={uid} className={`flex items-center justify-between p-3 rounded-2xl border ${uid === user?.uid ? 'bg-primary/20 border-primary shadow-lg' : 'bg-white/5 border-white/5'}`}>
                              <div className="flex items-center gap-3">
                                <span className="text-sm font-black text-slate-400 w-6">#{idx + 1}</span>
                                <span className="text-[10px] font-black text-white uppercase truncate max-w-[100px]">{uid === user?.uid ? "YOU" : (participantProfiles[uid]?.displayName || "OPPONENT")}</span>
                                {rankChange !== 0 && (
                                  <span className={`text-[10px] font-black animate-pulse ${rankChange > 0 ? "text-green-500" : "text-red-500"}`}>
                                    {rankChange > 0 ? "▲" : "▼"}{Math.abs(rankChange)}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge className={`${scoreChange > 0 ? "bg-green-500" : (scoreChange < 0 ? "bg-red-500" : "bg-slate-700")} text-white font-black text-[10px]`}>
                                  {scoreChange > 0 ? "+" : ""}{scoreChange}
                                </Badge>
                                <span className="text-sm font-black text-primary w-12 text-right">{score}</span>
                              </div>
                            </div>
                          );
                        })}
                        {myRankIndex >= 10 && user && (
                          <div className="pt-2 mt-2 border-t border-white/10 sticky bottom-0 bg-black/60 shadow-[0_-10px_20px_rgba(0,0,0,0.5)] z-10 backdrop-blur-md p-2 -mx-2 rounded-xl">
                            <div className="flex items-center justify-between p-3 rounded-2xl border bg-primary/20 border-primary shadow-lg">
                              <div className="flex items-center gap-3">
                                <span className="text-sm font-black text-primary w-6">#{myRankIndex + 1}</span>
                                <span className="text-[10px] font-black text-white uppercase truncate max-w-[100px]">YOU</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge className={`${(scoreChanges[user.uid] || 0) > 0 ? "bg-green-500" : ((scoreChanges[user.uid] || 0) < 0 ? "bg-red-500" : "bg-slate-700")} text-white font-black text-[10px]`}>
                                  {(scoreChanges[user.uid] || 0) > 0 ? "+" : ""}{scoreChanges[user.uid] || 0}
                                </Badge>
                                <span className="text-sm font-black text-primary w-12 text-right">{newScores[myRankIndex].score}</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </ScrollArea>
            ) : (
              <ScrollArea className="w-full max-h-[40vh] bg-white/5 p-4 rounded-3xl border border-white/10">
                <div className="space-y-3">
                  {participantIds
                    .map(uid => ({ uid, scoreChange: roundData?.scoreChanges?.[uid] ?? 0 }))
                    .sort((a, b) => b.scoreChange - a.scoreChange)
                    .slice(0, 10)
                    .map(({ uid, scoreChange }) => (
                      <div key={uid} className={`flex items-center justify-between p-3 rounded-2xl border ${uid === user?.uid ? 'bg-primary/20 border-primary' : 'bg-white/5 border-white/5'}`}>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-black text-white uppercase truncate max-w-[100px]">{uid === user?.uid ? "YOU" : (participantProfiles[uid]?.displayName || "OPPONENT")}</span>
                        </div>
                        <Badge className={`${scoreChange > 0 ? "bg-green-500" : (scoreChange < 0 ? "bg-red-500" : "bg-slate-700")} text-white font-black`}>
                          {scoreChange > 0 ? "+" : ""}{scoreChange} {room.mode === 'Party' ? 'PTS' : 'HP'}
                        </Badge>
                      </div>
                    ))
                  }
                </div>
              </ScrollArea>
            )}

            <div className="w-full bg-white/5 p-8 rounded-[2.5rem] border border-white/10 flex flex-col items-center text-center gap-4">
              <p className="text-5xl font-black text-white uppercase tracking-tighter italic">{targetPlayer?.name}</p>
              {targetPlayer && (
                <div className="flex gap-4 items-center">
                  <img src={getFlagUrl(targetPlayer.countryCode)} className="w-16 h-10 shadow-[0_0_15px_rgba(255,255,255,0.2)] border border-white/20 rounded-md object-cover" alt="flag" />
                  <img src={`/api/clubs?name=${encodeURIComponent(targetPlayer.club)}`} className="w-12 h-12 object-contain drop-shadow-md" alt="club" />
                </div>
              )}
            </div>
            <div className="w-full space-y-2">
              <Progress value={(autoNextRoundCountdown || 0) * 20} className="h-1.5 bg-white/10" />
              <p className="text-[8px] font-black text-center text-slate-500 uppercase tracking-widest">NEXT ROUND IN {autoNextRoundCountdown}S...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" /> SCOUTING REPORTS
              </h3>
              {roundTimer !== null && (
                <Badge className="bg-red-500 text-white font-black animate-pulse">{roundTimer}S</Badge>
              )}
            </div>
            <div className="space-y-3">
              {!targetPlayer ? (
                <div className="flex flex-col items-center justify-center p-12 opacity-50">
                  <Loader2 className="w-8 h-8 animate-spin text-primary mb-2" />
                  <p className="text-[10px] font-black uppercase">Loading Intelligence...</p>
                </div>
              ) : (
                targetPlayer.hints.slice(0, visibleHints).map((hint, idx) => (
                  <div key={idx} className="bg-card/80 backdrop-blur-md p-4 rounded-2xl border border-white/10 shadow-xl animate-in slide-in-from-bottom-2">
                    <p className="text-sm font-bold text-white/90 leading-relaxed">"{hint}"</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>

      <footer className="fixed bottom-0 left-0 right-0 p-6 bg-black/80 backdrop-blur-3xl border-t border-white/10 z-40">
        <div className="max-w-lg mx-auto w-full space-y-4">
          <div className="flex justify-center gap-2">
            {(profile?.equippedEmoteIds || DEFAULT_EQUIPPED_IDS).map(eid => {
              const emote = ALL_EMOTES.find(e => e.id === eid);
              return (
                <button key={eid} onClick={() => sendEmote(eid)} className="hover:scale-110 transition-transform">
                  <img src={emote?.url} className="w-10 h-10 rounded-lg object-cover border border-white/10" alt="emote" />
                </button>
              );
            })}
          </div>

          {iHaveGuessed && gameState === 'playing' ? (
            <div className="flex items-center gap-4 bg-green-500/10 px-6 py-4 rounded-2xl border border-green-500/30">
              <CheckCircle2 className="w-7 h-7 text-green-500" />
              <p className="text-xs font-black text-green-400 uppercase tracking-widest leading-tight">
                DECISION LOCKED.<br/><span className="opacity-70">WAITING FOR OTHERS...</span>
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <Input placeholder="TYPE PLAYER NAME..." className="h-14 bg-white/5 border-white/10 font-black tracking-widest text-white text-center uppercase text-base rounded-2xl" value={guessInput} onChange={(e) => setGuessInput(e.target.value)} disabled={iHaveGuessed || gameState !== 'playing' || isGuessing} />
              {isGuessing && <div className="flex items-center justify-center py-2"><Loader2 className="w-4 h-4 animate-spin text-primary mr-2" /><span className="text-[8px] font-black uppercase text-primary">VALIDATING...</span></div>}
              <div className="flex gap-2">
                <Button onClick={handleGuess} disabled={iHaveGuessed || gameState !== 'playing' || !guessInput.trim() || isGuessing} className="flex-1 h-12 rounded-xl bg-primary text-black font-black uppercase text-xs">LOCK in GUESS</Button>
                <Button onClick={handleSkip} variant="outline" disabled={iHaveGuessed || gameState !== 'playing' || isGuessing} className="w-24 h-12 rounded-xl border-white/10 bg-white/5 text-xs font-black uppercase">SKIP</Button>
              </div>
            </div>
          )}
        </div>
      </footer>
      </div>
    </div>
  );
}
