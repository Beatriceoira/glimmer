import './globals.css';
import Link from 'next/link';
import Nav from './nav';

export const metadata = { title: 'Glimmer: Interactive Fanfic', description: 'Read stories where your choices, and your own words, steer the plot.' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Nav />
        {children}
        <footer>
          <Link href="/terms">Terms and conditions</Link>
          <Link href="/privacy">Privacy policy</Link>
        </footer>
      </body>
    </html>
  );
}
