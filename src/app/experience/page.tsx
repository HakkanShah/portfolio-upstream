import type { Metadata } from 'next';
import Link from 'next/link';
import { Award, Briefcase, ExternalLink, FileText, GraduationCap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import SubpageShell from '@/components/subpage-shell';
import { CERTIFICATIONS, EDUCATION, EXPERIENCE, SKILLS } from '@/lib/data';
import { CURRENT_ROLE, JOB_TITLE, NAME, PERSON_ID, SITE_URL, WEBSITE_ID, OG_IMAGE } from '@/lib/seo';

/**
 * His full experience on one page. On the home page most of this sits inside
 * dialogs that are only rendered on click, so it never reached search
 * engines; here every role, skill, degree and certificate is in the HTML.
 */

const TITLE = `Experience, Skills & Certifications – ${NAME}`;
const DESCRIPTION = `${NAME}: ${JOB_TITLE} at ${CURRENT_ROLE.company}, earlier at ${EXPERIENCE.slice(1).map((r) => r.company.split(/\s+(?:india|pvt)\b/i)[0]).join(' and ')}. Skills, B.Tech CSE and ${CERTIFICATIONS.length} certifications.`;

export const metadata: Metadata = {
    title: 'Experience & Certifications',
    description: DESCRIPTION,
    alternates: { canonical: '/experience' },
    // A page's openGraph replaces the layout's, so the share image is repeated here.
    openGraph: { type: 'profile', url: '/experience', siteName: NAME, title: TITLE, description: DESCRIPTION, images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: NAME }] },
    twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, images: [OG_IMAGE], creator: '@HakkanShah' },
};

const Heading = ({ id, icon: Icon, children }: { id: string; icon: typeof Briefcase; children: React.ReactNode }) => (
    <h2 id={id} className="flex scroll-mt-24 items-center gap-3 font-headline text-4xl sm:text-5xl tracking-wider text-primary">
        <Icon className="h-8 w-8" aria-hidden="true" /> {children}
    </h2>
);

