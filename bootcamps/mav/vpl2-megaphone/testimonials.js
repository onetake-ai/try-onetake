/* ============================================================
   MAV VPL1 — Testimonial Gallery
   Featured stack + expandable overflow
   ============================================================ */
(function () {
  var data = [
    { name: "Jeanne Muvira", role: "Personal development coach", quote: "Generated €210,000 in sales while overcoming cancer and burnout", yt: "ChwiwKQKrTU" },
    { name: "Aurélien Amacker", role: "Founder of systeme.io", quote: "Turned down a €50,000 salary and ran a launch that brought in €500,000", yt: "fpWEoh9621I" },
    { name: "Catherine Booth", role: "Canine behavior educator", quote: "Revenue increased 50% from a single orchestrated launch", yt: "9gaGUvelg3M" },
    { name: "Léandro Lozahic", role: "Professional trainer", quote: "Went from €60,000/year to €80,000/month on autopilot", yt: "2-AE9WWZ8lQ" },
    { name: "Nathalie Simon", role: "Artisan bead business owner", quote: "Grew revenue 30% in one year and saved the family business", yt: "PkrnfkEUI-Q" },
    { name: "David Jay", role: "Founder of La Révolution Vidéo", quote: "Free to work where and when I want — 10x ROI in just 6 months", yt: "liSamVmxHtc" },
    { name: "Yvan Keyna", role: "Network marketing specialist", quote: "In just 11 months, learned to think bigger and stop self-limiting", yt: "qGX8tvn3P5s" },
    { name: "Alexis Marigny", role: "Sports coach", quote: "Generated €60,000 in 9 months — now a happy dad who spends time with his daughter", yt: "7H-iSnqvcjs" },
    { name: "Joël Bernard", role: "Golf instructor", quote: "Automated sales with just 4 emails and 5 videos", yt: "H3dAZIhsPzM" },
    { name: "Maryse Lehoux", role: "Yoga instructor", quote: "Started from zero, now trains 30,000 people online and lives her dream life", yt: "ipt1laQG0Og" },
    { name: "Luc Geiger", role: "Stress management specialist", quote: "Created just 4 pages that attract thousands of potential clients every month", yt: "8pqwZTEYNEI" },
    { name: "Janique Villeneuve", role: "Image consultant & personal shopper", quote: "Made her first sale with just the 4th prospect who signed up on her site", yt: "ebCbQrU0M-o" },
    { name: "Christine Cuisiniez", role: "Pharmacist", quote: "Reached thousands of people online through her passion — a true Free Entrepreneur", yt: "wzHh7i6doOE" },
    { name: "Maxence Rigottier", role: "Sports betting expert", quote: "Since automating, earns at least €20,000/month", yt: "qedkSpADXAY" },
    { name: "Julien Romain", role: "Trainer", quote: "Generates €300,000 in annual sales working just one day per week", yt: "Lri741F9ozA" },
    { name: "Olivier Roland", role: "Author & professional blogger", quote: "Went from €300 to €28,000/month and became a recognized expert", yt: "Ez6vGI6tBr0" },
    { name: "Gaëlle Le Reun", role: "Personal development coach", quote: "First launch was a massive success", yt: "IFrEu8JRjcg" },
    { name: "Charles", role: "Blogger", quote: "Earned several thousand euros in just a few days selling products on his blog", yt: "CoV9hEzwPkQ" },
    { name: "Nathalie Cariou", role: "Financial intelligence coach", quote: "Went from €50,000 to €1 million in online sales in just 4 years", yt: "ZuMvskOqLds" },
    { name: "Alexandre Lahouel", role: "Raw food specialist", quote: "Sébastien's advice helped generate €210,000 in sales starting from zero", yt: "mhkGwfu3VV8" },
    { name: "Sophie Gueidon", role: "Women's success coach", quote: "Generated €50,000 through partnerships, now reaching 25,000 women online", yt: "JP_in9niWic" },
    { name: "David Colom", role: "Personal development expert", quote: "Made €350,000 in sales — with no website, no email list, and no product", yt: "BXjQ2khMJds" },
    { name: "Matthieu Deloison", role: "Software developer", quote: "Alongside his job, built a site earning €10,000 in extra revenue", yt: "-73WxGaptas" },
    { name: "Lorenzo Pancino", role: "Public speaking expert", quote: "€48,000 in sales in one week during the first Maxxivoice launch", yt: "4N9j5vFJZXg" },
    { name: "Romy Malbroukou", role: "Psychologist", quote: "On launch day, 2 people showed up at her door to make sure they signed up", yt: "9UyNEpwewY8" },
    { name: "Caroline Burel", role: "Personal development coach", quote: "Tripled her client base in 1 year and multiplied her prospect list by 9", yt: "Dw81DhfGvec" },
    { name: "Yoann Romano", role: "Entrepreneur", quote: "Surpassed €1 million in revenue using Sébastien's strategies", yt: "Dy6fi2ii-TI" },
    { name: "Fabrice Mouchain", role: "Consultant", quote: "Created his business and generated €45,000 in sales for a new product", yt: "fO7qRpX1kOE" },
    { name: "Yannick Alain", role: "Professional sales trainer", quote: "Doubled revenue on offline product sales", yt: "EPUS_MciAec" },
    { name: "Vincent Guihard", role: "Sports coach", quote: "Reached #1 on Google with his coaching site", yt: "CjNAN24DJEU" },
    { name: "Jean Sommer", role: "Vocal coach", quote: "Reached major media outlets with numerous TV appearances and press coverage", yt: "iEozawSmlBE" },
    { name: "Nathalie Simon", role: "Artisan", quote: "Built a unique relationship with prospects, reaching exactly the right audience", yt: "BhSh8QZvqVU" }
  ];

  var featuredIds = [
    "2-AE9WWZ8lQ", "H3dAZIhsPzM", "ZuMvskOqLds", "Lri741F9ozA",
    "7H-iSnqvcjs", "Ez6vGI6tBr0", "BXjQ2khMJds", "fpWEoh9621I"
  ];

  function card(t) {
    return '<div class="testimonial-card">' +
      '<div class="testimonial-card__video">' +
        '<div class="youtube-player" data-id="' + t.yt + '"></div>' +
      '</div>' +
      '<div class="testimonial-card__body">' +
        '<p class="testimonial-card__quote">' + t.quote + '</p>' +
        '<p class="testimonial-card__name">' + t.name + '</p>' +
        '<p class="testimonial-card__role">' + t.role + '</p>' +
      '</div>' +
    '</div>';
  }

  function initThumbs() {
    var els = document.getElementsByClassName("youtube-player");
    for (var i = 0; i < els.length; i++) {
      if (els[i].querySelector("div")) continue;
      var d = document.createElement("div");
      d.setAttribute("data-id", els[i].dataset.id);
      d.innerHTML = labnolThumb(els[i].dataset.id);
      d.onclick = labnolIframe;
      els[i].appendChild(d);
    }
  }

  function render() {
    var gallery = document.getElementById("testimonial-gallery");
    if (!gallery) return;

    var featured = [];
    var rest = [];
    data.forEach(function (t) {
      if (featuredIds.indexOf(t.yt) !== -1) featured.push(t);
      else rest.push(t);
    });
    featured.sort(function (a, b) {
      return featuredIds.indexOf(a.yt) - featuredIds.indexOf(b.yt);
    });

    var h = '';

    h += '<div class="testimonial-stack">';
    featured.forEach(function (t) { h += card(t); });
    h += '</div>';

    h += '<div class="testimonial-actions">';
    h += '<button class="btn-see-all" id="seeAllBtn" aria-expanded="false">';
    h += 'See many more case studies ';
    h += '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 5l4 4 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
    h += '</button></div>';

    h += '<div class="testimonial-stack" id="tGrid" hidden>';
    rest.forEach(function (t) { h += card(t); });
    h += '</div>';

    gallery.innerHTML = h;
    initThumbs();

    var btn = document.getElementById("seeAllBtn");
    btn.addEventListener("click", function () {
      var grid = document.getElementById("tGrid");
      var open = this.getAttribute("aria-expanded") === "true";
      if (open) {
        grid.hidden = true;
        this.setAttribute("aria-expanded", "false");
        this.innerHTML = 'See many more case studies <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 5l4 4 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
      } else {
        grid.hidden = false;
        this.setAttribute("aria-expanded", "true");
        this.innerHTML = 'Show fewer <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 5l4 4 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
        initThumbs();
      }
    });
  }

  document.addEventListener("DOMContentLoaded", render);
})();
