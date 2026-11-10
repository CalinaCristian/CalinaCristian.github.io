// Original game dialogue. Culture/place references are conversational observations,
// never a claim about an actual person's identity or a current business/event.
// Stable IDs are group + row number: append rows; do not reorder published rows.
export const SITUATIONAL_DIALOGUE_VERSION = 1;
const lines = [];
function group(id, rule, rows) {
 for (let i=0;i<rows.length;i++) {
  const row=rows[i], t=Array.isArray(row)?row[0]:row, en=Array.isArray(row)?row[1]:'';
  lines.push(Object.freeze({id:`${id}.${String(i+1).padStart(2,'0')}`,t,en,...rule,
   kinds:Object.freeze([...rule.kinds]),roles:Object.freeze([...rule.roles]),relations:Object.freeze([...rule.relations]),
   ...(rule.places?{places:Object.freeze([...rule.places])}:{}),...(rule.hours?{hours:Object.freeze([...rule.hours])}:{}),
   ...(rule.facts?{facts:Object.freeze({...rule.facts})}:{}),...(rule.calendar?{calendar:Object.freeze({...rule.calendar})}:{}),
  }));
 }
}
const heard={kinds:['player-honk','npc-honk'],roles:['driver','pedestrian'],relations:['witness','recipient']};
const ambient={kinds:['ambient','greeting'],roles:['driver','pedestrian','staff'],relations:['source','conversant']};
const vehicle={kinds:['collision'],roles:['driver'],relations:['participant'],facts:{contact:true,collisionType:'vehicle'}};
const witness={kinds:['collision'],roles:['driver','pedestrian','staff'],relations:['witness'],facts:{contact:true,collisionType:'vehicle'}};
const waiting={kinds:['waiting'],roles:['driver'],relations:['source'],facts:{queued:true}};

