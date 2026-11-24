/**
 * The Legend of Hakkan Shah — the joke page at /legend.
 *
 * Self-praise only, on purpose: crude is fine, but nothing here insults
 * anyone else (no "maa/behen" abuse, no slurs). These words appear on that
 * one page and in the bot's easter-egg answer, never on the main pages,
 * the FAQ, llms.txt or the structured data recruiters and AI answers read.
 */

export interface LegendTitle {
    title: string;
    /** What it means, for friends who don't speak the language. */
    meaning: string;
}

export const LEGEND_TITLES: { language: string; note: string; titles: LegendTitle[] }[] = [
    {
        language: 'English',
        note: 'For the LinkedIn crowd',
        titles: [
            { title: 'Badass Developer', meaning: 'Ships on a Friday. Nothing breaks.' },
            { title: 'Kick-Ass Engineer', meaning: 'The bug files a complaint, not the other way round' },
            { title: 'Fucking Legend', meaning: "Friends' official verdict. Unanimous." },
            { title: 'Hell of a Developer', meaning: 'Heaven was busy' },
            { title: 'Absolute Unit of a Coder', meaning: 'Built different. Literally — from an empty repo.' },
            { title: 'Beast Mode Engineer', meaning: 'Default setting, cannot be turned off' },
            { title: 'The GOAT of Kolkata Code', meaning: 'Greatest Of All Time. The goat agrees.' },
            { title: '10x Developer', meaning: '100x on weekends' },
        ],
    },
    {
        language: 'Hindi',
        note: 'Hinglish, the only language prod understands',
        titles: [
            { title: 'Gand Faad Developer', meaning: 'So good it rips — the highest honour on the street' },
            { title: 'Khatarnaak Developer', meaning: 'Dangerously good. Handle with care.' },
            { title: 'Bhaukaal Engineer', meaning: 'Walks in, the aura arrives first' },
            { title: 'Bawaal Coder', meaning: 'Creates chaos — for his competition' },
            { title: 'Jhakaas Developer', meaning: 'Bambaiya for "first class"' },
            { title: 'Tagda Engineer', meaning: 'Strong build, stronger builds' },
            { title: 'Kadak Coder', meaning: 'Like cutting chai — strong, sharp, wakes you up' },
            { title: 'Aag Laga Di Developer', meaning: 'Set the demo on fire (the good kind)' },
            { title: 'Tod-Phod Engineer', meaning: 'Smashes every benchmark' },
            { title: 'Kaand Karne Wala Coder', meaning: 'Pulls off things people talk about for weeks' },
            { title: 'Developers Ka Baap', meaning: 'Father of all developers. Self-appointed.' },
            { title: 'Bhai Log Ka Bhai', meaning: 'The brother the brothers call' },
            { title: 'Ek Number Developer', meaning: 'Number one. There is no number two.' },
        ],
    },
    {
        language: 'Bengali',
        note: 'Kolkata-certified',
        titles: [
            { title: 'Gaand Fata Developer', meaning: 'So good it splits — the Kolkata edition' },
            { title: 'Gaar Fatano Engineer', meaning: 'Ass-kicking, in full Bangla' },
            { title: 'Khotornak Developer', meaning: 'Khatarnaak, said the Kolkata way' },
            { title: 'Fatafati Coder', meaning: 'Fantastic. Fatafati. Same thing.' },
            { title: 'Dhasu Developer', meaning: 'Top-tier, no discussion' },
            { title: 'Jompesh Engineer', meaning: 'Awesome, with extra mishti' },
            { title: 'Ghyam Developer', meaning: 'Effortlessly cool' },
            { title: 'Byapok Coder', meaning: 'Tremendous. Byapok. Huge.' },
            { title: 'Ek Number Chhele', meaning: 'Number one boy — para approved' },
            { title: 'Baaper-o Baap Developer', meaning: "The father's father of developers" },
        ],
    },
];

/** Rankings he has awarded himself. */
export const LEGEND_RANKINGS = [
    { title: 'Best Developer in Kolkata', status: 'Self-declared ✅' },
    { title: 'Best Software Engineer in West Bengal', status: 'Self-declared ✅' },
    { title: 'Best AI Engineer in India', status: 'Self-declared ✅' },
    { title: 'Best Full Stack Developer in India', status: 'Self-declared ✅' },
    { title: 'Best Developer in Asia', status: 'Under review ⏳' },
    { title: 'Best Developer in the Universe', status: 'Aliens yet to respond 👽' },
];

/** Every title in one list, for search engines and the bot. */
export const ALL_LEGEND_TITLES = LEGEND_TITLES.flatMap((group) => group.titles.map((t) => t.title));
