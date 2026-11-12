// Bygger kodhuset.se från innehållet i innehall/ till färdiga HTML-sidor i dist/.
//
//   node bygg.mjs          bygger en gång
//   node bygg.mjs --visa   bygger, startar en lokal server och bygger om när du sparar
//
// Inga beroenden behövs, bara Node 18 eller senare.

import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync, watch, statSync } from "node:fs";
import { join, dirname, extname, normalize } from "node:path";
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const rot = dirname(fileURLToPath(import.meta.url));
const ut = join(rot, "dist");
const PORT = 4321;

// ---------- Hjälpfunktioner ----------

const esc = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// Hårt mellanslag i tal som "1 700", så att de aldrig bryts över två rader
const siffror = (s) => s.replace(/(\d) (?=\d)/g, "$1 ");

// **fet text** blir <strong>, allt annat escapas
const md = (s = "") => siffror(esc(s)).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

// Ren text utan markeringar, för meta-taggar
const ren = (s = "") => String(s).replace(/\*\*/g, "");

const kortaAv = (s, max = 158) => (s.length <= max ? s : s.slice(0, s.lastIndexOf(" ", max)) + " ...");

function lasJson(fil) {
  const sokvag = join(rot, fil);
  try {
    return JSON.parse(readFileSync(sokvag, "utf8"));
  } catch (fel) {
    throw new Error(`Kunde inte läsa ${fil}: ${fel.message}`);
  }
}

function skriv(fil, innehall) {
  const sokvag = join(ut, fil);
  mkdirSync(dirname(sokvag), { recursive: true });
  writeFileSync(sokvag, innehall);
}

// ---------- Byggstenar ----------

const logga = () =>
  `<svg viewBox="0 0 32 32" aria-hidden="true"><rect class="ruta" width="32" height="32" rx="8"/><g class="streck" fill="none" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 15 16 7l9 8"/><path d="M12.5 17.5 9.5 20.5l3 3M19.5 17.5l3 3-3 3M17 17l-2 7"/></g></svg>`;

const chips = (lista = []) =>
  lista.length ? `<ul class="chips" aria-label="Teknik">${lista.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : "";

const fakta = (lista = [], klass = "") =>
  lista.length
    ? `<dl class="fakta ${klass}">${lista.map((f) => `<div><dt>${siffror(esc(f.varde))}</dt><dd>${esc(f.text)}</dd></div>`).join("")}</dl>`
    : "";

const extern = (l, klass = "knapp") =>
  `<a class="${klass}" href="${esc(l.url)}" rel="noopener">${esc(l.etikett)} <span class="pil" aria-hidden="true">↗</span></a>`;

function bild(p, upp, { lat = true, dekor = false } = {}) {
  if (p.bild) {
    const alt = dekor ? "" : esc(p.bildAlt || p.namn);
    return `<img src="${upp}bilder/${esc(p.bild)}" alt="${alt}" width="1200" height="750"${lat ? ' loading="lazy"' : ""} decoding="async">`;
  }
  return `<div class="platshallare" style="--farg:${esc(p.farg || "#0f6b5c")}" aria-hidden="true"><span>${esc(p.namn[0])}</span></div>`;
}

function sida({ titel, beskrivning, sokvag, upp, kropp, bildfil, jsonld }) {
  const url = sajt.url + sokvag;
  const hem = upp || "./";
  const ld = jsonld ? `\n<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, "\\u003c")}</script>` : "";
  const og = bildfil
    ? `\n<meta property="og:image" content="${sajt.url}/bilder/${esc(bildfil)}">\n<meta name="twitter:card" content="summary_large_image">`
    : "";

  return `<!doctype html>
<html lang="sv">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titel)}</title>
<meta name="description" content="${esc(beskrivning)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="website">
<meta property="og:locale" content="sv_SE">
<meta property="og:site_name" content="${esc(sajt.namn)}">
<meta property="og:title" content="${esc(titel)}">
<meta property="og:description" content="${esc(beskrivning)}">
<meta property="og:url" content="${url}">${og}
<meta name="theme-color" content="#f6f4ef" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#111315" media="(prefers-color-scheme: dark)">
<link rel="icon" href="${upp}favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="${upp}style.css?v=${cssVersion}">${ld}
</head>
<body>
<a class="hoppa" href="#innehall">Hoppa till innehållet</a>
<header class="sidhuvud">
  <div class="wrap">
    <a class="logga" href="${hem}" aria-label="${esc(sajt.namn)}, till startsidan">${logga()}<span>kodhuset</span></a>
    <nav class="meny" aria-label="Huvudmeny">
      <a href="${upp}#projekt">Projekt</a>
      <a href="${upp}#om">Om mig</a>
      <a href="${upp}#erfarenhet">Erfarenhet</a>
      <a class="viktig" href="${upp}#kontakt">Kontakt</a>
    </nav>
  </div>
</header>
<main id="innehall">
${kropp}
</main>
<footer class="sidfot">
  <div class="wrap">
    <span>© ${new Date().getFullYear()} ${esc(sajt.person)} · ${esc(new URL(sajt.url).hostname)}</span>
    <span>Byggd utan ramverk, med en egen liten generator.</span>
  </div>
</footer>
</body>
</html>
`;
}

