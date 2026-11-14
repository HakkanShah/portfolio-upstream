import { Github, Linkedin, Mail, Phone, Sparkles, Bot, Workflow, Network, Wrench, Mic } from 'lucide-react';
import {
  SiNextdotjs,
  SiReact,
  SiTypescript,
  SiNodedotjs,
  SiExpress,
  SiMongodb,
  SiMysql,
  SiPostgresql,
  SiTailwindcss,
  SiGit,
  SiVercel,
  SiJavascript,
  SiHtml5,
  SiCss3,
  SiPython,
  SiC,
  SiFirebase,
  SiSupabase,
  SiFlask,
  SiRedis,
  SiGithub,
  SiNetlify,
  SiFramer,
  SiOpenai,
  SiAnthropic,
  SiGoogle,
  SiSpring,
  SiShadcnui,
  SiElectron,
  SiDotnet,
  SiSharp,
  SiApple,
  SiAndroid,
} from 'react-icons/si';
import { VscVscode } from 'react-icons/vsc';
import { DiJava } from 'react-icons/di';
import { FaLightbulb, FaUsers, FaComments } from 'react-icons/fa';
import { FcGoogle } from 'react-icons/fc';
import { CursorIcon, AntigravityIcon } from '@/components/custom-icons';

export const NAV_LINKS = [
  { name: 'Home', href: '#home' },
  { name: 'About', href: '#about' },
  { name: 'Experience', href: '#experience' },
  { name: 'Projects', href: '#projects' },
  { name: 'GitHub', href: '#github' },
  { name: 'Skills', href: '#skills' },
  { name: 'Education', href: '#education' },
  { name: 'Certifications', href: '#certifications' },
];

export const SOCIAL_LINKS = [
  { name: 'GitHub', url: 'https://github.com/HakkanShah', icon: Github },
  { name: 'LinkedIn', url: 'https://www.linkedin.com/in/hakkan/', icon: Linkedin },
  { name: 'Gmail', url: 'mailto:hakkanparbej@gmail.com', icon: Mail },
];

export type Project = {
  title: string;
  description: string;
  longDescription: string;
  why: string;
  thumbnail: string;
  tags: string[];
  liveUrl: string;
  repoUrl: string;
  aiHint: string;
};

