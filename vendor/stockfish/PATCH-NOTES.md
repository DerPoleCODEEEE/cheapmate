# Aenderung an der Stockfish-Distribution

`stockfish-18-lite-single.js` wurde an EINER Stelle veraendert (GPL-3.0 erlaubt
das; die Aenderung wird hier offengelegt).

**Original:**
```js
return WebAssembly.instantiateStreaming(e,n)
```

**Geaendert zu:**
```js
return WebAssembly.instantiateStreaming(e.clone(),n).catch(function(){
  return e.arrayBuffer().then(function(b){return WebAssembly.instantiate(b,n)})
})
```

**Warum:** `WebAssembly.instantiateStreaming` verlangt zwingend den MIME-Typ
`application/wasm`. Liefert der Hoster die `.wasm` als `application/octet-stream`
aus, bricht der Original-Code ohne Fallback ab und das Spiel laedt nie.
Der Patch faellt in dem Fall auf `arrayBuffer()` + `WebAssembly.instantiate()`
zurueck. Damit laeuft das Spiel auf jedem Static-Hoster, egal wie er den
MIME-Typ setzt.

Sonst ist die Datei unveraendert. Quelle: https://github.com/nmrugg/stockfish.js
