export const zones = [
  { id: 'L1', name: 'L1 Portal', depth: 420, geometry: { x: 290, y: 100 } },
  { id: 'L2', name: 'L2 Haulage', depth: -640, geometry: { x: 370, y: 175 } },
  { id: 'L3', name: 'L3 Stope Drift / Rig 4B', depth: -880, geometry: { x: 740, y: 300 } },
  { id: 'L4', name: 'L4 Deep Bore', depth: -1120, geometry: { x: 420, y: 375 } },
]
export const workers = [
  ['WK-884', 'Marcus Brody', 'Senior Driller L3', 'L3'],
  ['WK-302', 'Elena Rostova', 'Geotechnical Surveyor', 'L2'],
  ['WK-119', 'Tarek Al-Mansoor', 'Haulage Operator', 'L2'],
  ['WK-512', 'Jaxson Vance', 'Driller', 'L3'],
  ['WK-741', "Samuel O’Connor", 'Refuge Attendant', 'L2'],
  ['WK-228', 'Chen Wei', 'Ventilation Technician', 'L1'],
  ['WK-905', 'Mateo Silva', 'Production Operator', 'L3'],
  ['W-014', 'Amina Johnson', 'Safety Demonstrator', 'L2'],
  ['WK-417', 'Amara Okafor', 'Mine Electrician', 'L4'],
].map(([id, name, role, zoneId]) => ({ id, name, role, zoneId, shift: 'B' }))
export const devices = [
  ...workers.map(w => ({ id: `TAG-${w.id.slice(3)}`, type: 'wearable', workerId: w.id, zoneId: w.zoneId, capabilities: ['heartRate', 'spo2', 'temperature', 'location', 'battery'] })),
  ...zones.map((zone, i) => ({ id: ['S-101', 'S-208', 'S-304', 'S-409'][i], type: 'environmental', workerId: null, zoneId: zone.id, capabilities: ['ch4', 'co', 'o2', 'h2s', 'pm10', 'no2', 'so2', 'co2', 'airTemperature', 'humidity', 'pressure', 'airVelocity'] })),
]
// Example thresholds are fixture inputs, not mine-approved engineering limits.
export const thresholds = { ch4: { warning: 0.3, critical: 0.5, unit: '% Vol' } }
