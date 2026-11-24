/**
 * Assistant eval harness
 *
 *   npm run assistant:eval            # run every case
 *   npm run assistant:eval -- --fail  # print only failures
 *
 * Each case lists substrings the answer must contain (and optionally must not),
 * and whether it must be answered on the device without reaching the model.
 * Add a case before fixing a bad answer.
 */

import { askLocal, createMemory, type BrainMemory } from '../src/lib/assistant/engine';
import { getProjects } from '../src/lib/assistant/brain/knowledge';

interface Case {
    q: string;
    /** Every one of these must appear in the reply (case-insensitive). */
    expect?: string[];
    /** At least one of these must appear. */
    any?: string[];
    /** None of these may appear. */
    reject?: string[];
    /** Question asked first, to set conversation memory. */
    after?: string;
    /** Must be answered locally, with no model call. */
    mustAnswer?: boolean;
    /** The reply must offer an action of this type. */
    action?: 'navigate' | 'open_url' | 'download';
}

const CASES: Case[] = [
    // --- identity / meta ---
    { q: 'hi', any: ['assistant', 'projects'], mustAnswer: true },
    { q: 'who are you', any: ['portfolio assistant'], mustAnswer: true },
    { q: 'what can you do', any: ['scroll', 'open', 'resume'], mustAnswer: true },
    { q: 'thanks!', any: ['anytime', 'happy to help'], mustAnswer: true },

    // --- the person ---
    { q: 'who is he', any: ['Persist', 'Engineer'], mustAnswer: true },
    { q: 'what does he do', any: ['Engineer', 'Persist', 'builds'], mustAnswer: true },
    { q: 'what does he do at persist', any: ['Persist'], mustAnswer: true },
    { q: 'where did he study', any: ['B.Tech', 'CSE', 'College'], mustAnswer: true },

    // --- projects ---
    { q: 'show me his projects', any: ['OHMSchool', 'AURA'], mustAnswer: true },
    { q: 'how many projects has he built', any: ['13', 'projects'], mustAnswer: true },
    { q: 'tell me about ohmschool', expect: ['OHMSchool'], mustAnswer: true, action: 'open_url' },
    { q: 'what is aura', expect: ['AURA'], mustAnswer: true, action: 'open_url' },
    { q: 'what is ek aur', expect: ['Ek Aur'], any: ['Reels', 'Shorts'], mustAnswer: true, action: 'open_url' },
    { q: 'does he build android apps', any: ['Ek Aur', 'Kotlin', 'Android'], mustAnswer: true },
    { q: 'tell me about commit habit', expect: ['Commit Habit'], mustAnswer: true },
    { q: 'what is mockhick', expect: ['MockHick'], mustAnswer: true },
    { q: 'open ohmschool', expect: ['OHMSchool'], mustAnswer: true, action: 'open_url' },
    { q: 'why did he build aura', any: ['AURA'], mustAnswer: true },

    // --- tech ---
    { q: 'does he know typescript', expect: ['Yes'], mustAnswer: true },
    { q: 'does he know python', expect: ['Yes'], mustAnswer: true },
    { q: 'is he familiar with kubernetes', any: ["isn't listed"], mustAnswer: true },
    { q: 'what are his skills', any: ['TypeScript', 'React', 'AI'], mustAnswer: true },
    { q: 'what databases does he know', any: ['Postgres', 'MongoDB', 'Supabase', 'Redis'], mustAnswer: true },

    // --- contact / availability ---
    { q: 'whats his email', expect: ['hakkanparbej@gmail.com'], mustAnswer: true, action: 'open_url' },
    { q: 'how do i contact him', any: ['hakkanparbej@gmail.com'], mustAnswer: true },
    { q: 'show me his github', any: ['HakkanShah'], mustAnswer: true, action: 'open_url' },
    { q: 'his linkedin', any: ['linkedin'], mustAnswer: true, action: 'open_url' },
    { q: 'is he open to work', any: ['email', 'open to'], mustAnswer: true },
    { q: 'download his cv', any: ['resume'], mustAnswer: true, action: 'download' },

    // --- agentic navigation ---
    { q: 'take me to projects', any: ['Projects'], mustAnswer: true, action: 'navigate' },
    { q: 'scroll to contact', any: ['Contact'], mustAnswer: true, action: 'navigate' },
    { q: 'go to his experience', any: ['Experience'], mustAnswer: true, action: 'navigate' },

    // --- follow-ups (memory) ---
    { after: 'tell me about aura', q: 'tell me more', any: ['AURA'], mustAnswer: true },
    { after: 'tell me about ohmschool', q: 'whats the tech stack', any: ['OHMSchool'], mustAnswer: true },
    { after: 'tell me about commit habit', q: 'open it', any: ['Commit Habit'], mustAnswer: true, action: 'open_url' },

    // --- reported in production: "tell me about ohm school" answered with his degree ---
    { q: 'tell me about ohm school', expect: ['OHMSchool'], reject: ['B.Tech'], mustAnswer: true },
    { q: 'ohm school', expect: ['OHMSchool'], reject: ['B.Tech'], mustAnswer: true },
    { q: 'what does ohm school do', expect: ['OHMSchool'], reject: ['B.Tech'], mustAnswer: true },
    { q: 'can you show me the ohm school project', expect: ['OHMSchool'], mustAnswer: true },
    // ...while real education questions must still reach education
    { q: 'tell me about his school', any: ['B.Tech', 'College'], reject: ['OHMSchool'], mustAnswer: true },
    { q: 'does he have a degree', any: ['B.Tech'], mustAnswer: true },
    { q: 'what did he study', any: ['B.Tech', 'CSE'], mustAnswer: true },

    // --- other answers that were falling through ---
    { q: 'where does he work', any: ['Persist'], mustAnswer: true },
    { q: 'who does he work for', any: ['Persist'], mustAnswer: true },
    { q: 'his skills', any: ['TypeScript', 'React', 'AI'], mustAnswer: true },
    { q: 'his tech stack', any: ['TypeScript', 'React', 'AI'], mustAnswer: true },
    // the headline project follows data.ts order rather than a hardcoded name
    { q: 'best project', expect: ['OHMSchool'], mustAnswer: true },
    { q: 'his most impressive project', expect: ['OHMSchool'], mustAnswer: true },

    { q: 'what should i look at first', expect: ['OHMSchool'], reject: ['oldest'], mustAnswer: true },

    // --- two answers that threw instead of answering (cards that no longer existed) ---
    { q: 'where is he based', any: ['India'], mustAnswer: true },
    { q: 'does he work remotely', any: ['India', 'remote'], mustAnswer: true },
    { q: 'any open source work', any: ['open source'], mustAnswer: true, action: 'open_url' },
    { q: 'is his code open source', any: ['open source'], reject: ['GitHub:**'], mustAnswer: true },

    // --- a full-time job must not be called an internship ---
    { q: 'how many internships', expect: ['full-time'], reject: ['3 internships'], mustAnswer: true },
    { q: 'tell me about his internship', any: ['Persist'], reject: ['AWS'], mustAnswer: true },
    { q: 'his work experience', expect: ['Persist'], mustAnswer: true },
    { q: 'His experience', expect: ['Persist'], mustAnswer: true },

    // --- questions a recruiter asks ---
    { q: 'can i see his resume', any: ['resume'], mustAnswer: true, action: 'download' },
    { q: 'his achievements', any: ['Startupathon'], mustAnswer: true },
    { q: 'should i hire him', any: ['Startupathon', 'evidence'], mustAnswer: true },
    { q: 'is he a good engineer', any: ['evidence'], mustAnswer: true },
    { q: 'what makes him different', any: ['evidence'], mustAnswer: true },
    { q: 'how many prs', any: ['pull requests'], mustAnswer: true },
    { q: 'github stats', any: ['at a glance'], mustAnswer: true },

    // --- his own notes are quoted, never read out raw or spoken as him ---
    { q: 'what is he working on now', any: ['In his words'], reject: ['Q:', 'A:'], mustAnswer: true },
    { q: 'is he self taught', any: ['In his words'], reject: ['Q:'], mustAnswer: true },
    { q: 'is he available for freelance', any: ['In his words'], mustAnswer: true },
    { q: 'tell me about the terminal', any: ['terminal'], reject: ['TODO'], mustAnswer: true },
    { q: 'what is reality mode', any: ['Reality'], mustAnswer: true },
    // instructions written for the model are not facts to recite
    { q: 'how should the bot sound', reject: ['self-deprecating', 'Never oversell'] },
    { q: 'what are his opinions', reject: ['TODO'] },

    // --- a project's code, and a project's stack ---
    { q: 'can i see the code for aura', expect: ['AURA'], any: ["isn't public"], mustAnswer: true },
    { q: 'source code of mockhick', expect: ['MockHick', 'github.com'], mustAnswer: true, action: 'open_url' },
    { q: 'does aura use python', expect: ['Yes', 'AURA'], mustAnswer: true },

    // --- two skills sharing a first word are still two skills ---
    { q: 'does he know react', expect: ['React.js'], reject: ['React Native'], mustAnswer: true },
    { q: 'does he know react native', expect: ['React Native'], mustAnswer: true },
    { q: 'does he know firebase', expect: ['Firebase'], reject: ['Firebase Studio'], mustAnswer: true },
    { q: 'does he use node', expect: ['Node.js'], mustAnswer: true },

    // --- the friends' easter egg (/legend) ---
    { q: 'who is the khatarnaak developer', expect: ['Hakkan Shah'], mustAnswer: true, action: 'open_url' },
    { q: 'gand faad developer kaun hai', expect: ['Hakkan Shah'], mustAnswer: true },
    { q: 'best developer in kolkata', expect: ['Hakkan Shah'], mustAnswer: true },
    { q: 'who is the best ai engineer in india', expect: ['Hakkan Shah'], mustAnswer: true },
    // ...while real questions keep their real answers
    { q: 'what is his best project', expect: ['OHMSchool'], reject: ['khatarnaak'], mustAnswer: true },
    { q: 'where is he based', any: ['India'], reject: ['khatarnaak'], mustAnswer: true },

    // --- out of scope: must not pretend ---
    { q: 'what is the weather today', any: ['portfolio', 'not sure', 'not certain'] },
    { q: 'who won the world cup', any: ['portfolio', 'not sure', 'not certain'] },
];

