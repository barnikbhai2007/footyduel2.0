export interface Emote {
  id: string;
  name: string;
  url: string;
}

// Logic to swap the Rank One reward automatically at Season Reset (Monday 00:00 IST)
const getRankOneUrl = () => {
  const now = new Date();
  // Monday, March 2nd, 2026 00:00:00 IST
  const resetTime = new Date("2026-03-02T00:00:00+05:30");
  
  if (now < resetTime) {
    // Previous Season Reward
    return "https://res.cloudinary.com/speed-searches/image/upload/v1772133456/cdc25250-0b8d-4107-889b-4d62d403ea90_c85cm8.jpg";
  }
  // New Season Reward
  return "https://res.cloudinary.com/speed-searches/image/upload/v1772388463/5jhHZsR__400x400_zvxjsp.jpg";
};

export const ALL_EMOTES: Emote[] = [
  { id: 'neymar_cute', name: 'FAHHH', url: 'https://res.cloudinary.com/speed-searches/image/upload/v1772131957/Neymar_cute_hg3e2v.jpg' },
  { id: 'messi_laugh', name: 'BOTTLED', url: 'https://res.cloudinary.com/speed-searches/image/upload/v1772131957/2dc70f34-b7cf-45f1-9db0-7a7c667f11de_bx6ecv.jpg' },
  { id: 'shocked_meme', name: 'STUNNED', url: 'https://res.cloudinary.com/speed-searches/image/upload/v1772131957/938ec3b5-6b90-4687-8d41-9a942b2142f6_iuitgx.jpg' },
  { id: 'vini_dance', name: 'HEHE', url: 'https://res.cloudinary.com/speed-searches/image/upload/v1772131957/fc314786-bb10-47c8-83c0-6936cafeed57_pheirf.jpg' },
  { id: 'ronaldo_siu', name: 'FOCUS', url: 'https://res.cloudinary.com/speed-searches/image/upload/v1772131958/RONALDO_PP_w2sjfy.jpg' },
  { id: 'mbappe_cry', name: 'OKAY', url: 'https://res.cloudinary.com/speed-searches/image/upload/v1772131958/kylian_mbappe_ty41ip.jpg' },
  { id: 'jude_hey', name: 'HEY JUDE', url: 'https://res.cloudinary.com/speed-searches/image/upload/v1772131957/Jude_Bellingham_meme_afkxet.jpg' },
  // Quest Reward Emotes
  { id: 'ronaldo_platinum', name: 'PLATINUM CR7', url: 'https://res.cloudinary.com/speed-searches/image/upload/v1772133455/443f2796-0210-4f04-bb5b-2c7dd4c9129d_udofod.jpg' },
  { id: 'messi_diamond', name: 'DIAMOND LEO', url: 'https://res.cloudinary.com/speed-searches/image/upload/v1772133456/cdc25250-0b8d-4107-889b-4d62d403ea90_c85cm8.jpg' },
  { id: 'haaland_gold', name: 'GOLDEN VIKING', url: 'https://res.cloudinary.com/speed-searches/image/upload/v1772133456/crop-1665076_l1aszn.jpg' },
  { id: 'mbappe_silver', name: 'SILVER TURTLE', url: 'https://res.cloudinary.com/speed-searches/image/upload/v1772133455/960d6216f61adc051f2542fcacc8a37d_f2oyz5.jpg' },
  { id: 'neymar_master', name: 'MASTER NEY', url: 'https://res.cloudinary.com/speed-searches/image/upload/v1772133456/Neymar_Jr_meobwz.jpg' },
  { id: 'ten_wins', name: 'VICTORY ROYALE', url: 'https://res.cloudinary.com/speed-searches/image/upload/v1772162261/90e5cbf3-55d0-400f-8d55-85a53ac5412d_knnj7g.jpg' },
  { id: 'rank_one', name: 'SUPREME CHAMPION', url: getRankOneUrl() }
];

export const UNLOCKED_EMOTE_IDS = [
  'neymar_cute', 
  'messi_laugh', 
  'shocked_meme', 
  'vini_dance', 
  'ronaldo_siu', 
  'mbappe_cry', 
  'jude_hey'
];

export const DEFAULT_EQUIPPED_IDS = [
  'neymar_cute', 
  'messi_laugh', 
  'shocked_meme', 
  'vini_dance', 
  'ronaldo_siu', 
  'mbappe_cry'
];

export const QUEST_EMOTE_IDS = [
  'ronaldo_platinum',
  'messi_diamond',
  'haaland_gold',
  'mbappe_silver',
  'neymar_master',
  'ten_wins'
];

export const SEASON_REWARD_EMOTE_ID = 'rank_one';