group('buc.player.driver',{locale:'bucharest',kinds:['player-honk'],roles:['driver'],relations:['witness','recipient']},[
 ['Claxonul nu are buton de derulare rapidă.','The horn has no fast-forward button.'],
 ['Te-am auzit. Și gândurile mele te-au auzit.','I heard you. So did my thoughts.'],
 ['Un claxon, două cafele de care am nevoie acum.','One honk, two coffees I now need.'],
 ['Dacă pornește traficul din sunet, îți cer playlistul.','If sound gets traffic moving, I want your playlist.'],
 ['Ai dat semnalul de început pentru o zi foarte lungă.','That sounded like the opening note of a very long day.'],
 ['Bună și ție! Varianta cu claxon, am înțeles.','Hello to you too! The horn version, got it.'],
 ['Claxonul merge. Restul conversației, mai încet.','The horn works. Let’s take the rest of this conversation slowly.'],
 ['Am primit notificarea. Nu era nevoie de sonerie nouă.','Notification received. No new ringtone needed.'],
 ['Asta a fost salut sau probă de orchestră?','Was that hello, or an orchestra rehearsal?'],
 ['Dacă aveai o întrebare, era una foarte sonoră.','If that was a question, it was a loud one.'],
]);
group('buc.player.ped',{locale:'bucharest',kinds:['player-honk'],roles:['pedestrian','staff'],relations:['witness','recipient']},[
 ['Te-am auzit. Bucureștiul n-are nevoie de volum maxim.','I heard you. Bucharest doesn’t need maximum volume.'],
 ['Pașii mei n-au mod turbo.','My feet don’t have turbo mode.'],
 ['Bună ziua se poate spune și fără baterie.','You can say hello without a car battery.'],
 ['M-ai scos din gânduri. Era un episod bun.','You interrupted my thoughts. It was a good episode.'],
 ['Asta intră la muzică sau la corespondență?','Does that count as music or correspondence?'],
 ['Claxonul tău are mai multă energie decât mine.','Your horn has more energy than I do.'],
 ['Am tresărit. Acum suntem amândoi treji.','That startled me. Now we’re both awake.'],
 ['Mi-ai pus semn de exclamare la plimbare.','You added an exclamation mark to my walk.'],
 ['Gata, am auzit anunțul. Nu trebuie bis.','I heard the announcement. No encore needed.'],
 ['O conversație întreagă într-o singură notă. Impresionant.','A whole conversation in one note. Impressive.'],
]);
group('buc.npc.source',{locale:'bucharest',kinds:['npc-honk'],roles:['driver'],relations:['source']},[
 ['A fost o notă, nu un discurs.','One note, not a speech.'],
 ['Atât a avut de spus claxonul.','That’s all the horn had to say.'],
 ['Claxon scurt. Monologul rămâne în mașină.','Short honk. The monologue stays in the car.'],
 ['Am cântat doar refrenul.','I only played the chorus.'],
 ['Bine, mi-am auzit și eu ideea.','All right, I’ve heard my own point now.'],
 ['Claxonul are o singură silabă disponibilă.','The horn only has one syllable available.'],
 ['Acum și un pic de liniște.','Now for a little quiet.'],
 ['Am trimis mesajul. Fără atașamente.','Message sent. No attachments.'],
]);
group('buc.horn.witness',{locale:'bucharest',...heard},[
 ['Orchestra de stradă are azi doar suflători.','The street orchestra is all horns today.'],
 ['Asta sigur nu era soneria de la bicicletă.','That definitely wasn’t a bicycle bell.'],
 ['Fiecare claxon vine cu propriul semn de exclamare.','Every horn comes with its own exclamation mark.'],
 ['Un pic mai puțin volum și ne auzim ideile.','A little less volume and we can hear ourselves think.'],
 ['N-am partituri pentru conversația asta.','I don’t have sheet music for this conversation.'],
 ['Claxonul n-a lăsat loc de subtitrări.','That horn didn’t leave room for subtitles.'],
]);
group('buc.crash.driver',{locale:'bucharest',...vehicle},[
 ['Întâi oprim. Replicile pot aștepta.','Let’s stop first. The commentary can wait.'],
 ['Hai să verificăm, pe rând.','Let’s check things one at a time.'],
 ['Oprim aici și vedem ce s-a întâmplat.','Let’s stop here and see what happened.'],
 ['Bara de protecție nu voia o conversație.','The bumper wasn’t asking for a conversation.'],
 ['Punem pauză la grabă.','Let’s put the hurry on pause.'],
 ['Cred că trebuie să schimbăm planul, nu doar direcția.','We may need a new plan, not just a new direction.'],
 ['Să ne uităm întâi. Concluziile după.','Let’s look first. Conclusions afterward.'],
 ['Avem un motiv foarte concret să încetinim.','We have a very concrete reason to slow down.'],
 ['Hai cu răbdare. Tabla nu răspunde la ceartă.','Easy now. Bodywork doesn’t respond to arguments.'],
 ['Un pas înapoi, apoi vedem ce e de făcut.','Let’s take a breath, then work out what to do.'],
]);
group('buc.crash.witness',{locale:'bucharest',...witness},[
 ['Lăsați-le loc să oprească.','Give them room to stop.'],
 ['Întâi se verifică oamenii, apoi vehiculele.','Check the people first, then the vehicles.'],
 ['Nu mai adăugăm și claxoane la ecuație.','Let’s not add horns to the equation.'],
 ['Cu calm. Intersecția nu cere un cor.','Easy. The intersection doesn’t need a choir.'],
 ['Aici merită o pauză de la comentarii.','This is a good moment to pause the commentary.'],
 ['Puțin spațiu ajută mai mult decât zece păreri.','A little space helps more than ten opinions.'],
]);
group('buc.crash.bobita',{locale:'bucharest',kinds:['collision'],roles:['driver','pedestrian'],relations:['participant','witness'],facts:{contact:true,collisionType:'vehicle',playerCausedContact:true}},[
 ['Ce-ai făcut, Bobiță?','What have you done, Bobiță?'],
]);
group('buc.crash.local',{locale:'bucharest',...vehicle},[
 ['Ce-ai făcut, Bobiță? Aici era bandă, nu pistă de popice!','What happened, Bobiță? This is a lane, not a bowling alley!'],
 ['Ușor, nea Gică! Nu se termină Bucureștiul la semaforul ăsta.','Easy, nea Gică! Bucharest doesn’t end at this traffic light.'],
 ['Ai venit cu tot cu mașină la îmbrățișat?','Did you bring the whole car in for a hug?'],
 ['N-am comandat tamponare la pachet!','I didn’t order a takeaway fender-bender!'],
 ['Boss, distanța de siguranță nu e opțională, ca pătrunjelul!','Boss, a safe gap isn’t optional like parsley!'],
 ['Bine că n-aveam ciorba pe bord.','Good thing I didn’t have soup on the dashboard.'],
 ['Oprim, verificăm, respirăm. După aia ne certăm politicos.','Stop, check, breathe. Then we can argue politely.'],
 ['M-ai apropiat de centru, dar nu așa voiam.','You got me closer to the centre, but that’s not how I meant it.'],
]);
group('buc.honk.local',{locale:'bucharest',...heard},[
 ['Am auzit, boss! S-a auzit până la Obor.','I heard you, boss! They heard that all the way in Obor.'],
 ['Claxonul nu-i telecomandă de semafor!','The horn isn’t a remote control for the lights!'],
 ['Stai că n-am buton de teleportare pe Dacie.','Hang on, my Dacia doesn’t have a teleport button.'],
 ['Băi, ai claxon sau fanfară de nuntă?','Is that a horn or an entire wedding brass band?'],
 ['Ce facem aici, repetiții pentru Revelion?','Are we rehearsing for New Year’s Eve here?'],
 ['Verde se face și fără coloană sonoră.','It’ll turn green without a soundtrack too.'],
]);
group('buc.crash.person',{locale:'bucharest',kinds:['collision'],roles:['driver','pedestrian','staff'],relations:['participant','witness'],facts:{contact:true,collisionType:'pedestrian'}},[
 ['Opriți. Are nevoie cineva de ajutor?','Stop. Does anyone need help?'],
 ['Lăsați puțin spațiu, vă rog.','Please give them some space.'],
 ['Verificăm persoana mai întâi.','Check on the person first.'],
 ['Poate cineva să ceară ajutor dacă este nevoie?','Can someone call for help if needed?'],
]);
group('buc.crash.static',{locale:'bucharest',kinds:['collision'],roles:['driver','pedestrian'],relations:['participant','witness'],facts:{contact:true,collisionType:'static'}},[
 ['Întâi o pauză. Apoi verificăm.','Pause first. Then we check.'],
 ['Obstacolul a rămas la programul lui.','The obstacle kept to its own schedule.'],
 ['Hai să vedem ce s-a întâmplat, fără grabă.','Let’s see what happened, without rushing.'],
 ['Aici oprim puțin povestea.','Let’s pause the story here.'],
]);
group('buc.wait',{locale:'bucharest',...waiting},[
 ['Cafeaua imaginară e deja la a doua ceașcă.','My imaginary coffee is already on its second cup.'],
 ['Avem timp să redenumim toate fișierele din cap.','Enough time to rename every file in my head.'],
 ['Răbdarea mea cere scaun ergonomic.','My patience is requesting an ergonomic chair.'],
 ['Cine a pus buton de pauză pe ziua asta?','Who put a pause button on this day?'],
 ['Dacă așteptarea era sport, făceam încălzirea acum.','If waiting were a sport, this would be the warm-up.'],
 ['Mi-am terminat gândul. Acum îl recitesc.','Finished my thought. Now I’m rereading it.'],
]);
group('buc.signal.green',{locale:'bucharest',...waiting,facts:{queued:true,speakerSignal:'green'}},[
 ['Verde. Cu răbdare, nu cu artificii.','Green. Patience, not fireworks.'],
 ['Semaforul a schimbat capitolul. Noi, pe rând.','The light changed chapters. We’ll go one at a time.'],
]);
group('buc.signal.red',{locale:'bucharest',...waiting,facts:{queued:true,speakerSignal:'red'}},[
 ['Roșu: ședința scurtă cu bordul.','Red: a short meeting with the dashboard.'],
 ['Pauză de semafor. Îmi ajung din urmă gândurile.','Red-light pause. My thoughts can catch up.'],
]);
group('buc.walk.signal',{locale:'bucharest',...heard,roles:['pedestrian'],facts:{speakerWalkSignal:'walk'}},[
 ['Semnalul meu e de trecere. Pas cu pas.','I have the walk signal. One step at a time.'],
 ['Trec pe semnalul meu, nu pe ritmul claxonului.','I’m crossing on my signal, not to the rhythm of a horn.'],
]);
group('buc.ambient',{locale:'bucharest',...ambient},[
 ['Planul meu are o cafea și mult spațiu pentru improvizație.','My plan includes coffee and plenty of room to improvise.'],
 ['Mai întâi salutul, apoi toate poveștile.','Hello first, then all the stories.'],
 ['Am ieșit la plimbare, fără listă de obiective.','I came out for a walk, with no objectives list.'],
 ['O zi bună încape și între două opriri.','A good day can fit between two stops.'],
 ['Am venit după o poveste. Bucureștiul are rezerve.','I came for a story. Bucharest has plenty in reserve.'],
 ['Covrigul e cercul meu preferat de discuții.','A covrig is my favourite discussion circle.'],
 ['Să nu confundăm programul cu aventura.','Let’s not confuse the schedule with the adventure.'],
 ['Până și lista mea de cumpărături are o paranteză despre cafea.','Even my shopping list has a parenthesis about coffee.'],
]);
group('buc.oldtown',{locale:'bucharest',...ambient,places:['old-town','lipscani']},[
 ['Pe Lipscani și o plimbare scurtă cere un capitol în plus.','On Lipscani, even a short walk asks for another chapter.'],
 ['Am zis o tură prin Centrul Vechi. N-am precizat câte povești.','I said one lap of Old Town. I didn’t specify how many stories.'],
 ['Aici planul meu de seară are note de subsol.','My evening plan comes with footnotes here.'],
 ['Centrul Vechi: unde „încă cinci minute” are multă imaginație.','Old Town: where “five more minutes” has quite an imagination.'],
]);
group('buc.carusel',{locale:'bucharest',...ambient,places:['carusel']},[
 ['La Carusel, și lista de cumpărături vrea copertă tare.','At Carusel, even a shopping list wants a hardback cover.'],
 ['Eu intru pentru o carte. Rucsacul negociază pentru trei.','I go in for one book. My backpack negotiates for three.'],
 ['Mi-am pus semn de carte în programul zilei.','I put a bookmark in my day’s schedule.'],
 ['O librărie e locul unde mă rătăcesc cu intenție.','A bookshop is where I get lost on purpose.'],
]);
group('buc.freddo',{locale:'bucharest',...ambient,places:['freddo']},[
 ['Mi-am lăsat mișcările serioase pentru ring.','I’m saving my serious moves for the dance floor.'],
 ['Pentru dans am două picioare și prea multe idei.','For dancing I have two feet and far too many ideas.'],
 ['Un pas bun valorează mai mult decât un plan complicat.','One good step beats an elaborate plan.'],
 ['Azi țin ritmul. Mâine țin minte pașii.','Today I’ll keep the beat. Tomorrow I’ll remember the steps.'],
]);
group('buc.arc',{locale:'bucharest',...ambient,places:['arc-de-triumf']},[
 ['Arcul de Triumf merită o privire în sus și un pic de răgaz.','The Arch of Triumph deserves a look up and a little time.'],
 ['Un pic de Paris în discuție, Bucureștiul în jur.','A little Paris in the conversation, Bucharest all around.'],
 ['Dacă plimbarea avea copertă, Arcul intra pe ea.','If this walk had a cover, the Arch would be on it.'],
 ['Aici și sandvișul meu pare să ceară o baghetă.','Even my sandwich seems to be asking for a baguette here.'],
]);
group('buc.cismigiu',{locale:'bucharest',...ambient,places:['cismigiu']},[
 ['Cișmigiul nu are inbox. O alegere foarte bună.','Cișmigiu has no inbox. Excellent design choice.'],
 ['Am lăsat graba la intrarea în parc. Să mă aștepte.','I left the hurry at the park entrance. It can wait.'],
 ['Aici și pauza mea ia o pauză.','Even my break takes a break here.'],
 ['O bancă și o conversație. Plan suficient.','A bench and a conversation. That’s enough of a plan.'],
]);
group('buc.pipera',{locale:'bucharest',...ambient,places:['pipera','hermes','bob-tower']},[
 ['Azi vreau o pauză fără invitație în calendar.','Today I’d like a break without a calendar invite.'],
 ['În cap am închis laptopul. Mai durează puțin.','I’ve closed the laptop in my head. It takes a moment.'],
]);
group('buc.romana',{locale:'bucharest',...ambient,places:['romana']},[
 ['La Romană, planul meu încape într-un bilet de metrou.','At Romană, my plan fits on a metro ticket.'],
 ['Încă o plimbare și poate îmi termin ideea.','One more walk and I might finish my thought.'],
]);
group('buc.morning',{locale:'bucharest',...ambient,hours:[5,11]},[
 ['Bună dimineața. Ideile vin după prima cafea.','Good morning. The ideas arrive after the first coffee.'],
 ['Dimineața asta merită pornită încet.','This morning deserves a gentle start.'],
]);
group('buc.night',{locale:'bucharest',...ambient,hours:[22,5]},[
 ['Noapte bună pentru o poveste scurtă. Sau două.','A good night for a short story. Or two.'],
 ['La ora asta, agenda mea scrie doar „vedem”.','At this hour, my diary just says “we’ll see.”'],
]);
group('buc.rain',{locale:'bucharest',...ambient,weather:'rain'},[
 ['Ploaia mi-a adăugat o virgulă la plimbare.','The rain added a comma to my walk.'],
 ['Ploaie. Cafeaua rămâne în plan.','Rain. Coffee stays in the plan.'],
]);
group('buc.snow',{locale:'bucharest',...ambient,weather:'snow'},[
 ['Ninge. Azi pașii merită mai multă atenție.','It’s snowing. Our steps deserve more attention today.'],
 ['Fulgii au început fără să mă invite în calendar.','The snowflakes started without sending a calendar invite.'],
]);
group('buc.hot',{locale:'bucharest',...ambient,minTemperatureC:28},[
 ['Pe căldura asta, apa e partea importantă din plan.','In this heat, water is the important part of the plan.'],
 ['E cald. Îmi programez entuziasmul la umbră.','It’s hot. I’m scheduling my enthusiasm in the shade.'],
]);
group('buc.cold',{locale:'bucharest',...ambient,maxTemperatureC:2},[
 ['Frigul a venit fără programare.','The cold arrived without an appointment.'],
 ['E frig. Conversația poate fi caldă.','It’s cold. The conversation can still be warm.'],
]);
group('buc.martisor',{locale:'bucharest',...ambient,calendar:{month:3,day:1}},[
 ['Un mărțișor și o primăvară cu răbdare.','A mărțișor and a spring with a little patience.'],
 ['La mulți ani de Mărțișor! Firul e mic, gândul e bun.','Happy Mărțișor! A small thread, a kind thought.'],
]);
group('buc.december',{locale:'bucharest',...ambient,calendar:{month:12,day:1}},[
 ['La mulți ani de 1 Decembrie!','Happy Romanian National Day!'],
 ['De Ziua Națională, urarea mea e simplă: drumuri bune.','For National Day, my wish is simple: safe travels.'],
]);

