// ============================================================================
//  CV DATA — the single place to edit the content of the game.
//  Sources: public/cv.pdf + LinkedIn export. Edit freely.
// ============================================================================

export const PROFILE = {
    name: 'Cristian-Florin Călina',
    title: 'Principal Software Engineer',
    location: 'Bellevue, Washington, USA',
    summary: 'Front-end engineer (React, Angular, web components) who grew from an intern in a Bucharest startup to Principal Engineer at UiPath in Bellevue. Eager to learn, adapt and overcome any challenge.',
    email: 'cristianflorincalina@gmail.com',
    links: [
        { label: 'LinkedIn', url: 'https://www.linkedin.com/in/cristianflorincalina/' },
        { label: 'GitHub', url: 'https://github.com/CalinaCristian' },
        { label: 'Medium', url: 'https://medium.com/@cristianflorincalina' },
        { label: 'dev.to', url: 'https://dev.to/cristianflorincalina' },
        { label: 'Stack Overflow', url: 'https://stackoverflow.com/users/19413118/cristian-florin-calina' },
        { label: 'Twitter / X', url: 'https://twitter.com/wastintimehere' },
        { label: 'CV (PDF)', url: '../public/cv.pdf' },
    ],
    topSkills: ['Front-End Development', 'JavaScript / TypeScript', 'React', 'Angular', 'Web Components (StencilJS)', 'Node.js & MongoDB', 'GraphQL', 'RxJS', 'Design Systems'],
    languages: [['Romanian', 'Native'], ['English', 'Full professional (Cambridge FCE B2)']],
};

