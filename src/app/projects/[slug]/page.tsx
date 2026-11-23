import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ExternalLink, Github, Mail } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import SubpageShell from '@/components/subpage-shell';
import { PROJECTS } from '@/lib/data';
import {
    CURRENT_ROLE,
    JOB_TITLE,
    NAME,
    PERSON_ID,
    PUBLIC_EMAIL,
    SITE_URL,
    WEBSITE_ID,
    featuredProjects,
    findProject,
    isPersistProduct,
    projectSchema,
    projectSlug,
    projectUrl,
} from '@/lib/seo';

/**
 * One page per project, generated from data.ts at build time.
 *
 * The home page shows six projects until "View more" is clicked, and as one
 * long page it can't rank for each project's name. These pages give every
 * project its own URL, title and description for search engines, and a
 * clean, citable page for AI assistants.
 */

type Params = { slug: string };

export const dynamicParams = false;

export function generateStaticParams(): Params[] {
    return PROJECTS.map((project) => ({ slug: projectSlug(project) }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
    const project = findProject((await params).slug);
    if (!project) return {};

    const title = `${project.title} by ${NAME}`;
    const description = `${project.description} Built with ${project.tags.slice(0, 4).join(', ')}.`;
    const path = `/projects/${projectSlug(project)}`;

    return {
        // "OHMSchool | Hakkan Shah" via the layout's template.
        title: project.title,
        description,
        keywords: [project.title, ...project.tags, NAME, JOB_TITLE, `${project.title} ${NAME}`],
        alternates: { canonical: path },
        openGraph: {
            type: 'article',
            url: path,
            siteName: NAME,
            title,
            description,
            images: [{ url: project.thumbnail, alt: `${project.title} — screenshot` }],
            authors: [SITE_URL],
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
            images: [project.thumbnail],
            creator: '@HakkanShah',
        },
    };
}

export default async function ProjectPage({ params }: { params: Promise<Params> }) {
    const project = findProject((await params).slug);
    if (!project) notFound();

    const index = PROJECTS.indexOf(project);
    // The featured projects, not all twelve others: see featuredProjects().
    const others = featuredProjects().filter((p) => p !== project).slice(0, 4);
    const next = PROJECTS[(index + 1) % PROJECTS.length];
    const persist = isPersistProduct(project);
    const url = projectUrl(project);

    const structuredData = {
        '@context': 'https://schema.org',
        '@graph': [
            {
                '@type': 'WebPage',
                '@id': url,
                url,
                name: `${project.title} by ${NAME}`,
                description: project.description,
                isPartOf: { '@id': WEBSITE_ID },
                about: { '@id': `${url}#software` },
                author: { '@id': PERSON_ID },
                primaryImageOfPage: `${SITE_URL}${project.thumbnail}`,
                breadcrumb: { '@id': `${url}#breadcrumb` },
                inLanguage: 'en',
            },
            projectSchema(project),
            {
                '@type': 'BreadcrumbList',
                '@id': `${url}#breadcrumb`,
                itemListElement: [
                    { '@type': 'ListItem', position: 1, name: NAME, item: `${SITE_URL}/` },
                    { '@type': 'ListItem', position: 2, name: 'Projects', item: `${SITE_URL}/projects` },
                    { '@type': 'ListItem', position: 3, name: project.title, item: url },
                ],
            },
        ],
    };

    return (
        <SubpageShell>
                <article className="section-container py-8 sm:py-12">
                    <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
                        <ol className="flex flex-wrap items-center gap-2">
                            <li><Link href="/" className="hover:text-primary">Home</Link></li>
                            <li aria-hidden="true">/</li>
                            <li><Link href="/projects" className="hover:text-primary">Projects</Link></li>
                            <li aria-hidden="true">/</li>
                            <li aria-current="page" className="font-bold text-foreground">{project.title}</li>
                        </ol>
                    </nav>

                    <div className="mt-6 grid gap-8 md:grid-cols-2 md:items-center">
                        <div>
                            <p className="inline-block rotate-[-1.5deg] border-2 border-foreground bg-[#FBDB0E] px-3 py-1 font-headline text-sm tracking-widest text-black shadow-[3px_3px_0_0_hsl(var(--foreground))]">
                                {persist ? `Built at ${CURRENT_ROLE.company}` : 'Personal project'}
                            </p>
                            <h1 className="mt-4 font-headline text-5xl sm:text-6xl md:text-7xl tracking-wider text-primary drop-shadow-[2px_2px_0_hsl(var(--foreground))]">
                                {project.title}
                            </h1>
                            <p className="mt-4 text-lg sm:text-xl text-foreground/90">{project.description}</p>

                            <ul className="mt-5 flex flex-wrap gap-2" aria-label="Built with">
                                {project.tags.map((tag) => (
                                    <li key={tag}>
                                        <Badge variant="secondary" className="border border-foreground/30">{tag}</Badge>
                                    </li>
                                ))}
                            </ul>

                            <div className="mt-6 flex flex-wrap gap-3">
                                {project.liveUrl ? (
                                    <Button asChild className="border-2 border-foreground font-bold">
                                        <a href={project.liveUrl} target="_blank" rel="noopener noreferrer">
                                            <ExternalLink className="mr-2 h-4 w-4" /> Open {project.title}
                                        </a>
                                    </Button>
                                ) : null}
                                {project.repoUrl ? (
                                    <Button asChild variant="outline" className="border-2 border-foreground font-bold">
                                        <a href={project.repoUrl} target="_blank" rel="noopener noreferrer">
                                            <Github className="mr-2 h-4 w-4" /> Source code
                                        </a>
                                    </Button>
                                ) : null}
                            </div>
                        </div>

                        <div className="relative aspect-[1200/630] overflow-hidden rounded-lg border-4 border-foreground shadow-[8px_8px_0_0_hsl(var(--foreground))]">
                            <Image
                                src={project.thumbnail}
                                alt={`${project.title} — ${project.description}`}
                                fill
                                priority
                                sizes="(max-width: 768px) 100vw, 50vw"
                                className="object-cover"
                            />
                        </div>
                    </div>

                    <div className="mt-12 grid gap-10 md:grid-cols-3">
                        <div className="space-y-10 md:col-span-2">
                            <section aria-labelledby="what">
                                <h2 id="what" className="font-headline text-3xl sm:text-4xl tracking-wide text-primary">What it is</h2>
                                <p className="mt-3 text-base sm:text-lg leading-relaxed text-foreground/85">{project.longDescription}</p>
                            </section>
                            <section aria-labelledby="why">
                                <h2 id="why" className="font-headline text-3xl sm:text-4xl tracking-wide text-primary">Why he built it</h2>
                                <blockquote className="mt-3 border-l-4 border-primary pl-4 text-base sm:text-lg italic leading-relaxed text-foreground/85">
                                    {project.why}
                                </blockquote>
                            </section>
                        </div>

                        <aside className="h-fit rounded-lg border-4 border-foreground bg-muted/30 p-5 shadow-[4px_4px_0_0_hsl(var(--foreground))]">
                            <h2 className="font-headline text-2xl tracking-wide">Built by</h2>
                            <p className="mt-2">
                                <Link href="/" className="font-bold text-primary underline underline-offset-4">{NAME}</Link>
                                {' — '}{JOB_TITLE} at {CURRENT_ROLE.company}, based in Kolkata, India.
                            </p>
                            <p className="mt-3 text-sm text-muted-foreground">Want to talk about {project.title}, or something like it?</p>
                            <a
                                href={`mailto:${PUBLIC_EMAIL}?subject=${encodeURIComponent(`About ${project.title}`)}`}
                                className="mt-2 inline-flex items-center gap-2 font-bold text-primary hover:text-accent"
                            >
                                <Mail className="h-4 w-4" /> {PUBLIC_EMAIL}
                            </a>
                        </aside>
                    </div>
                </article>

                <section aria-labelledby="more" className="border-t-4 border-foreground bg-accent/5">
                    <div className="section-container py-10 sm:py-12">
                        <div className="flex flex-wrap items-baseline justify-between gap-4">
                            <h2 id="more" className="font-headline text-3xl sm:text-4xl tracking-wide text-primary">More projects</h2>
                            <Link href={`/projects/${projectSlug(next)}`} className="font-bold hover:text-primary">
                                Next: {next.title} →
                            </Link>
                        </div>
                        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            {others.map((other) => (
                                <li key={other.title}>
                                    <Link
                                        href={`/projects/${projectSlug(other)}`}
                                        className="block h-full rounded-lg border-2 border-foreground bg-background p-4 transition-transform hover:-translate-y-1 hover:shadow-[4px_4px_0_0_hsl(var(--primary))]"
                                    >
                                        <span className="font-headline text-xl tracking-wide text-primary">{other.title}</span>
                                        <span className="mt-1 block text-sm text-muted-foreground line-clamp-2">{other.description}</span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                        <Link href="/projects" className="mt-8 inline-flex items-center gap-2 font-bold hover:text-primary">
                            <ArrowLeft className="h-4 w-4" /> All {PROJECTS.length} projects
                        </Link>
                    </div>
                </section>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
        </SubpageShell>
    );
}
