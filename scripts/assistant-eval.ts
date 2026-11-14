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
    { q: 'how many projects has he built', any: ['14', 'projects'], mustAnswer: true },
    { q: 'tell me about ohmschool', expect: ['OHMSchool'], mustAnswer: true, action: 'open_url' },
    { q: 'what is aura', expect: ['AURA'], mustAnswer: true, action: 'open_url' },
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

    // --- out of scope: must not pretend ---
    { q: 'what is the weather today', any: ['portfolio', 'not sure', 'not certain'] },
    { q: 'who won the world cup', any: ['portfolio', 'not sure', 'not certain'] },
];

const run = () => {
    const failuresOnly = process.argv.includes('--fail');
    let passed = 0;
    const failures: string[] = [];
    const timings: number[] = [];

    for (const testCase of CASES) {
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

    if (failures.length) {
        console.log(`\n${'='.repeat(70)}\nFAILURES\n${'='.repeat(70)}`);
        failures.forEach((failure) => console.log(`${failure}\n`));
    }

    const average = timings.reduce((sum, time) => sum + time, 0) / timings.length;
    console.log('='.repeat(70));
    console.log(`${passed}/${CASES.length} passed (${Math.round((passed / CASES.length) * 100)}%)`);
    console.log(`avg ${average.toFixed(2)}ms · slowest ${Math.max(...timings).toFixed(2)}ms (first call builds the index)`);

    process.exitCode = failures.length ? 1 : 0;
};

run();