export const PROJECTS: Project[] = [
  {
    title: 'OHMSchool',
    description: 'An adaptive K-12 learning platform that reshapes the curriculum around each student, with a 24/7 AI mentor.',
    longDescription: 'OHMSchool is a school shaped like the student. Instead of pushing every child through a fixed syllabus, an adaptive engine reroutes the curriculum through whatever the learner already loves — teaching quadratics through the arc of a skateboard ollie, or structural engineering through the ramp they skate on. It pairs interest-driven lesson generation with a 24/7 AI mentor, multilingual support by default, and learning maps that track mastery in real time. Built and shipped at Persist; now enrolling for Fall 2026.',
    why: 'The classroom model was built in 1894 and it still assumes every kid learns the same way at the same pace. I wanted to prove the opposite is buildable: that a curriculum can bend to the student instead of the other way around, and that an AI mentor available at 3am is worth more than a syllabus nobody chose.',
    thumbnail: '/project-images/ohmschool.png',
    tags: ['Next.js', 'TypeScript', 'LLM', 'Adaptive Learning', 'AI Mentor', 'Multilingual', 'Tailwind CSS'],
    liveUrl: 'https://www.ohmschool.org/',
    repoUrl: '',
    aiHint: 'adaptive learning platform',
  },
  {
    title: 'Ek Aur',
    description: 'An Android app that counts the Reels and Shorts you scroll — and cheers you on for one more, while the number quietly turns you in.',
    longDescription: 'Ek Aur puts a floating counter over Instagram and YouTube while you are in Reels or Shorts, and both feed the same number. There are no lectures and no streaks to protect: it hands you the count, drops a dry roast at every milestone, and when you hit the limit you set a meme lands over the feed instead of a wellness sermon — tap "10 More" and it steps aside, then comes back with a new one. An accessibility service does the counting and Room keeps every raw event on the phone; only a username and a daily total — a date, a count, a duration — ever reach Supabase, which is all the shared leaderboard is built from. Android only and sideloaded, with a Next.js site for the download and the leaderboard.',
    why: 'Screen-time dashboards scold you after the fact, which is easy to ignore. I wanted the number in front of me while I was still scrolling, framed as encouragement rather than a telling-off — which turns out to be far more uncomfortable, and far more effective. It also forced the privacy question up front: the raw events have nowhere to go but the phone, and one setting takes you off the leaderboard entirely.',
    thumbnail: '/project-images/ek-aur.png',
    tags: ['Kotlin', 'Jetpack Compose', 'Android', 'Room', 'Supabase', 'Next.js'],
    liveUrl: 'https://ek-aur.vercel.app',
    repoUrl: 'https://github.com/HakkanShah/Ek-Aur',
    aiHint: 'reels counter android app',
  },
  {
    title: 'AURA',
    description: 'A chat- and voice-driven desktop agent that operates your computer like a human — no code, no setup.',
    longDescription: 'AURA is the UI for OpenClaw: speak or type your intent and it drives your actual desktop to the outcome — booking a flight, applying to a job, summarising an inbox. Rather than wrapping rigid REST APIs, it pilots the real interface layer with full DOM reasoning across nested frames, backed by always-listening streaming speech-to-text, encrypted identity and form memory, a verify-before-act protocol, and fully local isolated execution so nothing runs on a remote container. Currently in v0.2 open beta, built in the open at Persist.',
    why: 'Most "AI automation" breaks the moment a site changes a class name, because it is really just a brittle script wearing a model as a hat. I wanted an agent that reasons about the interface the way a person does — look, decide, verify, act — and that runs on your own machine so the automation never costs you your privacy.',
    thumbnail: '/project-images/aura.png',
    tags: ['AI Agents', 'DOM Reasoning', 'Next.js', 'TypeScript', 'Python', 'Speech-to-Text', 'Desktop Automation'],
    liveUrl: 'https://aura-website-ashen.vercel.app/',
    repoUrl: '',
    aiHint: 'desktop ai agent',
  },
  {
    title: 'Commit Habit',
    description: 'A GitHub App that helps developers maintain daily GitHub activity streaks securely without Personal Access Tokens.',
    longDescription: 'Commit Habit is a free, open-source GitHub App designed to help developers maintain their daily GitHub activity streak. It uses GitHub App OAuth for secure authentication, automatically creates minimal README commits (whitespace changes) on days without activity, and provides smart scheduling that skips days when you have real commits. Features include a beautiful dashboard, daily limits (max 5 commits), email notifications, and Discord webhook analytics integration.',
    why: 'I built Commit Habit to solve a common developer challenge - maintaining GitHub activity streaks during busy periods. Traditional solutions require Personal Access Tokens which pose security risks. By building a GitHub App instead, I created a more secure, transparent, and user-controllable solution. It also taught me about GitHub App development, OAuth flows, JWT authentication, and cron job scheduling.',
    thumbnail: '/project-images/commithabit.png',
    tags: ['Next.js', 'TypeScript', 'Prisma', 'PostgreSQL', 'GitHub API', 'Tailwind CSS', 'Vercel'],
    liveUrl: 'https://commithabit.vercel.app',
    repoUrl: 'https://github.com/HakkanShah/commit-habit',
    aiHint: 'github streak automation',
  },
  {
    title: 'MockHick',
    description: 'Voice-Driven AI-powered web app that simulates mock interviews.',
    longDescription: 'MockHick is an innovative, AI-powered web application designed to help users prepare for job interviews. Inspired by the Hindi word "Maukhik" (मौखिक), which means oral or spoken, the app simulates a realistic interview experience. It leverages Gemini AI to dynamically generate questions, provide real-time transcription, and deliver detailed, personalized feedback to help users build confidence and land their dream job.',
    why: 'I built MockHick to help students and job seekers practice interviews in a realistic way without needing another person. Many people feel underconfident or don’t always have someone available to take their mock interviews. MockHick uses AI, voice interaction (Web Speech API), and clean UI (ShadCN UI) to simulate real interview scenarios, provide feedback, and build communication confidence. The main goal is to make interview preparation more accessible, interactive, and less stressful.',
    thumbnail: '/project-images/mockhick.png',
    tags: ['Next.js', 'Gemini AI', 'TypeScript', 'Firebase', 'Web Speech API', 'TailwindCSS', 'ShadCN'],
    liveUrl: 'https://mockhick.vercel.app/',
    repoUrl: 'https://github.com/HakkanShah/mockhick',
    aiHint: 'ai interview coach',
  },
  {
    title: 'Throughput',
    description: 'A lightweight Windows utility that displays real-time network speed as an always-on-top overlay with on-demand bandwidth speed test.',
    longDescription: 'Throughput is a lightweight Windows utility that shows real-time network download and upload speeds in a compact, always-on-top overlay. It features auto-detection of active network adapters, minimal CPU usage, and a draggable interface. Additionally, it includes an on-demand speed test that measures actual internet bandwidth with parallel connections, latency testing, and warm-up exclusion for accuracy. Built with WPF and .NET 8, it uses Windows Performance Counters for live monitoring and Cloudflare CDN endpoints for speed tests.',
    why: 'I built Throughput because I wanted a clean, privacy-focused network monitor that stays out of the way while still being accessible. Most network monitors are either too bloated or require external services. This tool does everything locally with no telemetry, no data collection, and no accounts required.',
    thumbnail: '/project-images/throughput.png',
    tags: ['.NET 8', 'WPF', 'C#', 'Windows', 'Performance Counters', 'Inno Setup'],
    liveUrl: 'https://github.com/HakkanShah/Throughput/releases',
    repoUrl: 'https://github.com/HakkanShah/Throughput',
    aiHint: 'network speed monitor',
  },
  {
    title: 'BuildMyCV',
    description: 'An AI-powered resume builder for creating professional CVs in minutes.',
    longDescription: 'BuildMyCV uses AI to help users craft the perfect resume. It suggests powerful action verbs, formats content professionally, and tailors the resume to specific job descriptions, making job applications faster and more effective.',
    why: 'I wanted to simplify the often-tedious process of resume writing. By leveraging AI, this tool empowers users to present their skills and experience in the best possible light with minimal effort.',
    thumbnail: '/project-images/buildmycv.png',
    tags: ['React', 'TypeScript', 'Nextjs', 'Genkit', 'PDF Generation'],
    liveUrl: 'https://cvbanao.netlify.app/',
    repoUrl: 'https://github.com/HakkanShah/BuildMyCV',
    aiHint: 'resume builder',
  },
  {
    title: 'VerifyAI',
    description: 'An AI tool for detecting fake news, deepfakes, and AI-generated content.',
    longDescription: 'VerifyAI is a powerful tool designed to combat misinformation. It analyzes text, images, and videos to detect signs of manipulation or AI generation, providing a trust score for online content.',
    why: 'With the rise of AI-generated content, I saw a need for a tool that could help users distinguish between authentic and fake information. This project was my attempt to address that challenge using machine learning.',
    thumbnail: '/project-images/verifyai.png',
    tags: ['JavaScript', 'Python', 'Next.js', 'Gemini API', 'TensorFlow'],
    liveUrl: 'https://verifyai.is-a.software/',
    repoUrl: 'https://github.com/HakkanShah/VerifyAI',
    aiHint: 'deepfake detection',
  },
  {
    title: "Rubik's Cube Solver",
    description: 'Interactive 3D Rubik\'s Cube with solving capabilities and step-by-step tutorials.',
    longDescription: "An interactive 3D Rubik's Cube application featuring Play Mode with smooth animations and keyboard shortcuts, Learn Mode with a 7-step layer-by-layer tutorial, and Solve Mode where you can paint your cube state and get a CFOP-based solution. Built with vanilla JavaScript and Three.js, featuring a modern dark theme with starfield background, responsive design, and sound effects.",
    why: "I wanted to combine my love for puzzles with 3D graphics programming. This project allowed me to dive deep into Three.js for rendering, implement complex solving algorithms (CFOP method), and create an engaging tutorial system to help others learn how to solve the cube step-by-step.",
    thumbnail: '/project-images/cubesolver.png',
    tags: ['JavaScript', 'Three.js', 'HTML', 'CSS', 'Web Audio API'],
    liveUrl: 'https://hakkanshah.github.io/R-Cube-Solver/',
    repoUrl: 'https://github.com/HakkanShah/R-Cube-Solver',
    aiHint: 'rubik cube solver',
  },
  {
    title: 'ConfessCode',
    description: 'An anonymous confession platform ensuring user privacy and secure messaging.',
    longDescription: 'ConfessCode is a secure and anonymous platform where users can freely share their thoughts, confessions, and secrets without revealing their identity. It uses robust authentication and encryption to ensure that all messages are private and untraceable.',
    why: 'I built this project to explore secure authentication methods and to create a safe online space for open expression, something I feel is increasingly important in today\'s digital world.',
    thumbnail: '/project-images/confesscode.png',
    tags: ['Next.js', 'TypeScript', 'Supabase', 'tailwind', 'ShadCN'],
    liveUrl: 'https://concode.vercel.app/',
    repoUrl: 'https://github.com/HakkanShah/ConfessCode',
    aiHint: 'anonymous confession',
  },
  {
    title: 'MemeMate',
    description: 'A prototype for a meme-based social and dating application.',
    longDescription: 'MemeMate is a conceptual dating app that matches users based on their sense of humor. It allows users to share and react to memes, creating a fun and lighthearted way to connect with new people.',
    why: 'This was a fun project to prototype a unique app idea and practice my UI/UX design skills. It combines social media elements with a dating-app framework to create a novel user experience.',
    thumbnail: '/project-images/mememate.png',
    tags: ['React', 'NextJS', 'TypeScript', 'Tailwind'],
    liveUrl: 'https://mememate.netlify.app/',
    repoUrl: 'https://github.com/HakkanShah/MemeMate',
    aiHint: 'meme dating app',
  },

  {
    title: 'AluChat',
    description: 'A dual-personality AI chatbot that can switch between being sweet and savage.',
    longDescription: 'AluChat is an interactive AI chatbot with a twist. Users can toggle its personality from a friendly, helpful assistant to a witty and savage companion. It\'s built to showcase the versatility of modern language models.',
    why: 'I wanted to experiment with AI and prompt engineering to create a more engaging and entertaining chatbot experience than the typical customer service bots.',
    thumbnail: '/project-images/aluchat.png',
    tags: ['JavaScript', 'Tailwind', 'Next', 'Gemini API'],
    liveUrl: 'https://aluchat.netlify.app/',
    repoUrl: 'https://github.com/HakkanShah/AluChat',
    aiHint: 'ai chatbot',
  },
  {
    title: 'ReelXtract',
    description: 'Intagram Reels Downloader.',
    longDescription: 'ReelXtract is a simple and fast tool to download Instagram Reels instantly. Just paste the Reel URL, click download, and save the video with a sleek Instagram-themed UI.',
    why: 'One-click download of Instagram Reels',
    thumbnail: '/project-images/reelxtract.png',
    tags: ['JavaScript', 'Python', 'Flask', 'yt-dlp'],
    liveUrl: 'https://hakkanshah.github.io/ReelXtract/',
    repoUrl: 'https://github.com/HakkanShah/ReelXtract',
    aiHint: 'reels downloader',
  },
];

