import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import SubpageShell from '@/components/subpage-shell';
import { PROFILE_PROSE } from '@/content/profile';
import { EDUCATION, EXPERIENCE, PROJECTS } from '@/lib/data';
import {
    CURRENT_ROLE,
    JOB_TITLE,
    LEGAL_NAME,
    NAME,
    OG_IMAGE,
    PERSON_ID,
    PROFILES,
    PROFILE_PHOTO,
    SITE_URL,
    WEBSITE_ID,
    persistProducts,
    projectSlug,
} from '@/lib/seo';

/**
 * About Hakkan, in his own words. "Who is Hakkan Shah?" is the question AI
 * answers and knowledge panels are built from, and they quote an about page
 * that answers it directly. Everything here comes from src/content/profile.ts
 * and data.ts; nothing is paraphrased into claims he didn't make.
 */

const DESCRIPTION = `${NAME} (${LEGAL_NAME}) is a ${JOB_TITLE} at ${CURRENT_ROLE.company} from Kolkata, India. How he got here, what he builds and what he believes about AI agents and product UI.`;

export const metadata: Metadata = {
    title: 'About',
    description: DESCRIPTION,
    alternates: { canonical: '/about' },
    openGraph: {
        type: 'profile',
        url: '/about',
        siteName: NAME,
        title: `About ${NAME}`,
        description: DESCRIPTION,
        images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: NAME }],
        firstName: 'Hakkan',
        lastName: 'Shah',
        username: 'HakkanShah',
    },
    twitter: { card: 'summary_large_image', title: `About ${NAME}`, description: DESCRIPTION, images: [OG_IMAGE], creator: '@HakkanShah' },
};

