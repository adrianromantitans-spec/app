# Local receipt OCR

Tesseract.js worker 6.0.1, Tesseract.js-core 6.0.0 and pinned tessdata_fast
Spanish, English and Romanian models. Exact model revision and SHA-256 hashes
are in sources.json; upstream licenses are included alongside the files.

The browser loads these assets from this site's origin only when reading a
receipt. No external OCR service or API key is used. receipt-ocr.js wraps the
pinned worker message protocol (load, loadLanguage, initialize, setParameters,
recognize), bounds its lifetime, and always terminates it on completion, error,
cancellation or timeout. Cached language data contains no user images or text.
Both SIMD and non-SIMD LSTM cores are included for older devices.

To upgrade, review the pinned worker protocol and run tests/receipt_ocr_browser.py
with the real engine, along with receipt parser unit tests.
