// middleware.ts o middleware.js
import { NextResponse } from 'next/server';

export const config = {
  // Excluye recursos estáticos (_next) y el favicon para no pedir password por cada asset
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

export default function middleware(req, Request) {
  const expected = process.env.BASIC_AUTH_B64; // base64 de "usuario:password"
  if (!expected) return NextResponse.next();   // si no hay variable, no protege nada

  const { pathname } = new URL(req.url);
  if (pathname.startsWith('/api/students') || pathname.startsWith('/api/lessons')) {
    return NextResponse.next(); // deja pasar sin tu auth propia
  }

  const auth = req.headers.get('authorization') || '';
  const ok = auth === `Basic ${expected}`;

  if (ok) return NextResponse.next();

  return new NextResponse('Auth required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Horario Academia"' },
  });
}