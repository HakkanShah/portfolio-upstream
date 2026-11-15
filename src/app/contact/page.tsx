import type { Metadata } from 'next';
import SubpageShell from '@/components/subpage-shell';
import ContactSection from '@/components/contact-section';
import { faqEntries } from '@/lib/faq';
import { CURRENT_ROLE, JOB_TITLE, NAME, PERSON_ID, PUBLIC_EMAIL, SITE_URL, WEBSITE_ID, OG_IMAGE } from '@/lib/seo';

const TITLE = `Contact ${NAME}`;
const DESCRIPTION = `Get in touch with ${NAME}, ${JOB_TITLE} at ${CURRENT_ROLE.company}: email ${PUBLIC_EMAIL}, LinkedIn, GitHub, or the contact form.`;

export const metadata: Metadata = {
    title: { absolute: `${TITLE} – ${JOB_TITLE}` },
    description: DESCRIPTION,
    alternates: { canonical: '/contact' },
    // A page's openGraph replaces the layout's, so the share image is repeated here.
    openGraph: { type: 'website', url: '/contact', siteName: NAME, title: TITLE, description: DESCRIPTION, images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: NAME }] },
    twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, images: [OG_IMAGE], creator: '@HakkanShah' },
};

export default function ContactPage() {
    // The FAQ's "open to work" answer, so this page says what he's open to.
    const openToWork = faqEntries().find((entry) => /open to work/i.test(entry.question));

    const structuredData = {
        '@context': 'https://schema.org',
        '@type': 'ContactPage',
        '@id': `${SITE_URL}/contact`,
        url: `${SITE_URL}/contact`,
        name: TITLE,
        description: DESCRIPTION,
        isPartOf: { '@id': WEBSITE_ID },
        mainEntity: { '@id': PERSON_ID },
    };

    return (
        <SubpageShell>
            <div className="section-container pt-10 sm:pt-14">
                <h1 className="font-headline text-5xl sm:text-6xl md:text-7xl tracking-wider text-primary drop-shadow-[2px_2px_0_hsl(var(--foreground))]">
                    Contact {NAME}
                </h1>
                {openToWork ? <p className="mt-4 max-w-2xl text-base sm:text-lg text-foreground/85">{openToWork.answer}</p> : null}
            </div>
            <ContactSection />
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
        </SubpageShell>
    );
}