// Each "stop" is a building in one of the two cities. `poi` must match a POI id in cities.js.
// Stations are the interactive screens inside the office.
export const STOPS = [
    {
        id: 'rosetti', poi: 'rosetti', city: 'bucharest', kind: 'school', order: 0,
        company: 'Liceul Teoretic C.A. Rosetti', short: 'C.A. Rosetti',
        role: 'Baccalaureate — Mathematics & Computer Science', period: '2009 – 2013', year: 2009,
        address: 'Str. Giuseppe Garibaldi 11, Sector 2 (Floreasca)',
        color: '#8b5cf6', icon: '🎓',
        tagline: 'Where it all started: math, first lines of code, and a lot of homework.',
        stations: [
            { title: 'High school', lines: ['Mathematics & Computer Science profile.', 'Graduated 2013 with the Baccalaureate.'] },
            { title: 'First code', lines: ['Pascal & C++ in the computer lab.', 'Learned that a missing semicolon can ruin an afternoon.'] },
        ],
    },
    {
        id: 'upb', poi: 'upb', city: 'bucharest', kind: 'school', order: 1,
        company: 'Politehnica University of Bucharest', short: 'Politehnica (UPB)',
        role: "Bachelor's degree, Computer Science", period: '2013 – 2017', year: 2013,
        address: 'Splaiul Independenței 313, Sector 6',
        color: '#6366f1', icon: '🏛️',
        tagline: 'Four years on the Splai: algorithms, operating systems, and projects now on GitHub.',
        stations: [
            { title: 'Degree', lines: ["Bachelor of Computer Science, Faculty of Automatic Control and Computers.", 'Student projects are on github.com/CalinaCristian.'] },
            { title: 'Hackathon trophy 🏆', lines: ['23 April 2017 — 1st place, BEST Engineering Marathon (BEST București).', 'Built a recruiting platform: recruiters post/edit/reassign jobs, candidates apply or email recruiters.'] },
        ],
    },
    {
        id: 'gts', poi: 'gts', city: 'bucharest', kind: 'office', order: 2,
        company: 'GTS Global Intelligence', short: 'GTS',
        role: 'Software Developer (intern → developer)', period: 'Jul 2015 – Aug 2017', year: 2015,
        address: 'Calea Călărașilor, la intersecția cu Str. Traian (lângă Hala Traian)',
        color: '#10b981', icon: '🚀',
        tagline: 'A 3-month internship that turned into the first job: startup mentality, Meteor and React.',
        stations: [
            { title: 'The job', lines: ['Developed a multi-tenant SaaS using Meteor (Node.js) with React and Blaze.', 'Joined as an intern for 3 months, then stayed 2 years.'] },
            { title: 'Learned here', lines: ['HTML, CSS & JavaScript from scratch.', 'WebSockets, Node.js & MongoDB, React & Meteor.', 'git CLI and how a startup works (and sleeps).'] },
            { title: 'Stack', chips: ['React', 'Meteor', 'Blaze', 'MongoDB', 'WebSockets', 'Trello', 'Git'] },
        ],
    },
    {
        id: 'luxoft', poi: 'luxoft', city: 'bucharest', kind: 'office', order: 3,
        company: 'Luxoft', short: 'Luxoft',
        role: 'Software Engineer', period: 'Sep 2017 – Dec 2017', year: 2017,
        address: 'Oregon Park, Șoseaua Pipera (confirm)',
        color: '#0ea5e9', icon: '🖧',
        tagline: 'A short stop in Pipera: enterprise front-end for network device configuration.',
        stations: [
            { title: 'The job', lines: ['Front-end of a network devices configuration application, built with ExtJS.', 'Java on the backend side of the house.'] },
            { title: 'Learned here', lines: ['ExtJS (yes, really).', 'SVN with TortoiseSVN — and why everyone moved to git.'] },
            { title: 'Stack', chips: ['ExtJS', 'TortoiseSVN', 'Java'] },
        ],
    },
    {
        id: 'db', poi: 'db', city: 'bucharest', kind: 'office', order: 4,
        company: 'Deutsche Bank — DB Global Technology', short: 'Deutsche Bank',
        role: 'Software Engineer', period: 'Dec 2017 – Dec 2018', year: 2017,
        address: 'Floreasca Park, Calea Floreasca 169A',
        color: '#1d4ed8', icon: '🏦',
        tagline: 'Real-time data in the browser, and a first taste of teaching.',
        stations: [
            { title: 'The job', lines: ['Front-end of a real-time data application: React, Redux, ES6+ and WebSockets.', 'Refactored a large codebase to decouple one business stream from the rest.', 'Reusable React components, unit-tested with Jest & Enzyme.'] },
            { title: 'Teaching & hiring', lines: ['Lead UI coach at DB Tech School 2018.', 'Trained students on Jest, React & Redux, reviewed every pull request.', 'Ran JavaScript / React courses for backend engineers moving to front-end.', 'Held technical interviews for front-end positions.'] },
            { title: 'Hackathons', lines: ['Hackathons on the side — that is where React Native got learned.'] },
            { title: 'Stack', chips: ['React', 'Redux', 'React Native', 'WebSockets', 'Jest', 'Enzyme', 'Mocha', 'Chai', 'Karma'] },
        ],
    },
    {
        id: 'arnia', poi: 'arnia', city: 'bucharest', kind: 'office', order: 5,
        company: 'Arnia Software', short: 'Arnia',
        role: 'Senior Software Engineer · Scrum Master · Mentor', period: 'Jan 2019 – Apr 2020', year: 2019,
        address: 'Bucharest (confirm street)',
        color: '#f59e0b', icon: '🧩',
        tagline: 'Three clients, three stacks: React, Next.js + GraphQL, and Vue. Plus a freelancing side-quest.',
        stations: [
            { title: 'Canadian client', lines: ['Multiple React projects: JavaScript → TypeScript migration, reusable components in the framework repo, estimates, features.', 'React, Redux, Reselect, redux-saga, ImmutableJS, material-ui.'] },
            { title: 'Swiss client #1 — Scrum Master', lines: ['Turned business requirements into epics, stories and 2-week sprints; built the MVP plan.', 'Mentored a junior developer, weekly client calls, daily Slack reports.', 'Full stack: React, Next.js, Redux, Apollo GraphQL, Express, MongoDB; CI/CD, Heroku & Zeit deploys.'] },
            { title: 'Swiss client #2 — Vue', lines: ['Learned Vue on the job, designed a feature-based folder structure.', 'Hot reloading integrated with Laravel; estimated the whole migration.'] },
            { title: 'Side quest: freelancing', lines: ['Aug 2019 – Apr 2020: React & Angular consultant / contractor (remote).', 'Node.js & MongoDB projects for various clients.'] },
            { title: 'Stack', chips: ['React', 'Next.js', 'TypeScript', 'Redux', 'GraphQL', 'Apollo', 'Express', 'MongoDB', 'Vue', 'Vuex', 'Heroku'] },
        ],
    },
    {
        id: 'uipath-buc', poi: 'uipath-buc', city: 'bucharest', kind: 'office', order: 6,
        company: 'UiPath — Bucharest HQ', short: 'UiPath Bucharest',
        role: 'Software Engineer II → Senior Software Engineer', period: 'Feb 2020 – Jul 2022', year: 2020,
        address: 'Str. Vasile Alecsandri 4, near Piața Romană',
        color: '#fa4616', icon: '🤖',
        tagline: 'Orchestrator front-end: Angular at scale, performance, 80% coverage, and a promotion.',
        stations: [
            { title: 'Software Engineer II (2020–21)', lines: ['Full time on UiPath Orchestrator (Angular + Angular Material).', 'Angular best practices: performance, unit, integration & e2e testing.', 'Contributed to private & public packages of reusable Angular components.', 'Wrote VS Code extensions to automate feature-flag chores.'] },
            { title: 'Senior Engineer (2021–22)', lines: ['Webpack Module Federation POCs for sharing components across apps.', 'Improved front-end performance with Angular best practices (wrote about it on Medium & dev.to).', 'Led the initiative that took front-end code coverage to 80%.'] },
            { title: 'Then…', lines: ['Summer 2022: packed the bags. Next stop: Otopeni airport → Seattle.', 'Drive north on DN1 to Henri Coandă airport to continue the story. ✈️'] },
            { title: 'Stack', chips: ['Angular', 'Angular Material', 'RxJS', 'TypeScript', 'Module Federation', 'Figma', 'Jira', 'Confluence'] },
        ],
    },
    {
        id: 'uipath-bel', poi: 'uipath-bel', city: 'seattle', kind: 'office', order: 7,
        company: 'UiPath — Bellevue, WA', short: 'UiPath Bellevue',
        role: 'Senior Software Engineer → Principal Software Engineer', period: 'Sep 2022 – present', year: 2022,
        address: 'Downtown Bellevue, WA (confirm building)',
        color: '#fa4616', icon: '🌲',
        tagline: 'Design System, Autopilot and Maestro — and the step up to Principal in October 2025.',
        stations: [
            { title: 'Senior Software Engineer (2022–25)', lines: ['Design System library for the UiPath platform: StencilJS web components consumed by React, Angular & Angular Elements apps.', 'Worked closely with design in Figma; shipped across the platform.', 'Autopilot and Maestro product work.'] },
            { title: 'Principal Software Engineer (Oct 2025 →)', lines: ['Technical leadership across front-end platform efforts.', 'Design System, Autopilot, Maestro.'] },
            { title: 'Stack', chips: ['StencilJS', 'Web Components', 'React', 'Angular', 'Angular Elements', 'TypeScript', 'Figma', 'GitHub'] },
            { title: 'Off the clock', lines: ['Writes articles (Medium, dev.to), answers questions on Stack Overflow.', 'Keeps up with React & Angular, learns new tech, and — last but not least — relaxes.'] },
        ],
    },
];

