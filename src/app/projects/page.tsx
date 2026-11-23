import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import SubpageShell from '@/components/subpage-shell';
import { PROJECTS } from '@/lib/data';
import { CURRENT_ROLE, JOB_TITLE, NAME, PERSON_ID, SITE_URL, WEBSITE_ID, isPersistProduct, persistProductNames, projectListSchema, projectSlug, OG_IMAGE } from '@/lib/seo';

const TITLE = `Projects by ${NAME}`;
const DESCRIPTION = `All ${PROJECTS.length} projects by ${NAME}, ${JOB_TITLE}: ${PROJECTS.slice(0, 4).map((p) => p.title).join(', ')} and more — AI agents, full stack web apps, Android and developer tools.`;

export const metadata: Metadata = {
    title: 'Projects',
    description: DESCRIPTION,
    alternates: { canonical: '/projects' },
    // A page's openGraph replaces the layout's, so the share image is repeated here.
    openGraph: { type: 'website', url: '/projects', siteName: NAME, title: TITLE, description: DESCRIPTION, images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: NAME }] },
    twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, images: [OG_IMAGE], creator: '@HakkanShah' },
};

export default function ProjectsPage() {
    const structuredData = {
        '@context': 'https://schema.org',
        '@graph': [
            {
                '@type': 'CollectionPage',
                '@id': `${SITE_URL}/projects`,
                url: `${SITE_URL}/projects`,
                name: TITLE,
                description: DESCRIPTION,
                isPartOf: { '@id': WEBSITE_ID },
                author: { '@id': PERSON_ID },
                mainEntity: { '@id': `${SITE_URL}/#projects` },
            },
            projectListSchema(),
        ],
    };

    return (
        <SubpageShell>
            <div className="section-container py-10 sm:py-14">
                <h1 className="font-headline text-5xl sm:text-6xl md:text-7xl tracking-wider text-primary drop-shadow-[2px_2px_0_hsl(var(--foreground))]">
                    Projects
                </h1>
                <p className="mt-4 max-w-2xl text-base sm:text-lg text-foreground/85">
                    {PROJECTS.length} things {NAME} has built — from {persistProductNames()} at {CURRENT_ROLE.company} to
                    the side projects he would still defend in an interview.
                </p>

                <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {PROJECTS.map((project, index) => (
                        <li key={project.title}>
                            <Link
                                href={`/projects/${projectSlug(project)}`}
                                className="group flex h-full flex-col overflow-hidden rounded-lg border-4 border-foreground bg-background shadow-[4px_4px_0_0_hsl(var(--foreground))] transition-transform hover:-translate-y-1 hover:shadow-[6px_6px_0_0_hsl(var(--primary))]"
                            >
                                <div className="relative aspect-[1200/630] border-b-4 border-foreground">
                                    <Image
                                        src={project.thumbnail}
                                        alt={`${project.title} — screenshot`}
                                        fill
                                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                                        className="object-cover"
                                        priority={index < 3}
                                    />
                                </div>
                                <div className="flex flex-1 flex-col p-4">
                                    <h2 className="font-headline text-2xl tracking-wide text-primary">{project.title}</h2>
                                    {isPersistProduct(project) ? (
                                        <span className="mt-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">Built at {CURRENT_ROLE.company}</span>
                                    ) : null}
                                    <p className="mt-2 flex-1 text-sm text-foreground/80">{project.description}</p>
                                    <div className="mt-3 flex flex-wrap gap-1.5">
                                        {project.tags.slice(0, 4).map((tag) => (
                                            <Badge key={tag} variant="secondary" className="border border-foreground/30 text-[11px]">{tag}</Badge>
                                        ))}
                                    </div>
                                </div>
                            </Link>
                        </li>
                    ))}
                </ul>
            </div>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
        </SubpageShell>
    );
}