/** The paragraphs under one "# Heading" of the profile prose, minus his TODO notes. */
const proseSection = (heading: string): string[] => {
    const match = PROFILE_PROSE.split(/^# /m).find((part) => part.startsWith(heading));
    if (!match) return [];
    return match
        .slice(heading.length)
        .split(/\n\s*\n/)
        .map((p) => p.replace(/\s*\n\s*/g, ' ').trim())
        .filter((p) => p && !/^TODO\b/i.test(p));
};

export default function AboutPage() {
    const story = proseSection('Who I am');
    const beliefs = proseSection('Opinions and taste');
    const products = persistProducts();
    const degree = EDUCATION[0];
    const [, ...earlierRoles] = EXPERIENCE;

    // Only milestones the data actually dates.
    const timeline = [
        ...EDUCATION.slice()
            .reverse()
            .map((e) => ({ when: e.period, what: `${e.degree} — ${e.institution}`, detail: e.details })),
        { when: 'Before Persist', what: earlierRoles.map((r) => `${r.role}, ${r.company}`).join(' · '), detail: '' },
        { when: 'Feb 2026', what: `Won ${CURRENT_ROLE.company}'s Startupathon against 250+ builders and joined as a ${JOB_TITLE}`, detail: '' },
        { when: 'Now', what: `Building ${products.map((p) => p.title).join(' and ')} at ${CURRENT_ROLE.company}`, detail: CURRENT_ROLE.details.achievements.slice(-1)[0] ?? '' },
    ];

    const structuredData = {
        '@context': 'https://schema.org',
        '@type': 'AboutPage',
        '@id': `${SITE_URL}/about`,
        url: `${SITE_URL}/about`,
        name: `About ${NAME}`,
        description: DESCRIPTION,
        isPartOf: { '@id': WEBSITE_ID },
        mainEntity: { '@id': PERSON_ID },
        about: { '@id': PERSON_ID },
        primaryImageOfPage: `${SITE_URL}${PROFILE_PHOTO}`,
    };

    return (
        <SubpageShell>
            <article className="section-container py-10 sm:py-14">
                <div className="grid gap-8 md:grid-cols-[1fr_320px] md:items-start">
                    <div>
                        <h1 className="font-headline text-5xl sm:text-6xl md:text-7xl tracking-wider text-primary drop-shadow-[2px_2px_0_hsl(var(--foreground))]">
                            About {NAME}
                        </h1>
                        {/* The one-line answer first: what AI answers and snippets lift. */}
                        <p className="mt-5 text-lg sm:text-xl font-bold text-foreground">
                            {NAME} is a {JOB_TITLE} at {CURRENT_ROLE.company}, based in Kolkata, India. He builds AI agents that act on real
                            interfaces, the full stack systems behind them, and the product UI around them. He created{' '}
                            {products.map((p, i) => (
                                <span key={p.title}>
                                    {i > 0 ? ' and ' : ''}
                                    <Link href={`/projects/${projectSlug(p)}`} className="text-primary underline underline-offset-4">{p.title}</Link>
                                </span>
                            ))}
                            .
                        </p>

                        <section aria-labelledby="story" className="mt-10">
                            <h2 id="story" className="font-headline text-3xl sm:text-4xl tracking-wide text-primary">In his words</h2>
                            <div className="mt-3 space-y-4 text-base sm:text-lg leading-relaxed text-foreground/85">
                                {story.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                            </div>
                        </section>
                    </div>

                    <figure className="mx-auto w-64 md:w-full">
                        <div className="relative aspect-[3/4] overflow-hidden rounded-lg border-4 border-foreground shadow-[8px_8px_0_0_hsl(var(--foreground))]">
                            <Image src={PROFILE_PHOTO} alt={`${NAME}, ${JOB_TITLE}`} fill priority sizes="(max-width: 768px) 256px, 320px" className="object-cover" />
                        </div>
                        <figcaption className="mt-3 text-center text-sm text-muted-foreground">{NAME} · Kolkata, India</figcaption>
                    </figure>
                </div>

                <section aria-labelledby="timeline" className="mt-14">
                    <h2 id="timeline" className="font-headline text-3xl sm:text-4xl tracking-wide text-primary">Timeline</h2>
                    <ol className="mt-5 space-y-4 border-l-4 border-foreground pl-5">
                        {timeline.map((item) => (
                            <li key={item.when + item.what} className="relative">
                                <span aria-hidden="true" className="absolute -left-[30px] top-1.5 h-4 w-4 rounded-full border-4 border-foreground bg-primary" />
                                <p className="font-headline text-lg tracking-wide text-primary">{item.when}</p>
                                <p className="font-bold">{item.what}</p>
                                {item.detail ? <p className="text-sm text-muted-foreground">{item.detail}</p> : null}
                            </li>
                        ))}
                    </ol>
                </section>

                {beliefs.length ? (
                    <section aria-labelledby="beliefs" className="mt-14">
                        <h2 id="beliefs" className="font-headline text-3xl sm:text-4xl tracking-wide text-primary">What he believes</h2>
                        <div className="mt-5 grid gap-4 md:grid-cols-2">
                            {beliefs.map((belief) => (
                                <blockquote key={belief} className="rounded-lg border-2 border-foreground bg-muted/30 p-4 italic leading-relaxed text-foreground/85">
                                    {belief}
                                </blockquote>
                            ))}
                        </div>
                    </section>
                ) : null}

                <section aria-labelledby="elsewhere" className="mt-14">
                    <h2 id="elsewhere" className="font-headline text-3xl sm:text-4xl tracking-wide text-primary">Find him elsewhere</h2>
                    <ul className="mt-4 flex flex-wrap gap-3">
                        {PROFILES.map((profile) => (
                            <li key={profile.url}>
                                <a href={profile.url} target="_blank" rel="me noopener noreferrer" className="inline-block rounded border-2 border-foreground px-3 py-1.5 font-bold hover:bg-primary hover:text-primary-foreground">
                                    {profile.name}
                                </a>
                            </li>
                        ))}
                    </ul>
                    <p className="mt-6 text-foreground/85">
                        Studied {degree.degree} at {degree.institution} ({degree.details}). See{' '}
                        <Link href="/experience" className="font-bold text-primary underline underline-offset-4">his experience</Link>,{' '}
                        <Link href="/projects" className="font-bold text-primary underline underline-offset-4">all {PROJECTS.length} projects</Link>, or{' '}
                        <Link href="/contact" className="font-bold text-primary underline underline-offset-4">get in touch</Link>.
                    </p>
                </section>
            </article>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
        </SubpageShell>
    );
}
