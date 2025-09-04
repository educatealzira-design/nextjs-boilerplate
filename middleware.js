// middleware.js
import { NextResponse } from 'next/server';

// APLICAR A TODO (salimos dentro para API); no intentes excluir /api aquí.
export const config = {
  matcher: ['/:path*'],
};

export default function middleware(req) {
  // Usa nextUrl que es lo recomendado y evita sorpresas con URL()
  const { pathname } = req.nextUrl;

  // 🚪 SALIDA INMEDIATA para API y rutas técnicas
  if (
    pathname.startsWith('/api/') ||      // tus endpoints
    pathname === '/api' ||               // por si acaso
    pathname.startsWith('/_next/') ||    // estáticos Next
    pathname === '/favicon.ico' ||       // favicon
    /\.[a-z0-9]+$/i.test(pathname)       // ficheros con extensión (.js,.css,.png,…)
  ) {
    return NextResponse.next();
  }

  // 🔐 Basic Auth solo para PÁGINAS
  const expected = process.env.BASIC_AUTH_B64; // base64("usuario:password")
  if (!expected) return NextResponse.next();

  const auth = req.headers.get('authorization') || '';
  if (auth === `Basic ${expected}`) return NextResponse.next();

  return new NextResponse('Auth required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Horario Academia"' },
  });
}