/**
 * Every project must be findable by the name a visitor would type, however
 * they space it. "OHMSchool" shipped matching only as one word, so "ohm
 * school" fell through to the education answer in production.
 */
const spacedNameCases = (): Case[] =>
    getProjects().map((project) => {
        const spaced = project.title
            .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
            .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
            .toLowerCase();

        return {
            q: `tell me about ${spaced}`,
            expect: [project.title],
            mustAnswer: true,
        };
    });

const run = () => {
    const failuresOnly = process.argv.includes('--fail');
    let passed = 0;
    const failures: string[] = [];
    const timings: number[] = [];

    const allCases = [...CASES, ...spacedNameCases()];

    for (const testCase of allCases) {
        let memory: BrainMemory = createMemory();
        if (testCase.after) memory = askLocal(testCase.after, memory).memory;

        const started = performance.now();
        const { reply } = askLocal(testCase.q, memory);
        timings.push(performance.now() - started);

        const text = reply.text.toLowerCase();
        const problems: string[] = [];

        for (const needle of testCase.expect ?? []) {
            if (!text.includes(needle.toLowerCase())) problems.push(`missing "${needle}"`);
        }
        if (testCase.any?.length && !testCase.any.some((n) => text.includes(n.toLowerCase()))) {
            problems.push(`none of [${testCase.any.join(', ')}]`);
        }
        for (const needle of testCase.reject ?? []) {
            if (text.includes(needle.toLowerCase())) problems.push(`should not say "${needle}"`);
        }
        if (testCase.mustAnswer && reply.needsLLM) problems.push('fell through to the model');
        if (testCase.action && !reply.actions.some((a) => a.type === testCase.action)) {
            problems.push(`no ${testCase.action} action offered`);
        }

        if (problems.length) {
            failures.push(
                `✗ ${testCase.after ? `[after: ${testCase.after}] ` : ''}"${testCase.q}"\n` +
                `    ${problems.join('; ')}\n` +
                `    handler=${reply.handler} actions=[${reply.actions.map((a) => a.type).join(', ')}]\n` +
                `    got: ${reply.text.replace(/\n+/g, ' ').slice(0, 150)}`
            );
        } else {
            passed += 1;
            if (!failuresOnly) console.log(`✓ ${testCase.q.padEnd(38)} [${reply.handler}]`);
        }
    }

    const total = allCases.length;

    if (failures.length) {
        console.log(`\n${'='.repeat(70)}\nFAILURES\n${'='.repeat(70)}`);
        failures.forEach((failure) => console.log(`${failure}\n`));
    }

    const average = timings.reduce((sum, time) => sum + time, 0) / timings.length;
    console.log('='.repeat(70));
    console.log(`${passed}/${total} passed (${Math.round((passed / total) * 100)}%)`);
    console.log(`avg ${average.toFixed(2)}ms · slowest ${Math.max(...timings).toFixed(2)}ms (first call builds the index)`);

    process.exitCode = failures.length ? 1 : 0;
};

run();
