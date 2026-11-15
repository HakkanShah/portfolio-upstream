import type { Metadata, Viewport } from 'next';
import { Suspense } from 'react';
import { Bangers, Comic_Neue } from "next/font/google";
import { Toaster } from "@/components/ui/toaster"
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import VisitorTracker from '@/components/visitor-tracker';
import { HOME_DESCRIPTION, HOME_TITLE, NAME, OG_IMAGE, PERSON_ID, PROFILES, SITE_URL, WEBSITE_ID, personSchema } from '@/lib/seo';

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

const TITLE = HOME_TITLE;
const DESCRIPTION = HOME_DESCRIPTION;

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
 * Structured data true of every page: the website (its `name` is what Google
 * shows as the site name) and the person it belongs to (lib/seo.ts). Each
 * page adds its own: the home page's ProfilePage, project list and FAQ, a
 * project page's SoftwareApplication, and so on.
 */
const STRUCTURED_DATA = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': WEBSITE_ID,
      url: `${SITE_URL}/`,
      name: NAME,
      // Not the legal name: Google picked it as the site name when it was listed
      // here. It stays on the Person, where it belongs.
      alternateName: ['Hakkan Shah Portfolio', 'hakkan.is-a.dev'],
      description: DESCRIPTION,
      inLanguage: 'en',
      publisher: { '@id': PERSON_ID },
    },
    personSchema(),
  ],
};

/**
 * Starts the scroll reveals used by <AnimatedDiv> as soon as the HTML is
 * parsed, without waiting for React. It hides nothing itself: the
 * `reveal-ready` class that lets the CSS hide not-yet-seen sections is only
 * added when this script can also reveal them. Elements added later (the
 * "view more projects" list) are picked up by the MutationObserver.
 */
const REVEAL_SCRIPT = `(function(){
  if (!('IntersectionObserver' in window)) return;
  var root = document.documentElement;
  root.classList.add('reveal-ready');
  var io = new IntersectionObserver(function (entries) {
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].isIntersecting) {
        entries[i].target.setAttribute('data-revealed', '');
        io.unobserve(entries[i].target);
      }
    }
  }, { rootMargin: '0px 0px -50px 0px' });
  var seen = new WeakSet();
  function scan() {
    var els = document.querySelectorAll('[data-reveal]:not([data-revealed])');
    for (var i = 0; i < els.length; i++) {
      if (!seen.has(els[i])) { seen.add(els[i]); io.observe(els[i]); }
    }
  }
  new MutationObserver(scan).observe(root, { childList: true, subtree: true });
  scan();
})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: REVEAL_SCRIPT }} />
        {/* rel="me": the same person owns these profiles (IndieWeb identity,
            used by search engines and Mastodon-style verification). */}
        {PROFILES.map((profile) => (
          <link key={profile.url} rel="me" href={profile.url} />
        ))}
        {/* A plain-text summary for AI agents (llmstxt.org). */}
        <link rel="alternate" type="text/markdown" href="/llms.txt" title="Hakkan Shah — summary for AI agents" />
      </head>
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
