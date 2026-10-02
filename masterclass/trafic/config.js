// Masterclass « trafic » (français, en direct) : toutes les valeurs modifiables.
// Une chaîne vide ('') affiche un encadré [PLACEHOLDER] / [CONFIG] visible sur la page tant qu'elle n'est pas remplie.
// Liste complète dans PLACEHOLDERS.md, dans ce dossier.
window.MASTERCLASS_CONFIG = {
  language: 'fr',
  slug: 'traffic',      // same Userlist slug as the English funnel

  // Lead capture (Userlist, through the Bunny edge script in /edge-scripts/userlist-proxy.ts)
  proxyUrl: 'https://userlist-proxy-for-tryonetakeai-84nhl.bunny.run/track',
  registrationEvent: 'CompleteRegistration',

  urls: {
    register:     '/masterclass/trafic/',
    checkInbox:   '/masterclass/trafic/verifiez-vos-emails/',
    confirmation: '/masterclass/trafic/confirmation/'
  },

  // Live session: every Thursday at 20:00, Paris time (see /masterclass/session-date.js)
  session: {
    weekday: 4,                 // 0 = Sunday ... 4 = Thursday
    time: '20:00',
    cutoff: '21:00',            // from this time on the session day, visitors register for the following week
    timeZone: 'Europe/Paris'
  },
  liveUrl: 'https://nuro.video/fr-live',
  joinButtonMinutesBefore: 15,  // page 3 shows a "Rejoindre le direct" button this many minutes before the start

  // Page 3: countdown bar (/oto/countdown/countdown.js), redirects to liveUrl when the session starts
  countdown: {
    label: 'La masterclass commence dans',
    days: 'jours',
    hours: 'heures',
    min: 'min',
    sec: 's'
  },

  // Page 2: the confirmation email the visitor should look for
  email: {
    subject: '',        // TODO(placeholder): objet exact de l'email de confirmation Userlist
    sender: ''          // TODO(placeholder): ex. 'Sébastien Night <hello@onetake.ai>'
  },

  // Page 3: Passe-Passe video
  passePasseVideo: {
    embedUrl: ''        // TODO(placeholder): OneTake player URL (https://my.onetake.ai/...), 16:9
  },

  // Page 1: proof section. Add or remove items freely; an empty image shows a placeholder.
  profiles: [
    { name: 'Alex Hormozi',      image: '', alt: 'Profil Instagram d’Alex Hormozi, avec son nombre d’abonnés' },
    { name: 'Leila Hormozi',     image: '', alt: 'Profil Instagram de Leila Hormozi, avec son nombre d’abonnés' },
    { name: 'Gary Vaynerchuk',   image: '', alt: 'Profil Instagram de Gary Vaynerchuk, avec son nombre d’abonnés' },
    { name: 'Steven Bartlett',   image: '', alt: 'Profil Instagram de Steven Bartlett, avec son nombre d’abonnés' },
    { name: 'Olivier Roland',    image: '', alt: 'Profil Instagram d’Olivier Roland, avec son nombre d’abonnés' },
    { name: 'Erico Rocha',       image: '', alt: 'Profil Instagram d’Erico Rocha, avec son nombre d’abonnés' },
    { name: 'Nicole Burke (@gardenaryco)', image: '', alt: 'Profil Instagram de Nicole Burke (@gardenaryco), avec son nombre d’abonnés' },
    { name: 'Fabien Olicard',    image: '', alt: 'Profil Instagram de Fabien Olicard, avec son nombre d’abonnés' }
  ],
  reels: [
    { creator: '', views: '', image: '', alt: '' },
    { creator: '', views: '', image: '', alt: '' },
    { creator: '', views: '', image: '', alt: '' },
    { creator: '', views: '', image: '', alt: '' },
    { creator: '', views: '', image: '', alt: '' },
    { creator: '', views: '', image: '', alt: '' }
  ],
  viewsSuffix: 'vues',

  // Page 1: host photo (the one used on /instagram/)
  hostPhoto: 'https://www.sebastiennight.com/images/press/Sebastien-03-official-sd.jpeg',

  messages: {
    firstName: 'Merci d’indiquer votre prénom.',
    email: 'Merci d’indiquer une adresse email valide, par exemple nom@exemple.com.',
    network: 'Votre inscription n’a pas pu être enregistrée. Vérifiez votre connexion Internet et réessayez.'
  }
};
