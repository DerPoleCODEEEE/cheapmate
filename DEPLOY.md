# CHEAPMATE auf Render bringen

Alles im Browser. Nichts wird auf deinem Laptop installiert oder ausgeführt.
Dauer: ungefähr 10 Minuten.

---

## Teil A — Code auf GitHub (Render braucht ein Git-Repo)

**A1.** Auf [github.com](https://github.com) einloggen oder kostenlos registrieren.

**A2.** Oben rechts auf **+** → **New repository**.

**A3.** Ausfüllen:
- **Repository name:** `cheapmate`
- **Public** oder **Private** — beides funktioniert mit Render
- ⚠️ **„Add a README file" NICHT ankreuzen.** Das Repo muss leer bleiben,
  sonst zeigt GitHub dir den Upload-Link nicht an.

**A4.** → **Create repository**

**A5.** Auf der jetzt leeren Repo-Seite den Link **„uploading an existing file"**
anklicken (mitten im Text).

**A6.** Den Ordner `cheapmate` öffnen und **den kompletten Inhalt** in das
Browser-Fenster ziehen — also `index.html`, `README.md`, und die Ordner `css`,
`js`, `tools`, `vendor`.

> **Wichtig:** Den *Inhalt* ziehen, nicht den Ordner `cheapmate` selbst.
> Sonst liegt später alles eine Ebene zu tief und Render findet die `index.html` nicht.
>
> Unterordner darfst du direkt mitziehen — GitHub behält die Struktur bei.

**A7.** Warten, bis alle Dateien durch sind. Die 7-MB-Datei
`stockfish-18-lite-single.wasm` dauert am längsten. Sie **muss** dabei sein.

**A8.** Unten auf **Commit changes** klicken.

---

## Teil B — Render

**B1.** Auf [render.com](https://render.com) → **Get Started** → **GitHub** wählen
und einloggen. Damit hängen GitHub und Render direkt zusammen.

**B2.** Im Dashboard oben rechts: **New** → **Static Site**

**B3.** Render fragt nach dem Repo. Falls `cheapmate` nicht auftaucht:
**„Configure account"** / **„Install"** anklicken und Render den Zugriff auf das
Repo geben. Dann `cheapmate` auswählen → **Connect**.

**B4.** Jetzt kommt das Formular. Genau so ausfüllen:

| Feld                  | Wert                                              |
| --------------------- | ------------------------------------------------- |
| **Name**              | `cheapmate` → ergibt `cheapmate.onrender.com` (muss weltweit eindeutig sein; wenn belegt, z.B. `cheapmate-jp`) |
| **Branch**            | `main`                                            |
| **Root Directory**    | **leer lassen**                                   |
| **Build Command**     | **LEER LASSEN** — falls Render etwas vorschlägt (`npm run build` o.ä.), das Feld **komplett löschen** |
| **Publish Directory** | `.`  ← nur ein einzelner Punkt                    |

> Warum leer? Es gibt nichts zu bauen. Das Spiel ist fertiges HTML/JS/WASM.
> Ein Build Command würde nur fehlschlagen.

**B5.** **Advanced** aufklappen → **Add Environment Variable**:

| Key                 | Value  |
| ------------------- | ------ |
| `SKIP_INSTALL_DEPS` | `true` |

> Render versucht sonst automatisch `npm install`. Die `package.json` enthält nur
> Test-Werkzeug, das auf dem Server niemand braucht — das spart Zeit und eine
> mögliche Fehlerquelle.

**B6.** → **Create Static Site**

**B7.** Render baut jetzt (dauert unter einer Minute). Im Log steht am Ende:
```
==> Your site is live 🎉
```

**B8.** Oben die URL anklicken. Beim ersten Aufruf lädt der Browser einmalig
7 MB Stockfish — der Ladebalken braucht ein paar Sekunden. Danach liegt es im
Browser-Cache und startet sofort.

---

## Fertig. Ab jetzt gilt:

Jede Änderung auf GitHub (Datei bearbeiten oder neu hochladen → Commit) löst
**automatisch ein neues Deployment** aus. Du musst bei Render nie wieder etwas tun.

---

## Wenn etwas nicht klappt

**Der Ladebalken bleibt bei „Stockfish 18 wird geladen" stehen**
→ Im Browser **F12** drücken → Reiter **Console**.
- Steht dort ein **404** auf die `.wasm`? Dann stimmt das **Publish Directory**
  nicht. In Render: *Settings → Publish Directory* auf `.` setzen → *Manual Deploy*.
- Steht dort etwas mit **MIME type** / `application/wasm`? Sollte nicht passieren,
  der mitgelieferte Stockfish hat dafür einen Fallback eingebaut
  (siehe `vendor/stockfish/PATCH-NOTES.md`).

**„Build failed"**
→ Fast immer war das **Build Command** nicht leer. In Render:
*Settings → Build Command* leeren → *Manual Deploy → Deploy latest commit*.

**Weiße Seite, Console zeigt 404 auf `/js/main.js`**
→ Beim Upload wurde der Ordner `cheapmate` mit hochgeladen statt nur sein Inhalt.
Auf GitHub prüfen: liegt `index.html` direkt in der Repo-Wurzel? Wenn nicht:
in Render *Settings → Root Directory* auf `cheapmate` setzen.

**Seite lädt, aber der Fisch zieht nie**
→ Console öffnen. Web Worker brauchen http(s); über Render ist das immer gegeben.
Bei lokalem Doppelklick auf `index.html` passiert genau das — dann `npx serve .`
benutzen.

---

## Kosten

Static Sites sind bei Render kostenlos: kein Spindown, keine schlafende Instanz,
globales CDN und HTTPS inklusive. Es zählt nur ausgehende Bandbreite gegen das
Kontingent deines Workspace. Bei 7 MB pro Erstbesuch und einer Handvoll Leuten
ist das nicht messbar.
