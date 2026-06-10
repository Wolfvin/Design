# Browser Extension Variant

Browser extensions run in a non-Node environment. The ghost proxy pattern still applies, but capture happens differently.

## Strategy: Background Script Injection

Instead of Node dynamic import, the capture script runs as an injected content/background script.

### manifest.json cluster config

```json
{
  "id": "download-invoice",
  "entry": "handleDownload",
  "watches": ["buildRequest", "parseResponse", "saveFile"],
  "file": "extension_source/background.js",
  "stack": "extension",
  "captureMethod": "background-inject"
}
```

### Capture Flow

1. Load extension in test Chrome instance (`--load-extension`)
2. Inject `capture-bridge.js` as a content script
3. Bridge intercepts message passing between content/background
4. Records inputs/outputs at message boundaries
5. Writes capture data back via `chrome.storage.local`
6. Node script reads from storage, computes fingerprint, writes `.regret`

### capture-bridge.js (injected)

```js
// Wrap chrome.runtime.sendMessage to observe traffic
const _sendMessage = chrome.runtime.sendMessage.bind(chrome.runtime)

chrome.runtime.sendMessage = function(msg, callback) {
  const start = { msg: JSON.parse(JSON.stringify(msg)) }
  
  return _sendMessage(msg, (response) => {
    const record = { ...start, response: JSON.parse(JSON.stringify(response)) }
    
    // Store for capture script to collect
    chrome.storage.local.get('__regret_capture', ({ __regret_capture = [] }) => {
      chrome.storage.local.set({ __regret_capture: [...__regret_capture, record] })
    })
    
    if (callback) callback(response)
  })
}
```

### Running capture for extensions

```bash
node scripts/capture-extension.js --profile /tmp/chrome-test
```

This script:
1. Spawns Chrome with `--remote-debugging-port=9222`
2. Loads extension from `extension_source/`
3. Triggers test flows via CDP (Chrome DevTools Protocol)
4. Reads `chrome.storage.local.__regret_capture`
5. Computes fingerprints and writes `.regret` files

### Validate for extensions

Same as regular validate, but `validate-extension.js` re-runs the flow via CDP and compares live storage output against golden hash.

```bash
node scripts/validate-extension.js
```

## Simpler Alternative: Unit-testable extraction

Refactor extension so business logic lives in pure JS modules (no browser APIs). Then fingerprint those directly with the standard `capture.js`.

This is the recommended path — it forces better architecture AND makes fingerprinting trivial.

```
extension_source/
  background.js          ← thin: only browser API calls
  logic/
    invoice-builder.js   ← pure: fingerprint this ✅
    response-parser.js   ← pure: fingerprint this ✅
    file-saver.js        ← side effect: stub in tests
```
