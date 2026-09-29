'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { session } from '../lib/api';

export default function Nav() {
  const [role, setRole] = useState<string | null>(null);
  const [signed, setSigned] = useState(false);
  useEffect(() => {
    const sync = () => { setSigned(!!session.token()); setRole(session.role()); };
    sync();
    window.addEventListener('gl-auth', sync);
    return () => window.removeEventListener('gl-auth', sync);
  }, []);
  return (
    <nav className="nav" aria-label="Main">
      <Link href="/" className="brand">Glimmer</Link>
      <Link href="/">Library</Link>
      {role === 'author' && <Link href="/author">Write</Link>}
      {signed ? <Link href="/account">Account</Link> : <Link href="/login">Sign in</Link>}
    </nav>
  );
}
