# kodhuset.se

Min projektsida. Allt innehåll ligger i två JSON-filer, och en liten byggscript utan beroenden gör om dem till färdiga HTML-sidor. Varje projekt får en egen sida med egen adress, titel och beskrivning, vilket är bra för SEO.

## Kom igång

Du behöver bara Node 18 eller senare.

```bash
npm run visa
```

Öppna http://localhost:4321. Sajten byggs om varje gång du sparar något i `innehall/`, `mall/` eller `bilder/`, så du behöver bara ladda om sidan. Ändrar du i `bygg.mjs` behöver du starta om kommandot.

Vill du bara bygga, utan server:

```bash
npm run bygg
```

## Var ligger vad

| Fil eller mapp | Innehåll |
| --- | --- |
| `innehall/sajt.json` | Texterna på startsidan: hero, om mig, kompetenser, erfarenhet och kontakt |
| `innehall/projekt.json` | Alla projekt och skolprojekt |
| `bilder/` | Skärmdumpar till projekten, helst 1200 x 750 pixlar |
| `mall/style.css` | All design, med ljust och mörkt läge |
| `mall/favicon.svg` | Loggan i webbläsarfliken |
| `bygg.mjs` | Byggscripten som gör om allt till `dist/` |
| `dist/` | Den färdiga sajten. Skapas vid bygget, ska inte redigeras |

## Redigera innehållet

- Skriv `**så här**` för att få fet text.
- Ordningen i `projekt.json` är ordningen på sidan. Projekt med `"utvald": true` visas stort överst.
- `slug` blir adressen, till exempel `kodhuset.se/projekt/vadkul/`. Använd bara a-z, 0-9 och bindestreck.
- Har ett projekt ingen `bild` visas en platshållare i projektets `farg`.
- Lägg till ett telefonnummer i `kontakt.telefon` om du vill visa det. Det är tomt från början.
- Bygget kontrollerar att alla projekt har det de behöver och säger till om något saknas, till exempel en bild som inte finns.

### Nytt projekt

Kopiera ett befintligt projekt i `projekt.json`, ändra fälten och lägg skärmdumpen i `bilder/`. Fälten `fakta`, `punkter`, `lankar` och `bild` kan utelämnas.

## Publicering

Sajten ligger på GitHub Pages och publiceras om av sig själv vid varje push till `main`, via `.github/workflows/publicera.yml`. Tills domänen är kopplad finns den på https://josefanderberg.github.io/kodhuset/.

### Koppla kodhuset.se

Gör det här först när domänen är registrerad. Annars slutar github.io-adressen att fungera.

1. Hos domänleverantören, peka domänen mot GitHub Pages med fyra A-poster för `kodhuset.se`:
   `185.199.108.153`, `185.199.109.153`, `185.199.110.153` och `185.199.111.153`,
   plus en CNAME-post för `www` som pekar på `josefanderberg.github.io`.
2. På GitHub, under **Settings > Pages > Custom domain**, skriv `kodhuset.se` och spara.
3. Bocka i **Enforce HTTPS** när certifikatet är klart. Det kan ta upp till ett dygn.
4. Låt `kodhuset.com` skicka vidare till `kodhuset.se` hos domänleverantören.
5. Lägg till sajten i Google Search Console och skicka in `https://kodhuset.se/sitemap.xml`.

## Om någon annan ska kunna skriva

Innehållet är vanliga filer, så den som har skrivbehörighet till repot kan redigera JSON-filerna direkt på github.com och sajten publiceras om av sig själv. Vill du ha ett riktigt redigeringsgränssnitt med inloggning och roller, likt skribent och redaktör i Umbraco, kan ett Git-baserat CMS läggas ovanpå samma filer senare utan att resten av sajten behöver ändras.
