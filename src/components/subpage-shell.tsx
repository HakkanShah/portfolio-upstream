import Link from 'next/link';
import { ThemeToggle } from '@/components/theme-toggle';
import { JOB_TITLE, NAME } from '@/lib/seo';

/**
 * The frame for the standalone pages (/projects, /experience, /contact and
 * each project). Their links are real URLs, not #anchors, which is what
 * search engines turn into sitelinks under the main result.
 */
export const SITE_PAGES = [
    { href: '/projects', label: 'Projects' },
    { href: '/experience', label: 'Experience' },
    { href: '/experience#certifications', label: 'Certifications' },
    { href: '/contact', label: 'Contact' },
    { href: '/faq', label: 'FAQ' },
] as const;

export default function SubpageShell({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex min-h-screen flex-col bg-background">
            <header className="sticky top-0 z-40 border-b-4 border-foreground bg-background/95 backdrop-blur">
                <div className="section-container flex items-center justify-between gap-4 py-3">
                    <Link href="/" className="font-headline text-2xl sm:text-3xl tracking-wider text-primary shrink-0">
                        {NAME}
                    </Link>
                    <nav aria-label="Site" className="flex items-center gap-1 sm:gap-2 overflow-x-auto">
                        {SITE_PAGES.filter((page) => !page.href.includes('#') && page.href !== '/faq').map((page) => (
                            <Link
                                key={page.href}
                                href={page.href}
                                className="font-headline tracking-wide text-sm sm:text-base px-2 py-1 rounded hover:text-primary whitespace-nowrap"
                            >
                                {page.label}
                            </Link>
                        ))}
                        <ThemeToggle />
                    </nav>
                </div>
            </header>

            <main className="flex-1">{children}</main>

            <footer className="border-t-4 border-foreground bg-[#0a0a0a] py-8 text-sm text-gray-400">
                <div className="section-container flex flex-col items-center gap-4 text-center">
                    <nav aria-label="Pages" className="flex flex-wrap justify-center gap-x-5 gap-y-2">
                        <Link href="/" className="hover:text-primary">Home</Link>
                        {SITE_PAGES.map((page) => (
                            <Link key={page.href} href={page.href} className="hover:text-primary">
                                {page.label}
                            </Link>
                        ))}
                    </nav>
                    <p>
                        © {new Date().getFullYear()}{' '}
                        <Link href="/" className="text-white hover:text-primary">{NAME}</Link> · {JOB_TITLE}
                    </p>
                </div>
            </footer>
        </div>
    );
}
