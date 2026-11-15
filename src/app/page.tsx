import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import Header from '@/components/header';
import HeroSection from '@/components/hero-section';
import FloatingElements from '@/components/floating-elements';
import ScrollProgress from '@/components/scroll-progress';
import CursorFollower from '@/components/cursor-follower';
import AssistantWrapper from '@/components/assistant/assistant-wrapper';
import FaqSection from '@/components/faq-section';
import { HOME_DESCRIPTION, HOME_TITLE, PERSON_ID, SITE_URL, WEBSITE_ID, projectListSchema } from '@/lib/seo';

// Lazy load below-the-fold sections for faster initial load
const AboutSection = dynamic(() => import('@/components/about-section'));
const ExperienceSection = dynamic(() => import('@/components/experience-section'));
const ProjectsSection = dynamic(() => import('@/components/projects-section'));
const GitHubActivitySection = dynamic(() => import('@/components/github-activity-section'));
const SkillsSection = dynamic(() => import('@/components/skills-section'));
const EducationSection = dynamic(() => import('@/components/education-section'));
const CertificationsSection = dynamic(() => import('@/components/certifications-section'));
const ContactSection = dynamic(() => import('@/components/contact-section'));
const Footer = dynamic(() => import('@/components/footer'));

// Simple loading skeleton
const SectionLoader = () => (
  <div className="py-16 md:py-24 flex items-center justify-center">
    <div className="animate-pulse flex flex-col items-center gap-4">
      <div className="h-8 w-48 bg-muted rounded"></div>
      <div className="h-4 w-64 bg-muted/50 rounded"></div>
    </div>
  </div>
);

/** What the home page is: one person's profile, with a list of his projects. */
const HOME_STRUCTURED_DATA = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'ProfilePage',
      '@id': `${SITE_URL}/#profilepage`,
      url: `${SITE_URL}/`,
      name: HOME_TITLE,
      description: HOME_DESCRIPTION,
      inLanguage: 'en',
      isPartOf: { '@id': WEBSITE_ID },
      mainEntity: { '@id': PERSON_ID },
      primaryImageOfPage: { '@id': `${SITE_URL}/#profile-photo` },
      hasPart: { '@id': `${SITE_URL}/#projects` },
      dateModified: new Date().toISOString(),
    },
    projectListSchema(),
  ],
};

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-background relative">
      <FloatingElements />
      <ScrollProgress />
      <CursorFollower />
      <Header />
      <main className="flex-1 relative z-10">
        <HeroSection />
        <Suspense fallback={<SectionLoader />}>
          <AboutSection />
        </Suspense>
        <Suspense fallback={<SectionLoader />}>
          <ExperienceSection />
        </Suspense>
        <Suspense fallback={<SectionLoader />}>
          <ProjectsSection />
        </Suspense>
        <Suspense fallback={<SectionLoader />}>
          <GitHubActivitySection />
        </Suspense>
        <Suspense fallback={<SectionLoader />}>
          <SkillsSection />
        </Suspense>
        <Suspense fallback={<SectionLoader />}>
          <EducationSection />
        </Suspense>
        <Suspense fallback={<SectionLoader />}>
          <CertificationsSection />
        </Suspense>
        <FaqSection />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(HOME_STRUCTURED_DATA) }} />
        <Suspense fallback={<SectionLoader />}>
          <ContactSection />
        </Suspense>
      </main>
      <Suspense fallback={null}>
        <Footer />
      </Suspense>

      {/* Interactive Portfolio Assistant */}
      <AssistantWrapper />
    </div>
  );
}
