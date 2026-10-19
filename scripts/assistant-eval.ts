/**
 * Assistant eval harness
 *
 *   npm run assistant:eval            # run every case
 *   npm run assistant:eval -- --fail  # print only failures
 *
 * Each case lists substrings the answer must contain (and optionally must not).
 * This is how we keep the bot honest: add a case before fixing a bad answer.
 */

import { createMemory, respond, type BrainMemory } from '../src/lib/assistant/brain/brain';

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
    /** The reply must be answered locally (no LLM fallback needed). */
    mustAnswer?: boolean;
}

const CASES: Case[] = [
    // --- identity / small talk ---
    { q: 'hi', any: ['assistant', 'projects'], mustAnswer: true },
    { q: 'hey there', any: ['assistant', 'projects'], mustAnswer: true },
    { q: 'who are you', expect: ['portfolio assistant'], reject: ['Hit-The-Jhatu'], mustAnswer: true },
    { q: 'are you a real human', any: ['assistant', 'on-device'], mustAnswer: true },
    { q: 'what can you do', any: ['Commit Habit', 'ask me', 'Try things'], mustAnswer: true },
    { q: 'thanks!', any: ['Anytime', 'Happy to help'], mustAnswer: true },
    { q: 'bye', any: ['Thanks for stopping by', 'See you'], mustAnswer: true },

    // --- about ---
    { q: 'who is hakkan', expect: ['Hakkan Parbej Shah'], mustAnswer: true },
    { q: 'tell me about him', any: ['full-stack', 'developer'], mustAnswer: true },
    { q: 'where is he based', any: ['Kolkata'], mustAnswer: true },
    { q: 'where does he live', any: ['Kolkata'], mustAnswer: true },

    // --- contact ---
    { q: 'whats his email', expect: ['hakkanparbej@gmail.com'], reject: ['Jhatu'], mustAnswer: true },
    { q: 'email id', expect: ['hakkanparbej@gmail.com'], mustAnswer: true },
    { q: 'how do i contact him', any: ['hakkanparbej@gmail.com'], mustAnswer: true },
    { q: 'his phone number', expect: ['7810843038'], mustAnswer: true },
    { q: 'linkedin', expect: ['linkedin.com/in/hakkan'], mustAnswer: true },
    { q: 'show me his github', expect: ['HakkanShah'], mustAnswer: true },
    { q: 'can i reach him on whatsapp', expect: ['7810843038'], mustAnswer: true },

    // --- availability / hiring ---
    { q: 'is he available for hire', any: ['open to', 'full-time'], mustAnswer: true },
    { q: 'is he looking for a job', any: ['open to', 'full-time'], mustAnswer: true },
    { q: 'does he do freelance', any: ['freelance'], mustAnswer: true },
    { q: 'why should i hire him', any: ['Ships end to end', 'internships'], mustAnswer: true },
    { q: 'can i hire him for a project', any: ['open to', 'hakkanparbej@gmail.com'], mustAnswer: true },
    { q: 'send me his resume', any: ['Download CV', 'resume'], mustAnswer: true },
    { q: 'where is the cv', any: ['Download CV'], mustAnswer: true },

    // --- education ---
    { q: 'what is his cgpa', expect: ['7.5'], mustAnswer: true },
    { q: 'his marks', expect: ['7.5'], mustAnswer: true },
    { q: 'where did he study', expect: ['Greater Kolkata College'], mustAnswer: true },
    { q: 'which college does he go to', expect: ['Greater Kolkata College'], mustAnswer: true },
    { q: 'what is he studying', any: ['B.Tech', 'CSE'], mustAnswer: true },
    { q: 'when does he graduate', any: ['2026'], mustAnswer: true },
    { q: 'his 12th percentage', any: ['85'], mustAnswer: true },

    // --- experience ---
    { q: 'what is his work experience', any: ['UDRCRAFTS', 'internship'], mustAnswer: true },
    { q: 'has he done any internships', any: ['UDRCRAFTS', 'AIKing'], mustAnswer: true },
    { q: 'what did he do at udrcrafts', any: ['e-commerce'], mustAnswer: true },
    { q: 'tell me about aiking solutions', any: ['interview', 'AIKing'], mustAnswer: true },
    { q: 'where is he interning right now', any: ['UDRCRAFTS'], mustAnswer: true },
    { q: 'what tech did he use at aiking', any: ['WaveNet', 'Google TTS', 'React'], mustAnswer: true },

    // --- projects: listing / counts ---
    { q: 'show me his projects', any: ['Commit Habit', 'MockHick'], mustAnswer: true },
    { q: 'how many projects has he built', expect: ['12'], mustAnswer: true },
    { q: 'list all projects', any: ['Commit Habit', 'Throughput'], mustAnswer: true },
    { q: 'what has he built', any: ['Commit Habit', 'MockHick', 'projects'], mustAnswer: true },
    { q: 'his latest project', any: ['Commit Habit'], mustAnswer: true },
    { q: 'best project', any: ['MockHick', 'Commit Habit'], mustAnswer: true },
    { q: 'which project is the hardest', any: ['Rubik', 'Commit Habit'], mustAnswer: true },
    { q: 'what was his first project', any: ['Hit-The-Jhatu', 'oldest'], mustAnswer: true },
    { q: 'show me his ai projects', any: ['MockHick', 'VerifyAI'], mustAnswer: true },
    { q: 'any games he made', any: ['Jhatu', 'Rubik', 'game'], mustAnswer: true },

    // --- projects: specific ---
    { q: 'tell me about commit habit', expect: ['Commit Habit'], any: ['GitHub App', 'streak'], mustAnswer: true },
    { q: 'what is mockhick', expect: ['MockHick'], any: ['interview'], mustAnswer: true },
    { q: 'tell me about mockhik', expect: ['MockHick'], mustAnswer: true },          // typo
    { q: 'whats maukhik about', expect: ['MockHick'], mustAnswer: true },            // alias
    { q: 'what is throughput', expect: ['Throughput'], any: ['network'], mustAnswer: true },
    { q: 'verifyai', expect: ['VerifyAI'], mustAnswer: true },
    { q: 'the cube solver', any: ['Rubik'], mustAnswer: true },
    { q: 'confess code project', expect: ['ConfessCode'], mustAnswer: true },
    { q: 'reel downloader', expect: ['ReelXtract'], mustAnswer: true },
    { q: 'buildmycv', expect: ['BuildMyCV'], mustAnswer: true },
    { q: 'aluchat', expect: ['AluChat'], mustAnswer: true },
    { q: 'mememate', expect: ['MemeMate'], mustAnswer: true },
    { q: 'why did he build commit habit', any: ['Personal Access Token', 'streak'], mustAnswer: true },
    { q: 'commit habit tech stack', any: ['Prisma', 'PostgreSQL', 'Next.js'], mustAnswer: true },
    { q: 'link to mockhick', any: ['mockhick.vercel.app'], mustAnswer: true },
    { q: 'is commit habit open source', any: ['github.com/HakkanShah/commit-habit', 'Source'], mustAnswer: true },

    // --- tech capability ---
    { q: 'does he know python', expect: ['Yes'], any: ['VerifyAI', 'ReelXtract', 'Python'], mustAnswer: true },
    { q: 'has he worked with postgres', expect: ['Yes'], any: ['PostgreSQL'], mustAnswer: true },
    { q: 'is he good at react', expect: ['Yes'], mustAnswer: true },
    { q: 'does he know typescript', expect: ['Yes'], mustAnswer: true },
    { q: 'can he do backend work', any: ['Node.js', 'Express'], mustAnswer: true },
    { q: 'does he do frontend', any: ['React', 'Next.js'], mustAnswer: true },
    { q: 'what databases does he know', any: ['MongoDB', 'PostgreSQL'], mustAnswer: true },
    { q: 'does he use ai tools', any: ['Gemini', 'ChatGPT', 'Claude'], mustAnswer: true },
    { q: 'which project uses three.js', any: ['Rubik'], mustAnswer: true },
    { q: 'which projects use gemini', any: ['MockHick', 'VerifyAI'], mustAnswer: true },
    { q: 'does he know flask', expect: ['Yes'], any: ['Flask', 'ReelXtract'], mustAnswer: true },
    { q: 'has he used dotnet', expect: ['Yes'], any: ['Throughput', '.NET'], mustAnswer: true },
    { q: 'does he know rust', any: ["isn't listed"], mustAnswer: true },
    { q: 'is he familiar with kubernetes', any: ["isn't listed"], mustAnswer: true },
    { q: 'what are his skills', any: ['React', 'Node.js'], reject: ['I am a bot'], mustAnswer: true },
    { q: 'what are his strongest skills', any: ['Next.js', 'TypeScript'], mustAnswer: true },
    { q: 'what tech does he use most', any: ['React', 'Next.js', 'TypeScript'], mustAnswer: true },
    { q: 'what programming languages does he know', any: ['Java', 'Python'], mustAnswer: true },

    // --- certifications ---
    { q: 'his certifications', any: ['AWS', 'MERN'], mustAnswer: true },
    { q: 'how many certifications does he have', expect: ['5'], mustAnswer: true },
    { q: 'does he have an aws certificate', any: ['AWS'], mustAnswer: true },
    { q: 'any cybersecurity courses', any: ['Palo Alto'], mustAnswer: true },

    // --- site / meta ---
    { q: 'how was this portfolio built', any: ['Next.js', 'Three.js'], mustAnswer: true },
    { q: 'are there hidden games here', any: ['Snake', 'games'], mustAnswer: true },
    { q: 'his github stats', any: ['27', 'streak'], mustAnswer: true },
    { q: 'how many repos does he have', any: ['27'], mustAnswer: true },

    // --- navigation ---
    { q: 'take me to projects', any: ['Projects'], mustAnswer: true },
    { q: 'scroll to contact', any: ['Contact'], mustAnswer: true },
    { q: 'go to skills section', any: ['Skills'], mustAnswer: true },

    // --- follow-ups (memory) ---
    { after: 'tell me about commit habit', q: 'tell me more', any: ['Commit Habit'], mustAnswer: true },
    { after: 'tell me about mockhick', q: 'why did he build it', any: ['MockHick', 'interview'], mustAnswer: true },
    { after: 'tell me about throughput', q: 'whats the tech stack', any: ['.NET', 'WPF'], mustAnswer: true },
    { after: 'tell me about verifyai', q: 'give me the link', any: ['verifyai'], mustAnswer: true },
    { after: 'show me his projects', q: 'show me another one', any: ['Stack'], mustAnswer: true },

    // --- regression cases for bugs found while rebuilding ---
    { q: 'summarize his portfolio', any: ['in short', 'Kolkata'], mustAnswer: true },
    { q: 'what kind of developer is he', any: ['full-stack'], mustAnswer: true },
    { q: 'what does he do', any: ['full-stack', 'developer'], mustAnswer: true },
    { q: 'does he have experience with payment gateways', any: ['UDRCRAFTS', 'Payment Gateway'], mustAnswer: true },
    { q: 'whats his strongest language', any: ['TypeScript'], reject: ['Commit Habit runs on'], mustAnswer: true },
    { q: 'tell me something interesting', any: ["here's one"], mustAnswer: true },
    { q: 'how old is he', any: ["isn't listed"], mustAnswer: true },
    { q: 'whats his notice period', any: ["isn't listed"], mustAnswer: true },
    { q: 'can he build a mobile app', any: ["isn't listed"], mustAnswer: true },
    { q: 'who built this website', any: ['Next.js 16', 'Three.js'], reject: ['ReelXtract'], mustAnswer: true },
    { q: 'any open source work', any: ['public', 'Source'], mustAnswer: true },
    { q: 'where can i see his code', any: ['HakkanShah'], reject: ['ConfessCode —'], mustAnswer: true },
    { q: 'which project got the most attention', any: ['12 projects', 'Commit Habit'], mustAnswer: true },
    { q: 'what did he learn at aiking', any: ['interview', 'AIKing'], mustAnswer: true },
    { q: 'does he do ui design', any: ['Tailwind', 'Framer'], mustAnswer: true },
    { q: 'what is reelxtract built with', any: ['Flask', 'yt-dlp'], mustAnswer: true },
    { q: 'is he still studying', any: ['B.Tech', '2026'], mustAnswer: true },
    { q: 'what is commit habit built with', any: ['Prisma', 'PostgreSQL'], mustAnswer: true },
    { q: 'next.js experience', any: ['Yes'], mustAnswer: true },
    { q: 'show me another project', any: ['Stack'], after: 'show me his projects', mustAnswer: true },

    // --- things it should NOT pretend to know ---
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
        if (testCase.after) memory = respond(testCase.after, memory).memory;

        const started = performance.now();
        const result = respond(testCase.q, memory);
        timings.push(performance.now() - started);

        const text = result.answer.text.toLowerCase();
        const problems: string[] = [];

        for (const needle of testCase.expect ?? []) {
            if (!text.includes(needle.toLowerCase())) problems.push(`missing "${needle}"`);
        }
        if (testCase.any?.length && !testCase.any.some((needle) => text.includes(needle.toLowerCase()))) {
            problems.push(`none of [${testCase.any.join(', ')}]`);
        }
        for (const needle of testCase.reject ?? []) {
            if (text.includes(needle.toLowerCase())) problems.push(`should not say "${needle}"`);
        }
        if (testCase.mustAnswer && result.answer.needsLLM) problems.push('fell through to LLM fallback');

        if (problems.length) {
            failures.push(
                `✗ ${testCase.after ? `[after: ${testCase.after}] ` : ''}"${testCase.q}"\n` +
                `    ${problems.join('; ')}\n` +
                `    handler=${result.answer.handler} conf=${result.answer.confidence.toFixed(2)}\n` +
                `    got: ${result.answer.text.replace(/\n+/g, ' ').slice(0, 160)}`
            );
        } else {
            passed += 1;
            if (!failuresOnly) {
                console.log(`✓ ${testCase.q.padEnd(42)} [${result.answer.handler}]`);
            }
        }
    }

    if (failures.length) {
        console.log(`\n${'='.repeat(70)}\nFAILURES\n${'='.repeat(70)}`);
        failures.forEach((failure) => console.log(`${failure}\n`));
    }

    const average = timings.reduce((sum, time) => sum + time, 0) / timings.length;
    const slowest = Math.max(...timings);

    console.log(`${'='.repeat(70)}`);
    console.log(`${passed}/${CASES.length} passed (${Math.round((passed / CASES.length) * 100)}%)`);
    console.log(`avg ${average.toFixed(2)}ms · slowest ${slowest.toFixed(2)}ms (first call builds the index)`);

    process.exitCode = failures.length ? 1 : 0;
};

run();