export const SKILLS = [
  {
    name: "AI Engineering",
    skills: [
      { name: "AI Agents", icon: Bot, color: "#7C5CFF" },
      { name: "LLM Orchestration", icon: Workflow, color: "#9B7BFF" },
      { name: "RAG", icon: Network, color: "#00C2A8" },
      { name: "Tool Use", icon: Wrench, color: "#FF7A45" },
      { name: "DOM Reasoning", icon: Sparkles, color: "#F7B500" },
      { name: "Speech-to-Text", icon: Mic, color: "#20C997" },
    ],
  },
  {
    name: "Frontend",
    skills: [
      { name: "HTML5", icon: SiHtml5, color: "#E34F26" },
      { name: "CSS3", icon: SiCss3, color: "#1572B6" },
      { name: "JavaScript", icon: SiJavascript, color: "#F7DF1E" },
      { name: "TypeScript", icon: SiTypescript, color: "#3178C6" },
      { name: "React.js", icon: SiReact, color: "#61DAFB" },
      { name: "Next.js", icon: SiNextdotjs },
    ],
  },
  {
    name: "Backend",
    skills: [
      { name: "Node.js", icon: SiNodedotjs, color: "#339933" },
      { name: "Next.js", icon: SiNextdotjs },
      { name: "Express.js", icon: SiExpress },
      { name: "Flask", icon: SiFlask },
    ],
  },
  {
    name: "Desktop & Mobile",
    skills: [
      { name: "React Native", icon: SiReact, color: "#61DAFB" },
      { name: "Android", icon: SiAndroid, color: "#3DDC84" },
      { name: "iOS", icon: SiApple },
      { name: "Electron", icon: SiElectron, color: "#47848F" },
      { name: ".NET", icon: SiDotnet, color: "#512BD4" },
      { name: "C#", icon: SiSharp, color: "#68217A" },
    ],
  },
  {
    name: "Database",
    skills: [
      { name: "MongoDB", icon: SiMongodb, color: "#47A248" },
      { name: "MySQL", icon: SiMysql, color: "#4479A1" },
      { name: "PostgreSQL", icon: SiPostgresql, color: "#4169E1" },
      { name: "Supabase", icon: SiSupabase, color: "#3ECF8E" },
      { name: "Redis", icon: SiRedis, color: "#DC382D" },
      { name: "Firestore", icon: SiFirebase, color: "#FFCA28" },
    ],
  },
  {
    name: "UI/UX",
    skills: [
      { name: "Tailwind CSS", icon: SiTailwindcss, color: "#06B6D4" },
      { name: "Framer Motion", icon: SiFramer, color: "#0055FF" },
      { name: "shadcn/ui", icon: SiShadcnui },
    ],
  },
  {
    name: "Tools",
    skills: [
      { name: "Git", icon: SiGit, color: "#F05032" },
      { name: "GitHub", icon: SiGithub },
      { name: "VS Code", icon: VscVscode, color: "#007ACC" },
      { name: "Firebase", icon: SiFirebase, color: "#FFCA28" },
      { name: "Vercel", icon: SiVercel },
      { name: "Netlify", icon: SiNetlify, color: "#00C7B7" },
      { name: "Cursor", icon: CursorIcon },
      { name: "Google's Antigravity", icon: AntigravityIcon, color: "#4285F4" },
      { name: "Firebase Studio", icon: SiFirebase, color: "#FFCA28" },
    ],
  },
  {
    name: "AI Tools",
    skills: [
      { name: "ChatGPT", icon: SiOpenai, color: "#10A37F" },
      { name: "Claude", icon: SiAnthropic, color: "#FFD700" },
      { name: "Gemini", icon: SiGoogle, color: "#4285F4" },
    ],
  },
  {
    name: "Programming Languages",
    skills: [
      { name: "Java", icon: DiJava, color: "#007396" },
      { name: "C", icon: SiC, color: "#A8B9CC" },
      { name: "Python", icon: SiPython, color: "#3776AB" },
    ],
  },
  {
    name: "Soft Skills",
    skills: [
      { name: "Problem Solving", icon: FaLightbulb, color: "#FFD700" },
      { name: "Teamwork", icon: FaUsers, color: "#228BE6" },
      { name: "Communication", icon: FaComments, color: "#20C997" },
    ],
  }
];