export default function ExperiencePage() {
    const structuredData = {
        '@context': 'https://schema.org',
        '@type': 'ProfilePage',
        '@id': `${SITE_URL}/experience`,
        url: `${SITE_URL}/experience`,
        name: TITLE,
        description: DESCRIPTION,
        isPartOf: { '@id': WEBSITE_ID },
        mainEntity: { '@id': PERSON_ID },
    };

    return (
        <SubpageShell>
            <div className="section-container py-10 sm:py-14">
                <h1 className="font-headline text-5xl sm:text-6xl md:text-7xl tracking-wider text-primary drop-shadow-[2px_2px_0_hsl(var(--foreground))]">
                    Experience
                </h1>
                <p className="mt-4 max-w-2xl text-base sm:text-lg text-foreground/85">
                    {NAME} is a {JOB_TITLE} at {CURRENT_ROLE.company}. {CURRENT_ROLE.description}
                </p>
                <nav aria-label="On this page" className="mt-6 flex flex-wrap gap-2">
                    {[['#roles', 'Roles'], ['#skills', 'Skills'], ['#education', 'Education'], ['#certifications', 'Certifications']].map(([href, label]) => (
                        <a key={href} href={href} className="rounded border-2 border-foreground px-3 py-1 font-headline tracking-wide hover:bg-primary hover:text-primary-foreground">
                            {label}
                        </a>
                    ))}
                </nav>

                <section aria-labelledby="roles" className="mt-12">
                    <Heading id="roles" icon={Briefcase}>Roles</Heading>
                    <div className="mt-6 space-y-8">
                        {EXPERIENCE.map((role) => (
                            <article key={role.company} className="rounded-lg border-4 border-foreground bg-background p-5 sm:p-6 shadow-[4px_4px_0_0_hsl(var(--foreground))]">
                                <header className="flex flex-wrap items-baseline justify-between gap-2">
                                    <h3 className="font-headline text-2xl sm:text-3xl tracking-wide">
                                        {role.role} <span className="text-primary">@ {role.company}</span>
                                    </h3>
                                    <span className="font-bold text-muted-foreground">{role.period}</span>
                                </header>
                                <p className="mt-3 text-foreground/85">{role.details.overview}</p>

                                <h4 className="mt-5 font-headline text-xl tracking-wide">What he did</h4>
                                <ul className="mt-2 list-disc space-y-1.5 pl-5 text-foreground/85">
                                    {role.details.responsibilities.map((item) => <li key={item}>{item}</li>)}
                                </ul>

                                <h4 className="mt-5 font-headline text-xl tracking-wide">Results</h4>
                                <ul className="mt-2 list-disc space-y-1.5 pl-5 text-foreground/85">
                                    {role.details.achievements.map((item) => <li key={item}>{item}</li>)}
                                </ul>

                                <div className="mt-5 flex flex-wrap gap-1.5" aria-label="Stack">
                                    {role.details.technologies.map((tech) => (
                                        <Badge key={tech} variant="secondary" className="border border-foreground/30">{tech}</Badge>
                                    ))}
                                </div>

                                {role.profileUrl || role.offerLetter ? (
                                    <p className="mt-5 flex flex-wrap gap-4">
                                        {role.profileUrl ? (
                                            <a href={role.profileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-bold text-primary hover:text-accent">
                                                <ExternalLink className="h-4 w-4" /> {role.profileLabel ?? 'Profile'}
                                            </a>
                                        ) : null}
                                        {role.offerLetter ? (
                                            <a href={role.offerLetter} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-bold text-primary hover:text-accent">
                                                <FileText className="h-4 w-4" /> Offer letter
                                            </a>
                                        ) : null}
                                    </p>
                                ) : null}
                            </article>
                        ))}
                    </div>
                </section>

                <section aria-labelledby="skills" className="mt-14">
                    <Heading id="skills" icon={Award}>Skills</Heading>
                    <dl className="mt-6 grid gap-4 sm:grid-cols-2">
                        {SKILLS.map((group) => (
                            <div key={group.name} className="rounded-lg border-2 border-foreground p-4">
                                <dt className="font-headline text-xl tracking-wide text-primary">{group.name}</dt>
                                <dd className="mt-2 text-foreground/85">{group.skills.map((skill) => skill.name).join(' · ')}</dd>
                            </div>
                        ))}
                    </dl>
                </section>

                <section aria-labelledby="education" className="mt-14">
                    <Heading id="education" icon={GraduationCap}>Education</Heading>
                    <ul className="mt-6 space-y-4">
                        {EDUCATION.map((edu) => (
                            <li key={edu.degree} className="rounded-lg border-2 border-foreground p-4">
                                <h3 className="font-bold text-lg text-primary">{edu.degree} · {edu.period}</h3>
                                <p className="text-foreground/85">{edu.institution}</p>
                                <p className="text-sm font-bold">{edu.details}</p>
                            </li>
                        ))}
                    </ul>
                </section>

                <section aria-labelledby="certifications" className="mt-14">
                    <Heading id="certifications" icon={Award}>Certifications</Heading>
                    <ul className="mt-6 grid gap-4 sm:grid-cols-2">
                        {CERTIFICATIONS.map((cert) => (
                            <li key={cert.name} className="rounded-lg border-2 border-foreground p-4">
                                <h3 className="font-bold text-lg">{cert.name}</h3>
                                <p className="text-sm text-muted-foreground">{cert.issuer}</p>
                                <a href={cert.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:text-accent">
                                    <ExternalLink className="h-4 w-4" /> View certificate
                                </a>
                            </li>
                        ))}
                    </ul>
                </section>

                <p className="mt-14">
                    <Link href="/contact" className="font-headline text-2xl tracking-wide text-primary underline underline-offset-4 hover:text-accent">
                        Want to work with him? Get in touch →
                    </Link>
                </p>
            </div>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
        </SubpageShell>
    );
}
