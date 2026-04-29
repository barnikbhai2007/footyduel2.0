import { NextResponse } from 'next/server';

const SVG_ICON = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#FBBF24" stroke="black" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
</svg>
`;

const SVG_RETIRED = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#9CA3AF" stroke="#4B5563" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
  <circle cx="9" cy="7" r="4" />
  <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
</svg>
`;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name');
  if (!name) return new NextResponse('No name provided', { status: 400 });

  const lowerName = name.toLowerCase();

  // Handle Icons
  if (lowerName === 'icons' || lowerName === 'icon' || lowerName.includes('icon')) {
    return new NextResponse(SVG_ICON, { headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=86400' } });
  }

  // Handle Retired
  if (lowerName === 'retired' || lowerName === 'free agent' || lowerName === 'deceased') {
    return new NextResponse(SVG_RETIRED, { headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=86400' } });
  }

  try {
    const res = await fetch('https://api-football-logo.vercel.app/clubs.json');
    if (res.ok) {
      const clubs = await res.json();
      let n = name.trim().toLowerCase();

      // Aliases mapping
      const aliases: Record<string, string> = {
        'bayern munich': 'bayern munchen',
        'psg': 'paris saint germain',
        'paris sg': 'paris saint germain',
        'p.s.g.': 'paris saint germain',
        'manchester united': 'manchester united',
        'man united': 'manchester united',
        'man utd': 'manchester united',
        'ac milan': 'milan',
        'inter milan': 'inter',
        'spurs': 'tottenham hotspur',
        'tottenham': 'tottenham hotspur',
        'atm': 'atletico madrid',
        'atletico': 'atletico madrid',
        'real madrid cf': 'real madrid',
        'fc barcelona': 'barcelona',
        'sporting cp': 'sporting'
      };

      if (aliases[n]) {
        n = aliases[n];
      }

      // Prioritize Top Leagues
      const topCountries = ['england', 'spain', 'italy', 'germany', 'france', 'portugal', 'netherlands'];

      // First pass
      let matches = clubs.filter((c: any) => c.name.toLowerCase() === n || c.slug === n);
      
      if (matches.length === 0) {
        matches = clubs.filter((c: any) => c.name.toLowerCase().includes(n) || n.includes(c.name.toLowerCase()));
      }
      
      if (matches.length === 0) {
        const parts = n.split(' ');
        matches = clubs.filter((c: any) => parts.every(p => c.name.toLowerCase().includes(p)));
      }

      if (matches.length > 0) {
        matches.sort((a: any, b: any) => {
          const aTop = topCountries.includes(a.country?.toLowerCase()) ? 1 : 0;
          const bTop = topCountries.includes(b.country?.toLowerCase()) ? 1 : 0;
          return bTop - aTop;
        });
        
        const match = matches[0];
        if (match && match.logoUrl) {
          // Proxy the image to bypass hotlink protection (403 Forbidden)
          const imgRes = await fetch(match.logoUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
              'Referer': 'https://api-football-logo.vercel.app/'
            }
          });
          
          if (imgRes.ok) {
            const buffer = await imgRes.arrayBuffer();
            const contentType = imgRes.headers.get('content-type') || 'image/png';
            return new NextResponse(buffer, {
              headers: { 
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=86400' 
              }
            });
          }
        }
      }
    }
  } catch (e) {
    console.error("Failed to fetch clubs", e);
  }

  // Final fallback (generic shield emoji or avatar)
  return NextResponse.redirect(`https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff&size=256&bold=true`);
}

