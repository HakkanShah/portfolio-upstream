import type { Metadata } from 'next';
import SubpageShell from '@/components/subpage-shell';
import FaqSection from '@/components/faq-section';
import { JOB_TITLE, NAME, OG_IMAGE } from '@/lib/seo';

const TITLE = `Questions about ${NAME}`;
const DESCRIPTION = `Who ${NAME} is, what he does at Persist, his best projects, skills, where he's based, whether he's open to work and how to reach him — short answers.`;

export const metadata: Metadata = {
    title: { absolute: `${TITLE} – ${JOB_TITLE} FAQ` },
    description: DESCRIPTION,
    alternates: { canonical: '/faq' },
    openGraph: { type: 'website', url: '/faq', siteName: NAME, title: TITLE, description: DESCRIPTION, images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: NAME }] },
    twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, images: [OG_IMAGE], creator: '@HakkanShah' },
};

export default function FaqPage() {
    return (
        <SubpageShell>
            <FaqSection />
        </SubpageShell>
    );
}