export type Experience = {
  role: string;
  company: string;
  period: string;
  description: string;
  reality: string;
  offerLetter?: string;
  /** Public proof of the role — rendered as a link button on the card. */
  profileUrl?: string;
  profileLabel?: string;
  details: {
    overview: string;
    responsibilities: string[];
    realityResponsibilities: string[];
    technologies: string[];
    achievements: string[];
    realityAchievements: string[];
  };
};

export const EXPERIENCE: Experience[] = [
  {
    role: 'Fullstack AI Engineer',
    company: 'Persist',
    period: 'Present',
    description: 'Building AI products end to end at Persist — the agent that thinks, the backend that scales, and the interface humans actually enjoy using. Joined in Feb 2026 after winning Startupathon against 250+ builders.',
    reality: "Won a build competition against 250+ people, turned down two campus placements, and now I ship agents that browse the internet better than I do. No safety net, no complaints — mostly I just argue with a DOM tree until it obeys.",
    profileUrl: 'https://hakkan.persist.org',
    profileLabel: 'Persist Profile',
    details: {
      overview: 'Persist funds overlooked builders to become founders. As one of the Persistians, I own products from empty repo to production — model behaviour, backend, and UI treated as one single thing. Two live products in the first five months.',
      responsibilities: [
        'Built OHMSchool end to end — an adaptive K-12 learning platform that reroutes curriculum through whatever a student already cares about',
        'Designed the adaptive engine and 24/7 AI mentor powering personalised, interest-driven learning paths',
        'Building AURA, a chat- and voice-driven agent that drives a real desktop through full DOM reasoning instead of brittle scripts',
        'Implemented always-listening voice input with streaming speech-to-text and a verify-before-act safety protocol',
        'Shipped local, isolated execution so agent runs stay on the user’s machine rather than a remote container',
        'Own the product UI/UX — motion, hierarchy and feel — so the intelligence is legible instead of just impressive',
      ],
      realityResponsibilities: [
        "Rebuilt school from scratch. The 1894 model had a good run, but it never met a kid who learns quadratics through skateboard ollies.",
        "The AI mentor is patient, available at 3am, and never once sighed at a repeated question. Setting a high bar for humans.",
        "Taught software to click buttons like a person. It now fails in exactly the same places a person does, which I'm calling progress.",
        "Always-listening voice means the agent has heard things. It will not be testifying.",
        "Local execution: your data never leaves your machine, and neither does the blame.",
        "Spent a full day on one easing curve. Worth it. Do not ask me to justify this.",
      ],
      technologies: ['Next.js', 'TypeScript', 'Node.js', 'Python', 'LLM Orchestration', 'AI Agents', 'RAG', 'Tool Use', 'DOM Automation', 'Speech-to-Text', 'Tailwind CSS'],
      achievements: [
        'Won Persist Startupathon out of 250+ builders — no résumé screening, merit over pedigree',
        'Shipped OHMSchool to production; now enrolling for Fall 2026',
        'Took AURA to v0.2 open beta, built publicly',
        'Two live products inside five months of joining',
      ],
      realityAchievements: [
        "Beat 250+ builders. Still slightly convinced they miscounted.",
        "OHMSchool is live and real children are learning from it. That thought keeps me humble and mildly terrified.",
        "AURA hit v0.2 beta. The 'v0.1' stories will stay between me and my logs.",
        "Two products in five months. My sleep schedule filed a formal complaint.",
      ],
    },
  },
  {
    role: 'Full Stack Developer Intern',
    company: 'UDRCRAFTS INDIA PVT. LTD.',
    period: 'Previous',
    description: 'Developed full-stack solutions, handling both frontend interfaces and backend logic to deliver robust web products.',
    reality: "Honestly? It's mostly me fighting with CSS to center things while simultaneously praying the database doesn't catch fire. Full stack means full responsibility for the mess.",
    offerLetter: '/UdrCrafts_Internship_Offer_Letter.pdf',
    details: {
      overview: 'Developed a comprehensive e-commerce platform from scratch, handling both frontend and backend development.',
      responsibilities: [
        'Built responsive homepage components with modern UI/UX design',
        'Implemented advanced search functionality and product grid layouts',
        'Created product listing pages with filtering and sorting capabilities',
        'Developed backend APIs for fetching product details, pricing, and owner information',
        'Designed and implemented route handling for seamless navigation',
        'Managed database operations for product details and inventory',
        'Integrated payment gateway for secure transactions',
      ],
      realityResponsibilities: [
        "Spent 3 hours making a button perfectly centered, only for the client to say 'can we make it pop more?'",
        "The search bar works perfectly, as long as you type exactly what I tested with.",
        "Made the product grid responsive. By responsive, I mean it stacks vertically on mobile. Groundbreaking.",
        "Backend logic consisted of 50% actual code and 50% console.log('here?').",
        "Routing was a maze I built myself and then immediately got lost in.",
        "Database operations involved a lot of nervous sweating while running update queries.",
        "Payment integration: The most stressful part of my life. Please don't use real money yet.",
      ],
      technologies: ['React', 'Node.js', 'Express', 'MongoDB', 'Payment Gateway APIs', 'RESTful APIs', 'Database Design'],
      achievements: [
        'Delivered a fully functional e-commerce platform',
        'Implemented secure payment processing system',
        'Optimized database queries for improved performance',
      ],
      realityAchievements: [
        "The site didn't crash during the client demo. Huge success.",
        "Payment gateway works (I think). No one has complained about lost money yet.",
        "Made the database faster by adding indexes I should have added on day one.",
      ],
    },
  },
  {
    role: 'React and NextJS Developer Intern',
    company: 'AIKing Solutions',
    period: 'Previous',
    description: 'Working on cutting-edge web applications using React and Next.js, focusing on performance optimization and modern UI/UX practices.',
    reality: "React state management is my personal hell. Also, teaching an AI to interview people is harder than it sounds—mostly it just wants to take over the world or hallucinate.",
    offerLetter: '/AIKing_Solutions_Internship_Offer_Letter.pdf',
    details: {
      overview: 'Built an AI-powered voice/video-driven mock interview system enabling users to practice interviews with real-time AI feedback.',
      responsibilities: [
        'Designed and implemented seamless AI interviewer and user communication system',
        'Developed dynamic question and cross-question generation algorithms',
        'Enhanced AI interviewer voice to sound more human-like, similar to Gemini and other advanced AI models',
        'Implemented live voice transcription using Google TTS and WaveNet',
        'Fixed critical UI, functional, and UX bugs to improve user experience',
        'Enabled one-click download of recorded interview videos with audio',
      ],
      realityResponsibilities: [
        "Built a 'seamless' chat system that only lags when you really need it to work.",
        "The AI generates questions. Sometimes they even make sense.",
        "Spent days tweaking the voice so it doesn't sound like a haunted GPS.",
        "Transcription works great if you speak like a news anchor in a soundproof room.",
        "Squashed bugs. Well, I hid them under the rug with try-catch blocks.",
        "The download button works, but don't ask me how the blob conversion happens.",
      ],
      technologies: ['React', 'Next.js', 'Google TTS', 'WaveNet', 'AI/ML Integration', 'WebRTC', 'Real-time Communication'],
      achievements: [
        'Successfully created a production-ready AI interview platform',
        'Improved voice quality to achieve near-human conversational experience',
        'Reduced user friction with streamlined download functionality',
      ],
      realityAchievements: [
        "It actually works in production! (Most of the time).",
        "The AI voice is now only slightly terrifying.",
        "Users can download videos, and the file size isn't 0 bytes. Progress.",
      ],
    },
  },
];

