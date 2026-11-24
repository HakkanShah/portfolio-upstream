import type { Metadata } from 'next';
import Link from 'next/link';
import SubpageShell from '@/components/subpage-shell';
import { ALL_LEGEND_TITLES, LEGEND_RANKINGS, LEGEND_TITLES } from '@/content/legend';
import { CURRENT_ROLE, JOB_TITLE, NAME, OG_IMAGE } from '@/lib/seo';

/**
 * The joke page. Indexable, so friends can Google the titles and land here,
 * but linked from nowhere on the site except the sitemap: it should not turn
 * up in the menus, the footer, or as a sitelink under his name for recruiters.
 */

const TITLE = `The Legend of ${NAME} – Khatarnaak, Gand Faad Developer of Kolkata`;
const DESCRIPTION = `${NAME}: self-declared best developer, software engineer and AI engineer in Kolkata, West Bengal and India. Khatarnaak developer, gand faad coder, gaand fata engineer, bhaukaal, fatafati, badass — certified by his friends.`;

export const metadata: Metadata = {
    title: { absolute: TITLE },
    description: DESCRIPTION,
    // Google ignores this tag; the words below on the page are what it reads.
    keywords: [...ALL_LEGEND_TITLES, 'Best Developer in Kolkata', 'Best AI Engineer in India', 'Best Software Engineer in West Bengal', NAME],
    alternates: { canonical: '/legend' },
    openGraph: {
        type: 'website',
        url: '/legend',
        siteName: NAME,
        title: `The Legend of ${NAME}`,
        description: 'Khatarnaak developer. Gand faad coder. Fatafati engineer. Certified by his friends.',
        images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: NAME }],
    },
    twitter: {
        card: 'summary_large_image',
        title: `The Legend of ${NAME}`,
        description: 'Khatarnaak developer. Gand faad coder. Fatafati engineer. Certified by his friends.',
        images: [OG_IMAGE],
    },
};

const STICKER_COLOURS = ['bg-[#FBDB0E] text-black', 'bg-primary text-primary-foreground', 'bg-accent text-accent-foreground', 'bg-background text-foreground'];

export default function LegendPage() {
    return (
        <SubpageShell>
            <div className="section-container py-10 sm:py-14">
                <p className="inline-block rotate-[-2deg] border-2 border-foreground bg-[#FBDB0E] px-3 py-1 font-headline text-sm tracking-widest text-black shadow-[3px_3px_0_0_hsl(var(--foreground))]">
                    Certified by his friends · Reviewed by nobody
                </p>
                <h1 className="mt-4 font-headline text-5xl sm:text-6xl md:text-7xl tracking-wider text-primary drop-shadow-[2px_2px_0_hsl(var(--foreground))]">
                    The Legend of {NAME}
                </h1>
                <p className="mt-4 max-w-2xl text-lg sm:text-xl text-foreground/90">
                    Officially a {JOB_TITLE} at {CURRENT_ROLE.company}. Unofficially, Kolkata&apos;s most khatarnaak developer, the gand
                    faad coder of West Bengal and — according to a jury of exactly one — the best AI engineer in India.
                </p>

                <section aria-labelledby="rankings" className="mt-12">
                    <h2 id="rankings" className="font-headline text-3xl sm:text-4xl tracking-wide text-primary">Official rankings</h2>
                    <p className="text-sm text-muted-foreground">Jury: himself. Appeals: not accepted.</p>
                    <ol className="mt-5 grid gap-3 sm:grid-cols-2">
                        {LEGEND_RANKINGS.map((rank) => (
                            <li key={rank.title} className="flex items-center justify-between gap-3 rounded-lg border-4 border-foreground bg-background p-4 shadow-[4px_4px_0_0_hsl(var(--foreground))]">
                                <span className="font-headline text-xl tracking-wide">
                                    <span className="text-primary">#1</span> {rank.title}
                                </span>
                                <span className="shrink-0 text-sm font-bold text-muted-foreground">{rank.status}</span>
                            </li>
                        ))}
                    </ol>
                </section>

                {LEGEND_TITLES.map((group) => (
                    <section key={group.language} aria-labelledby={`titles-${group.language}`} className="mt-14">
                        <h2 id={`titles-${group.language}`} className="font-headline text-3xl sm:text-4xl tracking-wide text-primary">
                            Titles in {group.language}
                        </h2>
                        <p className="text-sm text-muted-foreground">{group.note}</p>
                        <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {group.titles.map((item, index) => (
                                <li
                                    key={item.title}
                                    className={`rounded-lg border-4 border-foreground p-4 shadow-[4px_4px_0_0_hsl(var(--foreground))] ${STICKER_COLOURS[index % STICKER_COLOURS.length]} ${index % 2 ? 'rotate-[1deg]' : '-rotate-[1deg]'}`}
                                >
                                    <h3 className="font-headline text-2xl tracking-wide">{NAME}: {item.title}</h3>
                                    <p className="mt-1 text-sm opacity-90">{item.meaning}</p>
                                </li>
                            ))}
                        </ul>
                    </section>
                ))}

                <section className="mt-14 rounded-lg border-4 border-dashed border-foreground p-5">
                    <h2 className="font-headline text-2xl tracking-wide">Disclaimer</h2>
                    <p className="mt-2 text-foreground/85">
                        This page is a joke between friends. The serious version — the projects, the experience, the actual
                        engineering — is on the <Link href="/" className="font-bold text-primary underline underline-offset-4">portfolio</Link>.
                        (It&apos;s still khatarnaak.)
                    </p>
                </section>
            </div>
        </SubpageShell>
    );
}
