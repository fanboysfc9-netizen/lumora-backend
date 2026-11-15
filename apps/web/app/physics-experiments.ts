export type ExperimentParam = { key: string; label: string; min: number; max: number; step: number; value: number }
export type ExperimentState = Record<string, number | boolean | string | number[]>
export type Experiment = { id: string; category: string; title: string; params: ExperimentParam[]; init: () => ExperimentState; step: (state: ExperimentState, dt: number) => void; draw: (ctx: CanvasRenderingContext2D, state: ExperimentState, width: number, height: number) => void; readouts: (state: ExperimentState) => Array<{ label: string; value: string }> }

const n = (key: string, label: string, min: number, max: number, step: number, value: number): ExperimentParam => ({ key, label, min, max, step, value })
const num = (state: ExperimentState, key: string) => Number(state[key] || 0)
const line = (ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color = '#d4b36a', width = 2) => { ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke() }
const text = (ctx: CanvasRenderingContext2D, value: string, x: number, y: number, color = '#f2f0eb') => { ctx.fillStyle = color; ctx.font = '12px sans-serif'; ctx.fillText(value, x, y) }
const base = (ctx: CanvasRenderingContext2D, width: number, height: number) => { ctx.fillStyle = '#111315'; ctx.fillRect(0, 0, width, height); ctx.strokeStyle = '#343a3b'; ctx.lineWidth = 1; for (let x = 0; x < width; x += 32) line(ctx, x, height - 36, x, height, '#252b2e', 1); line(ctx, 0, height - 36, width, height - 36, '#596267', 1) }

const projectile: Experiment = { id: 'projectile', category: 'Mechanics', title: 'Kinematics — Projectile Motion', params: [n('speed', 'Launch speed', 1, 40, .5, 18), n('angle', 'Launch angle', 5, 85, 1, 48), n('gravity', 'Gravity', 0, 20, .1, 9.8), n('air', 'Air resistance', 0, .2, .01, 0)], init: () => ({ x: 0, y: 0, vx: 14, vy: 16, t: 0, trace: [] as number[] }), step: (s, dt) => { const g = num(s, 'gravity'); const air = num(s, 'air'); const vx = num(s, 'vx'); const vy = num(s, 'vy'); s.vx = vx - vx * air * dt; s.vy = vy - g * dt; s.x = num(s, 'x') + num(s, 'vx') * dt; s.y = num(s, 'y') + num(s, 'vy') * dt; s.t = num(s, 't') + dt; const trace = s.trace as number[]; trace.push(num(s, 'x'), num(s, 'y')); if (num(s, 'y') < 0) { s.x = 0; s.y = 0; s.t = 0; s.vx = num(s, 'speed') * Math.cos(num(s, 'angle') * Math.PI / 180); s.vy = num(s, 'speed') * Math.sin(num(s, 'angle') * Math.PI / 180); trace.splice(0) } }, draw: (ctx, w, h) => {}, readouts: s => [{ label: 'Time', value: `${num(s, 't').toFixed(2)} s` }, { label: 'Range', value: `${num(s, 'x').toFixed(2)} m` }, { label: 'Height', value: `${Math.max(0, num(s, 'y')).toFixed(2)} m` }, { label: 'Speed', value: `${Math.hypot(num(s, 'vx'), num(s, 'vy')).toFixed(2)} m/s` }] }

function drawProjectile(ctx: CanvasRenderingContext2D, s: ExperimentState, w: number, h: number) { base(ctx, w, h); const scale = Math.min(w / 42, (h - 60) / 24); const ox = 32; const ground = h - 36; const trace = s.trace as number[]; ctx.strokeStyle = '#7488a7'; ctx.beginPath(); for (let i = 0; i < trace.length; i += 2) { const x = ox + trace[i] * scale; const y = ground - Math.max(0, trace[i + 1]) * scale; i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y) } ctx.stroke(); const x = ox + num(s, 'x') * scale; const y = ground - Math.max(0, num(s, 'y')) * scale; ctx.fillStyle = '#d4b36a'; ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.fill(); line(ctx, x, y, x + num(s, 'vx') * 5, y - num(s, 'vy') * 5, '#81d6a3', 3); text(ctx, 'v', x + 8, y - 8, '#81d6a3') }
projectile.draw = drawProjectile

const incline: Experiment = { id: 'incline', category: 'Mechanics', title: 'Newton’s Laws — Forces on an Incline', params: [n('angle', 'Ramp angle', 0, 60, 1, 25), n('mass', 'Mass', .2, 10, .1, 2), n('static', 'Static friction', 0, 1, .01, .35), n('kinetic', 'Kinetic friction', 0, 1, .01, .25)], init: () => ({}), step: () => {}, draw: (ctx, w, h) => {}, readouts: s => { const a = num(s, 'angle') * Math.PI / 180; const m = num(s, 'mass'); const g = 9.8; const down = m * g * Math.sin(a); const normal = m * g * Math.cos(a); const maxStatic = num(s, 'static') * normal; const moving = down > maxStatic; const friction = moving ? num(s, 'kinetic') * normal : down; return [{ label: 'Net force', value: `${Math.max(0, down - friction).toFixed(2)} N` }, { label: 'Acceleration', value: `${(Math.max(0, down - friction) / m).toFixed(2)} m/s²` }, { label: 'State', value: moving ? 'Moving' : 'Static' }] } }
function drawIncline(ctx: CanvasRenderingContext2D, s: ExperimentState, w: number, h: number) { base(ctx, w, h); const angle = num(s, 'angle') * Math.PI / 180; const x = 70; const y = h - 55; const length = Math.min(w * .72, 360); line(ctx, x, y, x + length, y, '#596267', 8); line(ctx, x, y, x + length * Math.cos(angle), y - length * Math.sin(angle), '#d4b36a', 8); const bx = x + length * .5 * Math.cos(angle); const by = y - length * .5 * Math.sin(angle); ctx.save(); ctx.translate(bx, by); ctx.rotate(-angle); ctx.fillStyle = '#81a9d6'; ctx.fillRect(-24, -22, 48, 44); ctx.restore(); const g = num(s, 'mass') * 9.8; line(ctx, bx, by, bx, by + 42, '#ef9b9b', 3); line(ctx, bx, by, bx - Math.sin(angle) * 38, by + Math.cos(angle) * 38, '#81d6a3', 3); text(ctx, `mg ${g.toFixed(1)} N`, bx + 8, by + 46, '#ef9b9b') }
incline.draw = drawIncline
incline.init = () => ({ position: 0, velocity: 0, acceleration: 0, t: 0 })
incline.step = (s, dt) => {
	const angle = num(s, 'angle') * Math.PI / 180
	const staticLimit = num(s, 'static') * Math.cos(angle)
	const remainsStatic = num(s, 'velocity') === 0 && Math.sin(angle) <= staticLimit
	const acceleration = remainsStatic ? 0 : 9.8 * (Math.sin(angle) - num(s, 'kinetic') * Math.cos(angle))
	s.acceleration = acceleration
	const velocity = Math.max(0, Math.min(7, num(s, 'velocity') + acceleration * dt))
	s.position = Math.min(3.2, num(s, 'position') + (num(s, 'velocity') + velocity) / 2 * dt)
	s.velocity = velocity
	s.t = num(s, 't') + dt
}
incline.draw = (ctx, s, w, h) => {
	base(ctx, w, h)
	const angle = num(s, 'angle') * Math.PI / 180
	const x = 70
	const y = h - 55
	const length = Math.min(w * .72, 360)
	line(ctx, x, y, x + length, y, '#596267', 8)
	line(ctx, x, y, x + length * Math.cos(angle), y - length * Math.sin(angle), '#d4b36a', 8)
	const distance = .2 + num(s, 'position') / 10
	const bx = x + length * distance * Math.cos(angle)
	const by = y - length * distance * Math.sin(angle)
	ctx.save(); ctx.translate(bx, by); ctx.rotate(-angle); ctx.fillStyle = '#81a9d6'; ctx.fillRect(-24, -22, 48, 44); ctx.restore()
	const weight = num(s, 'mass') * 9.8
	line(ctx, bx, by, bx, by + 42, '#ef9b9b', 3)
	line(ctx, bx, by, bx - Math.sin(angle) * 38, by + Math.cos(angle) * 38, '#81d6a3', 3)
	text(ctx, `mg ${weight.toFixed(1)} N`, bx + 8, by + 46, '#ef9b9b')
}
incline.readouts = (s) => {
	const angle = num(s, 'angle') * Math.PI / 180
	const down = num(s, 'mass') * 9.8 * Math.sin(angle)
	const normal = num(s, 'mass') * 9.8 * Math.cos(angle)
	const moving = down > num(s, 'static') * normal
	const friction = moving ? num(s, 'kinetic') * normal : down
	return [
		{ label: 'Net force', value: `${Math.max(0, down - friction).toFixed(2)} N` },
		{ label: 'Acceleration', value: `${num(s, 'acceleration').toFixed(2)} m/s²` },
		{ label: 'Speed', value: `${num(s, 'velocity').toFixed(2)} m/s` },
		{ label: 'State', value: num(s, 'position') >= 3.2 ? 'At ramp end' : moving ? 'Moving' : 'Static' },
	]
}

