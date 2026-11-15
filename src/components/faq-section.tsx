import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import AnimatedDiv from './animated-div';
import { faqEntries, faqSchema } from '@/lib/faq';

/**
 * "Questions people ask": direct answers about Hakkan, in the words search
 * engines and AI assistants quote. Server-rendered with native <details>, so
 * it ships no JavaScript and every answer is in the HTML even when closed.
 *
 * It lives on its own page (/faq) rather than the home page: visitors don't
 * need it there, and hiding it on the home page while still serving it to
 * search engines would be cloaking.
 */
const FaqSection = () => {
  const entries = faqEntries();

  return (
    <section id="faq" aria-labelledby="faq-title" className="section-padding">
      <div className="section-container">
        <AnimatedDiv className="text-center mb-10 sm:mb-12">
          <h1 id="faq-title" className="font-headline text-4xl sm:text-5xl md:text-6xl font-bold text-primary tracking-wider drop-shadow-[2px_2px_0_hsl(var(--foreground))]">
            Questions People Ask
          </h1>
          <p className="mt-3 max-w-2xl mx-auto text-sm sm:text-base text-muted-foreground px-4">
            The short answers about Hakkan Shah. The long ones are on the <Link href="/" className="font-bold text-primary underline underline-offset-4">portfolio</Link>.
          </p>
        </AnimatedDiv>

        <div className="max-w-3xl mx-auto space-y-4">
          {entries.map((entry, index) => (
            <AnimatedDiv key={entry.question} delay={Math.min(index, 4) * 60} variant="fade">
              <details
                className="group bg-background border-4 border-foreground rounded-lg shadow-[4px_4px_0_0_hsl(var(--foreground))] open:shadow-[6px_6px_0_0_hsl(var(--primary))] transition-shadow"
                {...(index === 0 ? { open: true } : {})}
              >
                <summary className="flex items-center justify-between gap-4 cursor-pointer list-none p-4 sm:p-5 font-headline text-lg sm:text-xl tracking-wide [&::-webkit-details-marker]:hidden">
                  <h3 className="font-headline font-normal">{entry.question}</h3>
                  <ChevronDown aria-hidden="true" className="h-5 w-5 shrink-0 text-primary transition-transform group-open:rotate-180" />
                </summary>
                <div className="px-4 sm:px-5 pb-4 sm:pb-5 -mt-1 text-sm sm:text-base text-foreground/85 leading-relaxed">
                  <p>{entry.answer}</p>
                  {entry.links?.length ? (
                    <p className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
                      {entry.links.map((link) => (
                        <Link
                          key={link.href}
                          href={link.href}
                          {...(link.href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                          className="font-bold text-primary underline underline-offset-4 decoration-2 hover:text-accent"
                        >
                          {link.label} →
                        </Link>
                      ))}
                    </p>
                  ) : null}
                </div>
              </details>
            </AnimatedDiv>
          ))}
        </div>
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', ...faqSchema() }) }}
      />
    </section>
  );
};

export default FaqSection;
