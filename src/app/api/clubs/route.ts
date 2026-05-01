import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name');
  if (!name) return new NextResponse('No name provided', { status: 400 });

  const lowerName = name.toLowerCase();

  // Handle Icons & Retired
  if (lowerName === 'icons' || lowerName === 'icon' || lowerName.includes('icon') || lowerName === 'retired' || lowerName === 'free agent' || lowerName === 'deceased') {
    const isRetired = lowerName === 'retired' || lowerName === 'free agent';
    const text = isRetired ? 'RETIRED' : 'ICON';
    const bg = isRetired ? '#1a1a1a' : '#d4af37';
    const fg = isRetired ? '#ffffff' : '#000000';
    
    const svgIcon = `<svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
      <rect width="256" height="256" rx="32" fill="${bg}"/>
      <text x="128" y="140" font-family="Arial, sans-serif" font-weight="bold" font-style="italic" font-size="48" fill="${fg}" text-anchor="middle" alignment-baseline="middle">${text}</text>
    </svg>`;
    
    return new NextResponse(svgIcon, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=86400'
      }
    });
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
        matches = clubs.filter((c: any) => c.name.toLowerCase().includes(n));
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