export const AIRPORTS = {
    bucharest: { poi: 'otopeni', name: 'Henri Coandă International Airport (OTP)', hint: 'Drive north on DN1 past Băneasa to reach Otopeni.' },
    seattle: { poi: 'seatac', name: 'Seattle–Tacoma International Airport (SEA)' },
};

// Radio / ticker facts shown while driving.
export const FACTS = {
    bucharest: [
        'TomTom Traffic Index 2025: Bucharest drivers lost 171 hours (7+ days) in rush-hour traffic last year.',
        'Bucharest congestion level: 62.5% — among the worst in Europe, up again vs. 2024.',
        '1.7 million cars are registered in Bucharest and ~300,000 more enter the city every day.',
        'Roughly 5 cars compete for every parking spot — hence the double (and triple) parking.',
        'Piața Victoriei and Piața Romană are consistently the city\'s worst traffic hotspots.',
        'Local rule of thumb: 10 km in 45 minutes at rush hour. Bring podcasts.',
        'Honking at the car in front the millisecond the light turns green is a civic tradition here.',
        'DN1 to Otopeni: the only way to the airport, and everybody knows it. Leave early.',
        'Trams have priority. In theory.',
        'Kiseleff boulevard: tree-lined, beautiful, and still jammed every morning.',
    ],
    seattle: [
        'Welcome to Washington. Average SeaTac → Bellevue drive: about 30 minutes, no honking required.',
        'SR-520 floating bridge is tolled at peak hours; the I-90 floating bridge is free. Choose wisely.',
        'The I-90 bridge across Lake Washington is one of the longest floating bridges in the world.',
        'Seattle drivers rarely honk. If someone does, they are probably from out of town.',
        'Rain is not weather here, it is a lifestyle. Wipers on.',
        'Bellevue downtown: glass towers, calm streets, and UiPath\'s engineering office.',
    ],
};

