import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name');
  if (!name) return new NextResponse('No name provided', { status: 400 });

  if (name.toLowerCase() === 'icons' || name.toLowerCase() === 'icon' || name.toLowerCase().includes('icon')) {
    return NextResponse.redirect("https://fifaprizee.com/assets/cards/download_22/team_logos_256x256_L112658.png");
  }

  try {
    const res = await fetch('https://api-football-logo.vercel.app/clubs.json');
    if (res.ok) {
      const clubs = await res.json();
      const n = name.trim().toLowerCase();
      let match = clubs.find((c: any) => c.name.toLowerCase() === n || c.slug === n);
      if (!match) {
        match = clubs.find((c: any) => c.name.toLowerCase().includes(n) || n.includes(c.name.toLowerCase()));
      }
      if (match && match.logoUrl) {
        return NextResponse.redirect(match.logoUrl);
      }
    }
  } catch (e) {
    console.error("Failed to fetch clubs", e);
  }

  return NextResponse.redirect(`https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff&size=256&bold=true`);
}

