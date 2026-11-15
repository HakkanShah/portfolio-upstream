import type { Metadata, Viewport } from 'next';
import { Suspense } from 'react';
import { Bangers, Comic_Neue } from "next/font/google";
import { Toaster } from "@/components/ui/toaster"
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import VisitorTracker from '@/components/visitor-tracker';

// Only the two families the design actually uses: Bangers via `font-headline`
// and Comic Neue via `font-body`. Everything else resolves to the system stack,
// so loading extra families only cost bandwidth.
const bangers = Bangers({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-bangers',
  display: 'swap',
});

const comicNeue = Comic_Neue({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-comic-neue',
  style: ['normal', 'italic'],
  display: 'swap',
});

const SITE_URL = 'https://hakkan.is-a.dev';
const NAME = 'Hakkan Shah';
const TITLE = 'Hakkan Shah – Full Stack AI Engineer & AI Agent Developer';
const DESCRIPTION =
  'Hakkan Shah is a Full Stack AI Engineer in India. He builds AI agents, LLM apps and full stack products with Next.js, TypeScript and Python. Creator of OHMSchool & AURA.';
const OG_IMAGE = '/og-hakkan-shah.jpg';

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#131211' },
    { media: '(prefers-color-scheme: light)', color: '#FFFDF5' },
  ],
};

// Icons come from the files next to this one (favicon.ico, icon.png,
// apple-icon.png): Next.js links them, and Google picks the favicon up
// from there. Its search results show it in a circle, so the source is round.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: `%s | ${NAME}`,
  },
  description: DESCRIPTION,
  manifest: '/manifest.webmanifest',
  keywords: [
    'Hakkan Shah',
    'Hakkan',
    'Hakkan Parbej Shah',
    'Full Stack AI Engineer',
    'AI Engineer',
    'Full Stack Engineer',
    'Full Stack Developer',
    'AI Agent Developer',
    'LLM Engineer',
    'Generative AI Engineer',
    'AI Engineer India',
    'Full Stack Developer India',
    'AI Engineer Kolkata',
    'Next.js Developer',
    'React Developer',
    'TypeScript Developer',
    'Node.js Developer',
    'Python Developer',
    'Persist',
    'OHMSchool',
    'AURA desktop agent',
    'Hakkan Shah portfolio',
  ],
  authors: [{ name: NAME, url: SITE_URL }],
  creator: NAME,
  publisher: NAME,
  category: 'technology',
  applicationName: NAME,
  appleWebApp: { title: NAME, capable: true, statusBarStyle: 'black-translucent' },
  formatDetection: { telephone: false, email: false, address: false },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: '/',
    // What Google and link previews show as the site's name instead of the domain.
    siteName: NAME,
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: 'Hakkan Shah — Full Stack AI Engineer at Persist, creator of OHMSchool and AURA',
        type: 'image/jpeg',
      },
    ],
    locale: 'en_US',
    type: 'profile',
    firstName: 'Hakkan',
    lastName: 'Shah',
    username: 'HakkanShah',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    creator: '@HakkanShah',
    images: [{ url: OG_IMAGE, alt: 'Hakkan Shah — Full Stack AI Engineer' }],
  },
  alternates: {
    canonical: '/',
  },
};

/**
 * Structured data for Google, as one graph:
 *   - WebSite: its `name` is what Google shows as the site name, in place of
 *     "is-a.dev".
 *   - ProfilePage + Person: marks this as the profile of one person, which
 *     is what Google uses for a personal site in name searches.
 */
const STRUCTURED_DATA = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: `${SITE_URL}/`,
      name: NAME,
      alternateName: ['Hakkan', 'Hakkan Shah Portfolio', 'Hakkan Parbej Shah'],
      description: DESCRIPTION,
      inLanguage: 'en',
      publisher: { '@id': `${SITE_URL}/#person` },
    },
    {
      '@type': 'ProfilePage',
      '@id': `${SITE_URL}/#profilepage`,
      url: `${SITE_URL}/`,
      name: TITLE,
      description: DESCRIPTION,
      inLanguage: 'en',
      isPartOf: { '@id': `${SITE_URL}/#website` },
      mainEntity: { '@id': `${SITE_URL}/#person` },
      primaryImageOfPage: { '@id': `${SITE_URL}/#profile-photo` },
      dateModified: new Date().toISOString(),
    },
    {
      '@type': 'Person',
      '@id': `${SITE_URL}/#person`,
      name: NAME,
      alternateName: ['Hakkan Parbej Shah', 'Hakkan'],
      givenName: 'Hakkan',
      familyName: 'Shah',
      url: `${SITE_URL}/`,
      image: {
        '@type': 'ImageObject',
        '@id': `${SITE_URL}/#profile-photo`,
        url: `${SITE_URL}/profile.jpg`,
        width: 1024,
        height: 1364,
        caption: 'Hakkan Shah',
      },
      jobTitle: 'Full Stack AI Engineer',
      description:
        'Full Stack AI Engineer at Persist, building AI agents that act on real interfaces, the full stack systems behind them, and the product UI that makes them feel obvious. Creator of OHMSchool and AURA.',
      email: 'mailto:hakkanparbej@gmail.com',
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Kolkata',
        addressRegion: 'West Bengal',
        addressCountry: 'IN',
      },
      nationality: { '@type': 'Country', name: 'India' },
      worksFor: {
        '@type': 'Organization',
        name: 'Persist',
        url: 'https://persist.org/',
      },
      hasOccupation: [
        {
          '@type': 'Occupation',
          name: 'Full Stack AI Engineer',
          occupationLocation: { '@type': 'Country', name: 'India' },
          skills: 'AI agents, LLM applications, RAG, Next.js, TypeScript, Node.js, Python, React',
        },
        { '@type': 'Occupation', name: 'AI Engineer' },
        { '@type': 'Occupation', name: 'Full Stack Engineer' },
      ],
      alumniOf: {
        '@type': 'CollegeOrUniversity',
        name: 'Greater Kolkata College of Engineering and Management',
      },
      award: "Winner, Persist Startupathon (Feb 2026) — chosen from 250+ builders",
      knowsAbout: [
        'Artificial Intelligence',
        'AI Agents',
        'Large Language Models',
        'Generative AI',
        'Retrieval-Augmented Generation',
        'Full Stack Web Development',
        'Next.js',
        'React',
        'TypeScript',
        'JavaScript',
        'Node.js',
        'Python',
        'Product UI/UX',
      ],
      sameAs: [
        'https://github.com/HakkanShah',
        'https://www.linkedin.com/in/hakkan/',
        'https://g.dev/hakkan',
        'https://hakkan.persist.org',
      ],
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${bangers.variable} ${comicNeue.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <Suspense fallback={null}>
            <VisitorTracker />
          </Suspense>
          {children}
          <Toaster />
        </ThemeProvider>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
        />
      </body>
    </html>
  );
}