const oscillator: Experiment = { id: 'oscillator', category: 'Mechanics', title: 'Simple Harmonic Motion', params: [n('spring', 'Spring constant', 1, 40, .5, 12), n('mass', 'Mass', .2, 10, .1, 2), n('damping', 'Damping', 0, 2, .01, .12), n('displacement', 'Initial displacement', .1, 3, .1, 1)], init: () => ({ x: 1, v: 0, t: 0, trace: [] as number[] }), step: (s, dt) => { const a = (-num(s, 'spring') * num(s, 'x') - num(s, 'damping') * num(s, 'v')) / num(s, 'mass'); s.v = num(s, 'v') + a * dt; s.x = num(s, 'x') + num(s, 'v') * dt; s.t = num(s, 't') + dt; const trace = s.trace as number[]; trace.push(num(s, 'x')); if (trace.length > 180) trace.shift() }, draw: () => {}, readouts: s => [{ label: 'Period', value: `${(2 * Math.PI * Math.sqrt(num(s, 'mass') / num(s, 'spring'))).toFixed(2)} s` }, { label: 'Amplitude', value: `${Math.abs(num(s, 'x')).toFixed(2)} m` }, { label: 'Energy', value: `${(.5 * num(s, 'spring') * num(s, 'x') ** 2 + .5 * num(s, 'mass') * num(s, 'v') ** 2).toFixed(2)} J` }] }
function drawOscillator(ctx: CanvasRenderingContext2D, s: ExperimentState, w: number, h: number) { base(ctx, w, h); const cx = w * .5; const y = 90 + num(s, 'x') * 30; line(ctx, cx, 30, cx, y - 18, '#7488a7', 3); ctx.fillStyle = '#d4b36a'; ctx.beginPath(); ctx.arc(cx, y, 18, 0, Math.PI * 2); ctx.fill(); const trace = s.trace as number[]; line(ctx, 24, h - 18, w - 24, h - 18, '#596267'); trace.forEach((value, index) => { ctx.fillStyle = '#81d6a3'; ctx.fillRect(24 + index * (w - 48) / 180, h - 18 - value * 20, 2, 2) }) }
oscillator.draw = drawOscillator

