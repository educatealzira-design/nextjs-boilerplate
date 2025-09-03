import { NextResponse } from 'next/server';

// ✅ No ejecutes el middleware en /api/** (ni en estáticos)
export const config = {
  matcher: [
    '/((?!api/|_next/static|_next/image|favicon.ico).*)',
  ],
};

export default function middleware(req) {
  const expected = process.env.BASIC_AUTH_B64; // base64 de "usuario:password"
  if (!expected) return NextResponse.next();   // si no hay variable, no protege nada

  const auth = req.headers.get('authorization') || '';
  if (auth === `Basic ${expected}`) return NextResponse.next();

  return new NextResponse('Auth required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Horario Academia"' },
  });
}