group('sea.player.driver',{locale:'seattle',kinds:['player-honk'],roles:['driver'],relations:['witness','recipient']},[
 'Message received. My dashboard has no reply-all button.',
 'Was that the express version of hello?',
 'The horn has excellent projection. The conversation needs work.',
 'That notification came with surround sound.',
 'I heard you. So did my entire to-do list.',
 'No need to put the sentence in all caps.',
 'One honk is plenty of punctuation.',
 'My coffee and I both noticed.',
]);
group('sea.player.ped',{locale:'seattle',kinds:['player-honk'],roles:['pedestrian','staff'],relations:['witness','recipient']},[
 'My walking speed is a feature, not a setting.',
 'That startled the next three thoughts out of my head.',
 'A wave would also have reached me.',
 'I heard the horn. I’m still looking for the subtitle.',
 'The shoes don’t have a sport mode.',
 'That was a very emphatic hello.',
 'My imaginary headphones did not help.',
 'You’ve successfully interrupted a very small daydream.',
]);
group('sea.npc.source',{locale:'seattle',kinds:['npc-honk'],roles:['driver'],relations:['source']},[
 'One note. I’m resisting the extended edition.',
 'That’s the horn’s whole vocabulary.',
 'Message sent. Returning to indoor volume.',
 'All right, the horn has made its point.',
 'Short version. No podcast attached.',
 'That was my one-syllable announcement.',
]);
group('sea.horn.witness',{locale:'seattle',...heard},[
 'That horn is auditioning for the brass section.',
 'The street just acquired a notification sound.',
 'I was enjoying the acoustic version of my walk.',
 'Somewhere, a horn is having a very brief opinion.',
 'A horn is doing all the punctuation today.',
 'A little less volume would leave room for the conversation.',
]);
group('sea.crash.driver',{locale:'seattle',...vehicle},[
 'Let’s stop and check on everyone first.',
 'One thing at a time. People, then paperwork.',
 'Let’s take a breath before we take a look.',
 'The bumper did not put that on the calendar.',
 'We can pause the schedule for this.',
 'Let’s work out what happened before we work out a story.',
 'Okay. Stop, check, then talk.',
 'The bodywork has contributed enough to this conversation.',
]);
group('sea.crash.witness',{locale:'seattle',...witness},[
 'Give them some room to stop.',
 'Check on the people first.',
 'A little space will help more than a running commentary.',
 'Let’s keep the path clear while they check.',
 'This is a good moment for fewer horns.',
 'No need to turn this into a spectator meeting.',
]);
group('sea.crash.person',{locale:'seattle',kinds:['collision'],roles:['driver','pedestrian','staff'],relations:['participant','witness'],facts:{contact:true,collisionType:'pedestrian'}},[
 'Stop. Does anyone need help?',
 'Please give them some space.',
 'Check on the person first.',
 'Can someone call for help if needed?',
]);
group('sea.crash.static',{locale:'seattle',kinds:['collision'],roles:['driver','pedestrian'],relations:['participant','witness'],facts:{contact:true,collisionType:'static'}},[
 'Let’s stop and check before doing anything else.',
 'The obstacle kept its original appointment.',
 'That’s a good place to pause the schedule.',
 'One careful look before the next decision.',
]);
group('sea.wait',{locale:'seattle',...waiting},[
 'My next appointment is with patience.',
 'I could have outlined a very short novel by now.',
 'My coffee is getting a longer commute than planned.',
 'This is technically time away from my inbox.',
 'I’m treating this as an unscheduled intermission.',
 'Plenty of time to remember what I forgot.',
]);
group('sea.signal.green',{locale:'seattle',...waiting,facts:{queued:true,speakerSignal:'green'}},[
 'Green. One at a time still works.',
 'The light changed. Patience keeps its appointment.',
]);
group('sea.signal.red',{locale:'seattle',...waiting,facts:{queued:true,speakerSignal:'red'}},[
 'Red light. A tiny meeting with the dashboard.',
 'This red light has given my thoughts a head start.',
]);
group('sea.walk.signal',{locale:'seattle',...heard,roles:['pedestrian'],facts:{speakerWalkSignal:'walk'}},[
 'I have the walk signal. I’ll take it one step at a time.',
 'The walk signal sets my pace, not the horn.',
]);
group('sea.ambient',{locale:'seattle',...ambient},[
 'My ambitious plan is a walk followed by a snack.',
 'I’m taking the scenic route through my to-do list.',
 'Coffee is an excellent excuse to leave the house.',
 'No agenda. I’m testing the concept.',
 'A short walk is my favourite progress bar.',
 'I’ve put my phone in charge of doing nothing for a minute.',
]);
group('sea.pike',{locale:'seattle',...ambient,places:['pike-place']},[
 'Pike Place is a strong argument for leaving room in the bag.',
 'I came with a shopping list. It has become a suggestion.',
 'This market gives my snack budget a personality.',
 'One stroll, several deeply considered snack decisions.',
 'I’m trying to remember whether coffee counts as a souvenir.',
 'My market strategy is one careful lap and no promises.',
]);
group('sea.center',{locale:'seattle',...ambient,places:['seattle-center']},[
 'The Space Needle makes my to-do list look pleasantly small.',
 'Seattle Center is doing a good job of distracting me from email.',
 'A monorail is a very tidy way to commit to one direction.',
 'My sightseeing plan has acquired a vertical dimension.',
]);
group('sea.waterfront',{locale:'seattle',...ambient,places:['seattle-waterfront']},[
 'The waterfront is good at making a lunch break feel official.',
 'My plan for the water is to look at it for a while.',
 'I’ve scheduled absolutely nothing on the other side of this view.',
 'A walk by the water is my preferred loading screen.',
]);
group('sea.morning',{locale:'seattle',...ambient,hours:[5,11]},[
 'Morning. My first useful thought is still brewing.',
 'Good morning. I’m starting with the walking part.',
]);
group('sea.night',{locale:'seattle',...ambient,hours:[22,5]},[
 'At this hour my ambitious plan is a smaller plan.',
 'A late walk gives the day a little room at the end.',
]);
group('sea.rain',{locale:'seattle',...ambient,weather:'rain'},[
 'The rain has joined the conversation.',
 'Rain is a good reason to keep the coffee plan simple.',
]);
group('sea.snow',{locale:'seattle',...ambient,weather:'snow'},[
 'It’s snowing. I’m giving each step its own appointment.',
 'Snow has a way of editing the day’s itinerary.',
]);
group('sea.hot',{locale:'seattle',...ambient,minTemperatureC:28},[
 'It’s hot. Water gets first place on the schedule.',
 'In this heat, my sightseeing ambitions prefer shade.',
]);
group('sea.cold',{locale:'seattle',...ambient,maxTemperatureC:2},[
 'It’s cold enough to make a warm drink sound like a plan.',
 'Cold day. I’m keeping the conversation warm.',
]);
group('sea.july',{locale:'seattle',...ambient,calendar:{month:7,day:4}},[
 'Happy Fourth. Wishing you a safe trip through the day.',
 'Fourth of July plan: good company and room to breathe.',
]);

