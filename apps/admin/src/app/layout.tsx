import type { Metadata } from 'next';
import { APP_NAME } from '@autogenius/constants';

export const metadata: Metadata = {
  title: `${APP_NAME} Admin`,
  description: 'AutoGenius administration console',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
