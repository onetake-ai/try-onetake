// Masterclass « trafic » (français, en direct) : toutes les valeurs modifiables.
// Une chaîne vide ('') affiche un encadré [PLACEHOLDER] / [CONFIG] visible sur la page tant qu'elle n'est pas remplie.
// Liste complète dans PLACEHOLDERS.md, dans ce dossier.
window.MASTERCLASS_CONFIG = {
  language: 'fr',
  slug: 'traffic',      // same Userlist slug as the English funnel

  // Lead capture (Userlist, through the Bunny edge script in /edge-scripts/userlist-proxy.ts)
  proxyUrl: 'https://userlist-proxy-for-tryonetakeai-84nhl.bunny.run/track',
  registrationEvent: 'CompleteRegistration',
  qualificationEvent: 'CompleteQualification',   // optional step 2 questions (/masterclass/trafic/recherche/)

  urls: {
    register:     '/masterclass/trafic/',           // variant: /masterclass/trafic/recherche/ (same funnel)
    checkInbox:   '/masterclass/trafic/verifiez-vos-emails/',
    confirmation: '/masterclass/trafic/confirmation/',
    offer:        '/masterclass/trafic/offre/'
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
    subject: '{{ user.first_name | capitalize }}, confirme ta place (Masterclass 100M de followers)',
    sender: 'OneTake AI - Sebastien <contact@mail.onetake.ai>'
  },

  // Page 3: Passe-Passe video
  passePasseVideo: {
    embedUrl: ''        // TODO(placeholder): OneTake player URL (https://my.onetake.ai/...), 16:9
  },

  // Offer page (/masterclass/trafic/offre/, masterclass/offer.js): replay at the top, offer visible right away
  replayVideo: {
    embedUrl: 'https://my.onetake.ai/b9502ad6/80da4289/?hide_controls=true&t=400',
    days: [0, 1]        // shown on Sunday and Monday only (Paris time); other days the page shows the offer alone
  },
  offer: {
    plans: { yearly: 'scale-yearly-offer', quarterly: 'scale-quarterly-offer' },  // keys in /pricing-data.js
    defaultPlan: 'yearly',
    deadline: 'weekly-live',        // Wednesday after the Thursday live (?attends_masterclass_on=), 23:59:59 Paris time
    revealAfterSeconds: 0,
    expiredRedirectUrl: 'https://try.onetake.ai/oto/too-late/'
  },

  // Page 1 : comptes qui défilent sous l'effet de scan. Ajoutez ou retirez des comptes librement (captures dans /masterclass/images/, 288x640).
  profiles: [
    { name: 'Alex Hormozi', image: '/masterclass/images/hormozi-sd.jpeg', alt: 'Profil Instagram d’Alex Hormozi, avec son nombre d’abonnés' },
    { name: 'Leila Hormozi', image: '/masterclass/images/leilahormozi-sd.jpeg', alt: 'Profil Instagram de Leila Hormozi, avec son nombre d’abonnés' },
    { name: 'Gary Vaynerchuk', image: '/masterclass/images/garyvee-sd.jpeg', alt: 'Profil Instagram de Gary Vaynerchuk, avec son nombre d’abonnés' },
    { name: 'Steven Bartlett', image: '/masterclass/images/steven-sd.jpeg', alt: 'Profil Instagram de Steven Bartlett, avec son nombre d’abonnés' },
    { name: 'Erico Rocha', image: '/masterclass/images/rochaerico-sd.jpeg', alt: 'Profil Instagram d’Erico Rocha, avec son nombre d’abonnés' },
    { name: 'Fabien Olicard', image: '/masterclass/images/fabienolicard-sd.jpeg', alt: 'Profil Instagram de Fabien Olicard, avec son nombre d’abonnés' },
    { name: 'Nicole Johnsey Burke (@gardenaryco)', image: '/masterclass/images/gardenaryco-sd.jpeg', alt: 'Profil Instagram de Nicole Johnsey Burke (@gardenaryco), avec son nombre d’abonnés' },
    { name: 'Nicole Johnsey Burke (@heynicoleburke)', image: '/masterclass/images/heynicoleburke-sd.jpeg', alt: 'Profil Instagram de Nicole Johnsey Burke (@heynicoleburke), avec son nombre d’abonnés' }
  ],
  scanLabel: 'Analyse en cours',

  // Page 1: host photo (the one used on /instagram/)
  hostPhoto: 'https://www.sebastiennight.com/images/press/Sebastien-03-official-sd.jpeg',

  messages: {
    firstName: 'Merci d’indiquer votre prénom.',
    email: 'Merci d’indiquer une adresse email valide, par exemple nom@exemple.com.',
    network: 'Votre inscription n’a pas pu être enregistrée. Vérifiez votre connexion Internet et réessayez.'
  }
};