function genericReadouts(s: ExperimentState) { return [{ label: 'Time', value: `${num(s, 't').toFixed(2)} s` }, { label: 'Status', value: 'Live' }] }
const circular = { id: 'circular', category: 'Mechanics', title: 'Circular Motion & Gravitation', params: [n('radius', 'Radius', .5, 10, .1, 3), n('omega', 'Angular speed', .1, 8, .1, 2), n('mass', 'Mass', .2, 10, .1, 2)], init: () => ({ t: 0 }), step: (s: ExperimentState, dt: number) => { s.t = num(s, 't') + dt }, draw: (ctx: CanvasRenderingContext2D, s: ExperimentState, w: number, h: number) => { base(ctx, w, h); const r = num(s, 'radius') * 22; const a = num(s, 'omega') * num(s, 't'); const cx = w / 2; const cy = h / 2; ctx.strokeStyle = '#596267'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke(); const x = cx + Math.cos(a) * r; const y = cy + Math.sin(a) * r; ctx.fillStyle = '#d4b36a'; ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.fill(); line(ctx, x, y, x - Math.sin(a) * 45, y + Math.cos(a) * 45, '#81d6a3', 3); line(ctx, x, y, cx, cy, '#ef9b9b', 3) }, readouts: s => [{ label: 'Period', value: `${(2 * Math.PI / num(s, 'omega')).toFixed(2)} s` }, { label: 'Speed', value: `${(num(s, 'radius') * num(s, 'omega')).toFixed(2)} m/s` }, { label: 'Centripetal force', value: `${(num(s, 'mass') * num(s, 'radius') * num(s, 'omega') ** 2).toFixed(2)} N` }] } as Experiment
const collisions = { id: 'collisions', category: 'Mechanics', title: 'Momentum & Collisions', params: [n('massA', 'Cart A mass', .5, 10, .1, 2), n('massB', 'Cart B mass', .5, 10, .1, 2), n('velocityA', 'Cart A velocity', -8, 8, .1, 3), n('velocityB', 'Cart B velocity', -8, 8, .1, -2)], init: () => ({ t: 0 }), step: (s: ExperimentState, dt: number) => { s.t = num(s, 't') + dt }, draw: (ctx: CanvasRenderingContext2D, s: ExperimentState, w: number, h: number) => { base(ctx, w, h); const x = w / 2 + Math.sin(num(s, 't')) * 100; ctx.fillStyle = '#81a9d6'; ctx.fillRect(x - 60, h / 2 - 25, 50, 35); ctx.fillStyle = '#d4b36a'; ctx.fillRect(x + 10, h / 2 - 25, 50, 35); line(ctx, x - 60, h / 2 + 35, x + 60, h / 2 + 35, '#596267', 4) }, readouts: s => [{ label: 'Momentum', value: `${(num(s, 'massA') * num(s, 'velocityA') + num(s, 'massB') * num(s, 'velocityB')).toFixed(2)} kg·m/s` }, { label: 'Kinetic energy', value: `${(.5 * num(s, 'massA') * num(s, 'velocityA') ** 2 + .5 * num(s, 'massB') * num(s, 'velocityB') ** 2).toFixed(2)} J` }] } as Experiment
collisions.init = () => ({ t: 0, xA: -2, xB: 2, vA: 3, vB: -2, collided: false })
collisions.step = (s, dt) => {
	const radius = .28
	s.xA = num(s, 'xA') + num(s, 'vA') * dt
	s.xB = num(s, 'xB') + num(s, 'vB') * dt
	if (num(s, 'xA') + radius >= num(s, 'xB') - radius && num(s, 'vA') > num(s, 'vB')) {
		const massA = num(s, 'massA')
		const massB = num(s, 'massB')
		const velocityA = num(s, 'vA')
		const velocityB = num(s, 'vB')
		s.vA = ((massA - massB) * velocityA + 2 * massB * velocityB) / (massA + massB)
		s.vB = (2 * massA * velocityA + (massB - massA) * velocityB) / (massA + massB)
		s.xA = num(s, 'xB') - 2 * radius
		s.collided = true
	}
	if (num(s, 'xA') < -3.2) { s.xA = -3.2; s.vA = Math.abs(num(s, 'vA')) }
	if (num(s, 'xA') > 3.2) { s.xA = 3.2; s.vA = -Math.abs(num(s, 'vA')) }
	if (num(s, 'xB') < -3.2) { s.xB = -3.2; s.vB = Math.abs(num(s, 'vB')) }
	if (num(s, 'xB') > 3.2) { s.xB = 3.2; s.vB = -Math.abs(num(s, 'vB')) }
	s.t = num(s, 't') + dt
}
collisions.draw = (ctx, s, w, h) => {
	base(ctx, w, h)
	const scale = Math.min(w / 8, 70)
	const center = w / 2
	const y = h / 2
	const xA = center + num(s, 'xA') * scale
	const xB = center + num(s, 'xB') * scale
	ctx.fillStyle = '#81a9d6'; ctx.fillRect(xA - 24, y - 25, 48, 34)
	ctx.fillStyle = '#d4b36a'; ctx.fillRect(xB - 24, y - 25, 48, 34)
	ctx.fillStyle = '#f2f0eb'; ctx.beginPath(); ctx.arc(xA - 12, y + 12, 6, 0, Math.PI * 2); ctx.arc(xA + 12, y + 12, 6, 0, Math.PI * 2); ctx.fill()
	ctx.beginPath(); ctx.arc(xB - 12, y + 12, 6, 0, Math.PI * 2); ctx.arc(xB + 12, y + 12, 6, 0, Math.PI * 2); ctx.fill()
	line(ctx, xA, y - 34, xA + num(s, 'vA') * 12, y - 34, '#81d6a3', 3)
	line(ctx, xB, y - 34, xB + num(s, 'vB') * 12, y - 34, '#ef9b9b', 3)
}
collisions.readouts = (s) => [
	{ label: 'Momentum', value: `${(num(s, 'massA') * num(s, 'vA') + num(s, 'massB') * num(s, 'vB')).toFixed(2)} kg·m/s` },
	{ label: 'Kinetic energy', value: `${(.5 * num(s, 'massA') * num(s, 'vA') ** 2 + .5 * num(s, 'massB') * num(s, 'vB') ** 2).toFixed(2)} J` },
	{ label: 'Cart A speed', value: `${num(s, 'vA').toFixed(2)} m/s` },
	{ label: 'Collision', value: s.collided ? 'Complete' : 'Approaching' },
]
const waves = { id: 'waves', category: 'Waves', title: 'Waves & Interference', params: [n('wavelength', 'Wavelength', .3, 5, .1, 1.4), n('frequency', 'Frequency', .2, 5, .1, 1), n('phase', 'Phase', 0, 6.28, .1, 0)], init: () => ({ t: 0 }), step: (s: ExperimentState, dt: number) => { s.t = num(s, 't') + dt }, draw: (ctx: CanvasRenderingContext2D, s: ExperimentState, w: number, h: number) => { base(ctx, w, h); for (let x = 0; x < w; x += 4) { const y = h / 2 + Math.sin(x / 35 * num(s, 'wavelength') + num(s, 't') * num(s, 'frequency') + num(s, 'phase')) * 35; ctx.fillStyle = '#81d6a3'; ctx.fillRect(x, y, 3, 3) } }, readouts: s => [{ label: 'Wavelength', value: `${num(s, 'wavelength').toFixed(2)} m` }, { label: 'Frequency', value: `${num(s, 'frequency').toFixed(2)} Hz` }] } as Experiment
const electricity = { id: 'electricity', category: 'Electricity', title: 'Electricity — Simple DC Circuits', params: [n('emf', 'EMF', 1, 24, .5, 12), n('resistance', 'Resistance', 1, 100, 1, 6)], init: () => ({ t: 0 }), step: (s: ExperimentState, dt: number) => { s.t = num(s, 't') + dt }, draw: (ctx: CanvasRenderingContext2D, s: ExperimentState, w: number, h: number) => { base(ctx, w, h); const y = h / 2; line(ctx, 70, y, w - 70, y, '#91a5ad', 4); ctx.fillStyle = '#d4b36a'; ctx.fillText(`+ ${num(s, 'emf').toFixed(1)} V`, 80, y - 24); for (let i = 0; i < 10; i++) { ctx.fillStyle = '#f4df9f'; ctx.beginPath(); ctx.arc(90 + ((num(s, 't') * num(s, 'emf') / num(s, 'resistance') * 40 + i * 50) % (w - 180)), y, 4, 0, Math.PI * 2); ctx.fill() } }, readouts: s => [{ label: 'Total current', value: `${(num(s, 'emf') / num(s, 'resistance')).toFixed(2)} A` }, { label: 'Power', value: `${(num(s, 'emf') ** 2 / num(s, 'resistance')).toFixed(2)} W` }] } as Experiment
const forceLab = { id: 'force-mass-acceleration', category: 'Physics', title: 'Newton’s Second Law — Force, Mass & Acceleration', params: [n('forceA', 'Force A', 0, 30, .1, 8), n('directionA', 'Direction A', -180, 180, 1, 0), n('forceB', 'Force B', 0, 30, .1, 4), n('directionB', 'Direction B', -180, 180, 1, 180), n('forceC', 'Force C', 0, 30, .1, 0), n('directionC', 'Direction C', -180, 180, 1, 90), n('mass', 'Cart mass', .2, 20, .1, 2), n('friction', 'Friction', 0, 1, .01, 0)], init: () => ({ t: 0, a: 0 }), step: (s, dt) => { s.t = num(s, 't') + dt; s.a = Math.max(0, num(s, 'forceA') * Math.cos(num(s, 'directionA') * Math.PI / 180) + num(s, 'forceB') * Math.cos(num(s, 'directionB') * Math.PI / 180) + num(s, 'forceC') * Math.cos(num(s, 'directionC') * Math.PI / 180)) / Math.max(.1, num(s, 'mass')) * (1 - num(s, 'friction')) }, draw: (ctx, s, w, h) => { base(ctx, w, h); const cx = w / 2; const cy = h / 2; ctx.fillStyle = '#81a9d6'; ctx.fillRect(cx - 34, cy - 24, 68, 48); [[num(s, 'forceA'), num(s, 'directionA'), '#d4b36a'], [num(s, 'forceB'), num(s, 'directionB'), '#81d6a3'], [num(s, 'forceC'), num(s, 'directionC'), '#c98bdf']].forEach(([force, direction, color]) => { line(ctx, cx, cy, cx + Number(force) * 5 * Math.cos(Number(direction) * Math.PI / 180), cy - Number(force) * 5 * Math.sin(Number(direction) * Math.PI / 180), String(color), 3) }); text(ctx, 'F = ma', 18, 24) }, readouts: s => [{ label: 'Net force', value: `${(num(s, 'a') * num(s, 'mass') / Math.max(.01, 1 - num(s, 'friction'))).toFixed(2)} N` }, { label: 'Acceleration', value: `${num(s, 'a').toFixed(2)} m/s²` }, { label: 'Equation', value: `F = ${num(s, 'mass').toFixed(1)} × ${num(s, 'a').toFixed(2)}` }] } as Experiment
forceLab.init = () => ({ t: 0, a: 0, velocity: 0, position: 0 })
forceLab.step = (s, dt) => {
	const netForce = ['A', 'B', 'C'].reduce((sum, axis) => {
		const angle = num(s, `direction${axis}`) * Math.PI / 180
		return sum + num(s, `force${axis}`) * Math.cos(angle)
	}, 0)
	const mass = Math.max(.1, num(s, 'mass'))
	const friction = num(s, 'friction') * mass * 9.8
	const velocity = num(s, 'velocity')
	const staticHold = Math.abs(velocity) < .01 && Math.abs(netForce) <= friction
	const acceleration = staticHold ? 0 : (netForce - Math.sign(velocity || netForce) * friction) / mass
	s.a = acceleration
	s.velocity = Math.max(-12, Math.min(12, velocity + acceleration * dt))
	s.position = Math.max(-3, Math.min(3, num(s, 'position') + num(s, 'velocity') * dt))
	if (Math.abs(num(s, 'position')) === 3) s.velocity = 0
	s.t = num(s, 't') + dt
}
forceLab.draw = (ctx, s, w, h) => {
	base(ctx, w, h)
	const cx = w / 2 + num(s, 'position') * 42
	const cy = h / 2
	ctx.fillStyle = '#81a9d6'
	ctx.fillRect(cx - 34, cy - 24, 68, 48)
	;[['A', '#d4b36a'], ['B', '#81d6a3'], ['C', '#c98bdf']].forEach(([axis, color]) => {
		const angle = num(s, `direction${axis}`) * Math.PI / 180
		const force = num(s, `force${axis}`)
		line(ctx, cx, cy, cx + force * 5 * Math.cos(angle), cy - force * 5 * Math.sin(angle), color, 3)
	})
	text(ctx, 'F = ma', 18, 24)
}
forceLab.readouts = (s) => [
	{ label: 'Net force', value: `${(num(s, 'a') * num(s, 'mass')).toFixed(2)} N` },
	{ label: 'Acceleration', value: `${num(s, 'a').toFixed(2)} m/s²` },
	{ label: 'Velocity', value: `${num(s, 'velocity').toFixed(2)} m/s` },
]
const magnetismLab = { id: 'magnetism-fields', category: 'Physics', title: 'Magnetism — Fields & Moving Charges', params: [n('field', 'Magnetic field', 0, 10, .1, 3), n('charge', 'Charge', -3, 3, .1, 1), n('speed', 'Particle speed', 0, 20, .1, 8), n('mass', 'Particle mass', .1, 5, .1, 1)], init: () => ({ t: 0 }), step: (s, dt) => { s.t = num(s, 't') + dt }, draw: (ctx, s, w, h) => { base(ctx, w, h); const cx = w / 2; const cy = h / 2; const radius = Math.max(20, num(s, 'mass') * num(s, 'speed') / Math.max(.1, Math.abs(num(s, 'charge')) * num(s, 'field')) * 12); ctx.strokeStyle = '#7488a7'; ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke(); const a = num(s, 't') * 2; ctx.fillStyle = '#d4b36a'; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius, 9, 0, Math.PI * 2); ctx.fill(); text(ctx, 'F = qv × B', 18, 24) }, readouts: s => [{ label: 'Orbit radius', value: `${(num(s, 'mass') * num(s, 'speed') / Math.max(.1, Math.abs(num(s, 'charge')) * num(s, 'field'))).toFixed(2)} m` }, { label: 'Cyclotron period', value: `${(2 * Math.PI * num(s, 'mass') / Math.max(.1, Math.abs(num(s, 'charge')) * num(s, 'field'))).toFixed(2)} s` }, { label: 'Direction', value: num(s, 'charge') >= 0 ? 'Positive charge' : 'Negative charge' }] } as Experiment
const capacitor = { id: 'capacitor', category: 'Physics', title: 'Capacitance — Plates & RC Charging', params: [n('area', 'Plate area', .01, 2, .01, .2), n('separation', 'Separation', .01, 1, .01, .1), n('dielectric', 'Dielectric', 1, 10, .1, 1), n('resistance', 'Resistance', 1, 100, 1, 10), n('voltage', 'Voltage', 1, 24, .5, 12)], init: () => ({ t: 0 }), step: (s, dt) => { s.t = num(s, 't') + dt }, draw: (ctx, s, w, h) => { base(ctx, w, h); const cx = w / 2; const cy = h / 2; ctx.fillStyle = '#81a9d6'; ctx.fillRect(cx - 70, cy - 70, 12, 140); ctx.fillRect(cx + 58, cy - 70, 12, 140); const c = 8.854e-12 * num(s, 'dielectric') * num(s, 'area') / num(s, 'separation'); const v = num(s, 'voltage') * (1 - Math.exp(-num(s, 't') / Math.max(.01, num(s, 'resistance') * c * 1e9))); for (let y = cy - 55; y < cy + 55; y += 18) line(ctx, cx - 50, y, cx + 50, y, '#d4b36a', 1); text(ctx, `V(t) = ${v.toFixed(2)} V`, 18, 24) }, readouts: s => { const c = 8.854e-12 * num(s, 'dielectric') * num(s, 'area') / num(s, 'separation'); const tau = num(s, 'resistance') * c; const v = num(s, 'voltage') * (1 - Math.exp(-num(s, 't') / Math.max(.01, tau * 1e9))); return [{ label: 'Capacitance', value: `${(c * 1e9).toFixed(3)} nF` }, { label: 'Charge', value: `${(c * v * 1e9).toFixed(3)} nC` }, { label: 'Time constant', value: `${(tau * 1e9).toFixed(2)} ns` }] } } as Experiment

