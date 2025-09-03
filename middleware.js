// middleware.js
import { NextResponse } from 'next/server';

// Si usas i18n, pon aquí tus locales. Si no, déjalo vacío.
const LOCALES = ['es', 'ca', 'en']; // ajusta o deja []

export const config = {
  // No ejecutes middleware en /api/** ni en estáticos
  matcher: [
    // Excluye /api de forma explícita
    '/((?!api/|api$|_next/static|_next/image|favicon.ico).*)',
  ],
};

export default function middleware(req) {
  const { pathname } = req.nextUrl;

  // --- Extra por si hay i18n (/es/api/...):
  // Normaliza quitando el prefijo de locale
  const withoutLocale = pathname.replace(
    new RegExp(`^/(${LOCALES.join('|')})(?=/|$)`),
    ''
  );

  // Si tras quitar el locale empieza por /api -> NO aplicar middleware
  if (withoutLocale.startsWith('/api')) {
    return NextResponse.next();
  }

  // --- Basic Auth SOLO para el resto de rutas (páginas)
  const expected = process.env.BASIC_AUTH_B64; // base64 de "usuario:password"
  if (!expected) return NextResponse.next();

  const auth = req.headers.get('authorization') || '';
  if (auth === `Basic ${expected}`) return NextResponse.next();

  return new NextResponse('Auth required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Horario Academia"' },
  });
}
