import { strict as assert } from 'assert'
import { readFileSync } from 'fs'

type CapabilityRow = {
  capability: string
  classification: string
  downstreamPhases: string
  raw: string
}

const INVENTORY_PATH = new URL(
  '../../.planning/phases/05-ts-backend-capability-inventory/05-CAPABILITY-INVENTORY.md',
  import.meta.url,
)
const ALLOWED_CLASSIFICATIONS = new Set(['must-port', 'reference-only', 'deferred'])
const inventory = readFileSync(INVENTORY_PATH, 'utf8')

assert.match(inventory, /^# Phase 05 Capability Inventory/m)
assert.match(inventory, /^## Capability Matrix$/m)
assert.match(inventory, /^## Known Drift$/m)

for (const classification of ALLOWED_CLASSIFICATIONS) {
  assert.match(inventory, new RegExp(`\`${classification}\``), `inventory must document ${classification}`)
}

const matrixSection = inventory.match(/## Capability Matrix([\s\S]*?)## Known Drift/)
assert.ok(matrixSection, 'inventory must keep the capability matrix ahead of Known Drift')

const rows = (matrixSection?.[1] ?? '')
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line.startsWith('|'))
  .filter((line) => !line.includes('| --- '))
  .filter((line) => !line.includes('| Category | Capability |'))
  .map<CapabilityRow>((line) => {
    const columns = line
      .split('|')
      .slice(1, -1)
      .map((column) => column.trim())

    assert.equal(columns.length, 7, `inventory matrix rows must keep 7 columns: ${line}`)

    return {
      capability: columns[0] ?? '',
      classification: columns[4] ?? '',
      downstreamPhases: columns[5] ?? '',
      raw: line,
    }
  })

assert.ok(rows.length > 0, 'inventory must contain at least one capability row')

for (const row of rows) {
  assert.ok(
    ALLOWED_CLASSIFICATIONS.has(row.classification),
    `unexpected inventory classification "${row.classification}" in row: ${row.raw}`,
  )
}

function rowsForCapability(name: string): CapabilityRow[] {
  return rows.filter((row) => row.capability === name)
}

function assertPhaseNineCoverage(name: string, minimumRows = 1): void {
  const matchingRows = rowsForCapability(name)
  assert.ok(matchingRows.length >= minimumRows, `inventory must contain ${minimumRows} "${name}" row(s)`)

  for (const row of matchingRows) {
    assert.match(
      row.downstreamPhases,
      /Phase 9/,
      `"${name}" rows must stay mapped to Phase 9 so QLT-01 remains traceable`,
    )
  }
}

assertPhaseNineCoverage('config loading')
assertPhaseNineCoverage('credential extraction')
assertPhaseNineCoverage('config generation', 2)
assertPhaseNineCoverage('claude handoff')

assert.match(
  inventory,
  /must-port \| Phase 6<br>Phase 7<br>Phase 9/,
  'config loading must remain a must-port contract for Phases 6, 7, and 9',
)
assert.match(
  inventory,
  /must-port \| Phase 8<br>Phase 9/,
  'claude handoff must remain part of the Phase 8 and Phase 9 contract',
)

console.log('capability-inventory.test.ts: ok')
