import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import test from 'node:test'

import * as runtime from '@/scripts/acceptance-dev-child-env'

type SignalName = 'SIGINT' | 'SIGTERM'
type SignalChild = EventEmitter & { kill(signal: SignalName): boolean }
type Register = (input: { signalSource: EventEmitter; child: SignalChild }) => () => void

function makeChild(kills: SignalName[]): SignalChild {
  const child = new EventEmitter() as SignalChild
  child.kill = (signal: SignalName) => {
    kills.push(signal)
    return true
  }
  return child
}

test('KAN-885/T3 L6 forwards Ctrl+C once to its own child and removes signal handlers', () => {
  const candidate = (runtime as unknown as Record<string, unknown>)
    .registerAcceptanceDevSignalForwarding
  assert.equal(typeof candidate, 'function', 'controlled signal forwarding must be exported')
  const register = candidate as Register
  const signals = new EventEmitter()
  const kills: SignalName[] = []
  const child = makeChild(kills)
  const cleanup = register({ signalSource: signals, child })

  assert.equal(signals.listenerCount('SIGINT'), 1)
  assert.equal(signals.listenerCount('SIGTERM'), 1)
  signals.emit('SIGINT')
  signals.emit('SIGINT')
  signals.emit('SIGTERM')
  assert.deepEqual(kills, ['SIGINT'], 'multiple signals must not repeatedly terminate child')
  cleanup()
  cleanup()
  assert.equal(signals.listenerCount('SIGINT'), 0)
  assert.equal(signals.listenerCount('SIGTERM'), 0)
  signals.emit('SIGTERM')
  assert.deepEqual(kills, ['SIGINT'], 'cleanup must prevent late termination')
})

test('KAN-885/T3 L6 detaches handlers automatically when the child closes', () => {
  const register = (runtime as unknown as Record<string, unknown>)
    .registerAcceptanceDevSignalForwarding as Register
  const signals = new EventEmitter()
  const kills: SignalName[] = []
  const child = makeChild(kills)
  const cleanup = register({ signalSource: signals, child })
  child.emit('close', 0, null)
  assert.equal(signals.listenerCount('SIGINT'), 0)
  assert.equal(signals.listenerCount('SIGTERM'), 0)
  signals.emit('SIGINT')
  assert.deepEqual(kills, [], 'finished child must never receive late signal')
  cleanup()

  const other = makeChild(kills)
  const secondCleanup = register({ signalSource: signals, child: other })
  signals.emit('SIGTERM')
  assert.deepEqual(kills, ['SIGTERM'], 'fresh child should receive its own signal')
  secondCleanup()
})
