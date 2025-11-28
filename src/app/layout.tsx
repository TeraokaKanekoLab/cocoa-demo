import React from 'react';

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
      <body>{children}</body>
    </html>
  );
}