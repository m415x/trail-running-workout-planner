/**
 * KAN-885/T3 L6 — standalone manual Ctrl+C diagnostic interface.
 *
 * This initial cut exposes help and fail-closed mode selection only. It must
 * never start Next.js, touch SQLite, or launch disposable workers until the
 * isolated run/verify contracts are implemented and accredited separately.
 */
const usage = [
  'KAN-885 Windows Ctrl+C diagnostic for Git Bash',
  'Usage: pn exec tsx scripts/acceptance-dev-windows-ctrlc-probe.ts --help',
  'Planned manual workflow:',
  '  --run     Start an isolated disposable Node process tree (not enabled yet)',
  '  --verify  Verify the isolated process PIDs and port after Ctrl+C (not enabled yet)',
  'Both modes are currently disabled; neither starts processes.',
].join('\n')

const args = process.argv.slice(2)

if (args.length === 1 && args[0] === '--help') {
  console.log(usage)
} else if (args.length === 1 && (args[0] === '--run' || args[0] === '--verify')) {
  console.error('KAN-885: diagnostic mode is not enabled; explicit run/verify accreditation is pending')
  process.exitCode = 2
} else {
  console.error('KAN-885: explicit diagnostic mode required; usage: --help | --run | --verify')
  process.exitCode = 2
}