export const PHRASES = {
    bucharest: {
        honkedAt: ['Hai, mișcă!', 'Ce faci, dormi?!', 'Claxonezi la mine?!', 'Băi, nene!', 'Mută căruța!', 'Dă-te, că întârzii!', 'Ia-ți permisul de la Dedeman!', 'Ai luat carnetul la tombolă?', 'Hai, că nu e Formula 1!'],
        bumped: ['Ești nebun?!', 'Ce-ai făcut, mă?!', 'Scoate asigurarea!', 'Dă-te jos să vezi ce-ai făcut!', 'Mă, tu vezi pe unde mergi?!'],
        stuck: ['De ce nu merge?!', 'Haaaai odată!', 'Iar s-a blocat Victoriei…', 'Încă 10 minute și ajung la birou… mâine.', 'Claxonez eu, poate pornește.'],
        green: ['E verde, HAI!', 'Pornește, nene!', 'Mai verde de atât nu se face!'],
        redLight: ['Pe roșu?! Serios?!'],
    },
    seattle: {
        honkedAt: ['Oh, sorry!', 'Go ahead 🙂', 'You okay?', 'No worries!', 'Whoa, out-of-towner?'],
        bumped: ['Oh no… are you okay?', 'Let\'s exchange insurance, no rush.', 'Hope your day gets better!'],
        stuck: ['Traffic, huh.', 'Should\'ve taken the Link.', 'Ah, 405.'],
        green: ['After you!'],
        redLight: ['…that was a red light, friend.'],
    },
};

export const ACHIEVEMENTS = [
    { id: 'first-honk', title: 'First honk', desc: 'Welcome to Bucharest.' },
    { id: 'honk-10', title: 'Claxonist', desc: '10 honks. You are adapting.' },
    { id: 'rage-max', title: 'Bucharest Driver Status', desc: 'Rage meter maxed. Dedeman would be proud.' },
    { id: 'red-light', title: 'Verde pentru mine', desc: 'Ran a red light. Very local.' },
    { id: 'victoriei', title: 'Survived Piața Victoriei', desc: 'Crossed the worst intersection in the city.' },
    { id: 'all-buc', title: 'Bucharest chapter complete', desc: 'Visited every office in Bucharest.' },
    { id: 'flight', title: 'Relocated', desc: 'OTP → SEA. 12 hours, one layover, zero honks.' },
    { id: 'bridge', title: 'Floating bridge', desc: 'Crossed Lake Washington on I-90.' },
    { id: 'toll', title: 'Toll paid', desc: 'Took SR-520. That\'s $4.50, thank you.' },
    { id: 'all', title: 'CV complete', desc: 'You know the whole story now. Say hi!' },
    { id: 'ran-dry', title: 'Ran dry', desc: 'Out of fuel. The tow truck driver has seen it all.' },
    { id: 'full-tank', title: 'Plin, vă rog', desc: 'Filled up at a gas station.' },
    { id: 'camera', title: 'Smile for the camera', desc: 'Flashed by a speed camera.' },
    { id: 'police', title: 'License and registration', desc: 'Pulled over by the police for speeding.' },
    { id: 'pedestrian', title: 'Pieton!', desc: 'Hit a pedestrian. They are fine. You are not.' },
    { id: 'navigator', title: 'Navigator', desc: 'Set your own waypoint on the map.' },
    { id: 'night-owl', title: 'Night owl', desc: 'Drove through the city at night.' },
    { id: 'law-abiding', title: 'Law-abiding citizen', desc: 'Drove 5 km without a single fine.' },
    { id: 'fast-travel', title: 'Montage!', desc: 'Skipped the traffic with fast travel. If only it worked in real life.' },
];