export const EDUCATION = [
  {
    degree: 'B.Tech CSE',
    institution: 'Greater Kolkata College of Engineering and Management',
    period: '2022 – 2026',
    details: 'Graduated July 2026 · CGPA: 7.7/10',
  },
  {
    degree: 'Higher Secondary',
    institution: 'WBCHSE',
    period: '2022',
    details: 'Percentage: 85%',
  },
  {
    degree: 'Secondary',
    institution: 'WBBSE',
    period: '2020',
    details: 'Percentage: 80%',
  }
];

export const CERTIFICATIONS = [
  { name: 'Full-Stack(MERN) BCT Training', issuer: 'Euphoria GenX', url: 'https://drive.google.com/file/d/1EFpyLejBPAHJbNjRSWPk2-EvdYJKpisG/view?usp=sharing' },
  { name: 'AWS AI-ML Virtual Internship', issuer: 'Eduskills Foundation & AWS', url: 'https://drive.google.com/file/d/17ak5Lc2GkG4X2Hh0WGLOOwajs1GQYq5J/view?usp=sharing' },
  { name: 'Palo Alto Cybersecurity', issuer: 'Eduskills Foundation & Palo Alto', url: 'https://drive.google.com/file/d/18Bm-x7BD8kj4-EZnPQYFQt6WbV6I0Jiv/view?usp=sharing' },
  { name: 'Blue Prism Automation', issuer: 'Eduskills Foundation & Blue Prism', url: 'https://drive.google.com/file/d/1S2qRZhRRxTqQg2U6mso1ljgzTKaVRALT/view?usp=sharing' },
  { name: 'Zscaler Zero Trust Security', issuer: 'Eduskills Foundation & Zscaler', url: 'https://drive.google.com/file/d/1V31whUog2M8rhOW69HgZjBil1mazVY13/view?usp=sharing' },
];

