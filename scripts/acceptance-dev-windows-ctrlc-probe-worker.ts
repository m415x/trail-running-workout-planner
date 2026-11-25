/**
 * KAN-885/T3 L6 — reserved standalone, test-only Ctrl+C worker entry.
 * RED-50: worker bootstrap, loopback bind and exclusive state recording
 * have not been implemented; fail closed without side effects.
 */
console.error('KAN-885: disposable Ctrl+C worker is not enabled')
process.exitCode = 2
