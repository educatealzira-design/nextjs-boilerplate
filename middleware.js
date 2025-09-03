// middleware.js
import { NextResponse } from 'next/server';

const PUBLIC_API_PREFIXES = [
  '/api/students',
  '/api/lessons',   // incluye /api/lessons/by-month
  '/api/invoices',
];

export const config = {
  // protege todo excepto estáticos; las APIs públicas las dejamos pasar en el código
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

export default function middleware(req) {
  const path = new URL(req.url).pathname;

  // 1) Deja pasar sin auth tus APIs públicas
  if (PUBLIC_API_PREFIXES.some((p) => path.startsWith(p))) {
    return NextResponse.next();
  }

  // 2) Basic Auth para el resto
  const expected = process.env.BASIC_AUTH_B64; // base64 de "usuario:password"
  if (!expected) return NextResponse.next();

  const auth = req.headers.get('authorization') || '';
  if (auth === `Basic ${expected}`) return NextResponse.next();

  return new NextResponse('Auth required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Horario Academia"' },
  });
}
