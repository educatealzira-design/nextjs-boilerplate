// middleware.js
import { NextResponse } from 'next/server';

// ⛔️ No ejecutes el middleware en /api/** (ni en estáticos)
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};

export default function middleware(req) {
  const { pathname } = new URL(req.url);

  // Cinturón y tirantes: si aun así entra, SAL de /api/**
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Basic Auth sólo para páginas (no API)
  const expected = process.env.BASIC_AUTH_B64; // base64 de "usuario:password"
  if (!expected) return NextResponse.next();

  const auth = req.headers.get('authorization') || '';
  if (auth === `Basic ${expected}`) return NextResponse.next();

  return new NextResponse('Auth required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Horario Academia"' },
  });
}
