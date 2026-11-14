// A barcode reader for the camera. Uses the browser's own Barcode Detection API where it
// exists (Chrome on Android), and otherwise loads a bundled reader (iPhone Safari, desktop).
// The bundled reader and its .wasm file are served from this site, not a third-party CDN,
// and are only downloaded the first time someone opens the scan screen.

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e']

let ready

export function getDetector() {
  ready ||= (async () => {
    if ('BarcodeDetector' in window) {
      try {
        const supported = await window.BarcodeDetector.getSupportedFormats()
        const usable = FORMATS.filter((f) => supported.includes(f))
        if (usable.length) return new window.BarcodeDetector({ formats: usable })
      } catch {
        /* fall through to the bundled reader */
      }
    }
    const [{ BarcodeDetector, prepareZXingModule }, { default: wasmUrl }] = await Promise.all([
      import('barcode-detector/ponyfill'),
      import('zxing-wasm/reader/zxing_reader.wasm?url'),
    ])
    // Hand the decoder over as raw bytes. Some hosts serve .wasm files with the wrong
    // content type, which makes the browser refuse to load them by address.
    const response = await fetch(wasmUrl)
    if (!response.ok) throw new Error(`decoder download failed (${response.status})`)
    prepareZXingModule({ overrides: { wasmBinary: await response.arrayBuffer() } })
    return new BarcodeDetector({ formats: FORMATS })
  })()
  // Let a failed load be retried next time the screen opens.
  ready.catch(() => {
    ready = null
  })
  return ready
}