/**
 * Stats shown in the GitHub Activity section. Kept here rather than inside the
 * component so the AI assistant can answer questions about them too — the live
 * contribution calendar is fetched at render time, but these numbers are not.
 * Update them when they drift.
 */
export type GitHubAchievement = { name: string; badge?: string; img: string };

export const GITHUB_STATS: {
  username: string;
  publicRepos: number;
  totalPRs: number;
  longestStreak: { days: number; period: string };
  topLanguage: string;
  languages: { name: string; percentage: number }[];
  achievements: GitHubAchievement[];
} = {
  username: 'HakkanShah',
  publicRepos: 38,
  totalPRs: 57,
  longestStreak: { days: 77, period: 'Mar 5 – May 20, 2025' },
  topLanguage: 'TypeScript',
  languages: [
    { name: 'TypeScript', percentage: 70.62 },
    { name: 'JavaScript', percentage: 16.32 },
    { name: 'CSS', percentage: 8.38 },
    { name: 'HTML', percentage: 4.22 },
    { name: 'EJS', percentage: 0.25 },
    { name: 'Python', percentage: 0.21 },
  ],
  achievements: [
    { name: 'Pull Shark', badge: 'x3', img: 'https://github.githubassets.com/assets/pull-shark-default-498c279a747d.png' },
    { name: 'Pair Extraordinaire', badge: 'x3', img: 'https://user-images.githubusercontent.com/101352977/178841186-98adb2c7-3c39-4e69-8251-09891cbe1983.png' },
    { name: 'Quickdraw', img: 'https://github.githubassets.com/assets/quickdraw-default-39c6aec8ff89.png' },
    { name: 'YOLO', img: 'https://github.githubassets.com/assets/yolo-default-be0bbff04951.png' },
  ],
};

