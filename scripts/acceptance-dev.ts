/**
 * KAN-885/T3 launcher entrypoint.
 *
 * The CLI is deliberately fail-closed until the safe selection, environment
 * isolation, and child-process lifecycle contracts are implemented and tested.
 * No SQLite file is opened and no Next.js process is started in this cut.
 */
const usage = 'Usage: pn acceptance:dev --db <absolute-accredited-sqlite-path>'

const args = process.argv.slice(2)
if (args.length === 1 && args[0] === '--help') {
  console.log(usage)
} else {
  console.error('KAN-885: acceptance launcher is not yet enabled; ' + usage)
  process.exitCode = 2
}
