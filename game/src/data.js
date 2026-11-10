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
            { title: 'Degree', lines: ["Bachelor of Computer Science, Faculty of Automatic Control and Computers."] },
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
        address: 'Hermes Business Campus, Bd. Dimitrie Pompeiu 5-7, Pipera',
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
        address: 'BOB Tower, Bd. Dimitrie Pompeiu 6A, Pipera',
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
        address: 'Lincoln Square North, 700 Bellevue Way NE, Bellevue, WA',
        // driving past the 2022–2025 office on NE 8th St on the way to Lincoln Square (caption toast, once)
        passing: [{ poi: 'plaza-center', lat: 47.6175, lon: -122.1955, title: '🏢 Plaza Center · 2022–2025', caption: 'UiPath Bellevue\'s office from 2022 until the move to Lincoln Square North in September 2025.' }],
        color: '#fa4616', icon: '🌲',
        tagline: 'Design System, Autopilot and Maestro — and the step up to Principal in October 2025.',
        stations: [
            { title: 'Senior Software Engineer (2022–25)', lines: ['Design System library for the UiPath platform: StencilJS web components consumed by React, Angular & Angular Elements apps.', 'Worked closely with design in Figma; shipped across the platform.', 'Autopilot and Maestro product work.'] },
            { title: 'Principal Software Engineer (Oct 2025 →)', lines: ['Technical leadership across front-end platform efforts.', 'Design System, Autopilot, Maestro.'] },
            { title: 'Stack', chips: ['StencilJS', 'Web Components', 'React', 'Angular', 'Angular Elements', 'TypeScript', 'Figma', 'GitHub'] },
            { title: 'Off the clock', lines: ['Writes articles (Medium, dev.to), answers questions on Stack Overflow.', 'Keeps up with React & Angular and keeps learning new tech.'] },
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

// Roadworks crew at the district-edge closures (spec R10.9). Bucharest lines draw on the research notes about the
// Planșeul Unirii consolidation (works since 2023, last stage 2025–26, traffic restricted around Piața Unirii) and the
// city's habit of digging the same street twice; {text, en}.
export const ROADWORKS = {
    bucharest: [
        { text: 'Închis, șefu\'. Lucrăm.', en: 'Closed, boss. We\'re working.' },
        { text: 'Mai avem puțin… de doi ani.', en: 'Almost done… for two years now.' },
        { text: 'Ocolire pe la stânga, vezi săgeata.', en: 'Detour to the left, see the arrow.' },
        { text: 'Am terminat asfaltul ieri. Azi îl spargem pentru țeava de apă.', en: 'We finished the asphalt yesterday. Today we dig it up for the water main.' },
        { text: 'Planșeul Unirii? Ultima etapă. Tot ultima.', en: 'The Unirii slab? Last stage. Still the last one.' },
        { text: 'Nu claxona, că nu trece mai repede.', en: 'Don\'t honk, it won\'t go any faster.' },
        { text: 'Termen de finalizare: când se termină.', en: 'Completion date: when it\'s finished.' },
        { text: 'Pauză de cafea. A treia.', en: 'Coffee break. The third one.' },
        { text: 'Strada asta o reabilităm din 2019.', en: 'We\'ve been rehabilitating this street since 2019.' },
        { text: 'Mai încolo e drumul în capitolul următor.', en: 'That way is the road for the next chapter.' },
    ],
    seattle: [
        { text: 'Road\'s closed, buddy. Detour\'s signed.', en: '' },
        { text: 'Bridge maintenance. Should be done by spring. Which spring, they didn\'t say.', en: '' },
        { text: 'Local traffic only past this point.', en: '' },
        { text: 'Turn around — that way\'s for another chapter.', en: '' },
    ],
};
// ---------------------------------------------------------------------------
//  Montage routes between chapters of the same city (spec 10): waypoints of the jump drawn on the montage map.
//  `hi` = the leg ending at that point is highlighted and labelled (the I-90 floating bridge into Bellevue).
// ---------------------------------------------------------------------------
export const MONTAGE_VIA = {
    'uipath-bel': [
        { lat: 47.5520, lon: -122.2950 },                                              // I-5 north past Boeing Field
        { lat: 47.5895, lon: -122.2905 },                                              // I-90 east, Mount Baker tunnel
        { lat: 47.5888, lon: -122.2545, hi: true, label: 'I-90 floating bridge' },     // Lacey V. Murrow / Homer Hadley bridges over Lake Washington
        { lat: 47.5870, lon: -122.2250 },                                              // Mercer Island
        { lat: 47.5800, lon: -122.1880 },                                              // I-405 north
    ],
};

/** water drawn under the montage map (rough ellipses): Lake Washington with Mercer Island */
export const MONTAGE_WATER = {
    'uipath-bel': [
        { lat: 47.625, lon: -122.257, rlat: 0.125, rlon: 0.03, label: 'Lake Washington' },
        { lat: 47.562, lon: -122.228, rlat: 0.04, rlon: 0.014, land: true },
    ],
};

// ---------------------------------------------------------------------------
//  Transit streets per Bucharest district (R13.3), from the research dossiers (game/research/bucharest-<d>.json:
//  streets with OSM trolley_wire=yes or a trolleybus route → `trolley`; STB bus routes → `bus`; tram routes → `tram`).
//  Seattle has no research table: King County Metro buses use the arterials in `TRANSIT_RE`.
// ---------------------------------------------------------------------------
export const TRANSIT = {
    floreasca: { bus: ["Bulevardul Dimitrie Pompeiu", "Bulevardul Lacul Tei", "Bulevardul Mircea Eliade", "Calea Dorobanților", "Calea Floreasca", "Strada Barbu Văcărescu", "Strada Gara Herăstrău", "Strada Piotr Ilici Ceaikovski", "Șoseaua Fabrica de Glucoză"], tram: ["Strada Barbu Văcărescu", "Strada Piotr Ilici Ceaikovski"] },
    grozavesti: { trolley: ["Bulevardul Eroii Sanitari", "Bulevardul Eroilor", "Bulevardul General Paul Teodorescu", "Bulevardul Geniului", "Bulevardul Iuliu Maniu", "Bulevardul Profesor Doctor Gheorghe Marinescu", "Calea Griviței", "Calea Plevnei", "Podul Cotroceni", "Splaiul Independenței", "Strada Constantin Noica", "Strada Doctor Carol Davila", "Strada General Petre Popovăț", "Strada Witting", "Șoseaua Cotroceni", "Șoseaua Grozăvești"], bus: ["Bulevardul Dinicu Golescu", "Bulevardul Doina Cornea", "Bulevardul Eroilor", "Bulevardul General Paul Teodorescu", "Bulevardul Geniului", "Bulevardul Iuliu Maniu", "Bulevardul Regiei", "Calea Giulești", "Calea Griviței", "Calea Plevnei", "Podul Cotroceni", "Podul Grozăvești", "Splaiul Independenței", "Strada Constantin Noica", "Strada Pascal Cristian, Inginer", "Strada Witting", "Șoseaua Grozăvești", "Șoseaua Orhideelor"], tram: ["Bulevardul Doina Cornea", "Calea Giulești", "Pasajul Basarab", "Splaiul Independenței", "Șoseaua Orhideelor"] },
    otopeni: { bus: ["Bulevardul Aeroportului", "Calea Bucureștilor", "Strada 23 August"] },
    pipera: { bus: ["Bulevardul Dimitrie Pompeiu", "Bulevardul Pipera", "Calea Floreasca", "Podul Pipera", "Strada Barbu Văcărescu", "Strada Câmpul Pipera", "Strada Căpitan Aviator Alexandru Șerbănescu", "Strada Gara Herăstrău", "Șoseaua Fabrica de Glucoză", "Șoseaua Pipera"], tram: ["Strada Barbu Văcărescu"] },
    romana: { trolley: ["Bulevardul Dacia", "Bulevardul Lascăr Catargiu", "Calea Dorobanților", "Calea Griviței", "Piața Romană", "Piața Sfinții Voievozi", "Strada General Gheorghe Manu", "Strada Mircea Vulcănescu", "Strada Occidentului"], bus: ["Bulevardul Aviatorilor", "Bulevardul Dacia", "Bulevardul General Gheorghe Magheru", "Bulevardul Ion Mihalache", "Bulevardul Lascăr Catargiu", "Bulevardul Nicolae Bălcescu", "Calea Dorobanților", "Calea Griviței", "Calea Victoriei", "Piața Alexandru Lahovari", "Piața Romană", "Piața Victoriei", "Strada Buzești", "Strada C. A. Rosetti", "Strada Episcopiei", "Strada General Constantin Budișteanu", "Strada General Henri Mathias Berthelot", "Strada George Enescu", "Strada Ion Câmpineanu", "Strada Luterană", "Strada Mircea Vulcănescu", "Strada Nicolae Golescu", "Strada Știrbei Vodă", "Șoseaua Nicolae Titulescu", "Șoseaua Pavel Dimitrievici Kiseleff", "Șoseaua Ștefan cel Mare"], tram: ["Bulevardul Iancu de Hunedoara", "Pasajul Victoria", "Piața Victoriei", "Șoseaua Ștefan cel Mare"] },
    unirii: { trolley: ["Bulevardul Carol I", "Bulevardul Corneliu Coposu", "Bulevardul Dimitrie Cantemir", "Bulevardul Mircea Vodă", "Bulevardul Regina Elisabeta", "Bulevardul Unirii", "Piața C. A. Rosetti", "Piața Unirii", "Piața Universității", "Strada Halelor", "Strada Nerva Traian", "Strada Traian"], bus: ["Bulevardul Carol I", "Bulevardul Corneliu Coposu", "Bulevardul Dimitrie Cantemir", "Bulevardul Ion C. Brătianu", "Bulevardul Ion Constantin Brătianu", "Bulevardul Mircea Vodă", "Bulevardul Nicolae Bălcescu", "Bulevardul Octavian Goga", "Bulevardul Regina Elisabeta", "Bulevardul Regina Maria", "Bulevardul Unirii", "Calea Victoriei", "Pasajul Unirii", "Piața C. A. Rosetti", "Piața Unirii", "Piața Universității", "Splaiul Independenței", "Splaiul Unirii", "Strada Bibescu Vodă", "Strada Halelor", "Strada Sfânta Vineri"], tram: ["Bulevardul Ion Constantin Brătianu", "Bulevardul Octavian Goga", "Bulevardul Regina Maria", "Calea Moșilor", "Pasajul Mărășești", "Piața Unirii", "Podul Mărășești", "Splaiul Unirii", "Strada Anastasie Panu", "Strada Cavafii Vechi", "Strada Lipscani"] },
};
export const TRANSIT_RE = {
    bellevue: { bus: /Bellevue Way|NE 8th|NE 4th|NE 6th|NE 10th|NE 12th|108th Ave|110th Ave|112th Ave|Main St|116th Ave/i },
    seatac: { bus: /International B|S 188th|S 176th|S 170th|Air Cargo/i },
};

export const PHRASES = {
    // Romanian lines carry the English gloss shown under them in the bubble ({t, en}); Seattle lines are plain strings
    bucharest: {
        honkedAt: [{ t: 'Hai, mișcă!', en: 'Come on, move!' }, { t: 'Ce faci, dormi?!', en: 'What are you doing, sleeping?!' }, { t: 'Claxonezi la mine?!', en: 'You\'re honking at me?!' }, { t: 'Băi, nene!', en: 'Hey, mister!' }, { t: 'Mută căruța!', en: 'Move that cart!' }, { t: 'Dă-te, că întârzii!', en: 'Out of the way, I\'m late!' }, { t: 'Ia-ți permisul de la Dedeman!', en: 'Get your licence at the hardware store!' }, { t: 'Ai luat carnetul la tombolă?', en: 'Did you win your licence in a raffle?' }, { t: 'Hai, că nu e Formula 1!', en: 'Easy, this isn\'t Formula 1!' }],
        bumped: [{ t: 'Ești nebun?!', en: 'Are you crazy?!' }, { t: 'Unde ți-ai luat carnetul, la Obor?!', en: 'Where did you get your licence, at the flea market?!' },
            { t: 'Ce, ai cumpărat carnetul?!', en: 'What, did you buy your licence?!' }, { t: 'Chem poliția, să știi!', en: 'I\'m calling the police, just so you know!' },
            { t: 'Mașina e nouă, băi!', en: 'The car is new, man!' }, { t: 'Facem amiabila sau ce facem?', en: 'Do we fill in the accident form or what?' },
            { t: 'Doamne ferește, ce șofer!', en: 'God help us, what a driver!' }, { t: 'Vezi că plătești tu, eu nu dau un leu!', en: 'You\'re paying, I\'m not giving a single leu!' },
            { t: 'Te-a lovit soarele în cap?!', en: 'Did the sun get to your head?!' }, { t: 'Ăsta-i stilul de Ilfov!', en: 'That\'s Ilfov-style driving!' }, { t: 'Ce-ai făcut, mă?!', en: 'What have you done, man?!' }, { t: 'Scoate asigurarea!', en: 'Get your insurance papers out!' }, { t: 'Dă-te jos să vezi ce-ai făcut!', en: 'Get out and look at what you did!' }, { t: 'Mă, tu vezi pe unde mergi?!', en: 'Do you even look where you\'re going?!' }],
        stuck: [{ t: 'De ce nu merge?!', en: 'Why isn\'t it moving?!' }, { t: 'Haaaai odată!', en: 'Come ooon already!' }, { t: 'Iar s-a blocat Victoriei…', en: 'Victoriei is jammed again…' }, { t: 'Încă 10 minute și ajung la birou… mâine.', en: 'Ten more minutes and I\'m at the office… tomorrow.' }, { t: 'Claxonez eu, poate pornește.', en: 'I\'ll honk, maybe that gets it going.' }],
        green: [{ t: 'E verde, HAI!', en: 'It\'s green, GO!' }, { t: 'Pornește, nene!', en: 'Get going, mister!' }, { t: 'Mai verde de atât nu se face!', en: 'It doesn\'t get any greener than that!' }],
        redLight: [{ t: 'Pe roșu?! Serios?!', en: 'On red?! Seriously?!' }],
        // pedestrians honked at (round 6 note 49)
        pedHonked: [{ t: 'Ce claxonezi, mă?!', en: 'What are you honking for?!' }, { t: 'Las-o mai moale, șefu\'!', en: 'Take it easy, boss!' },
            { t: 'Am verde, frate!', en: 'I\'ve got the green, bro!' }, { t: 'Vezi că trec, nu zbor!', en: 'I\'m crossing, I can\'t fly!' },
            { t: 'Nebunul de la volan…', en: 'The lunatic behind the wheel…' }, { t: 'Și ce, să mă dau la o parte în copac?', en: 'So what, should I climb a tree?' },
            { t: 'Doamne, ce grabă pe ei…', en: 'Lord, what a rush they\'re all in…' }, { t: 'Claxonează tu la mă-ta!', en: 'Go honk at your mother!' }],
    },
    seattle: {
        honkedAt: ['Oh, sorry!', 'Go ahead 🙂', 'You okay?', 'No worries!', 'Whoa, out-of-towner?'],
        bumped: ['Oh no… are you okay?', 'Let\'s exchange insurance, no rush.', 'Hope your day gets better!', 'I\'m not mad. Just… disappointed.',
            'Wow. Okay. Cool cool cool.', 'Is this a Tesla thing?', 'Sir, this is a Subaru.', 'I\'ll just leave a strongly worded note.',
            'That\'s going on Nextdoor.', 'No worries! (there are worries)', 'Rain, right? Happens.', 'California plates, I bet.',
            'I literally just washed it.', 'Okay, deep breath. Namaste.', 'My insurance guy is going to love this.', 'Did you even see me?! …sorry, hi.'],
        stuck: ['Traffic, huh.', 'Should\'ve taken the Link.', 'Ah, 405.'],
        green: ['After you!'],
        redLight: ['…that was a red light, friend.'],
        pedHonked: ['Whoa, okay! Sorry!', 'Was that… for me?', 'Rude.', 'I have the walk signal, buddy.', 'Easy there.',
            'Someone\'s in a hurry.', 'Did I do something?', 'Wow. Just wow.', 'Okay, okay, I\'m going.'],
    },
};

/* achievements (progression role, spec 23): the catalogue. Triggers + counters live in achievements.js (id → trigger
 * table in specs/23 progress log). Fields: id, cat (story|explorer|driver|local|photo|foot|secret), icon, title, desc,
 * hidden (shown as "???" until unlocked), target (counter; `unit` for display). Facts come from game/research/*. */
export const ACHIEVEMENTS = [
    // ---- Story
    { id: 'ch-rosetti', cat: 'story', icon: '🎒', title: 'Homeroom', desc: 'Chapter 1 done: Liceul C.A. Rosetti, Floreasca (2009).' },
    { id: 'ch-upb', cat: 'story', icon: '🎓', title: 'Politehnica', desc: 'Chapter 2 done: UPB, in through the Doina Cornea gate (2013).' },
    { id: 'ch-gts', cat: 'story', icon: '💼', title: 'First job', desc: 'Chapter 3 done: GTS on Calea Călărașilor, by Hala Traian (2015).' },
    { id: 'ch-luxoft', cat: 'story', icon: '🏢', title: 'Hermes', desc: 'Chapter 4 done: Luxoft at Hermes Business Campus, Bd. Dimitrie Pompeiu (2017).' },
    { id: 'ch-db', cat: 'story', icon: '🏦', title: 'Across the street', desc: 'Chapter 5 done: Deutsche Bank in BOB Tower, on the same Bd. Dimitrie Pompeiu (2017).' },
    { id: 'ch-arnia', cat: 'story', icon: '🧩', title: 'Arnia', desc: 'Chapter 6 done: Arnia Software, Romană (2019).' },
    { id: 'ch-uipath-buc', cat: 'story', icon: '🤖', title: 'Robots, Bucharest edition', desc: 'Chapter 7 done: UiPath on Str. Vasile Alecsandri, near Piața Romană (2020).' },
    { id: 'ch-otopeni', cat: 'story', icon: '🛫', title: 'Departures', desc: 'Chapter 8 done: up the Plecări ramp at Henri Coandă airport (2022).' },
    { id: 'ch-seatac', cat: 'story', icon: '🌲', title: 'Out of SeaTac', desc: 'Chapter 9 done: from Departures Drive to the I-5 / I-405 split (2022).' },
    { id: 'ch-uipath-bel', cat: 'story', icon: '🏙️', title: 'Lincoln Square', desc: 'Chapter 10 done: UiPath Bellevue, Lincoln Square North on Bellevue Way.' },
    { id: 'all-buc', cat: 'story', icon: '🇷🇴', title: 'Bucharest chapter complete', desc: 'Every Bucharest office of the story, done.' },
    { id: 'flight', cat: 'story', icon: '✈️', title: 'Relocated', desc: 'OTP → SEA. Swapped the horn for the turn signal.' },
    { id: 'bridge', cat: 'story', icon: '🌉', title: 'Floating bridge', desc: 'Crossed Lake Washington on the I-90 floating bridge in the montage into Bellevue.' },
    { id: 'all', cat: 'story', icon: '🏁', title: 'CV complete', desc: 'You know the whole story now. Say hi!' },
    { id: 'reader-all', cat: 'story', icon: '📚', title: 'Heard it all', desc: 'Hear every story section in every CV office.', target: 27 },
    // ---- Explorer
    { id: 'roam-first', cat: 'explorer', icon: '🗺️', title: 'Off the script', desc: 'Went off the story: free roam from the world map.' },
    { id: 'roam-all', cat: 'explorer', icon: '🧭', title: 'All eight districts', desc: 'Visited every district in free roam (world map).', target: 8 },
    { id: 'spot-first', cat: 'explorer', icon: '🏛️', title: 'Sightseer', desc: 'Walked into a tourist spot.' },
    { id: 'spots-buc', cat: 'explorer', icon: '🏰', title: 'Turist în București', desc: 'Visited every available Bucharest tourist spot.', target: 10 },
    { id: 'spots-sea', cat: 'explorer', icon: '🗻', title: 'Emerald City & the Eastside', desc: 'Visited every available Seattle and Bellevue tourist spot.', target: 14 },
    { id: 'plaques-25', cat: 'explorer', icon: '📜', title: 'Read the plaque', desc: 'Read 25 plaques in the tourist spots.', target: 25 },
    { id: 'plaques-spot', cat: 'explorer', icon: '🔎', title: 'Every last plaque', desc: 'Read every plaque of one tourist spot.' },
    // drone (note 74, explore's `dmcv:drone` events)
    { id: 'drone-first', cat: 'explorer', icon: '🚁', title: 'Eye in the sky', desc: 'Flew the drone for the first time.' },
    { id: 'drone-ceiling', cat: 'explorer', icon: '⬆️', title: 'Legal limit', desc: 'Took the drone up to its ceiling: 120 m above ground (EU open category; 400 ft in the US).' },
    { id: 'drone-range', cat: 'explorer', icon: '📡', title: 'Edge of range', desc: 'Flew the drone 800 m out from you over a district.' },
    { id: 'drone-photo', cat: 'explorer', icon: '🛰️', title: 'Aerial shot', desc: 'Took a photo from the drone.' },
    { id: 'drone-gohere', cat: 'explorer', icon: '⇩', title: 'Go here', desc: 'Sent yourself to the spot under the drone.' },
    // ---- Driver
    { id: 'law-abiding', cat: 'driver', icon: '😇', title: 'Law-abiding citizen', desc: 'Drove 5 km without a single fine.' },
    { id: 'rush-hour', cat: 'driver', icon: '🚦', title: 'Rush-hour veteran', desc: 'Got through the real peak-hour hotspots: Piața Victoriei, Piața Unirii, Bd. Dimitrie Pompeiu and I-405 at NE 8th.', target: 4 },
    { id: 'night-owl', cat: 'driver', icon: '🦉', title: 'Night owl', desc: 'Drove through the city at night.' },
    { id: 'rain-drive', cat: 'driver', icon: '🌧️', title: 'Wipers on', desc: 'Drove 1 km in the rain. Less grip, slower traffic.' },
    { id: 'snow-drive', cat: 'driver', icon: '❄️', title: 'Half the grip', desc: 'Drove 1 km on snow.' },
    { id: 'fog-drive', cat: 'driver', icon: '🌫️', title: 'Pea soup', desc: 'Drove 1 km in fog.' },
    { id: 'full-tank', cat: 'driver', icon: '⛽', title: 'Plin, vă rog', desc: 'Filled up at a gas station.' },
    { id: 'ran-dry', cat: 'driver', icon: '🚛', title: 'Ran dry', desc: 'Out of fuel. The tow truck driver has seen it all.' },
    { id: 'clean-chapter', cat: 'driver', icon: '🛡️', title: 'Not a scratch', desc: 'Finished a chapter without a single crash.' },
    { id: 'navigator', cat: 'driver', icon: '📍', title: 'Navigator', desc: 'Set your own waypoint on the map.' },
    { id: 'nav-arrive', cat: 'driver', icon: '🏁', title: 'You have arrived', desc: 'Followed your own waypoint route all the way to the end.' },
    { id: 'fast-travel', cat: 'driver', icon: '⏩', title: 'Montage!', desc: 'Skipped the traffic with fast travel. If only it worked in real life.' },
    // ---- Local colour (research: traffic culture, honking, roadworks, Seattle politeness)
    { id: 'first-honk', cat: 'local', icon: '📯', title: 'First honk', desc: 'Pressed H. The city answered.' },
    { id: 'honk-10', cat: 'local', icon: '📣', title: 'Claxonist', desc: '10 honks. You are adapting.' },
    { id: 'rage-max', cat: 'local', icon: '🤬', title: 'Bucharest Driver Status', desc: 'Rage meter maxed. Dedeman would be proud.' },
    { id: 'red-light', cat: 'local', icon: '🔴', title: 'Verde pentru mine', desc: 'Ran a red light. Not a good idea anywhere.' },
    { id: 'victoriei', cat: 'local', icon: '🌀', title: 'Survived Piața Victoriei', desc: 'Drove through the square where every arm stands still at peak.' },
    { id: 'jam-stuck', cat: 'local', icon: '🐌', title: '171 hours', desc: 'Stood still in a Bucharest jam for a whole minute. Drivers there lost about 171 hours each in 2025 (TomTom).' },
    { id: 'roadworks', cat: 'local', icon: '🚧', title: 'Drum închis', desc: 'Drove up to a roadworks closure at the edge of the map.' },
    { id: 'seattle-honk', cat: 'local', icon: '🙊', title: 'Too polite to honk', desc: 'Honked in Seattle, where about 3 in 4 Northwest drivers said they rarely or never honk (PEMCO, 2017).' },
    { id: 'camera', cat: 'local', icon: '📸', title: 'Smile for the camera', desc: 'Flashed by a speed camera.' },
    { id: 'police', cat: 'local', icon: '🚓', title: 'License and registration', desc: 'Pulled over by the police for speeding.' },
    { id: 'pedestrian', cat: 'local', icon: '🚑', title: 'Pieton!', desc: 'Hit a pedestrian. They are fine. You are not.' },
    { id: 'jaywalker', cat: 'local', icon: '😬', title: 'Jaywalker', desc: 'Got nudged by a car on foot. Never assume a car will stop.' },
    { id: 'park-ticket', cat: 'local', icon: '🧾', title: 'Creative parking', desc: 'Got a parking ticket.' },
    { id: 'park-clamp', cat: 'local', icon: '🔒', title: 'Clamped', desc: 'Came back to a wheel clamp (Bucharest, Poliția Locală).' },
    { id: 'park-tow', cat: 'local', icon: '🚛', title: 'Where is my car?', desc: 'Watched the tow truck take your car.' },
    // ---- Photographer
    { id: 'photo-first', cat: 'photo', icon: '📷', title: 'Say cheese', desc: 'Took your first photo (P).' },
    { id: 'photo-night', cat: 'photo', icon: '🌃', title: 'Night shot', desc: 'Took a photo at night.' },
    { id: 'photo-rain', cat: 'photo', icon: '☔', title: 'Wet lens', desc: 'Took a photo in the rain.' },
    { id: 'photo-bw', cat: 'photo', icon: '🎞️', title: 'Film noir', desc: 'Took a photo with the B&W filter.' },
    { id: 'postcard-first', cat: 'photo', icon: '💌', title: 'Wish you were here', desc: 'Completed a tourist-spot postcard challenge.' },
    { id: 'postcards-all', cat: 'photo', icon: '🗂️', title: 'Postcard collector', desc: 'Completed the postcard challenge of every available tourist spot.', target: 24 },
    { id: 'photo-roll', cat: 'photo', icon: '🧾', title: '24 exposures', desc: 'Took 24 photos: one roll of film.', target: 24 },
    // ---- On foot
    { id: 'foot-first', cat: 'foot', icon: '🚶', title: 'Stretch your legs', desc: 'Got out of the car (Enter).' },
    { id: 'foot-km', cat: 'foot', icon: '👟', title: 'One kilometre', desc: 'Walked 1 km (streets and tourist spots both count).', target: 1000, unit: 'm' },
    { id: 'foot-office', cat: 'foot', icon: '🚪', title: 'Walk-in', desc: 'Walked into a CV office on foot.' },
    { id: 'foot-jump', cat: 'foot', icon: '🦘', title: 'Hop', desc: 'Jumped (Space, on foot).' },
    { id: 'foot-zebra', cat: 'foot', icon: '🦓', title: 'Zebra', desc: 'Crossed a street at a pedestrian crossing.' },
    // ---- Landmarks (note 57): one per spot activity the scenes emit (game.emit('activity', {spot, id}) / window
    // 'dmcv:activity'); key = '<spot>:<id>' ('*:<id>' = any spot). `live: true` = the activity is in the game (counts in
    // the panel and the %); others show up once fired / listed in spotsMod.ACTIVITIES. Titles + facts:
    // game/research/activities.json (achievement ids / titles) and the scene toasts.
    { id: 'lm-needle-up', cat: 'landmarks', activity: 'space-needle:elevator', live: true, icon: '🛗', title: '520 feet in 41 seconds', desc: 'Rode the Space Needle elevator up to the observation level.' },
    { id: 'lm-needle-loupe', cat: 'landmarks', activity: 'space-needle:loupe', live: true, icon: '🗼', title: 'Stand on the Loupe', desc: 'Stood on the Loupe, the revolving glass floor of the Space Needle (2018).' },
    { id: 'lm-pike-fish', cat: 'landmarks', activity: 'pike-place:fish', live: true, icon: '🐟', title: 'Catch!', desc: 'Caught a fish thrown at Pike Place Fish Market.' },
    { id: 'lm-gum-wall', cat: 'landmarks', activity: 'pike-place:gum-wall', live: true, icon: '🍬', title: 'Part of the wall', desc: 'Added your gum to the Gum Wall in Post Alley.' },
    { id: 'lm-pike-rachel', cat: 'landmarks', activity: 'pike-place:rachel', live: true, icon: '🐷', title: 'Fed Rachel', desc: 'Dropped a coin in Rachel, the bronze piggy bank whose donations fund the Market\'s social services.' },
    { id: 'lm-great-wheel', cat: 'landmarks', activity: 'waterfront:great-wheel', live: true, icon: '🎡', title: 'Three times round', desc: 'Rode the Seattle Great Wheel: three revolutions over Elliott Bay.' },
    { id: 'lm-troll-climb', cat: 'landmarks', activity: 'fremont-troll:climb', live: true, icon: '🧗', title: 'On the Troll\'s head', desc: 'Climbed the Fremont Troll.' },
    { id: 'lm-locks-lockage', cat: 'landmarks', activity: 'ballard-locks:lockage', live: true, icon: '⛴️', title: 'Locked through', desc: 'Watched the boats rise in a lockage at the Ballard Locks.' },
    { id: 'lm-gasworks-kite', cat: 'landmarks', activity: 'gas-works:kite', live: true, icon: '🪁', title: 'Kite on Kite Hill', desc: 'Flew a kite on Kite Hill at Gas Works Park.' },
    { id: 'lm-kerry-blue-hour', cat: 'landmarks', activity: 'kerry-park:blue-hour', live: true, icon: '🌃', title: 'Blue hour over Seattle', desc: 'Watched the skyline light up from Kerry Park at dusk.' },
    { id: 'lm-bdp-loop', cat: 'landmarks', activity: 'bel-downtown-park:loop', live: true, icon: '⛲', title: 'Half a mile round', desc: 'Walked the promenade loop of Bellevue Downtown Park.' },
    { id: 'lm-bbg-bridge', cat: 'landmarks', activity: 'bel-botanical-garden:bridge', live: true, icon: '🌉', title: 'Ravine bridge', desc: 'Crossed the suspension bridge over the ravine in the Bellevue Botanical Garden.' },
    { id: 'lm-meyd-pier', cat: 'landmarks', activity: 'bel-meydenbauer:pier-end', live: true, icon: '🌊', title: 'End of the crescent', desc: 'Walked to the end of the 420 ft crescent pier at Meydenbauer Bay.' },
    { id: 'lm-meyd-kayak', cat: 'landmarks', activity: 'bel-meydenbauer:kayak', live: true, icon: '🛶', title: 'Meydenbauer paddle', desc: 'Paddled a kayak around Meydenbauer Bay.' },
    { id: 'lm-bel-badge', cat: 'landmarks', activity: 'bel-lincoln-square:badge-in', live: true, icon: '📷', title: 'Lincoln Square details', desc: 'Framed three Lincoln Square details from the public approach.' },
    { id: 'lm-palace-balcony', cat: 'landmarks', activity: 'palace-parliament:balcony', live: true, icon: '🏛️', title: 'Across the Palace facade', desc: 'Framed the balcony and both wings from the public square.' },
    { id: 'lm-cathedral-dome', cat: 'landmarks', activity: 'peoples-salvation-cathedral:candle', live: true, icon: '🕯️', title: 'A candle at the cathedral', desc: 'Completed the outdoor virtual candle practice in a handheld holder.' },
    { id: 'lm-carusel-top', cat: 'landmarks', activity: 'old-town-lipscani:carusel', live: true, icon: '📚', title: 'Top of the Carusel', desc: 'Climbed to the top floor of Cărturești Carusel.' },
    { id: 'lm-freddo-dance', cat: 'landmarks', activity: 'old-town-lipscani:freddo-dance', live: true, icon: '🪩', title: 'Found the rhythm', desc: 'Completed the timed dance sequence at Freddo.' },
    { id: 'lm-freddo-shot', cat: 'landmarks', activity: 'old-town-lipscani:freddo-shot', live: true, icon: '🥂', title: 'Noroc, Freddo!', desc: 'Poured, raised and finished a virtual shot at Freddo.' },
    { id: 'lm-dristor-shaorma', cat: 'landmarks', activity: 'old-town-lipscani:dristor-shaorma', live: true, icon: '🥙', title: 'Poftă bună!', desc: 'Finished a shaorma at Dristor Kebap on Strada Franceză 17.' },
    { id: 'lm-shoteria-shot', cat: 'landmarks', activity: 'old-town-lipscani:shoteria-shot', live: true, icon: '🥂', title: 'Noroc!', desc: 'Poured, raised and finished a shot at Shoteria on Strada Șelari 17.' },
    { id: 'lm-curtea-veche', cat: 'landmarks', activity: 'old-town-lipscani:curtea-veche', live: true, icon: '🏰', title: 'At Vlad\'s court', desc: 'Visited the ruins of Curtea Veche, the Old Princely Court.' },
    { id: 'lm-stavropoleos', cat: 'landmarks', activity: 'stavropoleos-cec:stavropoleos', live: true, icon: '⛪', title: 'Quiet courtyard', desc: 'Lit a candle at Stavropoleos (1724).' },
    { id: 'lm-ateneu-concert', cat: 'landmarks', activity: 'athenaeum-revolution:concert-hall', live: true, icon: '📷', title: 'Athenaeum details', desc: 'Framed the Ionic portico, inscription and dome from the garden.' },
    { id: 'lm-village-passport', cat: 'landmarks', activity: 'village-museum:farmhouse', live: true, icon: '🏡', title: 'Village passport', desc: 'Visited five households from five regions in the Village Museum.' },
    { id: 'lm-herastrau-boat', cat: 'landmarks', activity: 'herastrau-park:boat', live: true, icon: '⛵', title: 'Lake Herăstrău', desc: 'Took a boat out on Lake Herăstrău.' },
    { id: 'lm-spring-tour', cat: 'landmarks', activity: 'spring-palace:residence-tour', live: true, icon: '📷', title: 'Spring Palace entrance', desc: 'Framed the gate, flag and residence from the public approach.' },
    { id: 'lm-cismigiu-boat', cat: 'landmarks', activity: 'cismigiu:rowboat', live: true, icon: '🚣', title: 'Rowed in Cișmigiu', desc: 'Rowed round the lake in Bucharest\'s oldest public garden.' },
    { id: 'lm-cismigiu-chess', cat: 'landmarks', activity: 'cismigiu:chess', live: true, icon: '♟️', title: 'Opening moves', desc: 'Played the legal e4, e5, Nf3 opening at a Cișmigiu chess table.' },
    { id: 'lm-cismigiu-backgammon', cat: 'landmarks', activity: 'cismigiu:backgammon', live: true, icon: '🎲', title: 'A match at La Șahiști', desc: 'Bore off all fifteen checkers and beat Doru, a Cișmigiu park regular.' },
    { id: 'lm-cismigiu-rotunda', cat: 'landmarks', activity: 'cismigiu:rotunda', live: true, icon: '📖', title: 'Twelve writers', desc: 'Stood before every bust in the Writers\' Rotunda.' },
    { id: 'lm-arc-terrace', cat: 'landmarks', activity: 'arcul-de-triumf:terrace', live: true, icon: '🏛️', title: 'The Arc memorial', desc: 'Framed the arch opening and both sculpted piers from the public island.' },
    { id: 'lm-arc-race', cat: 'landmarks', activity: 'arcul-de-triumf:arcul-race', live: true, icon: '🏁', title: 'First around the Arc', desc: 'Beat both island runners over a complete lap of the public walking course.' },
    { id: 'lm-arc-baguette', cat: 'landmarks', activity: 'arcul-de-triumf:arcul-baguette', live: true, icon: '🥖', title: 'A perfect catch', desc: 'Tossed and caught the souvenir baguette three times in a row.' },
    { id: 'lm-palace-pace', cat: 'landmarks', activity: 'palace-parliament:pace', live: true, icon: '⏱️', title: 'Pacing the Palace', desc: 'Walked the length of the esplanade in front of the Palace of the Parliament.' },
    { id: 'lm-chihuly-glasshouse', cat: 'landmarks', activity: 'space-needle:lm-chihuly-glasshouse', activityAliases: ['chihuly:lm-chihuly-glasshouse'], live: true, icon: '🌺', title: 'Under the Glasshouse', desc: 'Framed three details of the suspended sculpture during the combined Seattle Center visit.' },
    { id: 'lm-mopop-monorail', cat: 'landmarks', activity: 'mopop:lm-mopop-monorail', live: true, icon: '🚝', title: 'Monorail through the guitar', desc: 'Watched the 1962 Monorail run straight through MoPOP.' },
    { id: 'lm-totem-read', cat: 'landmarks', activity: 'pioneer-square:lm-totem-read', live: true, icon: '🪵', title: 'Seven figures', desc: 'Framed the seven published figures of the Chief-of-All-Women pole replica from Pioneer Square.' },
    { id: 'lm-underground', cat: 'landmarks', activity: 'pioneer-square:lm-underground', live: true, icon: '🕯️', title: 'Pioneer Square details', desc: 'Photographed the pergola, Chief Seattle bust and Smith Tower from the public square.' },
    { id: 'lm-bike', cat: 'landmarks', activity: '*:bike', icon: '🚲', title: 'On two wheels', desc: 'Rented a bike in a park.' },
    { id: 'tour-first', cat: 'landmarks', activity: '*:tour', live: true, icon: '🚩', title: 'Follow the flag', desc: 'Finished a guided tour in a tourist spot.' },
    { id: 'tours-buc', cat: 'landmarks', live: true, icon: '🗺️', title: 'Bucharest, guided', desc: 'Finished the guided tour of every available Bucharest tourist spot.', target: 10 },
    { id: 'tours-sea', cat: 'landmarks', live: true, icon: '🧭', title: 'Seattle & Bellevue, guided', desc: 'Finished the guided tour of every available Seattle and Bellevue tourist spot.', target: 14 },
    { id: 'landmarks-all', cat: 'landmarks', icon: '🏅', title: 'Done it all', desc: 'Did every landmark activity in the game.' },
    // ---- Secrets (hidden)
    { id: 'wcp-bar', cat: 'secret', hidden: true, activity: 'old-town-lipscani:wcp-bar', live: true, icon: '⚽', title: 'Hidden project', desc: 'Found the hidden football room and browsed World Cup Predictions, a project by Cristian.' },
    { id: 'dinamo-drone-goal', cat: 'secret', hidden: true, icon: '⚽', title: 'Air striker', desc: 'Scored at Stadionul Dinamo by nudging the football into a goal with the drone.' },
    { id: 'rosetti-basket', cat: 'secret', hidden: true, icon: '🏀', title: 'After-school hoops', desc: 'Picked up the basketball and made a basket at C.A. Rosetti in Floreasca.' },
    { id: 'troll-night', cat: 'secret', hidden: true, icon: '🧌', title: 'Under the bridge', desc: 'Visited the Fremont Troll at night, under the north end of the Aurora Bridge.' },
    { id: 'mountain-out', cat: 'secret', hidden: true, icon: '🏔️', title: 'The Mountain is out', desc: 'Got the Kerry Park postcard with Mount Rainier showing.' },
    { id: 'peacock', cat: 'secret', hidden: true, icon: '🦚', title: 'Peacock', desc: 'Photographed a peacock fanning its tail in the Spring Palace garden.' },
    { id: 'potato', cat: 'secret', hidden: true, icon: '🥔', title: 'The impaled potato', desc: 'Read about the Memorial of Rebirth in Piața Revoluției, nicknamed "the impaled potato" by locals.' },
    { id: 'vlad', cat: 'secret', hidden: true, icon: '🏰', title: 'Not a vampire', desc: 'Read the Curtea Veche plaque: Vlad III dated a document from his "fortress of Bucharest" in 1459.' },
];
/* end achievements */