function drawAtom(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, label: string, color: string) {
	ctx.save()
	ctx.fillStyle = color
	ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill()
	ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1; ctx.stroke()
	ctx.fillStyle = '#111315'; ctx.font = `bold ${Math.max(8, radius * .85)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, x, y)
	ctx.restore()
}

function drawMoleculeBond(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
	line(ctx, x1, y1, x2, y2, '#d6e5e5', 3)
}

function drawBiologyLab(id: string, ctx: CanvasRenderingContext2D, s: ExperimentState, w: number, h: number, title: string) {
	base(ctx, w, h)
	const cx = w / 2
	const cy = h / 2
	text(ctx, title, 18, 24)
	if (id === 'biology-diffusion') {
		const left = num(s, 'leftConcentration')
		const right = num(s, 'rightConcentration')
		const mix = 1 - Math.exp(-num(s, 't') * num(s, 'diffusionRate') / 8)
		const mean = (left + right) / 2
		const currentLeft = mean + (left - mean) * (1 - mix)
		const currentRight = mean + (right - mean) * (1 - mix)
		const boxLeft = w * .1
		const boxRight = w * .9
		const boxTop = h * .22
		const boxBottom = h * .78
		ctx.strokeStyle = '#91a5a8'; ctx.lineWidth = 3; ctx.strokeRect(boxLeft, boxTop, boxRight - boxLeft, boxBottom - boxTop)
		line(ctx, cx, boxTop, cx, boxBottom, '#b8e4cf', 2)
		text(ctx, 'High concentration', boxLeft + 8, boxTop - 8, '#ef9b9b')
		text(ctx, 'Low concentration', cx + 8, boxTop - 8, '#81a9d6')
		for (let i = 0; i < 36; i++) {
			const seedX = ((i * 43) % 97) / 97
			const seedY = ((i * 67) % 89) / 89
			const initiallyLeft = seedX < left / Math.max(.01, left + right)
			const startX = initiallyLeft ? boxLeft + 8 + seedX / Math.max(.01, left / (left + right)) * (cx - boxLeft - 16) : cx + 8 + (seedX - left / (left + right)) / Math.max(.01, right / (left + right)) * (boxRight - cx - 16)
			const targetX = boxLeft + 12 + (((i * 31) % 91) / 91) * (boxRight - boxLeft - 24)
			const x = startX + (targetX - startX) * mix + Math.sin(num(s, 't') * 1.8 + i) * 4
			const y = boxTop + 12 + seedY * (boxBottom - boxTop - 24) + Math.cos(num(s, 't') * 1.3 + i) * 4
			ctx.fillStyle = '#c98bdf'; ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill()
		}
		text(ctx, 'Net movement: high → low concentration', 18, h - 18, '#81d6a3')
		return
	}
	if (id === 'biology-osmosis') {
		const outside = num(s, 'soluteOutside')
		const inside = num(s, 'soluteInside')
		const permeability = num(s, 'permeability')
		const radius = Math.max(56, Math.min(Math.min(w, h) * .32, 82 + (inside - outside) * permeability * Math.min(num(s, 't'), 8) * 1.8))
		ctx.strokeStyle = '#91a5a8'; ctx.lineWidth = 2; ctx.strokeRect(w * .08, h * .22, w * .84, h * .56)
		ctx.fillStyle = 'rgba(129,169,214,.14)'; ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill()
		ctx.strokeStyle = '#b8e4cf'; ctx.lineWidth = 4; ctx.stroke()
		for (let i = 0; i < 18; i++) {
			const angle = i * 2.4
			const distance = radius + 16 + ((i * 13) % 48)
			const x = cx + Math.cos(angle + num(s, 't') * .35) * distance
			const y = cy + Math.sin(angle + num(s, 't') * .35) * distance * .68
			ctx.fillStyle = '#81a9d6'; ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill()
		}
		for (let i = 0; i < 8; i++) {
			const angle = i * 2.4
			ctx.fillStyle = '#d4b36a'; ctx.beginPath(); ctx.arc(cx + Math.cos(angle) * radius * .55, cy + Math.sin(angle) * radius * .55, 4, 0, Math.PI * 2); ctx.fill()
		}
		const flow = (inside - outside) * permeability
		const flowText = flow > .05 ? 'Water enters cell' : flow < -.05 ? 'Water leaves cell' : 'No net water movement'
		const flowColor = flow > .05 ? '#81d6a3' : flow < -.05 ? '#ef9b9b' : '#f2f0eb'
		line(ctx, cx, cy - radius - 30, cx, cy - radius - 8, flowColor, 3)
		text(ctx, flowText, 18, h - 18, flowColor)
		return
	}
	if (id === 'biology-active-transport') {
		const membraneX = cx
		const membraneTop = h * .25
		const membraneBottom = h * .76
		line(ctx, membraneX - 7, membraneTop, membraneX - 7, membraneBottom, '#81a9d6', 3)
		line(ctx, membraneX + 7, membraneTop, membraneX + 7, membraneBottom, '#81a9d6', 3)
		ctx.fillStyle = '#c98bdf'; ctx.fillRect(membraneX - 22, cy - 35, 44, 70)
		text(ctx, 'ATP pump', membraneX - 30, cy - 48, '#c98bdf')
		const cycles = num(s, 't') * num(s, 'pumpRate') * num(s, 'atp') / 10
		for (let i = 0; i < 8; i++) {
			const progress = Math.max(0, Math.min(1, cycles - i))
			const y = membraneTop + 25 + i * (membraneBottom - membraneTop - 50) / 7
			const x = w * .28 + (w * .44) * progress
			ctx.fillStyle = '#f4df9f'; ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill()
		}
		line(ctx, w * .3, cy + 60, w * .72, cy + 60, '#81d6a3', 2)
		text(ctx, 'Low ion concentration', w * .12, cy - 4, '#81a9d6')
		text(ctx, 'High ion concentration', w * .72, cy - 4, '#ef9b9b')
		text(ctx, `ATP → ADP + Pi   ·   ${Math.floor(cycles)} ions pumped`, 18, h - 18, '#81d6a3')
		return
	}
	if (id === 'biology-microscope') {
		const standX = w * .32
		const objective = num(s, 'objective')
		const focus = num(s, 'focus')
		ctx.strokeStyle = '#91a5a8'; ctx.lineWidth = 15; ctx.lineCap = 'round'
		ctx.beginPath(); ctx.moveTo(standX - 42, h * .82); ctx.lineTo(standX + 12, h * .82); ctx.lineTo(standX + 20, h * .38); ctx.lineTo(standX - 16, h * .2); ctx.stroke()
		ctx.strokeStyle = '#d4b36a'; ctx.lineWidth = 20; ctx.beginPath(); ctx.moveTo(standX - 16, h * .2); ctx.lineTo(standX + 22, h * .34); ctx.stroke()
		ctx.fillStyle = '#81a9d6'; ctx.fillRect(standX - 13, h * .39, 68, 12)
		ctx.fillStyle = '#d6e5e5'; ctx.fillRect(standX + 40, h * .14, 14, 34)
		ctx.fillStyle = '#d6e5e5'; ctx.fillRect(standX + 32, h * .38, 12, 29)
		line(ctx, standX - 48, h * .57, standX + 55, h * .57, '#d4b36a', 5)
		ctx.fillStyle = '#81d6a3'; ctx.beginPath(); ctx.arc(standX + 4, h * .57, 8, 0, Math.PI * 2); ctx.fill()
		const viewX = w * .72
		const viewY = cy
		const viewRadius = Math.min(w, h) * .27
		ctx.save(); ctx.beginPath(); ctx.arc(viewX, viewY, viewRadius, 0, Math.PI * 2); ctx.clip()
		ctx.fillStyle = '#e8eadc'; ctx.fillRect(viewX - viewRadius, viewY - viewRadius, viewRadius * 2, viewRadius * 2)
		ctx.filter = `blur(${(1 - focus) * 3}px)`
		for (let i = 0; i < 15; i++) {
			const angle = i * 2.4 + num(s, 't') * .08
			const distance = ((i * 19) % 83) / 100 * viewRadius
			const x = viewX + Math.cos(angle) * distance
			const y = viewY + Math.sin(angle) * distance
			ctx.fillStyle = i % 2 ? '#6aa78d' : '#7b91bd'
			ctx.beginPath(); ctx.ellipse(x, y, 5 + objective * .7, 3 + objective * .4, angle, 0, Math.PI * 2); ctx.fill()
		}
		ctx.filter = 'none'; ctx.restore()
		ctx.strokeStyle = '#d4b36a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(viewX, viewY, viewRadius, 0, Math.PI * 2); ctx.stroke()
		text(ctx, `${(objective * 10).toFixed(0)}× total magnification`, viewX - 62, h - 18, '#81d6a3')
		return
	}
	if (id === 'biology-endocytosis' || id === 'biology-exocytosis') {
		const phase = (num(s, 't') * num(s, 'vesicleRate')) % 4 / 4
		const endocytosis = id === 'biology-endocytosis'
		const membraneY = cy
		const vesicleX = cx
		const vesicleY = endocytosis ? h * .24 + phase * h * .48 : h * .76 - phase * h * .48
		const radius = 30 + Math.sin(phase * Math.PI) * 8
		ctx.strokeStyle = '#81a9d6'; ctx.lineWidth = 5
		ctx.beginPath()
		if (endocytosis && phase > .35 && phase < .72) {
			ctx.moveTo(w * .08, membraneY); ctx.lineTo(cx - radius, membraneY)
			ctx.arc(cx, membraneY, radius, Math.PI, 0, true)
			ctx.lineTo(w * .92, membraneY)
		} else if (!endocytosis && phase > .35 && phase < .72) {
			ctx.moveTo(w * .08, membraneY); ctx.lineTo(cx - radius, membraneY)
			ctx.arc(cx, membraneY, radius, Math.PI, 0, false)
			ctx.lineTo(w * .92, membraneY)
		} else {
			ctx.moveTo(w * .08, membraneY); ctx.lineTo(w * .92, membraneY)
		}
		ctx.stroke()
		ctx.fillStyle = 'rgba(201,139,223,.2)'; ctx.strokeStyle = '#c98bdf'; ctx.lineWidth = 3
		ctx.beginPath(); ctx.arc(vesicleX, vesicleY, radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
		for (let i = 0; i < 5; i++) {
			const angle = i * Math.PI * 2 / 5 + num(s, 't') * .2
			ctx.fillStyle = '#f4df9f'; ctx.beginPath(); ctx.arc(vesicleX + Math.cos(angle) * radius * .48, vesicleY + Math.sin(angle) * radius * .48, 4, 0, Math.PI * 2); ctx.fill()
		}
		text(ctx, 'Extracellular space', 18, h * .23, '#81a9d6')
		text(ctx, 'Cytoplasm', 18, h * .78, '#81d6a3')
		text(ctx, `${endocytosis ? 'Membrane invaginates · cargo enters' : 'Vesicle fuses · cargo released'} · ATP`, 18, h - 18, '#81d6a3')
	}
}

function drawChemistryScene(id: string, ctx: CanvasRenderingContext2D, s: ExperimentState, w: number, h: number, title: string) {
	if (id.startsWith('biology-') && id !== 'biology-cells' && id !== 'biology-cycles') {
		drawBiologyLab(id, ctx, s, w, h, title)
		return
	}
	base(ctx, w, h)
	const cx = w / 2; const cy = h / 2
	text(ctx, title, 18, 24)
	if (id === 'biology-cells' || id === 'biology-cycles') {
		ctx.fillStyle = '#7db7a4'; ctx.globalAlpha = .72; ctx.beginPath(); ctx.ellipse(cx, cy, 150, 105, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1
		ctx.strokeStyle = '#b8e4cf'; ctx.lineWidth = 4; ctx.stroke()
		ctx.fillStyle = '#8b79c4'; ctx.beginPath(); ctx.arc(cx - 18, cy, 42, 0, Math.PI * 2); ctx.fill()
		for (let i = 0; i < 6; i++) { ctx.fillStyle = '#d4b36a'; ctx.beginPath(); ctx.ellipse(cx + Math.cos(i + num(s, 't') * .35) * 72, cy + Math.sin(i * 1.7 + num(s, 't') * .35) * 48, 14, 8, i, 0, Math.PI * 2); ctx.fill() }
		if (id === 'biology-cycles') { const phase = ['G1', 'S', 'G2', 'M'][Math.floor(num(s, 'phase')) % 4]; text(ctx, `Cell cycle phase: ${phase}`, 18, h - 18, '#81d6a3') }
		return
	}
	if (id === 'titration') {
		ctx.strokeStyle = '#d6e5e5'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx - 12, 48); ctx.lineTo(cx + 12, 48); ctx.lineTo(cx + 12, cy - 20); ctx.stroke(); ctx.fillStyle = '#81a9d6'; ctx.beginPath(); ctx.moveTo(cx - 58, cy - 18); ctx.lineTo(cx + 58, cy - 18); ctx.lineTo(cx + 42, cy + 82); ctx.lineTo(cx - 42, cy + 82); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#d4b36a'; ctx.beginPath(); ctx.arc(cx, cy - 2 + (num(s, 't') % 1) * 20, 6, 0, Math.PI * 2); ctx.fill(); text(ctx, 'Burette + indicator flask', 18, h - 18, '#81d6a3'); return
	}
	if (id === 'electrochemistry') {
		ctx.fillStyle = '#81a9d6'; ctx.fillRect(cx - 150, cy - 55, 105, 120); ctx.fillStyle = '#d4b36a'; ctx.fillRect(cx + 45, cy - 55, 105, 120); line(ctx, cx - 95, cy - 55, cx - 95, cy - 110, '#d4b36a', 5); line(ctx, cx + 95, cy - 55, cx + 95, cy - 110, '#81d6a3', 5); line(ctx, cx - 95, cy - 110, cx + 95, cy - 110, '#e5e5e5', 3); line(ctx, cx - 45, cy + 10, cx + 45, cy + 10, '#c98bdf', 5); for (let i = 0; i < 5; i++) { ctx.fillStyle = '#f4df9f'; ctx.beginPath(); ctx.arc(cx - 90 + ((num(s, 't') * 55 + i * 36) % 180), cy - 110, 4, 0, Math.PI * 2); ctx.fill() } text(ctx, 'Salt bridge · electron flow', 18, h - 18, '#81d6a3'); return
	}
	if (id === 'chemical-reactions') {
		const reactants = Math.max(1, num(s, 'reactants'))
		const moleculeCount = Math.max(2, Math.min(6, Math.ceil(reactants / 2)))
		const reacted = Math.min(moleculeCount, num(s, 't') * num(s, 'rate') / reactants * moleculeCount)
		const chamberLeft = w * .1
		const chamberRight = w * .9
		ctx.strokeStyle = '#d6e5e5'; ctx.lineWidth = 3
		ctx.beginPath(); ctx.moveTo(chamberLeft, cy - 75); ctx.lineTo(chamberLeft + 18, cy + 85); ctx.lineTo(chamberRight - 18, cy + 85); ctx.lineTo(chamberRight, cy - 75); ctx.stroke()
		ctx.fillStyle = 'rgba(129,169,214,.22)'; ctx.fillRect(chamberLeft + 19, cy + 10, chamberRight - chamberLeft - 38, 74)
		text(ctx, 'NaOH + HCl', chamberLeft + 8, cy - 91, '#81a9d6')
		text(ctx, 'NaCl + H₂O', chamberRight - 108, cy - 91, '#81d6a3')
		line(ctx, cx - 42, cy - 56, cx + 42, cy - 56, '#d4b36a', 2)
		text(ctx, '→', cx - 5, cy - 50, '#d4b36a')
		for (let i = 0; i < moleculeCount; i++) {
			const fraction = Math.max(0, Math.min(1, reacted - i))
			const moleculeX = chamberLeft + 78 + fraction * (chamberRight - chamberLeft - 156)
			const moleculeY = cy + 28 + (i % 3) * 20 + Math.sin(num(s, 't') * 2 + i) * 5
			const opacity = 0.65 + Math.sin(num(s, 't') * 3 + i) * .15
			ctx.save(); ctx.globalAlpha = opacity
			if (fraction < .5) {
				drawMoleculeBond(ctx, moleculeX - 15, moleculeY, moleculeX - 3, moleculeY)
				drawAtom(ctx, moleculeX - 42, moleculeY, 11, 'Na⁺', '#81a9d6')
				drawAtom(ctx, moleculeX - 15, moleculeY, 10, 'O', '#d86658')
				drawAtom(ctx, moleculeX - 3, moleculeY, 8, 'H', '#f2f0eb')
				drawAtom(ctx, moleculeX + 22, moleculeY, 9, 'H⁺', '#f2f0eb')
				drawAtom(ctx, moleculeX + 43, moleculeY, 11, 'Cl⁻', '#81d6a3')
			} else {
				drawAtom(ctx, moleculeX - 30, moleculeY, 11, 'Na⁺', '#81a9d6')
				drawAtom(ctx, moleculeX - 10, moleculeY, 11, 'Cl⁻', '#81d6a3')
				drawMoleculeBond(ctx, moleculeX + 11, moleculeY, moleculeX + 27, moleculeY - 5)
				drawMoleculeBond(ctx, moleculeX + 11, moleculeY, moleculeX + 27, moleculeY + 5)
				drawAtom(ctx, moleculeX + 11, moleculeY, 10, 'O', '#d86658')
				drawAtom(ctx, moleculeX + 27, moleculeY - 5, 7, 'H', '#f2f0eb')
				drawAtom(ctx, moleculeX + 27, moleculeY + 5, 7, 'H', '#f2f0eb')
			}
			ctx.restore()
		}
		text(ctx, `Neutralization · ${Math.min(reactants, num(s, 't') * num(s, 'rate')).toFixed(1)} reaction units`, 18, h - 18, '#81d6a3')
		return
	}
	if (id === 'bonding' || id === 'vsepr') { const distance = id === 'vsepr' ? 85 : 70; ctx.strokeStyle = '#d6e5e5'; ctx.lineWidth = 8; for (let i = 0; i < 4; i++) line(ctx, cx, cy, cx + Math.cos(i * Math.PI / 2) * distance, cy + Math.sin(i * Math.PI / 2) * distance, '#d6e5e5', 5); ctx.fillStyle = '#d86658'; ctx.beginPath(); ctx.arc(cx, cy, 28, 0, Math.PI * 2); ctx.fill(); for (let i = 0; i < 4; i++) { ctx.fillStyle = '#81d6a3'; ctx.beginPath(); ctx.arc(cx + Math.cos(i * Math.PI / 2 + num(s, 't') * .8) * (distance * .55), cy + Math.sin(i * Math.PI / 2 + num(s, 't') * .8) * (distance * .55), 5, 0, Math.PI * 2); ctx.fill() } text(ctx, id === 'vsepr' ? 'Electron-pair geometry' : 'Shared electron pairs', 18, h - 18, '#81d6a3'); return }
	ctx.strokeStyle = '#d6e5e5'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx - 90, cy - 80); ctx.lineTo(cx - 65, cy + 80); ctx.lineTo(cx + 65, cy + 80); ctx.lineTo(cx + 90, cy - 80); ctx.stroke(); ctx.fillStyle = '#81a9d6'; ctx.fillRect(cx - 64, cy + 5, 128, 72); for (let i = 0; i < 10; i++) { ctx.fillStyle = i % 2 ? '#d4b36a' : '#d86658'; ctx.beginPath(); const x = cx - 45 + (i % 5) * 22 + Math.sin(num(s, 't') * 1.6 + i) * 5; const y = cy + 22 + Math.floor(i / 5) * 24 + Math.cos(num(s, 't') * 1.6 + i) * 4; ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill() } text(ctx, id === 'gas-laws' ? 'Gas chamber' : id === 'chemical-reactions' ? 'Reaction vessel' : 'Reactant beaker', 18, h - 18, '#81d6a3')
}
const chemistryPool = (id: string, title: string, params: ExperimentParam[], readouts: Experiment['readouts']): Experiment => ({ id, category: id.startsWith('biology') ? 'Biology' : 'Chemistry', title, params, init: () => ({ t: 0, amount: 1 }), step: (s, dt) => { s.t = num(s, 't') + dt; s.amount = Math.max(0, num(s, 'amount') - dt * .04) }, draw: (ctx, s, w, h) => drawChemistryScene(id, ctx, s, w, h, title), readouts })
const stoichiometry = chemistryPool('stoichiometry', 'Stoichiometry & Limiting Reactants', [n('reactantA', 'Reactant A moles', 0, 10, .1, 4), n('reactantB', 'Reactant B moles', 0, 10, .1, 3), n('coefficientA', 'A coefficient', 1, 4, 1, 1), n('coefficientB', 'B coefficient', 1, 4, 1, 1)], s => [{ label: 'Limiting reactant', value: num(s, 'reactantA') / num(s, 'coefficientA') < num(s, 'reactantB') / num(s, 'coefficientB') ? 'A' : 'B' }, { label: 'Theoretical yield', value: `${Math.min(num(s, 'reactantA') / num(s, 'coefficientA'), num(s, 'reactantB') / num(s, 'coefficientB')).toFixed(2)} mol` }])
const gas = chemistryPool('gas-laws', 'Gas Laws — Particle-in-a-Box', [n('volume', 'Volume', 1, 20, .1, 10), n('temperature', 'Temperature', 100, 600, 1, 300), n('particles', 'Particles', 1, 20, 1, 8)], s => [{ label: 'Pressure', value: `${(num(s, 'particles') * num(s, 'temperature') / num(s, 'volume')).toFixed(2)} kPa` }, { label: 'PV / nT', value: `${(num(s, 'volume') * num(s, 'temperature') / Math.max(1, num(s, 'particles') * num(s, 'temperature'))).toFixed(2)}` }])
const titration = chemistryPool('titration', 'Acid-Base Titration', [n('analyte', 'Analyte concentration', .01, 1, .01, .1), n('titrant', 'Titrant concentration', .01, 1, .01, .1), n('volume', 'Volume added', 0, 50, .5, 10)], s => [{ label: 'pH', value: `${(7 + Math.log10(Math.max(.001, num(s, 'volume') / 25))).toFixed(2)}` }, { label: 'Volume added', value: `${num(s, 'volume').toFixed(1)} mL` }, { label: 'Equivalence', value: `${(num(s, 'analyte') * 25 / Math.max(.001, num(s, 'titrant'))).toFixed(1)} mL` }])
const equilibrium = chemistryPool('equilibrium', 'Chemical Equilibrium — Le Chatelier', [n('reactant', 'Reactant added', 0, 10, .1, 3), n('product', 'Product added', 0, 10, .1, 1), n('temperature', 'Temperature', 200, 600, 1, 300)], s => [{ label: 'Reaction quotient Q', value: `${(num(s, 'product') / Math.max(.1, num(s, 'reactant'))).toFixed(2)}` }, { label: 'Shift', value: num(s, 'reactant') > num(s, 'product') ? 'Forward' : 'Reverse' }])
const kinetics = chemistryPool('kinetics', 'Reaction Kinetics — Rate Laws', [n('concentration', 'Concentration', 0, 10, .1, 5), n('rate', 'Rate constant k', .01, 2, .01, .2), n('order', 'Reaction order', 0, 2, 1, 1), n('temperature', 'Temperature', 200, 600, 1, 300)], s => [{ label: 'Instantaneous rate', value: `${(num(s, 'rate') * num(s, 'concentration') ** num(s, 'order')).toFixed(3)}` }, { label: 'Half-life', value: `${(Math.log(2) / Math.max(.01, num(s, 'rate'))).toFixed(2)} s` }, { label: '[A]', value: `${Math.max(0, num(s, 'concentration') - num(s, 'rate') * num(s, 't')).toFixed(2)}` }])
const electrochem = chemistryPool('electrochemistry', 'Electrochemistry — Galvanic Cell', [n('zinc', 'Ion concentration A', .01, 2, .01, 1), n('copper', 'Ion concentration B', .01, 2, .01, 1), n('temperature', 'Temperature', 250, 350, 1, 298)], s => [{ label: 'Cell potential', value: `${(1.10 - .0257 * Math.log(num(s, 'copper') / num(s, 'zinc'))).toFixed(3)} V` }, { label: 'Anode', value: 'Oxidation half-cell' }, { label: 'Cathode', value: 'Reduction half-cell' }])
const vsepr = chemistryPool('vsepr', 'Molecular Geometry — VSEPR', [n('bonding', 'Bonding pairs', 2, 6, 1, 4), n('lone', 'Lone pairs', 0, 3, 1, 0), n('rotation', 'Rotation', -180, 180, 1, 0)], s => [{ label: 'Geometry', value: num(s, 'bonding') === 2 ? 'Linear' : num(s, 'lone') === 1 ? 'Trigonal pyramidal' : 'Tetrahedral' }, { label: 'Bond angle', value: num(s, 'bonding') === 2 ? '180°' : num(s, 'lone') ? '107°' : '109.5°' }, { label: 'Polarity', value: num(s, 'lone') ? 'Asymmetric' : 'Symmetric' }])
const bonding = chemistryPool('bonding', 'Chemical Bonding — Ionic & Covalent', [n('electronegativityA', 'Atom A electronegativity', 0, 4, .1, 2.5), n('electronegativityB', 'Atom B electronegativity', 0, 4, .1, 3.5), n('sharing', 'Electron sharing', 0, 1, .01, .5)], s => [{ label: 'Bond type', value: Math.abs(num(s, 'electronegativityA') - num(s, 'electronegativityB')) > 1.7 ? 'Ionic' : 'Covalent' }, { label: 'Polarity', value: Math.abs(num(s, 'electronegativityA') - num(s, 'electronegativityB')) > .4 ? 'Polar' : 'Non-polar' }])
const reaction = chemistryPool('chemical-reactions', 'Chemical Reactions — Conservation of Matter', [n('reactants', 'Reactant particles', 1, 20, 1, 10), n('temperature', 'Temperature', 200, 800, 1, 300), n('rate', 'Reaction rate', .1, 5, .1, 1)], s => [{ label: 'Reactants remaining', value: `${Math.max(0, num(s, 'reactants') - num(s, 't') * num(s, 'rate')).toFixed(2)}` }, { label: 'Products formed', value: `${Math.min(num(s, 'reactants'), num(s, 't') * num(s, 'rate')).toFixed(2)}` }, { label: 'Matter', value: 'Conserved' }])
reaction.step = (s, dt) => {
	const temperature = Math.max(1, num(s, 'temperature'))
	const temperatureFactor = Math.exp((5000 / 8.314) * (1 / 300 - 1 / temperature))
	s.t = num(s, 't') + dt * temperatureFactor
}
const cellLab = chemistryPool('biology-cells', 'Biology — Cell Structure', [n('membrane', 'Membrane permeability', 0, 1, .01, .5), n('nutrients', 'Nutrients', 0, 10, .1, 6), n('energy', 'Cell energy', 0, 10, .1, 5)], s => [{ label: 'Cell status', value: num(s, 'energy') > 2 ? 'Active' : 'Stressed' }, { label: 'Transport', value: num(s, 'membrane') > .6 ? 'High permeability' : 'Selective transport' }, { label: 'ATP reserve', value: `${(num(s, 'energy') * .8).toFixed(2)}` }])
const cycleLab = chemistryPool('biology-cycles', 'Biology — Cell Cycles', [n('phase', 'Cycle phase', 0, 4, 1, 0), n('growth', 'Growth rate', 0, 2, .1, 1), n('checkpoint', 'Checkpoint strictness', 0, 1, .01, .7)], s => [{ label: 'Phase', value: ['G1', 'S', 'G2', 'M', 'G1'][Math.floor(num(s, 'phase'))] }, { label: 'Progress', value: `${((num(s, 't') * num(s, 'growth')) % 1 * 100).toFixed(0)}%` }, { label: 'Checkpoint', value: num(s, 'checkpoint') > .5 ? 'Protected' : 'Permissive' }])
const biologyPool = (id: string, title: string, params: ExperimentParam[], readouts: Experiment['readouts']): Experiment => ({
	id,
	category: 'Biology',
	title,
	params,
	init: () => ({ t: 0 }),
	step: (s, dt) => { s.t = num(s, 't') + dt },
	draw: (ctx, s, w, h) => drawBiologyLab(id, ctx, s, w, h, title),
	readouts,
})
const diffusionLab = biologyPool('biology-diffusion', 'Biology — Diffusion', [n('leftConcentration', 'Initial high concentration', 1, 10, .1, 8), n('rightConcentration', 'Initial low concentration', 0, 8, .1, 2), n('diffusionRate', 'Diffusion rate', .1, 4, .1, 1)], s => {
	const mix = 1 - Math.exp(-num(s, 't') * num(s, 'diffusionRate') / 8)
	const mean = (num(s, 'leftConcentration') + num(s, 'rightConcentration')) / 2
	return [{ label: 'High-side concentration', value: `${(mean + (num(s, 'leftConcentration') - mean) * (1 - mix)).toFixed(2)}` }, { label: 'Low-side concentration', value: `${(mean + (num(s, 'rightConcentration') - mean) * (1 - mix)).toFixed(2)}` }, { label: 'Net movement', value: 'High → low concentration' }]
})
const osmosisLab = biologyPool('biology-osmosis', 'Biology — Osmosis', [n('soluteOutside', 'Solute outside cell', 0, 10, .1, 3), n('soluteInside', 'Solute inside cell', 0, 10, .1, 7), n('permeability', 'Water permeability', 0, 1, .01, .6)], s => {
	const flow = (num(s, 'soluteInside') - num(s, 'soluteOutside')) * num(s, 'permeability')
	return [{ label: 'Water movement', value: flow > .05 ? 'Into the cell' : flow < -.05 ? 'Out of the cell' : 'At equilibrium' }, { label: 'Cell response', value: flow > .05 ? 'Swelling' : flow < -.05 ? 'Shrinking' : 'Stable' }, { label: 'Membrane', value: 'Water-permeable; solute-selective' }]
})
const activeTransportLab = biologyPool('biology-active-transport', 'Biology — Active Transport', [n('atp', 'ATP available', 0, 10, .1, 8), n('pumpRate', 'Pump cycle rate', .1, 4, .1, 1.5)], s => {
	const cycles = num(s, 't') * num(s, 'pumpRate') * num(s, 'atp') / 10
	return [{ label: 'Transported ions', value: `${Math.floor(cycles)}` }, { label: 'Direction', value: 'Low → high concentration' }, { label: 'Energy', value: num(s, 'atp') > 0 ? 'ATP-powered' : 'Stopped — no ATP' }]
})
const microscopeLab = biologyPool('biology-microscope', 'Biology — Microscope', [n('objective', 'Objective magnification', 1, 10, 1, 4), n('focus', 'Focus', 0, 1, .01, .8)], s => [{ label: 'Total magnification', value: `${(num(s, 'objective') * 10).toFixed(0)}×` }, { label: 'Focus', value: num(s, 'focus') > .8 ? 'Sharp' : num(s, 'focus') > .35 ? 'Adjusting' : 'Out of focus' }, { label: 'Eyepiece', value: '10×' }])
const endocytosisLab = biologyPool('biology-endocytosis', 'Biology — Endocytosis', [n('vesicleRate', 'Vesicle cycle rate', .1, 3, .1, 1)], s => {
	const phase = (num(s, 't') * num(s, 'vesicleRate')) % 4 / 4
	return [{ label: 'Process stage', value: phase < .25 ? 'Cargo binding' : phase < .5 ? 'Membrane invagination' : phase < .75 ? 'Vesicle formation' : 'Vesicle enters cytoplasm' }, { label: 'Cargo', value: 'Moving into cell' }, { label: 'Transport', value: 'Vesicle-mediated' }]
})
const exocytosisLab = biologyPool('biology-exocytosis', 'Biology — Exocytosis', [n('vesicleRate', 'Vesicle cycle rate', .1, 3, .1, 1)], s => {
	const phase = (num(s, 't') * num(s, 'vesicleRate')) % 4 / 4
	return [{ label: 'Process stage', value: phase < .25 ? 'Vesicle moves to membrane' : phase < .5 ? 'Vesicle docking' : phase < .75 ? 'Membrane fusion' : 'Cargo released outside' }, { label: 'Cargo', value: 'Moving out of cell' }, { label: 'Transport', value: 'Vesicle-mediated' }]
})
const cathodeRay: Experiment = {
	id: 'cathode-ray',
	category: 'Chemistry',
	title: 'J.J. Thomson Cathode-Ray Tube Experiment',
	params: [n('acceleratingVoltage', 'Accelerating voltage', 500, 5000, 100, 2000), n('deflectionVoltage', 'Deflection voltage', -100, 100, 1, 25), n('plateGap', 'Plate separation', 2, 8, .1, 4)],
	init: () => ({ t: 0, x: 0, y: 0, vy: 0, trail: [] as number[] }),
	step: (s, dt) => {
		s.t = num(s, 't') + dt
		s.x = num(s, 'x') + .34 * dt
		const gap = Math.max(.02, num(s, 'plateGap') / 100)
		const field = num(s, 'deflectionVoltage') / 100 * .25 * (.04 / gap) * (2000 / num(s, 'acceleratingVoltage'))
		s.vy = num(s, 'vy') + field * dt
		s.y = Math.max(-.32, Math.min(.32, num(s, 'y') + num(s, 'vy') * dt))
		const trail = s.trail as number[]
		trail.push(num(s, 'x'), num(s, 'y'))
		if (trail.length > 200) trail.splice(0, 2)
		if (num(s, 'x') >= 1) Object.assign(s, { x: 0, y: 0, vy: 0, trail: [] })
	},
	draw: (ctx, s, w, h) => {
		base(ctx, w, h)
		const left = w * .08
		const top = h * .22
		const tubeWidth = w * .84
		const tubeHeight = h * .56
		const centerY = h / 2
		ctx.strokeStyle = '#7488a7'
		ctx.lineWidth = 2
		ctx.strokeRect(left, top, tubeWidth, tubeHeight)
		ctx.fillStyle = '#c98bdf'
		ctx.fillRect(left + 18, centerY - 18, 8, 36)
		text(ctx, 'Cathode', left + 4, top - 8, '#c98bdf')
		ctx.fillStyle = '#81a9d6'
		ctx.fillRect(left + tubeWidth * .18, centerY - 32, 7, 64)
		text(ctx, 'Anode', left + tubeWidth * .14, top - 8, '#81a9d6')
		const plateX = left + tubeWidth * .43
		ctx.fillStyle = '#d4b36a'
		ctx.fillRect(plateX, centerY - 70, tubeWidth * .24, 5)
		ctx.fillRect(plateX, centerY + 65, tubeWidth * .24, 5)
		text(ctx, 'Deflection plates', plateX, centerY + 90, '#d4b36a')
		ctx.fillStyle = '#81d6a3'
		ctx.fillRect(left + tubeWidth * .91, top + 8, 5, tubeHeight - 16)
		text(ctx, 'Screen', left + tubeWidth * .86, top - 8, '#81d6a3')
		const beamStart = left + tubeWidth * .22
		const beamWidth = tubeWidth * .69
		const trail = s.trail as number[]
		ctx.strokeStyle = '#81d6a3'
		ctx.lineWidth = 2
		ctx.beginPath()
		for (let i = 0; i < trail.length; i += 2) {
			const x = beamStart + trail[i] * beamWidth
			const y = centerY - trail[i + 1] * tubeHeight
			if (i === 0) ctx.moveTo(x, y)
			else ctx.lineTo(x, y)
		}
		ctx.stroke()
		const electronX = beamStart + num(s, 'x') * beamWidth
		const electronY = centerY - num(s, 'y') * tubeHeight
		ctx.fillStyle = '#d9fff0'
		ctx.beginPath(); ctx.arc(electronX, electronY, 6, 0, Math.PI * 2); ctx.fill()
		text(ctx, 'e⁻', electronX + 8, electronY - 8, '#d9fff0')
	},
	readouts: (s) => [
		{ label: 'Beam deflection', value: `${(num(s, 'y') * 100).toFixed(1)} mm` },
		{ label: 'Accelerating voltage', value: `${num(s, 'acceleratingVoltage').toFixed(0)} V` },
		{ label: 'Electron speed', value: `${(18.76 * Math.sqrt(num(s, 'acceleratingVoltage') / 1000)).toFixed(2)} Mm/s` },
		{ label: 'Charge-to-mass ratio', value: '1.76 × 10¹¹ C/kg' },
	],
}

const bohrModel: Experiment = {
	id: 'bohr-model',
	category: 'Chemistry',
	title: 'Niels Bohr’s Planetary Model',
	params: [n('level', 'Electron energy level n', 1, 4, 1, 2), n('orbitalSpeed', 'Orbital speed', .5, 4, .1, 1.5), n('protons', 'Protons in nucleus', 1, 10, 1, 1)],
	init: () => ({ angle: 0 }),
	step: (s, dt) => { s.angle = num(s, 'angle') + num(s, 'orbitalSpeed') * dt },
	draw: (ctx, s, w, h) => {
		base(ctx, w, h)
		const cx = w / 2
		const cy = h / 2
		const scale = Math.min(w, h)
		const activeLevel = num(s, 'level')
		for (let level = 1; level <= 4; level++) {
			const radius = scale * (.12 + level * .075)
			ctx.beginPath()
			ctx.arc(cx, cy, radius, 0, Math.PI * 2)
			ctx.strokeStyle = level === activeLevel ? '#7488a7' : '#343a3b'
			ctx.lineWidth = level === activeLevel ? 2 : 1
			ctx.stroke()
		}
		const nucleusRadius = 13 + Math.min(12, num(s, 'protons'))
		ctx.fillStyle = '#d86658'
		ctx.beginPath(); ctx.arc(cx, cy, nucleusRadius, 0, Math.PI * 2); ctx.fill()
		text(ctx, `${num(s, 'protons').toFixed(0)}p⁺`, cx - 14, cy + 4)
		const orbitalRadius = scale * (.12 + activeLevel * .075)
		const angle = num(s, 'angle')
		const electronX = cx + Math.cos(angle) * orbitalRadius
		const electronY = cy + Math.sin(angle) * orbitalRadius
		ctx.fillStyle = '#81d6a3'
		ctx.beginPath(); ctx.arc(electronX, electronY, 8, 0, Math.PI * 2); ctx.fill()
		text(ctx, `n = ${activeLevel}`, 18, 24, '#81a9d6')
	},
	readouts: (s) => {
		const level = Math.max(1, num(s, 'level'))
		return [
			{ label: 'Selected shell', value: `n = ${level}` },
			{ label: 'Electron energy', value: `${(-13.6 / (level * level)).toFixed(2)} eV` },
			{ label: 'Orbital radius', value: `${(0.0529 * level * level).toFixed(3)} nm` },
			{ label: 'Nucleus', value: `${num(s, 'protons').toFixed(0)} proton(s)` },
		]
	},
}

const rutherford: Experiment = {
	id: 'rutherford-scattering',
	category: 'Chemistry',
	title: 'Rutherford’s Alpha Scattering Experiment',
	params: [n('nuclearCharge', 'Nuclear charge', 10, 100, 1, 79), n('particleEnergy', 'Alpha particle energy', 2, 8, .1, 5), n('impactParameter', 'Impact parameter', .02, .6, .01, .18)],
	init: () => ({ t: 0, x: -1.25, y: .18, vx: 1.6, vy: 0, minDistance: 99, shot: 0, trail: [] as number[] }),
	step: (s, dt) => {
		const radiusSquared = Math.max(.025, num(s, 'x') ** 2 + num(s, 'y') ** 2)
		const strength = .08 * num(s, 'nuclearCharge') / 79 * 5 / num(s, 'particleEnergy')
		const acceleration = strength / (radiusSquared * Math.sqrt(radiusSquared))
		s.vx = num(s, 'vx') + num(s, 'x') * acceleration * dt
		s.vy = num(s, 'vy') + num(s, 'y') * acceleration * dt
		s.x = num(s, 'x') + num(s, 'vx') * dt
		s.y = num(s, 'y') + num(s, 'vy') * dt
		s.minDistance = Math.min(num(s, 'minDistance'), Math.hypot(num(s, 'x'), num(s, 'y')))
		s.t = num(s, 't') + dt
		const trail = s.trail as number[]
		trail.push(num(s, 'x'), num(s, 'y'))
		if (trail.length > 160) trail.splice(0, 2)
		if (num(s, 'x') > 1.25 || num(s, 'x') < -1.25) {
			const shot = num(s, 'shot') + 1
			const offset = num(s, 'impactParameter') * (1 + Math.floor((shot - 1) / 2) % 3 * .35)
			Object.assign(s, { x: -1.25, y: shot % 2 ? -offset : offset, vx: 1.6, vy: 0, minDistance: Math.hypot(1.25, offset), shot, trail: [] })
		}
	},
	draw: (ctx, s, w, h) => {
		base(ctx, w, h)
		const cx = w * .62
		const cy = h / 2
		const scale = Math.min(w * .35, h * .33)
		ctx.fillStyle = '#d4b36a'
		ctx.fillRect(cx - 3, cy - h * .35, 6, h * .7)
		text(ctx, 'Gold foil', cx + 9, cy - h * .3, '#d4b36a')
		ctx.fillStyle = '#d86658'
		ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI * 2); ctx.fill()
		text(ctx, 'Au nucleus', cx - 32, cy + 28, '#d86658')
		const trail = s.trail as number[]
		ctx.strokeStyle = '#81d6a3'
		ctx.lineWidth = 2
		ctx.beginPath()
		for (let i = 0; i < trail.length; i += 2) {
			const x = cx + trail[i] * scale
			const y = cy - trail[i + 1] * scale
			if (i === 0) ctx.moveTo(x, y)
			else ctx.lineTo(x, y)
		}
		ctx.stroke()
		ctx.fillStyle = '#f4df9f'
		ctx.beginPath(); ctx.arc(cx + num(s, 'x') * scale, cy - num(s, 'y') * scale, 6, 0, Math.PI * 2); ctx.fill()
		text(ctx, 'α particle', 18, 24, '#81d6a3')
	},
	readouts: (s) => [
		{ label: 'Closest approach', value: `${num(s, 'minDistance').toFixed(2)} relative units` },
		{ label: 'Scattering angle', value: `${(Math.atan2(num(s, 'vy'), num(s, 'vx')) * 180 / Math.PI).toFixed(1)}°` },
		{ label: 'Nuclear charge', value: `${num(s, 'nuclearCharge').toFixed(0)} Z` },
		{ label: 'Particles observed', value: `${num(s, 'shot').toFixed(0)}` },
	],
}

export const EXPERIMENTS: Experiment[] = [projectile, incline, oscillator, circular, collisions, waves, electricity, forceLab, magnetismLab, capacitor, stoichiometry, gas, titration, equilibrium, kinetics, electrochem, vsepr, bonding, reaction, cathodeRay, bohrModel, rutherford, cellLab, cycleLab, diffusionLab, osmosisLab, activeTransportLab, microscopeLab, endocytosisLab, exocytosisLab]
export function experimentById(id: string) { return EXPERIMENTS.find((experiment) => experiment.id === id) || EXPERIMENTS[0] }
export function applyExperimentParams(experiment: Experiment, values: Record<string, number>): ExperimentState {
	const state = experiment.init()
	experiment.params.forEach((param) => { state[param.key] = values[param.key] ?? param.value })
	if (experiment.id === 'projectile') {
		const angle = num(state, 'angle') * Math.PI / 180
		const speed = num(state, 'speed')
		state.vx = speed * Math.cos(angle)
		state.vy = speed * Math.sin(angle)
	}
	if (experiment.id === 'collisions') {
		state.vA = num(state, 'velocityA')
		state.vB = num(state, 'velocityB')
	}
	if (experiment.id === 'rutherford-scattering') {
		state.minDistance = Math.hypot(1.25, num(state, 'impactParameter'))
	}
	return state
}
