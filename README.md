# CHEAPMATE

> Du spielst kein Schach. Du **investierst** in Schach.

Ein Roguelike, in dem du keinen einzigen Zug machst. Du kaufst eine Armee, stellst
sie auf – und dann spielt **dein** Stockfish gegen einen Stockfish auf voller Stärke.

Der Haken: dein Stockfish steht auf **Skill Level 0** und ist eine Katastrophe.
Der Gegner steht auf **Skill Level 20**. Immer. Was deinem Fisch an Können fehlt,
musst du mit Material ausgleichen – und Material kostet Geld. Übriges Geld nimmst
du in die nächste Runde mit und fütterst damit deinen Fisch. Ein besserer Fisch
braucht weniger Material. Weniger Material spart Geld. Mehr Geld macht einen
besseren Fisch.

Das ist die ganze Schleife. Gewinne so **billig** wie möglich.

## Regeln

- Du bist **Schwarz** und stellst auf Reihe 5–8 auf. Dein König steht fest auf e8 und ist gratis.
- **Weiß zieht zuerst.** Damit kann Weiß sich gegen ein gedrohtes Matt wehren –
  sonst wäre „Dame hinstellen, Matt in eins" jede Runde die gleiche Lösung.
- Du gewinnst **nur durch Matt**, und nur innerhalb des Zuglimits. Sonst: ein Herz weg.
- Remis zählt als Niederlage.
- Drei Herzen. Bei null ist der Run vorbei.

## Lokal starten

Die Seite **muss über http(s) laufen** – per Doppelklick auf `index.html` blockiert
der Browser den Web Worker.

```bash
npx serve -l 8080 .     # dann http://localhost:8080
# oder
python3 -m http.server 8080
```

## Auf Render deployen (Free Tier)

> **Schritt-für-Schritt mit allen Formularfeldern: siehe [DEPLOY.md](DEPLOY.md).**
> Unten nur die Kurzfassung.

Stockfish läuft als WASM **im Browser des Spielers**, nicht auf dem Server. Es
braucht also nur Static Hosting: kein Spindown, keine Server-CPU, keine Kosten.

1. Repo auf GitHub pushen (die 7 MB `.wasm` gehören mit rein, kein Git LFS nötig).
2. Auf Render: **New → Static Site**, Repo verbinden.
3. **Build Command:** leer lassen. **Publish Directory:** `.`
4. Deploy. Fertig – jedes weitere `git push` deployt automatisch.

`render.yaml` liegt bei, falls du lieber per Blueprint gehst.

> **Falls der Ladebalken hängt:** Der Browser braucht `Content-Type: application/wasm`
> für die `.wasm`-Datei. Render setzt das normalerweise selbst; die `render.yaml`
> erzwingt es zusätzlich.

## Warum ausgerechnet dieser Stockfish-Build

`stockfish-18-lite-single` (7,3 MB) – geprüft und bewusst gewählt:

| Kriterium | Warum das zählt |
|---|---|
| **kein SharedArrayBuffer** | Sonst bräuchte die Seite COOP/COEP-Header. Verifiziert: 0 Treffer im Build. |
| **single-threaded** | Läuft überall gleich, auch auf dem Handy. |
| **„lite"** | Das NNUE-Netz steckt im WASM. Der volle Build wäre 113 MB und würde an GitHubs 100-MB-Limit scheitern. |
| **Stockfish 18** | Aktuellste Version. `Skill Level 0–20` ist genau der Regler, den das Spiel braucht. |

Zwei **getrennte** Worker-Instanzen für dich und den Gegner – sonst würde dein
schwacher Fisch über die geteilte Transpositionstabelle vom starken mitlernen und
das ganze Upgrade-System wäre wertlos.

## Balancing – gemessen, nicht geraten

Alle Zahlen stehen in **`js/config.js`**. Sie stammen aus echten Stockfish-gegen-
Stockfish-Partien, nicht aus dem Bauch:

```
Materialvorsprung, den ein Fisch braucht, um Skill 20 mattzusetzen:
  Skill  0  ->  ~+25   (darunter verliert er sogar mit Mehrmaterial)
  Skill  4  ->   ~+8
  Skill  8  ->   ~+8
  Skill 12  ->   ~+3
  Skill 16  ->   ~+3
  Skill 20  ->   ~+3
```

Verlaufstest über Runde 1–8 mit realistischem Upgrade-Verhalten: **30 Siege,
2 Timeouts**. Früh fast immer schaffbar, ab Runde 7 wird es eng – so gewollt.

Das Zuglimit wird **pro Stellung** berechnet, nicht pauschal:
`44 + Gegnermaterial + (20 − Fischlevel) × 1,6`. Ein mieser Fisch gegen eine dicke
Armee bekommt mehr Zeit.

### Selbst nachjustieren

```bash
npm install                                  # nur jsdom, für die Tests
npm test                                     # 31 Checks durch die echte UI
node tools/rampe.mjs                         # spielt Runde 1-8 durch
SKILLS=0,8,16 ADVS=3,10,20 node tools/balance.mjs   # Skill/Material-Matrix
```

`tools/uitest.mjs` lädt `index.html` in jsdom und ersetzt `Worker` durch echte
Stockfish-Prozesse – damit lässt sich das komplette Spiel ohne Browser testen.

## Aufbau

```
index.html              Struktur
css/style.css           Kritzel-Look, alle Animationen
js/config.js            >>> ALLE Balancing-Zahlen an einem Ort <<<
js/rules.js             Werte, Preise, Fischränge, FEN-Bau
js/generator.js         Gegner-Themen + Legalitätsprüfung
js/validate.js          Stellungsprüfung vor dem Anpfiff
js/game.js              Run-Zustand, Ökonomie, Shop
js/engine.js            Stockfish-Worker-Wrapper
js/achievements.js      24 Achievements + Trigger
js/art.js               Figuren-SVGs, Wackelfilter
js/main.js              Spielablauf, DOM, Animationen
tools/                  Test- und Balancing-Skripte (laufen nur in Node)
vendor/                 Stockfish 18 Lite + chess.js
```

## Lizenz – bitte lesen

Stockfish steht unter **GPL-3.0**. Wenn du das Spiel öffentlich ausspielst und
Stockfish mitlieferst, muss das Gesamtwerk ebenfalls unter GPL-3.0 stehen und der
Quellcode verfügbar sein. Für ein privates Projekt für ein paar Leute ist das kein
Problem – für einen kommerziellen Steam-Release schon. Dann bräuchtest du eine
eigene Engine.

`chess.js` ist BSD-2-Clause, unkritisch.