group('bel.player.driver',{locale:'bellevue',kinds:['player-honk'],roles:['driver'],relations:['witness','recipient']},[
 'That was a very detailed one-note message.',
 'Notification received. No follow-up meeting required.',
 'The horn has joined the call without muting.',
 'My calendar heard that too.',
 'That sounded like a meeting reminder with wheels.',
 'You’ve reached the dashboard. Please leave a quieter message.',
 'A single honk can cover the whole subject line.',
 'My thoughts have all looked up from their desks.',
]);
group('bel.player.ped',{locale:'bellevue',kinds:['player-honk'],roles:['pedestrian','staff'],relations:['witness','recipient']},[
 'I’m walking. There’s no software update for faster ankles.',
 'That was a surprisingly loud calendar invite.',
 'A friendly wave also has excellent range.',
 'My shoes have declined the request to accelerate.',
 'I heard you. I’m letting my heartbeat finish its reply.',
 'That notification interrupted my offline mode.',
 'The stroll did not need a soundtrack that loud.',
 'My daydream has just left the meeting.',
]);
group('bel.npc.source',{locale:'bellevue',kinds:['npc-honk'],roles:['driver'],relations:['source']},[
 'One note. Keeping the meeting brief.',
 'That was the horn’s executive summary.',
 'Message delivered. Back to a reasonable volume.',
 'My horn has finished its presentation.',
 'No slides. Just the one sound.',
 'The horn had a very short agenda.',
]);
group('bel.horn.witness',{locale:'bellevue',...heard},[
 'Someone’s dashboard has sent a voice memo.',
 'A horn is making a point in a very large font.',
 'That was the shortest meeting I’ve heard today.',
 'The horn has bypassed the subject line.',
 'I preferred the quiet version of that update.',
 'A little more silence would fit nicely right here.',
]);
group('bel.crash.driver',{locale:'bellevue',...vehicle},[
 'Let’s stop and check on the people first.',
 'We can put the calendar on hold for this.',
 'A calm look before any conclusions.',
 'The bumper was not accepting meeting requests.',
 'One step at a time. Check first, discuss afterward.',
 'Let’s give this the time it needs.',
 'The schedule can wait while we check.',
 'That calls for a pause, not a presentation.',
]);
group('bel.crash.witness',{locale:'bellevue',...witness},[
 'Please leave them room to stop.',
 'Check on everyone before anything else.',
 'A little space is the most useful contribution.',
 'Let’s keep the way clear while they check.',
 'The commentary can wait.',
 'Fewer horns would help this conversation.',
]);
group('bel.crash.person',{locale:'bellevue',kinds:['collision'],roles:['driver','pedestrian','staff'],relations:['participant','witness'],facts:{contact:true,collisionType:'pedestrian'}},[
 'Stop. Does anyone need help?',
 'Please give them some room.',
 'Check on the person first.',
 'Can someone call for help if it’s needed?',
]);
group('bel.crash.static',{locale:'bellevue',kinds:['collision'],roles:['driver','pedestrian'],relations:['participant','witness'],facts:{contact:true,collisionType:'static'}},[
 'Let’s stop and take a careful look.',
 'The obstacle declined the invitation to move.',
 'A pause here will be more useful than a hurry.',
 'Check first. The next appointment can wait.',
]);
group('bel.wait',{locale:'bellevue',...waiting},[
 'I’ve pencilled in a brief meeting with patience.',
 'My calendar did not include this intermission.',
 'At least my inbox can’t get a word in.',
 'I have enough time to reconsider my snack strategy.',
 'This is becoming a very still walking alternative.',
 'My arrival estimate is practising creative writing.',
]);
group('bel.signal.green',{locale:'bellevue',...waiting,facts:{queued:true,speakerSignal:'green'}},[
 'Green. Still a good time for one at a time.',
 'The light changed. No need to make it a launch event.',
]);
group('bel.signal.red',{locale:'bellevue',...waiting,facts:{queued:true,speakerSignal:'red'}},[
 'Red light. Time for a small dashboard conference.',
 'This red light has a remarkably simple agenda.',
]);
group('bel.walk.signal',{locale:'bellevue',...heard,roles:['pedestrian'],facts:{speakerWalkSignal:'walk'}},[
 'I have the walk signal. One step at a time.',
 'The crossing signal has already sent my invitation.',
]);
group('bel.ambient',{locale:'bellevue',...ambient},[
 'I’m taking a meeting with the outside world.',
 'Today’s plan has a generous margin for wandering.',
 'My out-of-office reply is a short walk.',
 'A break with no slides is still a very good break.',
 'I’m trying the scenic version of doing nothing.',
 'My next deliverable is a snack.',
]);
group('bel.downtownpark',{locale:'bellevue',...ambient,places:['downtown-park']},[
 'Downtown Park: my favourite meeting without a conference link.',
 'One lap is a pleasantly measurable ambition.',
 'I’ve given this park walk a very flexible deadline.',
 'A park is an excellent place to forget the word deliverable.',
 'My to-do list can wait outside the circle for a minute.',
 'The best part of this walk is that nobody needs the minutes.',
]);
group('bel.meydenbauer',{locale:'bellevue',...ambient,places:['meydenbauer-bay']},[
 'Meydenbauer Bay is an excellent reason to put the phone away.',
 'My plan for the bay is to give it my undivided attention.',
 'A waterfront pause does not need an executive summary.',
 'I’ve left some room in the afternoon for looking at the water.',
 'This is a good place for a very small ambition.',
 'My favourite status update is a quiet walk by the bay.',
]);
group('bel.lincoln',{locale:'bellevue',...ambient,places:['lincoln-square']},[
 'At Lincoln Square my errands tend to become a whole itinerary.',
 'My shopping list has filed a request for a longer lunch break.',
 'A skybridge is a neat commitment to getting across.',
 'I’m here for an errand. The coffee part is a separate agenda item.',
]);
group('bel.way',{locale:'bellevue',...ambient,places:['bellevue-way']},[
 'Bellevue Way gives my afternoon plenty of side quests.',
 'My plan is to walk a little farther than the shopping list expected.',
]);
group('bel.morning',{locale:'bellevue',...ambient,hours:[5,11]},[
 'Morning. My first meeting is with a warm drink.',
 'Good morning. I’m giving the day a gentle start.',
]);
group('bel.night',{locale:'bellevue',...ambient,hours:[22,5]},[
 'At this hour, even my to-do list can take a break.',
 'A late walk is a tidy way to close the day.',
]);
group('bel.rain',{locale:'bellevue',...ambient,weather:'rain'},[
 'The rain has added a small footnote to my walk.',
 'Rainy plan: a shorter list and a warm drink.',
]);
group('bel.snow',{locale:'bellevue',...ambient,weather:'snow'},[
 'It’s snowing. Today’s steps get a little extra care.',
 'Snow has requested a more flexible itinerary.',
]);
group('bel.hot',{locale:'bellevue',...ambient,minTemperatureC:28},[
 'It’s hot. Water comes before the next errand.',
 'This heat has moved my ambitions into the shade.',
]);
group('bel.cold',{locale:'bellevue',...ambient,maxTemperatureC:2},[
 'Cold day. A warm drink has made a strong proposal.',
 'It’s cold enough to keep my sightseeing plan compact.',
]);
group('bel.july',{locale:'bellevue',...ambient,calendar:{month:7,day:4}},[
 'Happy Fourth. Hope the day gives you time for a good walk.',
 'Fourth of July plan: good company and an unhurried afternoon.',
]);

export const SITUATIONAL_DIALOGUE = Object.freeze(lines);
export const SITUATIONAL_DIALOGUE_KINDS = Object.freeze(['player-honk','npc-honk','collision','ambient','greeting','waiting']);
/** Library coverage only. No event integration or native proof is implied. */
export function situationalDialogueCoverage(){
 const locales={};for(const l of lines){const s=locales[l.locale]||(locales[l.locale]={lines:0,kinds:{},places:0,time:0,weather:0,temperature:0,calendar:0,signal:0});s.lines++;for(const k of l.kinds)s.kinds[k]=(s.kinds[k]||0)+1;if(l.places)s.places++;if(l.hours)s.time++;if(l.weather)s.weather++;if(l.minTemperatureC!=null||l.maxTemperatureC!=null)s.temperature++;if(l.calendar)s.calendar++;if(l.facts?.speakerSignal||l.facts?.speakerWalkSignal)s.signal++;}return{version:SITUATIONAL_DIALOGUE_VERSION,total:lines.length,locales,wiredEvents:[],nativeProvedEvents:[]};
}