export const CONTACT_INFO = [
  { name: 'Email', value: 'hakkanparbej@gmail.com', icon: Mail, href: 'mailto:hakkanparbej@gmail.com', color: '#EA4335' },
  { name: 'Phone', value: '+91-7810843038', icon: Phone, href: 'tel:+917810843038', color: '#43C59E' },
  { name: 'GitHub', value: 'HakkanShah', icon: Github, href: 'https://github.com/HakkanShah' },
  { name: 'LinkedIn', value: 'hakkan', icon: Linkedin, href: 'https://www.linkedin.com/in/hakkan/', color: '#0A66C2' },
  { name: 'G.Dev Profile', value: 'hakkan', icon: FcGoogle, href: 'https://g.dev/hakkan' },
  { name: 'Persist', value: 'hakkan.persist.org', icon: Sparkles, href: 'https://hakkan.persist.org', color: '#7C5CFF' },
];

export const ABOUT_ME = "Fullstack AI Engineer at Persist, where I treat the model, the backend and the pixels as one single product. I won Persist's Startupathon against 250+ builders in February 2026, turned down two campus placements to take the job, and finished my B.Tech in CSE that July with two live products already shipped — OHMSchool, an adaptive K-12 learning platform, and AURA, a desktop agent that operates your computer through real DOM reasoning. I build AI agents that act on real interfaces, the fullstack machinery that keeps them reliable, and the UI that makes the intelligence feel obvious. Based in India, building remotely for four continents."


