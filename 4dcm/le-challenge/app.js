/**
 * Le Challenge des Experts à Haute Valeur: sales page script
 *
 * Display states (all dates Europe/Paris; Paris is UTC+1 from Oct 25, 2026):
 *   launch     until Wed Oct 28 23:59:59      annual plan only (+ wire transfer)
 *   quarterly  Thu Oct 29 00:00 to Nov 2       annual + quarterly; wire transfer stays annual only
 *   closed     from Tue Nov 3 00:00           the countdown bar in <head> redirects to /oto/too-late/
 * The edge script (edge-scripts/airwallex-checkout.ts, PLANS) enforces the same dates server side.
 *
 * ?preview_state=launch|quarterly forces a display state (display only: checkouts still follow
 * the server dates). Combine with ?unlockfor=1 to look at the page after the deadline.
 */
(function () {
  'use strict';

  var CONFIG = {
    timeZone:         'Europe/Paris',
    quarterlyOpensAt: '2026-10-28T23:00:00Z',   // Thu Oct 29, 00:00 Paris
    closesAt:         '2026-11-02T23:00:00Z'    // Mon Nov 2, 23:59:59 Paris (exclusive end)
  };

  function offerState() {
    var preview = new URLSearchParams(window.location.search).get('preview_state');
    if (preview === 'launch' || preview === 'quarterly') return preview;
    var now = Date.now();
    if (now >= Date.parse(CONFIG.closesAt)) return 'closed';
    return now >= Date.parse(CONFIG.quarterlyOpensAt) ? 'quarterly' : 'launch';
  }

  // Set right away (this script is loaded at the end of <body>) so the plans don't flicker
  document.documentElement.setAttribute('data-offer-state', offerState());

  // ── Skills (section 6): rendered with /assets/info-bubbles/info-bubbles.js ──────

  var SKILL_FAMILIES = [
    { key: 'clarte',    name: 'Clarté',             intro: 'savoir exactement quoi vendre, et à qui' },
    { key: 'contenu',   name: 'Contenu',            intro: 'attirer des acheteurs, et pas seulement des vues' },
    { key: 'emails',    name: 'Emails',             intro: 'transformer ta liste en clients' },
    { key: 'lancement', name: 'Lancement et vente', intro: 'vendre sans appel de vente' },
    { key: 'finition',  name: 'Finition',           intro: 'un texte qui sonne comme toi' }
  ];

  var SKILLS = [
    { family: 'clarte', name: 'Étude de Marché Express', description: 'Rédige les 7 questions du sondage qui te révèlent ce que ton marché veut vraiment acheter, avant que tu investisses une seule heure dans ta formation.' },
    { family: 'clarte', name: 'Avatar client idéal', description: 'Transforme les réponses de ton sondage, ou ce que tu sais déjà de tes clients, en portrait détaillé de ton client idéal : ses peurs, ses désirs et ses mots exacts.' },
    { family: 'clarte', name: 'Promesse de transformation', description: 'Formule le résultat concret que ton client achète vraiment, avec l\'avant, l\'après, et ce que ça lui coûte de ne rien changer.' },
    { family: 'clarte', name: 'Positionnement', description: 'Te guide question après question pour définir ton marché, tes vraies alternatives et la raison pour laquelle on doit te choisir toi.' },
    { family: 'clarte', name: 'Big Idea', description: 'Trouve l\'angle qui rend ton offre impossible à ignorer et différente de tout ce que ton marché a déjà vu.' },
    { family: 'clarte', name: 'Offre irrésistible', description: 'Construit et vérifie ton offre (bonus, garantie, urgence, valeur perçue) pour que le prix ne soit plus une objection.' },
    { family: 'clarte', name: 'Persuasion en une phrase', description: 'Renforce n\'importe quel texte avec les 5 leviers de Blair Warren, pour que ton lecteur se dise enfin « cette personne me comprend ».' },
    { family: 'clarte', name: 'Profil de marque', description: 'Enregistre une fois pour toutes ton identité, ta voix et ton audience, pour que tous tes textes sonnent comme toi.' },

    { family: 'contenu', name: 'Calendrier de contenu 12 semaines', description: 'Planifie 12 semaines de vidéos avec les sujets, les titres et le plan de chaque vidéo, toutes pensées pour attirer des acheteurs.' },
    { family: 'contenu', name: 'Aimant à prospects', description: 'Conçoit et produit ta ressource gratuite (checklist, guide ou tableur) aux couleurs de ta marque, pour faire grandir ta liste email.' },
    { family: 'contenu', name: 'Architecte de formation', description: 'Structure ta formation ou ton coaching à partir des résultats promis : modules, actions, livrables et plan de chaque leçon.' },
    { family: 'contenu', name: 'Prestaproduit', description: 'Transforme ta méthode en outil IA pour tes clients, puis rédige le brief prêt à construire dans Lovable.' },

    { family: 'emails', name: 'Rédaction d\'emails', description: 'Écrit tes emails marketing, toujours en campagne, avec un objet qui donne envie d\'ouvrir et un seul appel à l\'action clair.' },
    { family: 'emails', name: 'Générateur d\'objets d\'email', description: 'Propose et évalue des objets d\'email selon la formule bénéfice et curiosité, pour que tes emails soient ouverts.' },
    { family: 'emails', name: 'Séquence de bienvenue', description: 'Écrit les emails d\'accueil de tes nouveaux abonnés ou clients, envoyés au bon moment pour qu\'ils passent à l\'action au lieu de t\'oublier.' },
    { family: 'emails', name: 'Campagne de prélancement', description: 'Écrit les emails qui annoncent tes vidéos de prélancement et font monter l\'envie avant l\'ouverture des ventes.' },
    { family: 'emails', name: 'Campagne d\'ouverture des ventes', description: 'Écrit toute la séquence, de l\'ouverture à la fermeture des inscriptions, où chaque email mène vers ta page de vente.' },
    { family: 'emails', name: 'Campagne de webinaire', description: 'Écrit les emails qui remplissent ton webinaire ou ta masterclass, puis font regarder le replay.' },
    { family: 'emails', name: 'Séquence produit d\'appel', description: 'Écrit les emails qui suivent l\'inscription à ton aimant à prospects : livraison du cadeau, contenus, puis offre à petit prix avec une vraie échéance.' },

    { family: 'lancement', name: 'Synopsis de lancement', description: 'Planifie l\'arc émotionnel de ton lancement : ce que chaque vidéo doit dire et les leviers psychologiques à activer, dans le bon ordre.' },
    { family: 'lancement', name: 'Script vidéo de prélancement 1', description: 'Écrit, prêt pour le prompteur, le script de ta première vidéo de lancement : celle qui capte l\'attention et révèle l\'opportunité.' },
    { family: 'lancement', name: 'Script vidéo de prélancement 2', description: 'Écrit le script de ta deuxième vidéo : celle qui montre la transformation possible et prouve que ta méthode fonctionne.' },
    { family: 'lancement', name: 'Script vidéo de prélancement 3', description: 'Écrit le script de ta troisième vidéo : celle qui présente le plan complet et prépare l\'ouverture des ventes.' },
    { family: 'lancement', name: 'Script vidéo de vente', description: 'Écrit le script de ta vidéo de vente : celle qui présente ton offre et ouvre les inscriptions.' },
    { family: 'lancement', name: 'Page de vente', description: 'Écrit ta page de vente section par section, puis la livre en brief pour ton graphiste ou en aperçu prêt à partager.' },
    { family: 'lancement', name: 'Relecture de page de vente', description: 'Note ta page de vente ou ton script section par section, et te propose des réécritures concrètes pour mieux convertir.' },
    { family: 'lancement', name: 'Brief de pages de lancement', description: 'Prépare le brief de tes pages d\'inscription et de tes pages de vidéos de lancement, pour ton graphiste ou ton outil de création de pages.' },
    { family: 'lancement', name: 'Architecte de tunnel', description: 'Choisit le tunnel de vente adapté à ton offre et liste toutes les pages, emails et vidéos à créer, avec un premier jet des textes.' },
    { family: 'lancement', name: 'Vidéo Passe-Passe', description: 'Écrit le script de la vidéo affichée juste après l\'inscription à ton aimant à prospects : elle confirme le cadeau et propose une offre à petit prix.' },
    { family: 'lancement', name: 'Script vidéo d\'upsell', description: 'Écrit le script de la vidéo qui propose une offre complémentaire juste après un achat.' },

    { family: 'finition', name: 'Humanisation des textes', description: 'Relit tes textes et supprime les tics d\'écriture qui trahissent l\'IA, sans changer ton message.' }
  ];

  // French typography: non-breaking space before : ; ! ? and inside « »
  function frenchSpaces(text) {
    return text.replace(/ ([:;!?»])/g, ' $1').replace(/« /g, '« ');
  }

  function renderSkills() {
    var container = document.getElementById('skills');
    if (!container || !window.oneTakeInfoBubbles) return;
    window.oneTakeInfoBubbles.renderGroups(
      container,
      SKILL_FAMILIES.map(function (f) { return { key: f.key, name: f.name, intro: f.intro }; }),
      SKILLS.map(function (s) { return { family: s.family, name: s.name, description: frenchSpaces(s.description) }; }),
      { label: function (name) { return 'En savoir plus sur ' + name; } }
    );
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', renderSkills);
  else renderSkills();
})();
