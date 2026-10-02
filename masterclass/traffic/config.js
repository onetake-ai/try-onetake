// Masterclass "traffic" (English, prerecorded): every value you may need to change.
// An empty string ('') shows a visible [PLACEHOLDER] / [CONFIG] box on the page until it is filled in.
// See PLACEHOLDERS.md in this folder for the full list.
window.MASTERCLASS_CONFIG = {
  language: 'en',
  slug: 'traffic',

  // Lead capture (Userlist, through the Bunny edge script in /edge-scripts/userlist-proxy.ts)
  proxyUrl: 'https://userlist-proxy-for-tryonetakeai-84nhl.bunny.run/track',
  registrationEvent: 'CompleteRegistration',

  urls: {
    register:   '/masterclass/traffic/',
    checkInbox: '/masterclass/traffic/check-your-inbox/',
    watch:      '/masterclass/traffic/watch/'
  },

  // Page 2: the confirmation email the visitor should look for
  email: {
    subject: '',        // TODO(placeholder): exact subject line of the Userlist confirmation email
    sender: 'OneTake AI - Sebastien <contact@mail.onetake.ai>'
  },

  // Page 2: sales video shown while the visitor waits for the email (the trial offer follows, as on /instagram/)
  salesVideo: {
    embedUrl: ''        // TODO(placeholder): OneTake player URL (https://my.onetake.ai/...), 16:9
  },

  // Page 3: the prerecorded masterclass (about 75 minutes)
  masterclassVideo: {
    embedUrl: ''        // TODO(placeholder): OneTake player URL (https://my.onetake.ai/...), 16:9
  },

  // Page 3: the offer under the masterclass (masterclass/offer.js)
  offer: {
    plans: { yearly: 'scale-yearly-offer', quarterly: 'scale-quarterly-offer' },  // keys in /pricing-data.js
    defaultPlan: 'yearly',
    deadline: 'registration',       // 6 days after registration (?registered_on=), end of day, visitor's time zone
    revealAfterSeconds: 270,        // sales content appears after 4 min 30 s on the page (0 = right away)
    expiredRedirectUrl: 'https://try.onetake.ai/oto/too-late/'
  },

  // Page 1: proof section. Add or remove items freely; an empty image shows a placeholder.
  profiles: [
    { name: 'Alex Hormozi',      image: '', alt: 'Instagram profile of Alex Hormozi, showing the follower count' },
    { name: 'Leila Hormozi',     image: '', alt: 'Instagram profile of Leila Hormozi, showing the follower count' },
    { name: 'Gary Vaynerchuk',   image: '', alt: 'Instagram profile of Gary Vaynerchuk, showing the follower count' },
    { name: 'Steven Bartlett',   image: '', alt: 'Instagram profile of Steven Bartlett, showing the follower count' },
    { name: 'Olivier Roland',    image: '', alt: 'Instagram profile of Olivier Roland, showing the follower count' },
    { name: 'Erico Rocha',       image: '', alt: 'Instagram profile of Erico Rocha, showing the follower count' },
    { name: 'Nicole Burke (@gardenaryco)', image: '', alt: 'Instagram profile of Nicole Burke (@gardenaryco), showing the follower count' },
    { name: 'Fabien Olicard',    image: '', alt: 'Instagram profile of Fabien Olicard, showing the follower count' }
  ],
  reels: [
    { creator: '', views: '', image: '', alt: '' },
    { creator: '', views: '', image: '', alt: '' },
    { creator: '', views: '', image: '', alt: '' },
    { creator: '', views: '', image: '', alt: '' },
    { creator: '', views: '', image: '', alt: '' },
    { creator: '', views: '', image: '', alt: '' }
  ],
  viewsSuffix: 'views',

  // Page 1: host photo (the one used on /instagram/)
  hostPhoto: 'https://www.sebastiennight.com/images/press/Sebastien-03-official-sd.jpeg',

  messages: {
    firstName: 'Please enter your first name.',
    email: 'Please enter a valid email address, like name@example.com.',
    network: 'We couldn\'t save your registration. Check your internet connection and try again.'
  }
};