// ---------- Startsidan ----------

function startsida() {
  const utvalda = projekt.filter((p) => p.utvald);
  const ovriga = projekt.filter((p) => !p.utvald);
  const k = sajt.kontakt;

  const kropp = `
<section class="hero">
  <div class="wrap">
    ${sajt.hero.status ? `<span class="etikett"><span class="prick"></span>${esc(sajt.hero.status)}</span>` : ""}
    <h1>${md(sajt.hero.rubrik)}</h1>
    <p class="ingress">${md(sajt.hero.text)}</p>
    <div class="knappar">
      <a class="knapp primar" href="#projekt">Se projekten <span class="pil" aria-hidden="true">→</span></a>
      <a class="knapp" href="#kontakt">Kontakta mig</a>
    </div>
  </div>
</section>

<section class="sektion" id="projekt">
  <div class="wrap">
    <div class="sektion-huvud">
      <p class="overrubrik">Projekt</p>
      <h2>Det här har jag byggt</h2>
      <p>Egna projekt som jag har byggt från idé till färdig produkt, plus ett par från utbildningen.</p>
    </div>
    ${utvalda
      .map(
        (p) => `
    <article class="utvald">
      <a class="bild" href="projekt/${p.slug}/" tabindex="-1" aria-hidden="true">${bild(p, "", { lat: false, dekor: true })}</a>
      <div class="innehall">
        <div>
          <p class="overrubrik">Utvalt projekt · ${esc(p.status)}</p>
          <h3><a href="projekt/${p.slug}/">${esc(p.namn)}</a></h3>
        </div>
        <p class="kort-text">${md(p.beskrivning[0])}</p>
        ${fakta(p.fakta)}
        ${chips(p.teknik)}
        <div class="knappar">
          <a class="knapp primar" href="projekt/${p.slug}/">Läs mer om ${esc(p.namn)} <span class="pil" aria-hidden="true">→</span></a>
          ${p.lankar[0] ? extern(p.lankar[0]) : ""}
        </div>
      </div>
    </article>`
      )
      .join("")}

    <h3 class="skola-rubrik">Fler projekt</h3>
    <div class="rutnat" style="margin-top:16px">
      ${ovriga
        .map(
          (p) => `
      <article class="kort">
        <div class="bild">${bild(p, "", { dekor: true })}</div>
        <div class="innehall">
          <div class="rad"><h4><a href="projekt/${p.slug}/">${esc(p.namn)}</a></h4><span class="status">${esc(p.status)}</span></div>
          <p>${md(p.kort)}</p>
          ${chips(p.teknik.slice(0, 4))}
        </div>
      </article>`
        )
        .join("")}
    </div>

    ${
      skolprojekt.length
        ? `<h3 class="skola-rubrik">Från utbildningen</h3>
    <div class="skola" style="margin-top:16px">
      ${skolprojekt.map((s) => `<article><h4>${esc(s.namn)}</h4><p>${md(s.text)}</p>${chips(s.teknik)}</article>`).join("")}
    </div>`
        : ""
    }
  </div>
</section>

<section class="sektion" id="om">
  <div class="wrap">
    <div class="sektion-huvud">
      <p class="overrubrik">Om mig</p>
      <h2>${esc(sajt.person)}</h2>
      <p>${esc(sajt.titel)} i ${esc(sajt.ort)}.</p>
    </div>
    <div class="om">
      <div class="text">
        ${sajt.om.stycken.map((s) => `<p>${md(s)}</p>`).join("\n        ")}
        ${
          sajt.om.citat?.text
            ? `<blockquote class="citat"><p>${esc(sajt.om.citat.text)}</p><footer>${esc(sajt.om.citat.avsandare)}</footer></blockquote>`
            : ""
        }
      </div>
      <div class="kompetenser">
        ${sajt.kompetenser.map((c) => `<div><h3>${esc(c.rubrik)}</h3><p>${esc(c.text)}</p></div>`).join("\n        ")}
      </div>
    </div>
  </div>
</section>

<section class="sektion" id="erfarenhet">
  <div class="wrap">
    <div class="sektion-huvud">
      <p class="overrubrik">Erfarenhet och utbildning</p>
      <h2>Vägen hit</h2>
    </div>
    <ol class="tidslinje">
      ${sajt.erfarenhet
        .map(
          (e) => `<li><span class="datum">${esc(e.datum)}</span><div><h3>${esc(e.rubrik)}</h3><div class="plats">${esc(e.plats)}</div>${e.text ? `<p>${md(e.text)}</p>` : ""}</div></li>`
        )
        .join("\n      ")}
    </ol>
  </div>
</section>

<section class="sektion" id="kontakt">
  <div class="wrap">
    <div class="kontakt-ruta">
      <div>
        <h2>Hör av dig</h2>
        <p>${md(k.text)}</p>
        ${k.epost ? `<p class="epost"><a href="mailto:${esc(k.epost)}">${esc(k.epost)}</a></p>` : ""}
        ${k.telefon ? `<p class="epost"><a href="tel:${esc(k.telefon.replace(/[^\d+]/g, ""))}">${esc(k.telefon)}</a></p>` : ""}
      </div>
      <div class="knappar">
        ${k.epost ? `<a class="knapp primar" href="mailto:${esc(k.epost)}">Skicka e-post</a>` : ""}
        ${k.lankar.map((l) => extern(l)).join("\n        ")}
      </div>
    </div>
  </div>
</section>`;

  const jsonld = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: sajt.person,
    jobTitle: sajt.titel,
    url: sajt.url,
    address: { "@type": "PostalAddress", addressLocality: sajt.ort, addressCountry: "SE" },
    sameAs: k.lankar.map((l) => l.url),
  };

  return sida({
    titel: `${sajt.namn} - ${sajt.person}, ${sajt.titel[0].toLowerCase() + sajt.titel.slice(1)}`,
    beskrivning: kortaAv(ren(sajt.beskrivning)),
    sokvag: "/",
    upp: "",
    kropp,
    jsonld,
  });
}

