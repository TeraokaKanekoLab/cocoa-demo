import React from 'react';
import './globals.css';

export const metadata = {
  title: 'Demo App',
  description: 'Next.js with C++ Backend',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-slate-50 text-slate-900">
        {children}
      </body>
    </html>
  );
}