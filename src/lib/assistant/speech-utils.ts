/**
 * Speech helpers
 * Markdown and emoji read well on screen and badly out loud.
 */

export const optimizeForSpeech = (text: string): string =>
    text
        // Markdown links: keep the label, drop the URL
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
        .replace(/[*_`#>]/g, '')
        .replace(/^\s*[•\-]\s*/gm, '')
        .replace(/^\s*\d+\.\s*/gm, '')
        .replace(/\r?\n+/g, '. ')
        .replace(/https?:\/\/\S+/g, 'the link on the page')
        .replace(/([a-z0-9._%-]+)@([a-z0-9.-]+\.[a-z]{2,})/gi, (_match, user: string, domain: string) =>
            `${user.replace(/\./g, ' dot ')} at ${domain.replace(/\./g, ' dot ')}`
        )
        .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2190}-\u{21FF}]/gu, '')
        .replace(/\.\s*\./g, '.')
        .replace(/\s{2,}/g, ' ')
        .trim();

export default optimizeForSpeech;