// ---------- Projektsidor ----------

function projektsida(p, i) {
  const upp = "../../";
  const forra = projekt[i - 1];
  const nasta = projekt[i + 1];

  const kropp = `
<section class="projekt-hero">
  <div class="wrap">
    <a class="tillbaka" href="${upp}#projekt"><span aria-hidden="true">←</span> Alla projekt</a>
    <h1>${esc(p.namn)}</h1>
    <p class="ingress">${md(p.kort)}</p>
    <ul class="meta">
      ${p.ar ? `<li>År<strong>${esc(p.ar)}</strong></li>` : ""}
      ${p.roll ? `<li>Roll<strong>${esc(p.roll)}</strong></li>` : ""}
      ${p.status ? `<li>Status<strong>${esc(p.status)}</strong></li>` : ""}
    </ul>
  </div>
</section>

<div class="wrap">
  <div class="projekt-bild">${bild(p, upp, { lat: false })}</div>
  ${fakta(p.fakta, "projekt-fakta")}

  <div class="projekt-kropp">
    <div class="text">
      <h2>Om projektet</h2>
      ${p.beskrivning.map((s) => `<p>${md(s)}</p>`).join("\n      ")}
      ${p.punkter?.length ? `<h2>Höjdpunkter</h2>\n      <ul class="punkter">${p.punkter.map((s) => `<li>${md(s)}</li>`).join("")}</ul>` : ""}
    </div>
    <aside class="sidopanel">
      <div>
        <h2>Teknik</h2>
        ${chips(p.teknik)}
      </div>
      <div>
        <h2>Länkar</h2>
        ${
          p.lankar.length
            ? `<div class="knappar">${p.lankar.map((l) => extern(l)).join("")}</div>`
            : `<p class="ingen-lank">Koden är inte publik än. Hör gärna av dig om du vill veta mer.</p>`
        }
      </div>
    </aside>
  </div>

  <nav class="nasta" aria-label="Fler projekt">
    ${forra ? `<a href="${upp}projekt/${forra.slug}/"><small>← Föregående</small><span>${esc(forra.namn)}</span></a>` : ""}
    ${nasta ? `<a class="fram" href="${upp}projekt/${nasta.slug}/"><small>Nästa →</small><span>${esc(nasta.namn)}</span></a>` : ""}
  </nav>
</div>`;

  return sida({
    titel: `${p.namn} | ${sajt.namn}`,
    beskrivning: kortaAv(ren(p.beskrivning[0])),
    sokvag: `/projekt/${p.slug}/`,
    upp,
    kropp,
    bildfil: p.bild,
  });
}

