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
    sender: ''          // TODO(placeholder): e.g. 'Sébastien Night <hello@onetake.ai>'
  },

  // Page 2: sales video shown while the visitor waits for the email
  salesVideo: {
    embedUrl: '',       // TODO(placeholder): OneTake player URL (https://my.onetake.ai/...), 16:9
    offerLabel: 'Start my 3-day free trial',
    offerUrl: 'https://yes.onetake.ai'
  },

  // Page 3: the prerecorded masterclass
  masterclassVideo: {
    embedUrl: ''        // TODO(placeholder): OneTake player URL (https://my.onetake.ai/...), 16:9
  },

  // Page 3: offer block under the video
  offerHeadline: '',    // TODO(placeholder)
  offerText: '',        // TODO(placeholder)
  offerButtonLabel: '', // TODO(placeholder)
  offerUrl: 'https://yes.onetake.ai',
  offerRevealSeconds: 0,          // 0 = always visible; otherwise seconds on the page before the offer block appears
  offerCountdownEnabled: false,   // true shows a countdown in the offer block
  offerDeadline: '',              // ISO 8601 UTC, e.g. '2026-11-30T22:00:00Z'; the offer block hides after it
  offerCountdownLabel: 'This offer closes in',

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
