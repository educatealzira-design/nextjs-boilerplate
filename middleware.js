// middleware.js (o middleware.ts en la raíz del proyecto)
import { NextResponse } from 'next/server';

export const config = {
  // Excluye por completo /api/** del middleware (además de estáticos)
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};

export default function middleware(req) {
  const expected = process.env.BASIC_AUTH_B64; // base64 de "usuario:password"
  if (!expected) return NextResponse.next();

  const auth = req.headers.get('authorization') || '';
  if (auth === `Basic ${expected}`) return NextResponse.next();

  return new NextResponse('Auth required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Horario Academia"' },
  });
}