// 404-sidan kan visas på vilken adress som helst, så den behöver absoluta sökvägar.
// BAS sätts av GitHub-workflowen, till exempel "/kodhuset" så länge sajten ligger på github.io.
function felsida() {
  const bas = (process.env.BAS || "").replace(/\/?$/, "/");
  return sida({
    titel: `Sidan finns inte | ${sajt.namn}`,
    beskrivning: "Sidan du letar efter finns inte.",
    sokvag: "/404.html",
    upp: bas,
    kropp: `<section class="fel"><div class="wrap"><p class="overrubrik">404</p><h1>Här fanns ingenting.</h1><p>Sidan kan ha flyttat, eller så blev det ett stavfel i adressen.</p><div class="knappar"><a class="knapp primar" href="${bas}">Till startsidan</a></div></div></section>`,
  });
}

// ---------- Kontroll av innehållet ----------

function kontrollera() {
  const fel = [];
  const slugs = new Set();
  projekt.forEach((p, i) => {
    const namn = p.namn || `projekt nummer ${i + 1}`;
    for (const falt of ["slug", "namn", "kort"]) if (!p[falt]) fel.push(`${namn} saknar "${falt}"`);
    if (!Array.isArray(p.beskrivning) || !p.beskrivning.length) fel.push(`${namn} saknar "beskrivning" (en lista med stycken)`);
    if (p.slug && !/^[a-z0-9-]+$/.test(p.slug)) fel.push(`${namn}: "slug" får bara innehålla a-z, 0-9 och bindestreck`);
    if (slugs.has(p.slug)) fel.push(`Två projekt har slug "${p.slug}"`);
    slugs.add(p.slug);
    if (p.bild && !existsSync(join(rot, "bilder", p.bild))) fel.push(`${namn}: bilden bilder/${p.bild} finns inte`);
    p.teknik ??= [];
    p.lankar ??= [];
  });
  if (fel.length) throw new Error("Fel i innehall/projekt.json:\n  - " + fel.join("\n  - "));
}

// ---------- Bygget ----------

let sajt, projekt, skolprojekt, cssVersion;

function bygg() {
  const start = Date.now();
  sajt = lasJson("innehall/sajt.json");
  ({ projekt, skolprojekt = [] } = lasJson("innehall/projekt.json"));
  kontrollera();

  const css = readFileSync(join(rot, "mall/style.css"));
  cssVersion = createHash("md5").update(css).digest("hex").slice(0, 8);

  rmSync(ut, { recursive: true, force: true });
  mkdirSync(ut, { recursive: true });

  skriv("index.html", startsida());
  projekt.forEach((p, i) => skriv(`projekt/${p.slug}/index.html`, projektsida(p, i)));
  skriv("404.html", felsida());

  skriv("style.css", css);
  cpSync(join(rot, "mall/favicon.svg"), join(ut, "favicon.svg"));
  if (existsSync(join(rot, "bilder"))) cpSync(join(rot, "bilder"), join(ut, "bilder"), { recursive: true, filter: (f) => !f.endsWith(".DS_Store") });

  const idag = new Date().toISOString().slice(0, 10);
  const adresser = ["/", ...projekt.map((p) => `/projekt/${p.slug}/`)];
  skriv(
    "sitemap.xml",
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${adresser
      .map((a) => `  <url><loc>${sajt.url}${a}</loc><lastmod>${idag}</lastmod></url>`)
      .join("\n")}\n</urlset>\n`
  );
  skriv("robots.txt", `User-agent: *\nAllow: /\n\nSitemap: ${sajt.url}/sitemap.xml\n`);
  skriv("CNAME", new URL(sajt.url).hostname + "\n");

  console.log(`Byggt ${projekt.length + 1} sidor till dist/ på ${Date.now() - start} ms`);
}

// ---------- Lokal förhandsvisning ----------

const typer = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

function visa() {
  createServer((req, res) => {
    let sokvag = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (sokvag.endsWith("/")) sokvag += "index.html";
    let fil = normalize(join(ut, sokvag));
    if (!fil.startsWith(ut)) return res.writeHead(403).end();
    if (existsSync(fil) && statSync(fil).isDirectory()) fil = join(fil, "index.html");
    if (!existsSync(fil)) {
      res.writeHead(404, { "content-type": typer[".html"] });
      return res.end(readFileSync(join(ut, "404.html")));
    }
    res.writeHead(200, { "content-type": typer[extname(fil)] || "application/octet-stream", "cache-control": "no-store" });
    res.end(readFileSync(fil));
  }).listen(PORT, () => console.log(`Förhandsvisning: http://localhost:${PORT}  (Ctrl+C avslutar)`));

  let timer;
  for (const mapp of ["innehall", "mall", "bilder"]) {
    watch(join(rot, mapp), { recursive: true }, () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        try {
          bygg();
        } catch (fel) {
          console.error(fel.message);
        }
      }, 120);
    });
  }
}

try {
  bygg();
} catch (fel) {
  console.error(fel.message);
  process.exit(1);
}
if (process.argv.includes("--visa")) visa();
