window.__LAST_CLICKED_ON_AVATAR__ = null;
window.__LAST_SCROLL_DIRECTION__ = 'up';

window.addEventListener("wheel", (event) => {
    if (document.querySelector('.content').scrollTop > 0) {
        return;
    }
    if (event.deltaY < 0 && window.__LAST_SCROLL_DIRECTION__ !== 'up') {
        handleImageClick();
    } else if (event.deltaY > 0 && window.__LAST_SCROLL_DIRECTION__ !== 'down') {
        handleImageClick();
    }
}, false);

document.querySelector('.avatar').addEventListener('click', () => handleImageClick());
// initial transition should be skipped (after the stack is empty)
setTimeout(() => {
    document.querySelector('.content').classList.toggle('no-transition');
}, 0)

const handleImageClick = () => {
    const now = new Date().getTime();

    // Prevent clicking while in transition (700ms is the duration of the transition)
    if (window.__LAST_CLICKED_ON_AVATAR__ && now - window.__LAST_CLICKED_ON_AVATAR__ < 700) {
        return;
    }

    window.__LAST_SCROLL_DIRECTION__ = window.__LAST_SCROLL_DIRECTION__ === 'up' ? 'down' : 'up';
    window.__LAST_CLICKED_ON_AVATAR__ = now;

    // selected class will move the image and redimension it
    document.querySelector('.avatar').classList.toggle('selected');

    // scale-hide will use transform: scale(0); to animate the diminishing of the content
    document.querySelector('.content').classList.toggle('scale-hide');
    // opacity-hide will use opacity: 0; to animate the disappearance of the footer 
    document.querySelector('.footer').classList.toggle('opacity-hide');
    document.querySelector('.play-cta').classList.toggle('opacity-hide');

    toggleElement(document.querySelector('.cv-viewer'));
    document.querySelectorAll('.social-links a').forEach(link => {
        toggleElement(link);
    })

    track('cv_toggle', { open: window.__LAST_SCROLL_DIRECTION__ === 'down' });
}

// ---- analytics (see public/telemetry.js; no-op unless enabled) ----
const track = (event, props) => window.cvTelemetry && window.cvTelemetry.track(event, props);

document.addEventListener('click', (e) => {
    const el = e.target.closest && e.target.closest('a');
    if (!el) return;
    if (el.dataset.track) {
        track(el.dataset.track, el.dataset.placement ? { placement: el.dataset.placement } : {});
    } else if (el.closest('.social-links')) {
        track('social_click', { network: el.title });
    }
    // keep the same anonymous visitor id when going from the landing page into the game
    if (el.dataset.track === 'play_cta_click' && window.cvTelemetry) {
        el.href = window.cvTelemetry.linkWithId(el.getAttribute('href'));
    }
});

const toggleElement = (element) => {
    // we also need to make them unaccessible while hidden 
    element.setAttribute('tabindex', element.getAttribute('tabindex') === '-1' ? '0' : '-1');
}

const iconMap = [{
    alt: 'email',
    description: 'Send an email to Cristian-Florin Călina',
    path: './public/icons/email.png',
    url: 'mailto:cristianflorincalina@gmail.com'
}, {
    alt: 'linkedin',
    description: 'Open Cristian-Florin Călina\'s linkedin profile',
    path: './public/icons/linkedin.png',
    url: 'https://www.linkedin.com/in/cristianflorincalina/'
}, {
    alt: 'github',
    description: 'Open Cristian-Florin Călina\'s github profile',
    path: './public/icons/github.png',
    url: 'https://github.com/CalinaCristian'
}, {
    alt: 'twitter',
    description: 'Open Cristian-Florin Călina\'s twitter profile',
    path: './public/icons/twitter.png',
    url: 'https://twitter.com/wastintimehere'
}, {
    alt: 'medium',
    description: 'Open Cristian-Florin Călina\'s medium profile',
    path: './public/icons/medium.png',
    url: 'https://medium.com/@cristianflorincalina',
}, {
    alt: 'dev-to',
    description: 'Open Cristian-Florin Călina\'s dev-to profile',
    path: './public/icons/dev-to.png',
    url: 'https://dev.to/cristianflorincalina',
}, {
    alt: 'stackoverflow',
    description: 'Open Cristian-Florin Călina\'s stackoverflow profile',
    path: './public/icons/stackoverflow.png',
    url: 'https://stackoverflow.com/users/19413118/cristian-florin-calina',
}]

// dynamically generate the social links
document.querySelector('.social-links').innerHTML = iconMap.map(icon => `<a title="${icon.alt}" aria-label="${icon.description}" href="${icon.url}" target="_blank" tabindex="-1"><img class="${icon.alt}" src=${icon.path} alt=${icon.alt}/></a>`).join('');