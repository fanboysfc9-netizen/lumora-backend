type WikipediaArticle = { title: string; snippet: string; extract?: string; source?: string }
"use client"
import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useSupabaseSession } from '../hooks/use-supabase-session'
import { useAccountState } from '../hooks/use-account-state'
import { ApiAuthenticationError, authenticatedFetch, AuthenticationRequiredError } from '../utils/api-client'
import { getTimeGreeting } from '../utils/time-greeting'
import { userScopedStorageKey } from '../utils/user-scoped-state'
import { buildWorkspaceApiUrl, normalizeApiBaseUrl } from '../utils/api-endpoints'
import * as THREE from 'three'
import { EXPERIMENTS, applyExperimentParams, experimentById, ExperimentState } from './physics-experiments'

type Msg = { role: 'user' | 'assistant' | 'system'; text: string; id?: string; subject?: string; mode?: string; targetId?: string }
type Project = { id: string; title: string; description: string; subject: string; goal?: string; deadline?: string | null; status?: string; progress_percent?: number; created_at?: string; updated_at?: string }
type PlanTopic = { id?: string; week_number: number; title: string; lesson?: string; exercise?: string; completed: boolean; sort_order?: number }
type StudyPlan = { id: string; title: string; objective: string; subject: string; learner_level: string; estimated_duration: string; schedule: string; available_time?: string; deadline?: string | null; status?: string; project_id?: string | null; study_plan_topics?: PlanTopic[] }
type ProjectContext = { projectId?: string; projectName: string; subject?: string; studyPlanId?: string | null }
type Conversation = { id: string; title: string; created_at: string; updated_at: string }
type YouTubeVideo = { videoId: string; title: string; thumbnailUrl: string; channelTitle: string; publishedAt: string | null; watchUrl: string; embedUrl: string }
type PendingAttachment = { file: File; previewUrl: string | null; kind: 'image' | 'document' }
type PracticeKind = 'test' | 'quiz' | 'exam'
type PracticeQuestion = { id: string; topic: string; prompt: string; answer: string; verification: string; source?: string }
type PracticePacket = { plan: { id: string; title: string; subject: string }; kind: PracticeKind; questions: PracticeQuestion[]; sources: Array<{ title: string; snippet: string; source?: string }> }

function canUseWebGL() {
  try {
    const probe = document.createElement('canvas')
    return Boolean(probe.getContext('webgl') || probe.getContext('experimental-webgl'))
  } catch {
    return false
  }
}

function ExperimentCanvas({ experimentId, values, running, stepSignal, resetSignal, onReadouts }: { experimentId: string; values: Record<string, number>; running: boolean; stepSignal: number; resetSignal: number; onReadouts: (readouts: Array<{ label: string; value: string }>) => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const runningRef = useRef(running)
  const stepRef = useRef(stepSignal)
  useEffect(() => { runningRef.current = running }, [running])
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const experiment = experimentById(experimentId)
    const state: ExperimentState = applyExperimentParams(experiment, values)
    let accumulator = 0
    let last = performance.now()
    let frame = 0
    const fixedStep = 1 / 60
    const draw = (now: number) => {
      const elapsed = Math.min(Math.max(0, (now - last) / 1000), .1)
      last = now
      if (runningRef.current) accumulator += elapsed
      while (accumulator >= fixedStep) { experiment.step(state, fixedStep); accumulator -= fixedStep }
      const width = canvas.clientWidth || 700
      const height = canvas.clientHeight || 460
      const ratio = Math.min(window.devicePixelRatio, 2)
      canvas.width = width * ratio
      canvas.height = height * ratio
      const context = canvas.getContext('2d')
      if (context) { context.setTransform(ratio, 0, 0, ratio, 0, 0); experiment.draw(context, state, width, height); onReadouts(experiment.readouts(state)) }
      frame = requestAnimationFrame(draw)
    }
    if (stepSignal > stepRef.current) { experiment.step(state, fixedStep); stepRef.current = stepSignal }
    else stepRef.current = stepSignal
    if (resetSignal) Object.assign(state, applyExperimentParams(experiment, values))
    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [experimentId, values, resetSignal, onReadouts])
  return <canvas ref={canvasRef} className="physics-canvas experiment-canvas" aria-label={experimentById(experimentId).title} />
}

function PhysicsSimulationCanvas({ acceleration, initialVelocity, mass, gravity, playing, resetToken }: { acceleration: number; initialVelocity: number; mass: number; gravity: number; playing: boolean; resetToken: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    if (!canUseWebGL()) {
      const context = canvas.getContext('2d')
      if (!context) return
      let position = 0
      let velocity = initialVelocity
      let height = 0
      let verticalVelocity = Math.max(1.5, initialVelocity * .12)
      let last = performance.now()
      let frame = 0
      const draw = (now: number) => {
        const delta = Math.min((now - last) / 1000, .04)
        last = now
        if (playing) {
          velocity += acceleration * delta
          position += velocity * delta
          verticalVelocity -= gravity * delta
          height += verticalVelocity * delta
          if (height <= 0) { height = 0; verticalVelocity = Math.max(1.5, Math.abs(velocity) * .08 / Math.max(mass, .1)) }
          if (position > 9) { position = -4.8; velocity = initialVelocity }
        }
        const width = canvas.clientWidth || 640
        const heightPx = canvas.clientHeight || 360
        canvas.width = width * Math.min(window.devicePixelRatio, 2)
        canvas.height = heightPx * Math.min(window.devicePixelRatio, 2)
        context.setTransform(Math.min(window.devicePixelRatio, 2), 0, 0, Math.min(window.devicePixelRatio, 2), 0, 0)
        context.fillStyle = '#111315'; context.fillRect(0, 0, width, heightPx)
        context.strokeStyle = '#343a3b'; context.lineWidth = 1
        for (let x = 0; x < width; x += 32) { context.beginPath(); context.moveTo(x, heightPx - 42); context.lineTo(x, heightPx); context.stroke() }
        context.beginPath(); context.moveTo(0, heightPx - 42); context.lineTo(width, heightPx - 42); context.stroke()
        const x = width * .12 + (position / 9) * width * .76
        const y = heightPx - 42 - height * 18
        context.fillStyle = '#d4b36a'; context.beginPath(); context.arc(x, y, 18 + mass * 2, 0, Math.PI * 2); context.fill()
        context.fillStyle = '#f2f0eb'; context.font = '12px sans-serif'; context.fillText('WebGL fallback · 2D physics view', 16, 22)
        frame = requestAnimationFrame(draw)
      }
      frame = requestAnimationFrame(draw)
      return () => cancelAnimationFrame(frame)
    }
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#111315')
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100)
    camera.position.set(5.5, 3.7, 8)
    camera.lookAt(0, 1.1, 0)
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    const resize = () => {
      const width = canvas.clientWidth || 640
      const height = canvas.clientHeight || 360
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }
    resize()
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(canvas)

    scene.add(new THREE.HemisphereLight('#dce8ff', '#252016', 2.1))
    const keyLight = new THREE.DirectionalLight('#fff4d8', 3)
    keyLight.position.set(4, 7, 5)
    keyLight.castShadow = true
    scene.add(keyLight)

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(14, 8), new THREE.MeshStandardMaterial({ color: '#25292c', roughness: .82, metalness: .08 }))
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    scene.add(ground)
    const grid = new THREE.GridHelper(14, 14, '#69716f', '#343a3b')
    grid.position.y = .012
    scene.add(grid)
    const ball = new THREE.Mesh(new THREE.SphereGeometry(.34, 32, 20), new THREE.MeshStandardMaterial({ color: '#d4b36a', roughness: .28, metalness: .18 }))
    ball.castShadow = true
    ball.position.set(-4.8, .34, 0)
    scene.add(ball)
    const marker = new THREE.Mesh(new THREE.RingGeometry(.38, .43, 32), new THREE.MeshBasicMaterial({ color: '#d4b36a', transparent: true, opacity: .42, side: THREE.DoubleSide }))
    marker.rotation.x = -Math.PI / 2
    marker.position.y = .02
    scene.add(marker)

    let position = 0
    let height = 0
    let velocity = initialVelocity
    let verticalVelocity = Math.max(1.5, initialVelocity * .12)
    let last = performance.now()
    let frame = 0
    const animate = (now: number) => {
      const delta = Math.min((now - last) / 1000, .04)
      last = now
      if (playing) {
        velocity += acceleration * delta
        position += velocity * delta
        verticalVelocity -= gravity * delta
        height += verticalVelocity * delta
        if (height <= 0) {
          height = 0
          verticalVelocity = Math.max(1.5, Math.abs(velocity) * .08 / Math.max(mass, .1))
        }
        if (position > 9) { position = -4.8; velocity = initialVelocity }
      }
      ball.position.x = -4.8 + position
      ball.position.y = .34 + height
      const scale = .82 + mass * .045
      ball.scale.setScalar(scale)
      marker.position.x = ball.position.x
      ball.rotation.z += delta * (velocity * .5)
      renderer.render(scene, camera)
      frame = requestAnimationFrame(animate)
    }
    frame = requestAnimationFrame(animate)
    return () => {
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      renderer.dispose()
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh
        if (mesh.geometry) mesh.geometry.dispose()
        if (Array.isArray(mesh.material)) mesh.material.forEach((material) => material.dispose())
        else if (mesh.material) mesh.material.dispose()
      })
    }
  }, [acceleration, initialVelocity, mass, gravity, playing, resetToken])

  return <canvas ref={canvasRef} className="physics-canvas" aria-label="Interactive ball acceleration simulation" />
}

function CircuitSimulationCanvas({ voltage, resistance, playing, closed }: { voltage: number; resistance: number; playing: boolean; closed: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return
    let phase = 0
    let frame = 0
    const draw = () => {
      const width = canvas.clientWidth || 640
      const height = canvas.clientHeight || 420
      const ratio = Math.min(window.devicePixelRatio, 2)
      canvas.width = width * ratio
      canvas.height = height * ratio
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      context.fillStyle = '#111315'
      context.fillRect(0, 0, width, height)
      const left = width * .16
      const right = width * .84
      const top = height * .27
      const bottom = height * .73
      const current = closed ? voltage / Math.max(resistance, .1) : 0
      const speed = Math.min(.045, current * .006)
      context.strokeStyle = '#91a5ad'
      context.lineWidth = 4
      context.beginPath()
      context.moveTo(left, top); context.lineTo(width * .36, top); context.lineTo(width * .43, top)
      context.moveTo(width * .57, top); context.lineTo(right, top); context.lineTo(right, bottom); context.lineTo(left, bottom); context.lineTo(left, top)
      context.stroke()
      context.strokeStyle = closed ? '#d4b36a' : '#596267'
      context.lineWidth = 3
      context.beginPath(); context.moveTo(width * .43, top); context.lineTo(width * .57, top); context.stroke()
      context.strokeStyle = '#d4b36a'; context.lineWidth = 5
      context.beginPath(); context.moveTo(left, top - 22); context.lineTo(left, top + 22); context.stroke()
      context.strokeStyle = '#e3e8e8'; context.lineWidth = 3
      context.beginPath(); context.moveTo(left + 12, top - 13); context.lineTo(left + 12, top + 13); context.stroke()
      context.fillStyle = '#d4b36a'; context.font = 'bold 14px sans-serif'; context.fillText('+', left - 6, top - 30)
      context.fillStyle = '#e3e8e8'; context.fillText('−', left + 7, top - 30)
      context.strokeStyle = '#d4b36a'; context.lineWidth = 5
      context.beginPath(); context.moveTo(width * .43, top); context.lineTo(width * .47, top - 16); context.lineTo(width * .53, top + 16); context.lineTo(width * .57, top); context.stroke()
      context.fillStyle = '#d4b36a'; context.beginPath(); context.arc(width * .68, top, 20, 0, Math.PI * 2); context.fill()
      context.fillStyle = '#171717'; context.font = 'bold 12px sans-serif'; context.textAlign = 'center'; context.fillText('💡', width * .68, top + 5); context.textAlign = 'left'
      context.fillStyle = '#f2f0eb'; context.font = '12px sans-serif'; context.fillText(`V = ${voltage.toFixed(1)} V   R = ${resistance.toFixed(1)} Ω   I = ${current.toFixed(2)} A`, 16, 24)
      context.fillStyle = closed ? '#81d6a3' : '#ef9b9b'; context.fillText(closed ? 'Switch closed · circuit active' : 'Switch open · no current', 16, height - 18)
      for (let index = 0; index < 18; index++) {
        const distance = ((index / 18 + phase) % 1)
        const x = left + distance * (right - left)
        const y = distance < .3 ? top : distance < .55 ? top + (distance - .3) / .25 * (bottom - top) : bottom
        if (closed) { context.fillStyle = '#f4df9f'; context.beginPath(); context.arc(distance < .55 ? x : right - (distance - .55) / .45 * (right - left), y, 3, 0, Math.PI * 2); context.fill() }
      }
      if (playing && closed) phase = (phase + speed) % 1
      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [voltage, resistance, playing, closed])
  return <canvas ref={canvasRef} className="physics-canvas" aria-label="Interactive electric circuit simulation" />
}

const ELEMENTS = `Hydrogen|H|1|1.008|nonmetal|1;Helium|He|2|4.003|noble gas|2;Lithium|Li|3|6.94|alkali metal|2,1;Beryllium|Be|4|9.012|alkaline earth|2,2;Boron|B|5|10.81|metalloid|2,3;Carbon|C|6|12.011|nonmetal|2,4;Nitrogen|N|7|14.007|nonmetal|2,5;Oxygen|O|8|15.999|nonmetal|2,6;Fluorine|F|9|18.998|halogen|2,7;Neon|Ne|10|20.18|noble gas|2,8;Sodium|Na|11|22.99|alkali metal|2,8,1;Magnesium|Mg|12|24.305|alkaline earth|2,8,2;Aluminium|Al|13|26.982|post-transition|2,8,3;Silicon|Si|14|28.085|metalloid|2,8,4;Phosphorus|P|15|30.974|nonmetal|2,8,5;Sulfur|S|16|32.06|nonmetal|2,8,6;Chlorine|Cl|17|35.45|halogen|2,8,7;Argon|Ar|18|39.948|noble gas|2,8,8;Potassium|K|19|39.098|alkali metal|2,8,8,1;Calcium|Ca|20|40.078|alkaline earth|2,8,8,2;Scandium|Sc|21|44.956|transition metal|2,8,9,2;Titanium|Ti|22|47.867|transition metal|2,8,10,2;Vanadium|V|23|50.942|transition metal|2,8,11,2;Chromium|Cr|24|51.996|transition metal|2,8,13,1;Manganese|Mn|25|54.938|transition metal|2,8,13,2;Iron|Fe|26|55.845|transition metal|2,8,14,2;Cobalt|Co|27|58.933|transition metal|2,8,15,2;Nickel|Ni|28|58.693|transition metal|2,8,16,2;Copper|Cu|29|63.546|transition metal|2,8,18,1;Zinc|Zn|30|65.38|transition metal|2,8,18,2;Gallium|Ga|31|69.723|post-transition|2,8,18,3;Germanium|Ge|32|72.63|metalloid|2,8,18,4;Arsenic|As|33|74.922|metalloid|2,8,18,5;Selenium|Se|34|78.971|nonmetal|2,8,18,6;Bromine|Br|35|79.904|halogen|2,8,18,7;Krypton|Kr|36|83.798|noble gas|2,8,18,8;Rubidium|Rb|37|85.468|alkali metal|2,8,18,8,1;Strontium|Sr|38|87.62|alkaline earth|2,8,18,8,2;Yttrium|Y|39|88.906|transition metal|2,8,18,9,2;Zirconium|Zr|40|91.224|transition metal|2,8,18,10,2;Niobium|Nb|41|92.906|transition metal|2,8,18,12,1;Molybdenum|Mo|42|95.95|transition metal|2,8,18,13,1;Technetium|Tc|43|98|transition metal|2,8,18,13,2;Ruthenium|Ru|44|101.07|transition metal|2,8,18,15,1;Rhodium|Rh|45|102.91|transition metal|2,8,18,16,1;Palladium|Pd|46|106.42|transition metal|2,8,18,18;Silver|Ag|47|107.87|transition metal|2,8,18,18,1;Cadmium|Cd|48|112.41|transition metal|2,8,18,18,2;Indium|In|49|114.82|post-transition|2,8,18,18,3;Tin|Sn|50|118.71|post-transition|2,8,18,18,4;Antimony|Sb|51|121.76|metalloid|2,8,18,18,5;Tellurium|Te|52|127.6|metalloid|2,8,18,18,6;Iodine|I|53|126.9|halogen|2,8,18,18,7;Xenon|Xe|54|131.29|noble gas|2,8,18,18,8;Caesium|Cs|55|132.91|alkali metal|2,8,18,18,8,1;Barium|Ba|56|137.33|alkaline earth|2,8,18,18,8,2;Lanthanum|La|57|138.91|lanthanide|2,8,18,18,9,2;Cerium|Ce|58|140.12|lanthanide|2,8,18,19,9,2;Praseodymium|Pr|59|140.91|lanthanide|2,8,18,21,8,2;Neodymium|Nd|60|144.24|lanthanide|2,8,18,22,8,2;Promethium|Pm|61|145|lanthanide|2,8,18,23,8,2;Samarium|Sm|62|150.36|lanthanide|2,8,18,24,8,2;Europium|Eu|63|151.96|lanthanide|2,8,18,25,8,2;Gadolinium|Gd|64|157.25|lanthanide|2,8,18,25,9,2;Terbium|Tb|65|158.93|lanthanide|2,8,18,27,8,2;Dysprosium|Dy|66|162.5|lanthanide|2,8,18,28,8,2;Holmium|Ho|67|164.93|lanthanide|2,8,18,29,8,2;Erbium|Er|68|167.26|lanthanide|2,8,18,30,8,2;Thulium|Tm|69|168.93|lanthanide|2,8,18,31,8,2;Ytterbium|Yb|70|173.05|lanthanide|2,8,18,32,8,2;Lutetium|Lu|71|174.97|lanthanide|2,8,18,32,9,2;Hafnium|Hf|72|178.49|transition metal|2,8,18,32,10,2;Tantalum|Ta|73|180.95|transition metal|2,8,18,32,11,2;Tungsten|W|74|183.84|transition metal|2,8,18,32,12,2;Rhenium|Re|75|186.21|transition metal|2,8,18,32,13,2;Osmium|Os|76|190.23|transition metal|2,8,18,32,14,2;Iridium|Ir|77|192.22|transition metal|2,8,18,32,15,2;Platinum|Pt|78|195.08|transition metal|2,8,18,32,17,1;Gold|Au|79|196.97|transition metal|2,8,18,32,18,1;Mercury|Hg|80|200.59|transition metal|2,8,18,32,18,2;Thallium|Tl|81|204.38|post-transition|2,8,18,32,18,3;Lead|Pb|82|207.2|post-transition|2,8,18,32,18,4;Bismuth|Bi|83|208.98|post-transition|2,8,18,32,18,5;Polonium|Po|84|209|post-transition|2,8,18,32,18,6;Astatine|At|85|210|halogen|2,8,18,32,18,7;Radon|Rn|86|222|noble gas|2,8,18,32,18,8;Francium|Fr|87|223|alkali metal|2,8,18,32,18,8,1;Radium|Ra|88|226|alkaline earth|2,8,18,32,18,8,2;Actinium|Ac|89|227|actinide|2,8,18,32,18,9,2;Thorium|Th|90|232.04|actinide|2,8,18,32,18,10,2;Protactinium|Pa|91|231.04|actinide|2,8,18,32,20,9,2;Uranium|U|92|238.03|actinide|2,8,18,32,21,9,2;Neptunium|Np|93|237|actinide|2,8,18,32,22,9,2;Plutonium|Pu|94|244|actinide|2,8,18,32,24,8,2;Americium|Am|95|243|actinide|2,8,18,32,25,8,2;Curium|Cm|96|247|actinide|2,8,18,32,25,9,2;Berkelium|Bk|97|247|actinide|2,8,18,32,27,8,2;Californium|Cf|98|251|actinide|2,8,18,32,28,8,2;Einsteinium|Es|99|252|actinide|2,8,18,32,29,8,2;Fermium|Fm|100|257|actinide|2,8,18,32,30,8,2;Mendelevium|Md|101|258|actinide|2,8,18,32,31,8,2;Nobelium|No|102|259|actinide|2,8,18,32,32,8,2;Lawrencium|Lr|103|266|actinide|2,8,18,32,32,8,3;Rutherfordium|Rf|104|267|transition metal|2,8,18,32,32,10,2;Dubnium|Db|105|268|transition metal|2,8,18,32,32,11,2;Seaborgium|Sg|106|269|transition metal|2,8,18,32,32,12,2;Bohrium|Bh|107|270|transition metal|2,8,18,32,32,13,2;Hassium|Hs|108|277|transition metal|2,8,18,32,32,14,2;Meitnerium|Mt|109|278|transition metal|2,8,18,32,32,15,2;Darmstadtium|Ds|110|281|transition metal|2,8,18,32,32,17,1;Roentgenium|Rg|111|282|transition metal|2,8,18,32,32,18,1;Copernicium|Cn|112|285|transition metal|2,8,18,32,32,18,2;Nihonium|Nh|113|286|post-transition|2,8,18,32,32,18,3;Flerovium|Fl|114|289|post-transition|2,8,18,32,32,18,4;Moscovium|Mc|115|290|post-transition|2,8,18,32,32,18,5;Livermorium|Lv|116|293|post-transition|2,8,18,32,32,18,6;Tennessine|Ts|117|294|halogen|2,8,18,32,32,18,7;Oganesson|Og|118|294|noble gas|2,8,18,32,32,18,8`.split(';').map((entry) => { const [name, symbol, atomicNumber, atomicMass, category, shells] = entry.split('|'); return { name, symbol, atomicNumber: Number(atomicNumber), atomicMass, category, shells: shells.split(',').map(Number) } })

const MOLECULES = [{ name: 'Water', formula: 'H₂O', atoms: ['H', 'O', 'H'] }, { name: 'Carbon dioxide', formula: 'CO₂', atoms: ['O', 'C', 'O'] }, { name: 'Methane', formula: 'CH₄', atoms: ['H', 'C', 'H', 'H', 'H'] }, { name: 'Ammonia', formula: 'NH₃', atoms: ['H', 'N', 'H', 'H'] }]
const PHYSICS_TOPICS = [{ id: 'motion', title: 'Laws of motion', description: 'Change force, mass, acceleration, and gravity to observe motion.', practical: 'Compare how the same force changes objects with different masses.' }, { id: 'electricity', title: 'Electricity', description: 'Explore voltage, resistance, current, and power in a simple circuit.', practical: 'Raise resistance and observe how current changes.' }, { id: 'magnetism', title: 'Magnetism', description: 'Inspect magnetic field strength, distance, and direction.', practical: 'Move a magnet near a field sensor and map the field.' }, { id: 'waves', title: 'Waves', description: 'Adjust frequency, amplitude, and damping to study wave motion.', practical: 'Double frequency and compare wavelength and energy.' }]
const CHEMISTRY_TOPICS = [{ id: 'atomic', title: 'Atomic structure', description: 'Inspect nuclei, electron shells, and periodic patterns.', practical: 'Compare shell populations across a period.' }, { id: 'bonding', title: 'Chemical bonding', description: 'Explore how atoms share or transfer electrons.', practical: 'Compare ionic and covalent bonding using molecule models.' }, { id: 'molecules', title: 'Molecular geometry', description: 'Rotate molecules and compare shapes, bonds, and polarity.', practical: 'Compare linear carbon dioxide with bent water.' }, { id: 'reactions', title: 'Reaction lab', description: 'Model reactants, products, energy, and conservation of atoms.', practical: 'Balance a reaction by changing coefficients, not atoms.' }]

function AtomSimulationCanvas({ element, playing, resetToken }: { element: typeof ELEMENTS[number]; playing: boolean; resetToken: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    if (!canUseWebGL()) {
      const context = canvas.getContext('2d')
      if (!context) return
      let rotation = 0
      let frame = 0
      const draw = () => {
        const width = canvas.clientWidth || 640
        const height = canvas.clientHeight || 420
        const pixelRatio = Math.min(window.devicePixelRatio, 2)
        canvas.width = width * pixelRatio; canvas.height = height * pixelRatio
        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
        context.fillStyle = '#111315'; context.fillRect(0, 0, width, height)
        const centerX = width / 2; const centerY = height / 2
        context.strokeStyle = '#7488a7'; context.lineWidth = 1
        element.shells.forEach((_, index) => { context.beginPath(); context.ellipse(centerX, centerY, 42 + index * 28, 24 + index * 18, index * .12, 0, Math.PI * 2); context.stroke() })
        context.fillStyle = '#db725c'; context.beginPath(); context.arc(centerX, centerY, 28, 0, Math.PI * 2); context.fill()
        element.shells.forEach((count, shellIndex) => { for (let index = 0; index < count; index++) { const angle = index / count * Math.PI * 2 + rotation * (.5 + shellIndex * .08); const radiusX = 42 + shellIndex * 28; const radiusY = 24 + shellIndex * 18; context.fillStyle = '#d4b36a'; context.beginPath(); context.arc(centerX + Math.cos(angle) * radiusX, centerY + Math.sin(angle) * radiusY, 4, 0, Math.PI * 2); context.fill() } })
        context.fillStyle = '#f2f0eb'; context.font = '12px sans-serif'; context.fillText(`${element.name} · ${element.symbol} · ${element.atomicNumber} electrons`, 16, 22)
        if (playing) rotation += .015
        frame = requestAnimationFrame(draw)
      }
      frame = requestAnimationFrame(draw)
      return () => cancelAnimationFrame(frame)
    }
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#111315')
    const camera = new THREE.PerspectiveCamera(38, 1, .1, 100)
    camera.position.set(0, 1.5, 8)
    camera.lookAt(0, 0, 0)
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    const resize = () => { const width = canvas.clientWidth || 640; const height = canvas.clientHeight || 420; renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix() }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    scene.add(new THREE.AmbientLight('#b8c8ff', 2))
    const nucleus = new THREE.Mesh(new THREE.SphereGeometry(.62, 32, 20), new THREE.MeshStandardMaterial({ color: '#db725c', emissive: '#411c25', emissiveIntensity: .45 }))
    scene.add(nucleus)
    const rings: THREE.Mesh[] = []
    const electrons: THREE.Mesh[] = []
    element.shells.forEach((count, shellIndex) => {
      const radius = 1.15 + shellIndex * .52
      const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, .008, 8, 96), new THREE.MeshBasicMaterial({ color: '#7488a7', transparent: true, opacity: .6 }))
      ring.rotation.x = Math.PI / 2 + shellIndex * .12
      scene.add(ring); rings.push(ring)
      for (let i = 0; i < count; i++) { const electron = new THREE.Mesh(new THREE.SphereGeometry(.065, 12, 8), new THREE.MeshStandardMaterial({ color: '#d4b36a', emissive: '#d4b36a', emissiveIntensity: 1.2 })); const angle = i / count * Math.PI * 2; electron.userData = { radius, angle, speed: .35 + shellIndex * .08, tilt: Math.PI / 2 + shellIndex * .12 }; scene.add(electron); electrons.push(electron) }
    })
    let last = performance.now(); let frame = 0
    const animate = (now: number) => { const delta = Math.min((now - last) / 1000, .05); last = now; electrons.forEach((electron) => { const data = electron.userData; if (playing) data.angle += delta * data.speed; const shellX = Math.cos(data.angle) * data.radius; const shellY = Math.sin(data.angle) * data.radius; electron.position.set(shellX, shellY * Math.cos(data.tilt), shellY * Math.sin(data.tilt)) }); nucleus.rotation.y += delta * .2; rings.forEach((ring, index) => { ring.rotation.z += delta * (.06 + index * .01) }); renderer.render(scene, camera); frame = requestAnimationFrame(animate) }
    frame = requestAnimationFrame(animate)
    return () => { cancelAnimationFrame(frame); observer.disconnect(); renderer.dispose(); scene.traverse((object) => { const mesh = object as THREE.Mesh; if (mesh.geometry) mesh.geometry.dispose(); if (Array.isArray(mesh.material)) mesh.material.forEach((material) => material.dispose()); else if (mesh.material) mesh.material.dispose() }) }
  }, [element, playing, resetToken])
  return <canvas ref={canvasRef} className="physics-canvas" aria-label={`${element.name} atom visualization`} />
}

function MoleculeSimulationCanvas({ molecule, playing }: { molecule: typeof MOLECULES[number]; playing: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    if (!canUseWebGL()) {
      const context = canvas.getContext('2d')
      if (!context) return
      let rotation = 0
      let frame = 0
      const draw = () => {
        const width = canvas.clientWidth || 640
        const height = canvas.clientHeight || 300
        const pixelRatio = Math.min(window.devicePixelRatio, 2)
        canvas.width = width * pixelRatio; canvas.height = height * pixelRatio
        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
        context.fillStyle = '#101416'; context.fillRect(0, 0, width, height)
        const positions = molecule.atoms.length === 3 ? [[-80, 0], [0, 0], [80, 0]] : molecule.atoms.length === 4 ? [[-70, 0], [0, 0], [70, 0], [0, -70]] : [[-80, 0], [0, 0], [80, 0], [0, -70], [0, 70]]
        const centerX = width / 2; const centerY = height / 2
        const colors: Record<string, string> = { H: '#f2f2f2', C: '#4e5962', O: '#d86658', N: '#668bdd' }
        positions.slice(1).forEach((position) => { context.strokeStyle = '#aeb8bd'; context.lineWidth = 7; context.beginPath(); context.moveTo(centerX, centerY); context.lineTo(centerX + position[0] * Math.cos(rotation) - position[1] * Math.sin(rotation), centerY + position[0] * Math.sin(rotation) + position[1] * Math.cos(rotation)); context.stroke() })
        molecule.atoms.forEach((symbol, index) => { const position = positions[index]; const x = centerX + position[0] * Math.cos(rotation) - position[1] * Math.sin(rotation); const y = centerY + position[0] * Math.sin(rotation) + position[1] * Math.cos(rotation); context.fillStyle = colors[symbol] || '#c99555'; context.beginPath(); context.arc(x, y, symbol === 'H' ? 16 : 24, 0, Math.PI * 2); context.fill(); context.fillStyle = symbol === 'H' ? '#161616' : '#fff'; context.font = 'bold 12px sans-serif'; context.textAlign = 'center'; context.fillText(symbol, x, y + 4) })
        context.textAlign = 'left'; context.fillStyle = '#f2f0eb'; context.font = '12px sans-serif'; context.fillText(`${molecule.name} · ${molecule.formula}`, 16, 22)
        if (playing) rotation += .006
        frame = requestAnimationFrame(draw)
      }
      frame = requestAnimationFrame(draw)
      return () => cancelAnimationFrame(frame)
    }
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#101416')
    const camera = new THREE.PerspectiveCamera(40, 1, .1, 100)
    camera.position.set(0, 1.2, 7)
    camera.lookAt(0, 0, 0)
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    const resize = () => { const width = canvas.clientWidth || 640; const height = canvas.clientHeight || 300; renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix() }
    resize()
    const observer = new ResizeObserver(resize); observer.observe(canvas)
    scene.add(new THREE.HemisphereLight('#e9efff', '#242018', 2.2))
    const colors: Record<string, string> = { H: '#f2f2f2', C: '#4e5962', O: '#d86658', N: '#668bdd' }
    const positions = molecule.atoms.length === 3 ? [[-1.25, 0, 0], [0, 0, 0], [1.25, 0, 0]] : molecule.atoms.length === 4 ? [[-1.05, 0, 0], [0, 0, 0], [1.05, 0, 0], [0, .95, 0]] : [[-1.1, 0, 0], [0, 0, 0], [1.1, 0, 0], [0, .95, 0], [0, -.95, 0]]
    const atoms: THREE.Mesh[] = []
    molecule.atoms.forEach((symbol, index) => { const atom = new THREE.Mesh(new THREE.SphereGeometry(symbol === 'H' ? .27 : .43, 24, 16), new THREE.MeshStandardMaterial({ color: colors[symbol] || '#c99555', roughness: .3, metalness: .12 })); const position = positions[index]; atom.position.set(position[0], position[1], position[2]); scene.add(atom); atoms.push(atom) })
    const bondMaterial = new THREE.MeshStandardMaterial({ color: '#aeb8bd', roughness: .4, metalness: .35 })
    for (let index = 1; index < atoms.length; index++) { const from = atoms[0].position; const to = atoms[index].position; const vector = new THREE.Vector3().subVectors(to, from); const bond = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, vector.length(), 12), bondMaterial); bond.position.copy(from).add(to).multiplyScalar(.5); bond.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vector.normalize()); scene.add(bond) }
    let frame = 0
    const animate = () => { if (playing) scene.rotation.y += .006; renderer.render(scene, camera); frame = requestAnimationFrame(animate) }
    frame = requestAnimationFrame(animate)
    return () => { cancelAnimationFrame(frame); observer.disconnect(); renderer.dispose(); scene.traverse((object) => { const mesh = object as THREE.Mesh; if (mesh.geometry) mesh.geometry.dispose(); if (Array.isArray(mesh.material)) mesh.material.forEach((material) => material.dispose()); else if (mesh.material) mesh.material.dispose() }) }
  }, [molecule, playing])
  return <canvas ref={canvasRef} className="physics-canvas molecule-canvas" aria-label={`${molecule.name} molecule visualization`} />
}

type TutorName = 'Nira' | 'Elara' | 'Solara'

const TUTORS: Array<{ name: TutorName; mode: string; description: string }> = [
  { name: 'Nira', mode: 'nira', description: 'Balanced guidance' },
  { name: 'Elara', mode: 'elara', description: 'Structured analysis' },
  { name: 'Solara', mode: 'solara', description: 'Idea generation' }
]

function tutorForMode(value: string): TutorName {
  const normalized = value.toLowerCase()
  if (normalized === 'elara' || normalized === 'research') return 'Elara'
  if (normalized === 'solara' || normalized === 'creative') return 'Solara'
  return 'Nira'
}

function modeForTutor(name: TutorName) {
  return TUTORS.find((tutor) => tutor.name === name)?.mode || 'nira'
}

function Icon({ name }: { name: 'menu' | 'sun' | 'moon' | 'mic' | 'stop' | 'plus' | 'home' | 'chat' | 'folder' | 'book' | 'spark' | 'settings' | 'user' | 'logout' | 'search' | 'paperclip' | 'arrow-up' | 'arrow-left' }) {
  const paths = {
    menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></>,
    moon: <path d="M20.4 15.6A8.5 8.5 0 0 1 8.4 3.6 8.5 8.5 0 1 0 20.4 15.6Z" />,
    mic: <><path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z" /><path d="M19 11v1a7 7 0 0 1-14 0v-1M12 19v3M9 22h6" /></>,
    stop: <rect x="7" y="7" width="10" height="10" rx="1" />,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    home: <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9M9 20v-6h6v6" /></>,
    chat: <path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 8.7 8.7 0 0 1-3.4-.7L4 20l1.7-3.8A7.3 7.3 0 0 1 4.5 12 7.5 7.5 0 0 1 12 4.5a7.5 7.5 0 0 1 8 7Z" />,
    folder: <path d="M3 6.5h7l2 2h9v9.8a1.7 1.7 0 0 1-1.7 1.7H4.7A1.7 1.7 0 0 1 3 18.3V6.5Z" />,
    book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Z" /><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /></>,
    spark: <><path d="m12 3 1.3 4.7L18 9l-4.7 1.3L12 15l-1.3-4.7L6 9l4.7-1.3L12 3Z" /><path d="m19 15 .6 2.4L22 18l-2.4.6L19 21l-.6-2.4L16 18l2.4-.6L19 15Z" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.7 1.7-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5v.2h-2.4v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1L8 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H6.7v-2.4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9L8 8.6l1.7-1.7.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5v-.2h2.4v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1 1.7 1.7-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.2V14h-.2a1.7 1.7 0 0 0-1.5 1Z" /></>,
    user: <><circle cx="12" cy="8" r="3" /><path d="M5 21a7 7 0 0 1 14 0" /></>,
    logout: <><path d="M10 5H5v14h5M14 8l4 4-4 4M18 12H9" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.3" /><path d="m16 16 4.5 4.5" /></>,
    paperclip: <path d="m20.5 11.5-7.8 7.8a5 5 0 0 1-7.1-7.1l8.2-8.2a3.4 3.4 0 0 1 4.8 4.8l-8.3 8.3a1.8 1.8 0 0 1-2.5-2.5l7.8-7.8" />,
    'arrow-up': <><path d="M12 19V5M6 11l6-6 6 6" /></>,
    'arrow-left': <><path d="M19 12H5M12 19l-7-7 7-7" /></>
  }
  return <svg className="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

const API_URL = process.env.NEXT_PUBLIC_API_URL
const API_ROOT = normalizeApiBaseUrl(API_URL)

async function readApiJson(response: Response, label: string) {
  const body = await response.text()
  try {
    return JSON.parse(body)
  } catch {
    throw new Error(`${label} returned ${response.status} ${response.headers.get('content-type') || 'non-JSON response'}`)
  }
}

if (!API_URL) {
  throw new Error('Missing NEXT_PUBLIC_API_URL in environment variables')
}

function SearchParamsBridge({ onPrefill }: { onPrefill: (value: string | null) => void }) {
  const search = useSearchParams()
  const prefill = search?.get('prefill') || null

  useEffect(() => {
    onPrefill(prefill)
  }, [onPrefill, prefill])

  return null
}

const FRANCES_NAME = 'Frances'
const FRANCES_DESCRIPTION = "A special girl's name you're mentioning"
const IDENTITY_PHRASE = 'Lumora Cognita was created by Lumora Technologies.'

function normalizeQuestion(s: string) {
  return s
    .trim()
    .toLowerCase()
    .replace(/[\s]+/g, ' ')
    .replace(/[?!.]+$/, '')
}

export default function Page() {
  const { session, loading: authLoading, error: authError, signIn, signUp, signOut, refreshSession } = useSupabaseSession()
  const { account, updateProfile } = useAccountState(session, API_URL!)
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authFormError, setAuthFormError] = useState<string | null>(null)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin')
  const [pendingWorkspaceView, setPendingWorkspaceView] = useState<'projects' | 'plans' | null>(null)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [profileName, setProfileName] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileMessage, setProfileMessage] = useState<string | null>(null)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const previousUserIdRef = useRef<string | null>(null)
  const [theme, setTheme] = useState<string>('light')
  const [showStats, setShowStats] = useState(false)
  const [workspaceView, setWorkspaceView] = useState<'chat' | 'projects' | 'plans' | 'youtube' | 'homework' | 'practice' | 'simulations' | 'resources' | 'wikipedia'>('chat')
  const [projects, setProjects] = useState<Project[]>([])
  const [studyPlans, setStudyPlans] = useState<StudyPlan[]>([])
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [selectedPlan, setSelectedPlan] = useState<StudyPlan | null>(null)
  const [showProjectForm, setShowProjectForm] = useState(false)
  const [showProjectEditForm, setShowProjectEditForm] = useState(false)
  const [showPlanForm, setShowPlanForm] = useState(false)
  const [projectTitle, setProjectTitle] = useState('')
  const [projectDescription, setProjectDescription] = useState('')
  const [projectSubject, setProjectSubject] = useState('')
  const [projectGoal, setProjectGoal] = useState('')
  const [projectDeadline, setProjectDeadline] = useState('')
  const [projectStatus, setProjectStatus] = useState('active')
  const [projectProgress, setProjectProgress] = useState('0')
  const [projectEditTitle, setProjectEditTitle] = useState('')
  const [projectEditDescription, setProjectEditDescription] = useState('')
  const [projectEditSubject, setProjectEditSubject] = useState('')
  const [projectEditGoal, setProjectEditGoal] = useState('')
  const [projectEditDeadline, setProjectEditDeadline] = useState('')
  const [projectEditStatus, setProjectEditStatus] = useState('active')
  const [projectEditProgress, setProjectEditProgress] = useState('0')
  const [projectEditLoading, setProjectEditLoading] = useState(false)
  const [projectLoading, setProjectLoading] = useState(false)
  const [studyPlanLoading, setStudyPlanLoading] = useState(false)
  const [projectTab, setProjectTab] = useState<'overview' | 'chats' | 'study-plan' | 'resources' | 'progress' | 'files'>('overview')
  const [activeProjectContext, setActiveProjectContext] = useState<ProjectContext | null>(null)
  const [planTitle, setPlanTitle] = useState('')
  const [planObjective, setPlanObjective] = useState('')
  const [planSubject, setPlanSubject] = useState('')
  const [planLevel, setPlanLevel] = useState('beginner')
  const [planTopics, setPlanTopics] = useState('')
  const [planTime, setPlanTime] = useState('')
  const [planDeadline, setPlanDeadline] = useState('')
  const [planProjectId, setPlanProjectId] = useState<string | undefined>(undefined)
  const [workspaceError, setWorkspaceError] = useState<string | null>(null)
  const [youtubeQuery, setYoutubeQuery] = useState('')
  const [youtubeVideos, setYoutubeVideos] = useState<YouTubeVideo[]>([])
  const [selectedVideo, setSelectedVideo] = useState<YouTubeVideo | null>(null)
  const [youtubePlayerError, setYoutubePlayerError] = useState(false)
  const [youtubeLoading, setYoutubeLoading] = useState(false)
  const [youtubeMessage, setYoutubeMessage] = useState<string | null>(null)
    const [wikipediaQuery, setWikipediaQuery] = useState('')
    const [wikipediaArticles, setWikipediaArticles] = useState<WikipediaArticle[]>([])
    const [wikipediaLoading, setWikipediaLoading] = useState(false)
    const [wikipediaMessage, setWikipediaMessage] = useState<string | null>(null)
  const [pendingAttachment, setPendingAttachment] = useState<PendingAttachment | null>(null)
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false)
  const [attachmentError, setAttachmentError] = useState<string | null>(null)
  const [homeworkType, setHomeworkType] = useState('Explain and guide')
  const [homeworkPrompt, setHomeworkPrompt] = useState('')
  const [practiceKind, setPracticeKind] = useState<PracticeKind>('quiz')
  const [practicePlanId, setPracticePlanId] = useState('')
  const [practicePacket, setPracticePacket] = useState<PracticePacket | null>(null)
  const [practiceLoading, setPracticeLoading] = useState(false)
  const [practiceError, setPracticeError] = useState<string | null>(null)
  const [practiceAnswers, setPracticeAnswers] = useState<Record<string, string>>({})
  const [practiceChecked, setPracticeChecked] = useState<Record<string, boolean>>({})
  const [simulationPlaying, setSimulationPlaying] = useState(false)
  const [activeExperimentId, setActiveExperimentId] = useState('projectile')
  const [experimentValues, setExperimentValues] = useState<Record<string, number>>(() => Object.fromEntries(EXPERIMENTS[0].params.map((param) => [param.key, param.value])))
  const [experimentReadouts, setExperimentReadouts] = useState<Array<{ label: string; value: string }>>([])
  const [experimentStepSignal, setExperimentStepSignal] = useState(0)
  const [experimentResetSignal, setExperimentResetSignal] = useState(0)
  const [experimentFullscreen, setExperimentFullscreen] = useState(false)
  const [simulationResetToken, setSimulationResetToken] = useState(0)
  const [simulationAcceleration, setSimulationAcceleration] = useState(2)
  const [simulationVelocity, setSimulationVelocity] = useState(2)
  const [simulationMass, setSimulationMass] = useState(1)
  const [simulationGravity, setSimulationGravity] = useState(9.8)
  const [electricVoltage, setElectricVoltage] = useState(12)
  const [electricResistance, setElectricResistance] = useState(6)
  const [circuitClosed, setCircuitClosed] = useState(true)
  const [magneticStrength, setMagneticStrength] = useState(5)
  const [magneticDistance, setMagneticDistance] = useState(2)
  const [simulationLab, setSimulationLab] = useState<'physics' | 'chemistry'>('physics')
  const [selectedLabTopic, setSelectedLabTopic] = useState('motion')
  const [selectedElementNumber, setSelectedElementNumber] = useState(1)
  const [selectedMolecule, setSelectedMolecule] = useState(0)
  const [atomPlaying, setAtomPlaying] = useState(true)

  const defaultStats = { totalMessages: 0, responses: 0, understood: 0, subjects: {} as Record<string, { messages: number; understood: number }> }
  const [stats, setStats] = useState(() => defaultStats)
  const [messages, setMessages] = useState<Msg[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const chatRequestInFlightRef = useRef(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [conversationSearch, setConversationSearch] = useState('')
  const [conversationsLoading, setConversationsLoading] = useState(false)
  const [conversationError, setConversationError] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [mode, setMode] = useState<string>('chat')
  const [activeMode, setActiveMode] = useState<string>('nira')
  const [subject, setSubject] = useState<string>('mathematics')
  const [isThinking, setIsThinking] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const lastMessageRef = useRef<HTMLDivElement | null>(null)
  const recognitionRef = useRef<any>(null)
  const cameraInputRef = useRef<HTMLInputElement | null>(null)
  const imageInputRef = useRef<HTMLInputElement | null>(null)
  const documentInputRef = useRef<HTMLInputElement | null>(null)
  const [micState, setMicState] = useState<'idle'|'listening'|'processing'|'error'>('idle')
  const [micError, setMicError] = useState<string | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const dataArrayRef = useRef<Uint8Array | null>(null)
  const animationRef = useRef<number | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const barsRef = useRef<HTMLDivElement | null>(null)
  const preRecordingInputRef = useRef<string>('')
  const lastInterimRef = useRef<string>('')
  const voiceTimingRef = useRef<Record<string, number>>({})
  function markTiming(name: string) {
    try {
      if (!voiceTimingRef.current) voiceTimingRef.current = {}
      voiceTimingRef.current[name] = Date.now()
      console.log('[voice]', name, voiceTimingRef.current[name])
    } catch (e) {}
  }
  // Speech buffering and VAD refs
  const finalTranscriptRef = useRef<string>('')
  const interimTranscriptRef = useRef<string>('')
  const listeningActiveRef = useRef<boolean>(false)
  const userInitiatedStopRef = useRef<boolean>(false)
  const vadIntervalRef = useRef<number | null>(null)
  const lastVoiceTimeRef = useRef<number>(0)
  const SILENCE_TIMEOUT_MS = 3500 // 2.5-4s recommended
  const VAD_CHECK_INTERVAL_MS = 150
  const VAD_AMPLITUDE_THRESHOLD = 0.012
  const RESTART_DELAY_MS = 300

  function dedupeAppendFinal(newPart: string) {
    try {
      const np = (newPart || '').trim()
      if (!np) return
      const existing = (finalTranscriptRef.current || '').trim()
      if (!existing) { finalTranscriptRef.current = np; return }
      const exWords = existing.split(/\s+/).filter(Boolean)
      const newWords = np.split(/\s+/).filter(Boolean)
      const maxCheck = Math.min(exWords.length, newWords.length, 6)
      let overlap = 0
      for (let k = maxCheck; k > 0; k--) {
        const exSuffix = exWords.slice(exWords.length - k).join(' ').toLowerCase()
        const newPrefix = newWords.slice(0, k).join(' ').toLowerCase()
        if (exSuffix === newPrefix) { overlap = k; break }
      }
      const toAppend = newWords.slice(overlap).join(' ')
      finalTranscriptRef.current = (existing + (toAppend ? ' ' + toAppend : '')).trim()
    } catch (e) {}
  }

  function startVADMonitor() {
    if (vadIntervalRef.current) return
    lastVoiceTimeRef.current = Date.now()
    vadIntervalRef.current = window.setInterval(() => {
      try {
        const analyser = analyserRef.current
        if (!analyser) return
        const buf = new Uint8Array(analyser.fftSize || 2048)
        analyser.getByteTimeDomainData(buf)
        let sum = 0
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128
          sum += v * v
        }
        const rms = Math.sqrt(sum / buf.length)
        if (rms > VAD_AMPLITUDE_THRESHOLD) {
          lastVoiceTimeRef.current = Date.now()
          try { if (!voiceTimingRef.current.speechDetected) markTiming('speechDetected') } catch (e) {}
        } else {
          if (listeningActiveRef.current && Date.now() - lastVoiceTimeRef.current > SILENCE_TIMEOUT_MS) {
            // considered silence — gracefully stop recognition to finalize
            userInitiatedStopRef.current = true
            try { recognitionRef.current && recognitionRef.current.stop() } catch (e) {}
          }
        }
      } catch (e) {}
    }, VAD_CHECK_INTERVAL_MS)
  }

  function stopVADMonitor() {
    if (vadIntervalRef.current) { clearInterval(vadIntervalRef.current); vadIntervalRef.current = null }
  }
  async function sendVoiceMetrics(extra: Record<string, any> = {}) {
    try {
      if (!API_URL) return
      if (!session?.access_token) return
      if (!voiceTimingRef.current || Object.keys(voiceTimingRef.current).length === 0) return
      const payload = { client: 'web', metrics: voiceTimingRef.current, extra }
      // best-effort POST; do not await
      authenticatedFetch(`${API_URL}/admin/voice-metrics`, session, {
        method: 'POST',
        body: JSON.stringify(payload)
      }).catch((err) => console.warn('voice metrics post failed', err))
    } catch (e) { console.warn('sendVoiceMetrics failed', e) }
  }
  const [prefill, setPrefill] = useState<string | null>(null)
  const [envError, setEnvError] = useState<string | null>(null)

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && API_URL) {
        try {
          const u = new URL(API_URL)
          const isLocal = u.hostname === 'localhost' || u.hostname === '127.0.0.1'
          if (isLocal && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
            const msg = 'This build was exported with NEXT_PUBLIC_API_URL set to a localhost address. Rebuild with a production backend URL to enable API calls.'
            console.error('[env-mismatch]', msg, API_URL)
            setEnvError(msg)
          }
        } catch (e) {
          // ignore URL parse errors
        }
      }
    } catch (e) {}
  }, [])

  useEffect(() => {
    async function load() {
      if (!session) {
        try { localStorage.removeItem('lumora_anonymous_messages') } catch {}
        setMessages([])
        return
      }
      try {
        const res = await authenticatedFetch(`${API_URL!}/history`, session)
        const data = await res.json()
        if (data?.ok && Array.isArray(data.history) && !chatRequestInFlightRef.current) {
          setConversationId(data.conversationId || null)
          setMessages(data.history.map((m: any, index: number) => ({ role: m.role, text: m.text, id: `h-${data.conversationId || 'latest'}-${index}` })))
        }
      } catch (err) {
        console.warn('failed to load history', err)
      }

      const pre = prefill
      if (pre) {
        const decodedPrefill = decodeURIComponent(pre)
        setInput(decodedPrefill)
        setTimeout(() => {
          handleSend(decodedPrefill)
        }, 250)
      }
    }
    load()
  }, [prefill, session])

  useEffect(() => {
    async function loadConversations() {
      if (!session) {
        setConversations([])
        setConversationError(null)
        return
      }
      setConversationsLoading(true)
      setConversationError(null)
      try {
        const query = conversationSearch.trim() ? `?search=${encodeURIComponent(conversationSearch.trim())}` : ''
        const res = await authenticatedFetch(`${API_URL!}/conversations${query}`, session)
        const data = await res.json()
        if (!res.ok || !data?.ok) throw new Error(data?.error || 'Conversations unavailable')
        if (Array.isArray(data.conversations)) setConversations(data.conversations)
      } catch (err) {
        console.warn('failed to load conversations', err)
        setConversationError(err instanceof Error ? err.message : 'Conversations unavailable')
      } finally {
        setConversationsLoading(false)
      }
    }
    loadConversations()
  }, [conversationSearch, session?.user.id, session?.access_token])

  useEffect(() => {
    if (!session) {
        setProjects([])
        setStudyPlans([])
        setProjectLoading(false)
        setStudyPlanLoading(false)
      return
    }

    setProjectLoading(true)
    setStudyPlanLoading(true)
    Promise.all([
      authenticatedFetch(buildWorkspaceApiUrl(API_URL, '/projects'), session).then(async (res) => {
        const data = await readApiJson(res, 'Projects endpoint')
        if (!res.ok) throw new Error(data?.error || 'Projects unavailable')
        return data.projects || []
      }),
      authenticatedFetch(buildWorkspaceApiUrl(API_URL, '/study-plans'), session).then(async (res) => {
        const data = await readApiJson(res, 'Study Plans endpoint')
        if (!res.ok) throw new Error(data?.error || 'Study plans unavailable')
        return data.studyPlans || []
      })
    ]).then(([nextProjects, nextPlans]) => {
      setProjects(nextProjects)
      setStudyPlans(nextPlans)
      if (selectedProject) {
        const projectMatch = nextProjects.find((project: Project) => project.id === selectedProject.id)
        if (projectMatch) {
          const currentPlan = nextPlans.find((plan: StudyPlan) => plan.project_id === projectMatch.id)
          setActiveProjectContext({
            projectId: projectMatch.id,
            projectName: projectMatch.title,
            subject: projectMatch.subject || currentPlan?.subject,
            studyPlanId: currentPlan?.id || null
          })
        }
      }
    }).catch((error) => {
      setWorkspaceError(error instanceof Error ? error.message : 'Workspace data unavailable')
    }).finally(() => {
      setProjectLoading(false)
      setStudyPlanLoading(false)
    })
  }, [session])

  useEffect(() => {
    const nextUserId = session?.user.id || null
    if (previousUserIdRef.current !== null && previousUserIdRef.current !== nextUserId) {
      setMessages([])
      setConversationId(null)
      setInput('')
      setStats(defaultStats)
    }
    previousUserIdRef.current = nextUserId
  }, [session?.user.id])

  useEffect(() => {
    try { localStorage.setItem('lumora_mode', activeMode) } catch {}
  }, [activeMode])

  useEffect(() => {
    if (!session?.user.id) {
      setStats(defaultStats)
      return
    }
    try {
      const s = localStorage.getItem(userScopedStorageKey('lumora_stats', session.user.id)!)
      if (s) setStats(JSON.parse(s))
      else setStats(defaultStats)
    } catch (e) {}
    try {
      document.documentElement.classList.toggle('light-theme', theme === 'light')
    } catch (e) {}
  }, [session?.user.id])

  useEffect(() => {
    try { localStorage.setItem('lumora_theme', theme); document.documentElement.classList.toggle('light-theme', theme === 'light') } catch {}
  }, [theme])

  function isComplexResponse(text: string) {
    if (!text) return false
    const t = text.trim()
    if (t.length > 350) return true
    if (/```/.test(t)) return true
    if (/^\d+\./m.test(t)) return true
    if (/\bstep[s]?\b/i.test(t)) return true
    return false
  }

  function maybeAskUnderstandingCheck(originalMsg: Msg, isEdu: boolean) {
    try {
      if (!isEdu) return
      if (activeMode !== 'research' && originalMsg?.mode !== 'research') return
      const COOLDOWN_MS = 1000 * 60 * 5
      const last = (stats && (stats as any).lastCheckAt) || 0
      if (last && last > Date.now() - COOLDOWN_MS) return
      if (originalMsg && /\?\s*$/.test((originalMsg.text || '').trim())) return
      const PROB = 2 / 9
      if (Math.random() > PROB) return
      const checkText = 'Would you like a brief recap or a deeper explanation on any point?'
      const checkMsg: Msg = { role: 'assistant', text: checkText, id: `check-${Date.now()}`, subject: originalMsg.subject, mode: originalMsg.mode }
      setMessages((m) => [...m, checkMsg])
      saveStats((prev: any) => { const next = { ...prev }; next.checksAsked = (next.checksAsked || 0) + 1; next.lastCheckAt = Date.now(); return next })
    } catch (e) {}
  }

  useEffect(() => {
    if (lastMessageRef.current) {
      lastMessageRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [messages, isThinking])

  const ensureRecognition = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      recognitionRef.current = null
      return null
    }

    if (recognitionRef.current) return recognitionRef.current

    try {
      const r = new SpeechRecognition()
      r.lang = 'en-US'
      r.interimResults = true
      r.continuous = true
      r.maxAlternatives = 1

      r.onstart = () => {
        setIsRecording(true)
        setMicState('listening')
        setMicError(null)
        listeningActiveRef.current = true
        userInitiatedStopRef.current = false
        lastVoiceTimeRef.current = Date.now()
        try { voiceTimingRef.current = {}; markTiming('micStart'); voiceTimingRef.current.sessionId = Date.now() } catch (e) {}
      }

      r.onresult = (ev: any) => {
        try {
          let interim = ''
          for (let i = ev.resultIndex; i < ev.results.length; ++i) {
            const res = ev.results[i]
            const t = (res[0] && res[0].transcript) || ''
            if (res.isFinal) {
              dedupeAppendFinal(t)
            } else {
              interim += (interim ? ' ' : '') + t
            }
          }
          interim = interim.trim()
          interimTranscriptRef.current = interim
          lastInterimRef.current = interim
          try { if (interim && !voiceTimingRef.current.firstInterim) markTiming('firstInterim') } catch (e) {}
          const base = (preRecordingInputRef.current || '').trim()
          const combined = [base, finalTranscriptRef.current, interimTranscriptRef.current].filter(Boolean).join(' ')
          setInput(combined)
        } catch (e) {}
      }

      r.onend = () => {
        try {
          if (userInitiatedStopRef.current) {
            setIsRecording(false)
            setMicState('processing')
            stopVADMonitor()
            stopAnalyser()
            if (streamRef.current) { try { streamRef.current.getTracks().forEach((t: any) => t.stop()) } catch (_) {} streamRef.current = null }
            try { markTiming('transcriptReady') } catch (e) {}
            const base = (preRecordingInputRef.current || '').trim()
            const finalText = [base, finalTranscriptRef.current, interimTranscriptRef.current].filter(Boolean).join(' ').trim()
            setInput(finalText)
            userInitiatedStopRef.current = false
            listeningActiveRef.current = false
            setTimeout(() => setMicState('idle'), 600)
            return
          }
        } catch (e) {}

        if (listeningActiveRef.current) {
          setTimeout(() => {
            try { recognitionRef.current && recognitionRef.current.start() } catch (e) { console.warn('restart failed', e) }
          }, RESTART_DELAY_MS)
        } else {
          setIsRecording(false)
          setMicState('idle')
        }
      }

      r.onerror = (e: any) => {
        console.warn('Speech recognition error', e)
        setMicError(e?.message || e?.error || 'Recognition error')
        setMicState('error')
        setIsRecording(false)
        stopVADMonitor()
        stopAnalyser()
      }

      recognitionRef.current = r
      return r
    } catch (e) {
      recognitionRef.current = null
      return null
    }
  }, [])

  useEffect(() => {
    ensureRecognition()
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
      if (vadIntervalRef.current) { clearInterval(vadIntervalRef.current); vadIntervalRef.current = null }
      if (streamRef.current) { try { streamRef.current.getTracks().forEach((t: any) => t.stop()) } catch (_) {} streamRef.current = null }
      if (audioContextRef.current) { try { audioContextRef.current.close() } catch (_) {} audioContextRef.current = null }
    }
  }, [ensureRecognition])

  // Audio analyser + waveform helpers
  function startAnalyser(stream: MediaStream) {
    try {
      if (audioContextRef.current || analyserRef.current) return
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext
      if (!AudioCtx) return
      const ac = new AudioCtx()
      audioContextRef.current = ac
      const source = ac.createMediaStreamSource(stream)
      const analyser = ac.createAnalyser()
      analyser.fftSize = 2048
      source.connect(analyser)
      analyserRef.current = analyser
      const bufferLength = analyser.frequencyBinCount
      dataArrayRef.current = new Uint8Array(bufferLength)

      const draw = () => {
        if (!analyserRef.current || !dataArrayRef.current || !barsRef.current) {
          animationRef.current = requestAnimationFrame(draw)
          return
        }
        // TS DOM typings can mismatch between ArrayBuffer/SharedArrayBuffer across TS versions.
        // The runtime value is a Uint8Array backed by an ArrayBuffer; ignore the strict check here.
        // @ts-ignore
        analyserRef.current.getByteTimeDomainData(dataArrayRef.current as any)
        const bars = Array.from(barsRef.current.children) as HTMLElement[]
        const step = Math.max(1, Math.floor(dataArrayRef.current.length / bars.length))
        for (let i = 0; i < bars.length; i++) {
          let sum = 0
          for (let j = 0; j < step; j++) {
            sum += Math.abs(dataArrayRef.current[i * step + j] - 128)
          }
          const avg = sum / step
          const height = Math.max(4, Math.min(40, (avg / 128) * 40))
          bars[i].style.height = `${height}px`
          bars[i].style.opacity = `${0.3 + (height / 40) * 0.7}`
        }
        animationRef.current = requestAnimationFrame(draw)
      }
      animationRef.current = requestAnimationFrame(draw)
    } catch (e) {
      console.warn('startAnalyser failed', e)
    }
  }

  function stopAnalyser() {
    stopVADMonitor()
    if (animationRef.current) { cancelAnimationFrame(animationRef.current); animationRef.current = null }
    if (analyserRef.current) { try { analyserRef.current.disconnect() } catch (e) {} analyserRef.current = null }
    if (audioContextRef.current) { try { audioContextRef.current.close() } catch (e) {} audioContextRef.current = null }
    dataArrayRef.current = null
  }

  const startRecording = useCallback(async () => {
    if (isRecording) return

    const recognition = ensureRecognition()
    if (!recognition) {
      setMicError('Speech recognition not supported in this browser')
      setMicState('error')
      return
    }

    setMicError(null)
    preRecordingInputRef.current = input || ''
    finalTranscriptRef.current = ''
    interimTranscriptRef.current = ''
    userInitiatedStopRef.current = false
    listeningActiveRef.current = true

    try {
      if (!streamRef.current) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        streamRef.current = stream
      }
      if (!audioContextRef.current || !analyserRef.current) {
        startAnalyser(streamRef.current!)
      }
      startVADMonitor()
      try { recognition.start() } catch (e) { console.warn('recognition start skipped', e) }
      setIsRecording(true)
      setMicState('listening')
    } catch (err) {
      console.warn('startRecording failed', err)
      setMicError((err as any)?.message || 'Microphone access denied')
      setMicState('error')
      setIsRecording(false)
      if (streamRef.current) { try { streamRef.current.getTracks().forEach((t) => t.stop()) } catch (_) {} streamRef.current = null }
      stopAnalyser()
    }
  }, [ensureRecognition, input, isRecording])

  const stopRecording = useCallback(() => {
    if (!recognitionRef.current) return
    userInitiatedStopRef.current = true
    listeningActiveRef.current = false
    try {
      recognitionRef.current.stop()
    } catch (e) {
      console.warn('stopRecording failed', e)
    }
  }, [])

  function interceptSpecialQuestions(text: string): string | null {
    const n = normalizeQuestion(text)
    if (['who created you', 'who made you', 'who is your developer'].includes(n)) {
      return IDENTITY_PHRASE
    }
    if (n === 'who is frances' || n === `who is ${FRANCES_NAME.toLowerCase()}`) {
      return FRANCES_DESCRIPTION
    }
    if (n.includes('who is bastoni')) {
      return 'He is my maker.'
    }
    return null
  }

  function renderParsedText(text: string) {
    if (!text) return null
    const lines = text.replace(/\r/g, '').split('\n')
    const nodes: React.ReactNode[] = []
    const renderInlineText = (value: string) => {
      const parts = value.split(/(\*\*[^*]+\*\*|__[^_]+__)/g)
      return parts.map((part, idx) => {
        const match = part.match(/^(?:\*\*|__)(.*?)(?:\*\*|__)$/)
        return match ? <strong key={idx}>{match[1]}</strong> : part
      })
    }
    const isTableRow = (value: string) => /^\s*\|.+\|\s*$/.test(value)
    const splitTableRow = (value: string) => value.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim())
    const isTableDivider = (value: string) => splitTableRow(value).every((cell) => /^:?-{3,}:?$/.test(cell))
    let i = 0
    while (i < lines.length) {
      const raw = lines[i]
      const line = raw.trim()
      if (/^```/.test(line)) {
        const codeLines: string[] = []
        i++
        while (i < lines.length && !/^```/.test(lines[i].trim())) {
          codeLines.push(lines[i])
          i++
        }
        if (i < lines.length) i++
        nodes.push(<pre key={`code-${i}`}><code>{codeLines.join('\n')}</code></pre>)
        continue
      }
      if (line === '') {
        nodes.push(<div key={`br-${i}`} className="message-break" />)
        i++
        continue
      }
      if (isTableRow(line) && i + 1 < lines.length && isTableDivider(lines[i + 1].trim())) {
        const headers = splitTableRow(line)
        const rows: string[][] = []
        i += 2
        while (i < lines.length && isTableRow(lines[i])) {
          rows.push(splitTableRow(lines[i]))
          i++
        }
        nodes.push(
          <div key={`table-${i}`} className="message-table-wrap">
            <table className="message-table">
              <thead>
                <tr>{headers.map((header, idx) => <th key={idx}>{renderInlineText(header)}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map((row, rowIdx) => (
                  <tr key={rowIdx}>
                    {headers.map((_, cellIdx) => <td key={cellIdx}>{renderInlineText(row[cellIdx] || '')}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
        continue
      }
      if (/^#{1,3}\s+/.test(line) || (/^[A-Z][^.!?]{2,60}:$/.test(line) && !/^(Step|Example)\s+\d/i.test(line))) {
        nodes.push(<h3 key={`h-${i}`}>{renderInlineText(line.replace(/^#{1,3}\s+/, '').replace(/:$/, ''))}</h3>)
        i++
        continue
      }
      if (/^[-\*\+]\s+/.test(line)) {
        const items: string[] = []
        while (i < lines.length && /^[-\*\+]\s+/.test(lines[i].trim())) {
          items.push(lines[i].trim().replace(/^[-\*\+]\s+/, ''))
          i++
        }
        nodes.push(
          <ul key={`ul-${i}`}>
            {items.map((it, idx) => (
              <li key={idx} className="whitespace-pre-line">
                {renderInlineText(it)}
              </li>
            ))}
          </ul>
        )
        continue
      }
      if (/^\d+[\.)]\s+/.test(line)) {
        const items: string[] = []
        while (i < lines.length && /^\d+[\.)]\s+/.test(lines[i].trim())) {
          items.push(lines[i].trim().replace(/^\d+[\.)]\s+/, ''))
          i++
        }
        nodes.push(
          <ol key={`ol-${i}`}>
            {items.map((it, idx) => (
              <li key={idx} className="whitespace-pre-line">
                {renderInlineText(it)}
              </li>
            ))}
          </ol>
        )
        continue
      }
      const paraLines: string[] = []
      while (
        i < lines.length &&
        lines[i].trim() !== '' &&
        !/^[-\*\+]\s+/.test(lines[i].trim()) &&
        !/^\d+[\.)]\s+/.test(lines[i].trim())
      ) {
        paraLines.push(lines[i])
        i++
      }
      const paraText = paraLines.join(' ').trim()
      nodes.push(
        <p key={`p-${i}`} className="whitespace-pre-line">
          {renderInlineText(paraText)}
        </p>
      )
    }
    return <div>{nodes}</div>
  }

  function selectAttachment(file: File | undefined) {
    if (!file) return
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    if (!allowed.includes(file.type)) { setAttachmentError("That file type isn't supported."); return }
    if (file.size > 15 * 1024 * 1024) { setAttachmentError('That file is too large to process.'); return }
    if (pendingAttachment?.previewUrl) URL.revokeObjectURL(pendingAttachment.previewUrl)
    setAttachmentError(null)
    setAttachmentMenuOpen(false)
    setPendingAttachment({ file, kind: file.type.startsWith('image/') ? 'image' : 'document', previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null })
  }

  function removeAttachment() {
    if (pendingAttachment?.previewUrl) URL.revokeObjectURL(pendingAttachment.previewUrl)
    setPendingAttachment(null)
    setAttachmentError(null)
  }

  function handleAttachmentInput(event: React.ChangeEvent<HTMLInputElement>) {
    selectAttachment(event.target.files?.[0])
    event.target.value = ''
  }

  async function handleSend(overrideText?: string, options?: { displayText?: string }) {
    if (authLoading) return
    const text = (overrideText ?? input).trim()
    if (!text && !pendingAttachment) return
    const norm = text.toLowerCase().trim()
    const blockedPos = ['i understood', 'i understand', 'understood', 'got it', 'i got it']
    const blockedNeg = ["i didn't understand", 'i didnt understand', "didn't understand", 'didnt understand', "i don't understand", 'i do not understand', 'did not understand']
    if (blockedPos.includes(norm) || blockedNeg.includes(norm)) {
      setInput('')
      return
    }
    if (isThinking) return

    setInput('')
    chatRequestInFlightRef.current = true
    const displayText = (options?.displayText || text || `Attachment: ${pendingAttachment?.file.name || 'uploaded file'}`).trim()
    const messageStamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const userMsg: Msg = { role: 'user', text: displayText, id: `u-${messageStamp}`, subject, mode: activeMode }
    setMessages((m) => [...m, userMsg])
    try { setStats((s) => { const ns = { ...s, totalMessages: s.totalMessages + 1 }; const key = userScopedStorageKey('lumora_stats', session?.user.id); if (key) localStorage.setItem(key, JSON.stringify(ns)); return ns }) } catch {}

    const local = pendingAttachment ? null : interceptSpecialQuestions(text)
    if (local) {
      const assistantLocal: Msg = { role: 'assistant', text: local, id: `a-local-${messageStamp}`, subject, mode: activeMode }
      setMessages((m) => [...m, assistantLocal])
      const isEduLocal = isComplexResponse(assistantLocal.text) || activeMode === 'research'
      recordResponseReceived(assistantLocal.id!, subject, assistantLocal.text, isEduLocal)
      maybeAskUnderstandingCheck(assistantLocal, isEduLocal)
      chatRequestInFlightRef.current = false
      return
    }

    const learningMatch = pendingAttachment ? null : text.match(/(?:want to learn|learn|study)\s+([a-z0-9+#.-]+)/i)
    if (learningMatch) {
      const topic = learningMatch[1]
      const assistantMsg: Msg = { role: 'assistant', text: `Let's set up a learning project for ${topic}. Add a goal and a few topics when you are ready.`, id: `a-project-${messageStamp}`, subject: topic, mode: activeMode }
      setMessages((m) => [...m, assistantMsg])
      setProjectTitle(`Learn ${topic.charAt(0).toUpperCase() + topic.slice(1)}`)
      setProjectSubject(topic)
      setProjectDescription(`Build confidence with ${topic}.`)
      setWorkspaceView('projects')
      setShowProjectForm(true)
      chatRequestInFlightRef.current = false
      return
    }

    setIsThinking(true)
    try {
      const requestSession = session ? (await refreshSession()) || session : null
      try { markTiming('requestSent') } catch (e) {}
      const requestSubject = activeProjectContext?.subject || subject
      const projectContextPayload = activeProjectContext ? {
        projectId: activeProjectContext.projectId,
        projectName: activeProjectContext.projectName,
        subject: requestSubject,
        studyPlanId: activeProjectContext.studyPlanId || null
      } : undefined
      const attachment = pendingAttachment
      const isMultimodal = Boolean(attachment)
      const endpoint = isMultimodal ? `${API_URL!}/multimodal` : API_URL!
      const body = isMultimodal ? (() => { const form = new FormData(); form.append('attachment', attachment!.file); form.append('message', text); form.append('clientMessage', displayText); form.append('conversationId', conversationId || ''); form.append('mode', activeMode); form.append('projectContext', JSON.stringify(projectContextPayload || {})); return form })() : JSON.stringify({ message: text, clientMessage: displayText, conversationId, mode: activeMode, subject: requestSubject, skill: computeSkillForSubject(requestSubject), projectContext: projectContextPayload })
      const res = requestSession
        ? await authenticatedFetch(endpoint, requestSession, { method: 'POST', body })
        : await fetch(endpoint, { method: 'POST', ...(isMultimodal ? {} : { headers: { 'Content-Type': 'application/json' } }), body })
      const data = await res.json()
      try { markTiming('responseReceived') } catch (e) {}
      try { sendVoiceMetrics({ textLength: displayText.length, subject, mode: activeMode }) } catch (e) {}
      if (data?.ok) {
        if (requestSession && data.conversationId) {
          setConversationId(data.conversationId)
        }
        const assistantText = typeof data.answer === 'string' ? data.answer : ''
        const assistantMsg: Msg = { role: 'assistant', text: assistantText, id: `a-${messageStamp}`, subject, mode: activeMode }
        setMessages((m) => [...m, assistantMsg])
        setMode(data.mode || activeMode || 'chat')
        const isEdu = isComplexResponse(assistantText) || activeMode === 'research'
        recordResponseReceived(assistantMsg.id!, subject, assistantText, isEdu)
        maybeAskUnderstandingCheck(assistantMsg, isEdu)
        if (requestSession && data.conversationId) {
          void authenticatedFetch(`${API_URL!}/conversations`, requestSession)
            .then((conversationsResponse) => conversationsResponse.json())
            .then((conversationsData) => {
              if (conversationsData?.ok && Array.isArray(conversationsData.conversations)) setConversations(conversationsData.conversations)
            })
            .catch(() => undefined)
        }
      } else {
        const assistantErr: Msg = { role: 'assistant', text: data?.error || 'Sorry, something went wrong.', id: `a-${messageStamp}`, subject, mode: activeMode }
        setMessages((m) => [...m, assistantErr])
      }
      if (attachment) removeAttachment()
    } catch (err) {
      console.error(err)
      setMessages((m) => [...m, { role: 'assistant', text: err instanceof ApiAuthenticationError ? err.message : err instanceof AuthenticationRequiredError ? err.message : 'I could not reach Cognita. Please try again.' }])
    } finally {
      setIsThinking(false)
      chatRequestInFlightRef.current = false
    }
  }

  function saveStats(ns: any) {
    try {
      const key = userScopedStorageKey('lumora_stats', session?.user.id)
      if (key) localStorage.setItem(key, JSON.stringify(ns))
    } catch {}
    setStats(ns)
  }

  function recordResponseReceived(messageId: string, subj: string, text?: string, isEdu?: boolean) {
    try {
      saveStats((prev: any) => {
        const next = { ...prev }
        next.responses = (next.responses || 0) + 1
        if (!next.subjects) next.subjects = {}
        if (!next.subjects[subj]) next.subjects[subj] = { messages: 0, understood: 0 }
        next.subjects[subj].messages = (next.subjects[subj].messages || 0) + 1
        if (isEdu || isComplexResponse(text || '')) next.eduResponses = (next.eduResponses || 0) + 1
        return next
      })
    } catch (e) {}
  }

  function computeSkillForSubject(subj: string) {
    const s = stats.subjects && (stats.subjects as any)[subj]
    if (!s || !s.messages) return 'beginner'
    const rate = (s.understood || 0) / s.messages
    if (rate < 0.5) return 'beginner'
    if (rate < 0.8) return 'intermediate'
    return 'advanced'
  }

  const overallProgress = stats.responses ? Math.round(((stats.understood || 0) / stats.responses) * 100) : 0
  const firstName = session?.user.email?.split('@')[0]?.split(/[._-]/)[0]
  const displayName = firstName ? firstName.charAt(0).toUpperCase() + firstName.slice(1) : null
    const authenticatedDisplayName = account?.profile?.display_name || displayName || 'Account'

    useEffect(() => {
      if (!session) {
        setProfileName('')
        setProfileMessage(null)
        return
      }
      setProfileName(account?.profile?.display_name || '')
    }, [account?.profile?.display_name, session?.user.id])

    async function saveProfile(event: React.FormEvent) {
      event.preventDefault()
      setProfileSaving(true)
      setProfileMessage(null)
      const result = await updateProfile(profileName)
      setProfileSaving(false)
      setProfileMessage(result.error ? result.error.message : 'Profile updated')
    }
  const [now, setNow] = useState(() => new Date(0))
  useEffect(() => {
    try {
      const storedTheme = localStorage.getItem('lumora_theme')
      if (storedTheme) setTheme(storedTheme)
      const storedMode = localStorage.getItem('lumora_mode')
      if (storedMode) setActiveMode(storedMode)
    } catch {}
    setNow(new Date())
    const timer = window.setInterval(() => setNow(new Date()), 60000)
    return () => window.clearInterval(timer)
  }, [])

  const activeTutor = tutorForMode(activeMode)
  const userGreeting = getTimeGreeting(now)
  const greeting = displayName ? `${userGreeting}, ${displayName}.` : `${userGreeting}. What would you like to learn?`

  async function handleSignIn(event: React.FormEvent) {
    event.preventDefault()
    setAuthFormError(null)
    const result = authMode === 'signin'
      ? await signIn(authEmail.trim(), authPassword)
      : await signUp(authEmail.trim(), authPassword, termsAccepted)
    if (result.error) setAuthFormError(result.error.message)
    else {
      setAuthPassword('')
      setShowAuthModal(false)
      if (pendingWorkspaceView) {
        setWorkspaceView(pendingWorkspaceView)
        setPendingWorkspaceView(null)
      }
    }
  }

  function openWorkspace(view: 'chat' | 'projects' | 'plans') {
    if (view !== 'chat' && !session) {
      setWorkspaceView(view)
      setPendingWorkspaceView(view)
      setShowAuthModal(true)
      setMobileNavOpen(false)
      return
    }
    setWorkspaceView(view)
    if (view === 'chat') {
      setSelectedPlan(null)
    } else {
      setSelectedProject(null)
      setSelectedPlan(null)
      setActiveProjectContext(null)
    }
    setMobileNavOpen(false)
  }

  async function startNewChat() {
    setMessages([])
    setConversationId(null)
    setWorkspaceView('chat')
    setWorkspaceError(null)
    setMobileNavOpen(false)
    if (!session) return
    try {
      const response = await authenticatedFetch(`${API_URL!}/conversations`, session)
      const data = await response.json()
      if (response.ok && data?.ok && Array.isArray(data.conversations)) setConversations(data.conversations)
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : 'Recent conversations unavailable')
    }
  }

  function formatConversationDate(value: string) {
    const date = new Date(value)
    const now = new Date()
    return date.toDateString() === now.toDateString() ? date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : date.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }

  async function openConversation(conversation: Conversation) {
    if (!session) return
    try {
      const res = await authenticatedFetch(`${API_URL!}/history?conversationId=${encodeURIComponent(conversation.id)}`, session)
      const data = await res.json()
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Conversation unavailable')
      setWorkspaceView('chat')
      setConversationId(conversation.id)
      setMessages(Array.isArray(data.history) ? data.history.map((message: any) => ({ role: message.role, text: message.text })) : [])
      setMobileNavOpen(false)
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : 'Conversation unavailable')
    }
  }

  async function renameConversation(conversation: Conversation) {
    if (!session) return
    const title = window.prompt('Rename conversation', conversation.title)
    if (title === null) return
    try {
      const res = await authenticatedFetch(`${API_URL!}/conversations/${conversation.id}`, session, { method: 'PATCH', body: JSON.stringify({ title }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Conversation could not be renamed')
      setConversations((items) => items.map((item) => item.id === conversation.id ? data.conversation : item))
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : 'Conversation could not be renamed')
    }
  }

  async function deleteConversation(conversation: Conversation) {
    if (!session || !window.confirm(`Delete "${conversation.title}"?`)) return
    try {
      const res = await authenticatedFetch(`${API_URL!}/conversations/${conversation.id}`, session, { method: 'DELETE' })
      if (!res.ok) throw new Error('Conversation could not be deleted')
      setConversations((items) => items.filter((item) => item.id !== conversation.id))
      if (conversationId === conversation.id) {
        setConversationId(null)
        setMessages([])
      }
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : 'Conversation could not be deleted')
    }
  }

  function openProject(project: Project) {
    setSelectedProject(project)
    setWorkspaceView('projects')
    setProjectTab('overview')
    const plan = studyPlans.find((item) => item.project_id === project.id)
    setSelectedPlan(plan || null)
    setActiveProjectContext({
      projectId: project.id,
      projectName: project.title,
      subject: project.subject || plan?.subject,
      studyPlanId: plan?.id || null
    })
  }

  async function createProject(event: React.FormEvent) {
    event.preventDefault()
    const project = { id: `local-project-${Date.now()}`, title: projectTitle.trim(), description: projectDescription.trim(), subject: projectSubject.trim(), goal: projectGoal.trim(), deadline: projectDeadline || null, status: projectStatus, progress_percent: Math.max(0, Math.min(100, Number(projectProgress) || 0)) }
    if (!project.title || !projectSubject.trim() || !projectGoal.trim()) { setWorkspaceError('Project title, subject, and goal are required.'); return }
    setProjectLoading(true)
    try {
      const next = [...projects, project]
      if (session) {
        const response = await authenticatedFetch(buildWorkspaceApiUrl(API_URL, '/projects'), session, { method: 'POST', body: JSON.stringify(project) })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Project could not be created')
        const createdProject = data.project
        setProjects([...projects, createdProject])
        setSelectedProject(createdProject)
        setProjectTab('overview')
        setActiveProjectContext({
          projectId: createdProject.id,
          projectName: createdProject.title,
          subject: createdProject.subject || undefined,
          studyPlanId: null
        })
      } else {
        setProjects(next)
        localStorage.setItem('lumora_anonymous_projects', JSON.stringify(next))
      }
      setProjectTitle(''); setProjectDescription(''); setProjectSubject(''); setProjectGoal(''); setProjectDeadline(''); setProjectStatus('active'); setProjectProgress('0'); setShowProjectForm(false)
    } catch (error) { setWorkspaceError(error instanceof Error ? error.message : 'Project could not be created') } finally { setProjectLoading(false) }
  }

  async function archiveProject(project: Project) {
    if (!session || !window.confirm(`Archive "${project.title}"?`)) return
    try {
      const response = await authenticatedFetch(`${buildWorkspaceApiUrl(API_URL, '/projects')}/${project.id}`, session, { method: 'DELETE' })
      if (!response.ok) throw new Error('Project could not be archived')
      setProjects((items) => items.filter((item) => item.id !== project.id))
      if (selectedProject?.id === project.id) { setSelectedProject(null); setActiveProjectContext(null) }
    } catch (error) { setWorkspaceError(error instanceof Error ? error.message : 'Project could not be archived') }
  }

  async function updateProject(project: Project) {
    if (!session) return
    setProjectEditTitle(project.title)
    setProjectEditDescription(project.description || '')
    setProjectEditSubject(project.subject || '')
    setProjectEditGoal(project.goal || '')
    setProjectEditDeadline(project.deadline || '')
    setProjectEditStatus(project.status || 'active')
    setProjectEditProgress(String(project.progress_percent || 0))
    setShowProjectEditForm(true)
  }

  async function saveProjectEdit(event: React.FormEvent) {
    event.preventDefault()
    if (!session || !selectedProject) return
    if (!projectEditTitle.trim() || !projectEditSubject.trim() || !projectEditGoal.trim()) {
      setWorkspaceError('Project name, subject, and goal are required.')
      return
    }
    setProjectEditLoading(true)
    try {
      const response = await authenticatedFetch(`${buildWorkspaceApiUrl(API_URL, '/projects')}/${selectedProject.id}`, session, { method: 'PATCH', body: JSON.stringify({ title: projectEditTitle.trim(), description: projectEditDescription.trim(), subject: projectEditSubject.trim(), goal: projectEditGoal.trim(), deadline: projectEditDeadline || null, status: projectEditStatus, progress_percent: Math.max(0, Math.min(100, Number(projectEditProgress) || 0)) }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || 'Project could not be updated')
      setProjects((items) => items.map((item) => item.id === selectedProject.id ? data.project : item))
      setSelectedProject(data.project)
      setShowProjectEditForm(false)
    } catch (error) { setWorkspaceError(error instanceof Error ? error.message : 'Project could not be updated') } finally { setProjectEditLoading(false) }
  }

  async function createPlan(event: React.FormEvent) {
    event.preventDefault()
    const topics: PlanTopic[] = planTopics.split('\n').map((title, index) => title.trim()).filter(Boolean).map((title, index) => ({ id: `local-topic-${Date.now()}-${index}`, week_number: Math.floor(index / 3) + 1, title, lesson: `Study ${title}.`, exercise: `Explain or practise ${title}.`, completed: false, sort_order: index }))
    if (!planTitle.trim() || !planSubject.trim() || !planObjective.trim() || !topics.length) { setWorkspaceError('Add a title, subject, learning goal, and at least one topic.'); return }
    const plan: StudyPlan = { id: `local-plan-${Date.now()}`, title: planTitle.trim(), objective: planObjective.trim(), subject: planSubject.trim(), learner_level: planLevel, estimated_duration: '', schedule: planTime, available_time: planTime, deadline: planDeadline || null, status: 'active', project_id: planProjectId, study_plan_topics: topics }
    setStudyPlanLoading(true)
    try {
      if (session) {
        const response = await authenticatedFetch(buildWorkspaceApiUrl(API_URL, '/study-plans'), session, { method: 'POST', body: JSON.stringify({ ...plan, topics, available_time: planTime, deadline: planDeadline || null }) })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Study plan could not be created')
        const createdPlan = data.studyPlan
        setStudyPlans([createdPlan, ...studyPlans])
        if (createdPlan.project_id) {
          const relatedProject = projects.find((project) => project.id === createdPlan.project_id)
          if (relatedProject) {
            setSelectedProject(relatedProject)
            setActiveProjectContext({
              projectId: relatedProject.id,
              projectName: relatedProject.title,
              subject: relatedProject.subject || createdPlan.subject,
              studyPlanId: createdPlan.id
            })
          }
        }
      } else {
        const next = [...studyPlans, plan]
        setStudyPlans(next)
        localStorage.setItem('lumora_anonymous_study_plans', JSON.stringify(next))
      }
      setPlanTitle(''); setPlanObjective(''); setPlanSubject(''); setPlanTopics(''); setPlanTime(''); setPlanDeadline(''); setPlanProjectId(undefined); setShowPlanForm(false)
    } catch (error) { setWorkspaceError(error instanceof Error ? error.message : 'Study plan could not be created') } finally { setStudyPlanLoading(false) }
  }

  async function toggleTopic(plan: StudyPlan, topic: PlanTopic) {
    const completed = !topic.completed
    try {
      if (session && topic.id) {
        const response = await authenticatedFetch(`${buildWorkspaceApiUrl(API_URL, '/study-plans')}/topics/${topic.id}`, session, { method: 'PATCH', body: JSON.stringify({ completed }) })
        if (!response.ok) throw new Error('Topic could not be updated')
      }
      const update = (item: StudyPlan) => item.id !== plan.id ? item : { ...item, study_plan_topics: (item.study_plan_topics || []).map((current) => current.id === topic.id ? { ...current, completed } : current) }
      const next = studyPlans.map(update)
      setStudyPlans(next)
      setSelectedPlan(update(plan))
      if (!session) localStorage.setItem('lumora_anonymous_study_plans', JSON.stringify(next))
    } catch (error) { setWorkspaceError(error instanceof Error ? error.message : 'Topic could not be updated') }
  }

  async function searchLearningVideos(event?: React.FormEvent) {
    event?.preventDefault()
    const query = youtubeQuery.trim() || activeProjectContext?.subject || subject
    if (!query) return
    setYoutubeLoading(true)
    setYoutubeMessage(null)
    try {
      const requestSession = session ? (await refreshSession()) || session : null
      const response = requestSession
        ? await authenticatedFetch(buildWorkspaceApiUrl(API_URL, '/youtube/search'), requestSession, { method: 'POST', body: JSON.stringify({ query, projectContext: activeProjectContext ? { projectId: activeProjectContext.projectId, studyPlanId: activeProjectContext.studyPlanId } : undefined }) })
        : await fetch(buildWorkspaceApiUrl(API_URL, '/youtube/search'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) })
      const data = await response.json()
      if (!response.ok || !data?.ok) throw new Error(data?.error || 'Video search is unavailable')
      setYoutubeVideos(Array.isArray(data.videos) ? data.videos : [])
      setYoutubeMessage(data.enabled === false ? 'Video search is not configured yet.' : data.videos?.length ? null : 'No relevant videos found. Try a more specific topic.')
    } catch (error) {
      setYoutubeVideos([])
      setYoutubeMessage(error instanceof Error ? error.message : 'Video search is unavailable')
    } finally {
      setYoutubeLoading(false)
    }
  }

  async function searchWikipedia(event?: React.FormEvent) {
    event?.preventDefault()
    const query = wikipediaQuery.trim()
    if (!query) { setWikipediaMessage('Enter a question or topic first.'); return }
    setWikipediaLoading(true)
    setWikipediaMessage(null)
    try {
      const response = await fetch(buildWorkspaceApiUrl(API_URL, '/wikipedia/search'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) })
      const data = await response.json()
      if (!response.ok || !data?.ok) throw new Error(data?.error || 'Wikipedia search is unavailable')
      setWikipediaArticles(Array.isArray(data.articles) ? data.articles : [])
      setWikipediaMessage(data.articles?.length ? null : 'No Wikipedia article matched that question.')
    } catch (error) {
      setWikipediaArticles([])
      setWikipediaMessage(error instanceof Error ? error.message : 'Wikipedia search is unavailable')
    } finally { setWikipediaLoading(false) }
  }

  async function archiveStudyPlan(plan: StudyPlan) {
    if (!session || !window.confirm(`Archive "${plan.title}"?`)) return
    try {
      const response = await authenticatedFetch(`${buildWorkspaceApiUrl(API_URL, '/study-plans')}/${plan.id}`, session, { method: 'DELETE' })
      if (!response.ok) throw new Error('Study plan could not be archived')
      setStudyPlans((items) => items.filter((item) => item.id !== plan.id))
      if (selectedPlan?.id === plan.id) { setSelectedPlan(null); setActiveProjectContext(null) }
    } catch (error) { setWorkspaceError(error instanceof Error ? error.message : 'Study plan could not be archived') }
  }

  function renderProjectView() {
    if (!session) return <section className="workspace-content"><h1>Projects</h1><p className="workspace-muted">Sign in to use Projects</p><p className="workspace-muted">Create projects, organize your learning, and give Cognita persistent context.</p><div className="project-action-row"><button className="primary-button" onClick={() => { setAuthMode('signin'); setShowAuthModal(true) }}>Log in</button><button className="text-button" onClick={() => { setAuthMode('signup'); setShowAuthModal(true) }}>Create account</button></div></section>
    if (selectedProject) {
      const plan = studyPlans.find((item) => item.project_id === selectedProject.id)
      const projectInfo = [
        { label: 'Subject', value: selectedProject.subject || 'Not set' },
        { label: 'Goal', value: selectedProject.description || 'Add a clear objective for this project.' },
        { label: 'Study plan', value: plan ? plan.title : 'No study plan yet' },
        { label: 'Updated', value: selectedProject.updated_at ? new Date(selectedProject.updated_at).toLocaleDateString() : 'Recently' }
      ]

      return <section className="workspace-content">
        <button className="back-link" onClick={() => { setSelectedProject(null); setActiveProjectContext(null) }}>Projects</button>
        <h1>{selectedProject.title}</h1>
        <p className="workspace-muted">{selectedProject.description || 'No objective added yet.'}</p>

        <div className="workspace-tabs">
          <span className={projectTab === 'overview' ? 'active' : ''} onClick={() => setProjectTab('overview')}>Overview</span>
          <span className={projectTab === 'chats' ? 'active' : ''} onClick={() => { setWorkspaceView('chat'); setProjectTab('overview'); }}>Chats</span>
          <span className={projectTab === 'study-plan' ? 'active' : ''} onClick={() => { if (plan) { setSelectedPlan(plan); setWorkspaceView('plans'); } else { setPlanProjectId(selectedProject.id); setPlanSubject(selectedProject.subject); setPlanTitle(`${selectedProject.title} Plan`); setShowPlanForm(true) } }}>Study Plan</span>
          <span className={projectTab === 'resources' ? 'active' : ''} onClick={() => setProjectTab('resources')}>Resources</span>
          <span className={projectTab === 'progress' ? 'active' : ''} onClick={() => setProjectTab('progress')}>Progress</span>
          <span className={projectTab === 'files' ? 'active' : ''} onClick={() => setProjectTab('files')}>Files</span>
        </div>

        {projectTab === 'overview' && <div className="project-overview-grid">
          <div className="project-overview-card">
            <h2>Project overview</h2>
            <div className="project-meta-grid">
              {projectInfo.map((meta) => <div key={meta.label} className="project-meta-item"><span>{meta.label}</span><strong>{meta.value}</strong></div>)}
            </div>
            <div className="project-action-row">
              <button className="primary-button" onClick={() => setWorkspaceView('chat')}>Continue learning</button>
              {plan ? <button className="text-button" onClick={() => { setSelectedPlan(plan); setWorkspaceView('plans'); setSelectedProject(null) }}>Open study plan</button> : <button className="primary-button" onClick={() => { setPlanProjectId(selectedProject.id); setPlanSubject(selectedProject.subject); setPlanTitle(`${selectedProject.title} Plan`); setShowPlanForm(true) }}>Create study plan</button>}
              <button className="text-button" onClick={() => updateProject(selectedProject)}>Edit goal</button>
              <button className="text-button" onClick={() => archiveProject(selectedProject)}>Archive</button>
            </div>
            <div className="plan-progress">Progress: {Math.round(selectedProject.progress_percent || 0)}%</div>
          </div>
          <div className="project-overview-card">
            <h2>Current status</h2>
            {plan ? <>
              <p className="workspace-muted">{plan.title}</p>
              <div className="mini-status">
                <span>Topics</span>
                <strong>{plan.study_plan_topics?.length || 0}</strong>
              </div>
              <div className="mini-status">
                <span>Completed</span>
                <strong>{plan.study_plan_topics?.filter((topic) => topic.completed).length || 0}</strong>
              </div>
            </> : <p className="workspace-muted">No study plan is attached yet. Create one to turn this project into a focused learning path.</p>}
          </div>
        </div>}

        {projectTab === 'chats' && <div className="workspace-section"><p className="workspace-muted">Return to your active chat to continue this project with the same context visible at the top of the workspace.</p><button className="primary-button" onClick={() => setWorkspaceView('chat')}>Open project chat</button></div>}
        {projectTab === 'resources' && <div className="workspace-section"><p className="workspace-muted">Resources are not available in this slice yet. This project can still keep the learning objective and study plan together while you continue in chat.</p></div>}
        {projectTab === 'progress' && <div className="workspace-section"><p className="workspace-muted">Progress tracking is intentionally left for a later slice. The current project already keeps objective and study-plan context in place.</p></div>}
        {projectTab === 'files' && <div className="workspace-section"><p className="workspace-muted">Files are not yet connected for this project. This placeholder keeps the workspace structure intact without creating fake functionality.</p></div>}
      </section>
    }

    if (projectLoading) {
      return <section className="workspace-content"><div className="empty-workspace">Loading your projects…</div></section>
    }

    return <section className="workspace-content">
      <div className="workspace-heading"><div><h1>Projects</h1><p className="workspace-muted">Keep conversations, plans, and learning context together.</p></div><button className="primary-button" onClick={() => session ? setShowProjectForm(true) : setShowAuthModal(true)}>New project</button></div>
      {projects.length === 0 ? <div className="empty-workspace">Create a learning project to keep conversations, plans, and resources together.</div> : <div className="workspace-list">{projects.map((project) => <button className="workspace-list-item" key={project.id} onClick={() => openProject(project)}><strong>{project.title}</strong><span>{project.subject || 'Learning project'} · {project.status || 'active'} · {project.progress_percent || 0}%</span><small>{project.goal || project.description || 'No objective added yet.'}</small></button>)}</div>}
    </section>
  }

  function renderPlanView() {
    if (!session) return <section className="workspace-content"><h1>Study Plans</h1><p className="workspace-muted">Sign in to create and track Study Plans</p><p className="workspace-muted">Your learning plans, progress, topics, and deadlines are saved to your account.</p><div className="project-action-row"><button className="primary-button" onClick={() => { setAuthMode('signin'); setShowAuthModal(true) }}>Log in</button><button className="text-button" onClick={() => { setAuthMode('signup'); setShowAuthModal(true) }}>Create account</button></div></section>
    if (selectedPlan) {
      const topics = selectedPlan.study_plan_topics || []
      const completed = topics.filter((topic) => topic.completed).length
      const completion = topics.length ? Math.round((completed / topics.length) * 100) : 0
      const groupedWeeks = Array.from(new Set(topics.map((topic) => topic.week_number))).sort((a, b) => a - b)
      const nextTopic = topics.find((topic) => !topic.completed)?.title
      const deadlineStatus = selectedPlan.deadline ? (new Date(`${selectedPlan.deadline}T23:59:59`).getTime() < Date.now() ? 'Overdue' : 'On track') : 'No deadline'
      return <section className="workspace-content"><button className="back-link" onClick={() => setSelectedPlan(null)}>Study Plans</button><h1>{selectedPlan.title}</h1><p className="workspace-muted">{selectedPlan.objective || `Learn ${selectedPlan.subject}.`}</p><div className="plan-summary-grid"><div className="plan-summary-item"><span>Subject</span><strong>{selectedPlan.subject || 'Unspecified'}</strong></div><div className="plan-summary-item"><span>Level</span><strong>{selectedPlan.learner_level || 'Beginner'}</strong></div><div className="plan-summary-item"><span>Time</span><strong>{selectedPlan.available_time || selectedPlan.schedule || 'Flexible'}</strong></div><div className="plan-summary-item"><span>Deadline</span><strong>{selectedPlan.deadline || 'Optional'}</strong></div></div><div className="plan-progress">Progress: {completion}% ({completed}/{topics.length || 0} complete) · {deadlineStatus}</div><div className="workspace-section"><strong>Recommended next action</strong><p className="workspace-muted">{nextTopic ? `Study ${nextTopic}${selectedPlan.deadline ? ` before ${selectedPlan.deadline}` : ''}.` : 'Review what you have completed and choose a new goal.'}</p></div><div className="project-action-row"><button className="primary-button" onClick={() => { setActiveProjectContext({ projectId: selectedPlan.project_id || undefined, projectName: selectedPlan.title, subject: selectedPlan.subject, studyPlanId: selectedPlan.id }); setWorkspaceView('chat'); setInput(`Continue my study plan: ${nextTopic || selectedPlan.subject}`) }}>Continue current topic</button><button className="text-button" onClick={() => archiveStudyPlan(selectedPlan)}>Archive plan</button></div>{groupedWeeks.map((week) => <div className="plan-week" key={week}><h2>Week {week}</h2>{topics.filter((topic) => topic.week_number === week).map((topic) => <label className="plan-topic" key={topic.id || `${topic.title}-${week}`}><input type="checkbox" checked={topic.completed} onChange={() => toggleTopic(selectedPlan, topic)} /><span><strong>{topic.title}</strong><small>{topic.lesson || 'Keep practising this topic.'}</small></span></label>)}</div>)}</section>
    }

    if (studyPlanLoading) {
      return <section className="workspace-content"><div className="empty-workspace">Loading your study plans…</div></section>
    }

    return <section className="workspace-content"><div className="workspace-heading"><div><h1>Study Plans</h1><p className="workspace-muted">Tell Cognita what you want to learn and build a plan around your goal.</p></div><button className="primary-button" onClick={() => session ? setShowPlanForm(true) : setShowAuthModal(true)}>New study plan</button></div>{studyPlans.length === 0 ? <div className="empty-workspace">Your first plan can turn a goal into clear weekly topics and practice.</div> : <div className="workspace-list">{studyPlans.map((plan) => { const topics = plan.study_plan_topics || []; const completed = topics.filter((topic) => topic.completed).length; const next = topics.find((topic) => !topic.completed)?.title || 'Complete'; return <button className="workspace-list-item" key={plan.id} onClick={() => setSelectedPlan(plan)}><strong>{plan.title}</strong><span>{plan.subject} · {plan.learner_level} · {topics.length ? Math.round((completed / topics.length) * 100) : 0}%</span><small>{plan.objective || 'Learning goal not set'} · Next: {next}</small></button> })}</div>}</section>
  }

  function sendHomeworkRequest(event: React.FormEvent) {
    event.preventDefault()
    const details = homeworkPrompt.trim()
    if (!details && !pendingAttachment) {
      setAttachmentError('Add the question, or attach a photo or document first.')
      return
    }
    setAttachmentError(null)
    const prompt = [
      'Homework Helper request.',
      `Help style: ${homeworkType}.`,
      `Subject: ${subject || activeProjectContext?.subject || 'general homework'}.`,
      'Use the format that fits the question. For definitions or comparisons, answer in short clear paragraphs or bullets, not numbered steps. Use numbered steps only for calculations, proofs, procedures, or worked solutions. Do not just give the final answer unless I ask for it.',
      details ? `Question: ${details}` : 'Use the attached file or photo as the question.'
    ].join('\n')
    setWorkspaceView('chat')
    setInput('')
    void handleSend(prompt, { displayText: details || `Homework attachment: ${pendingAttachment?.file.name || 'uploaded file'}` })
  }

  function renderHomeworkView() {
    return <section className="workspace-content homework-helper">
      <div className="workspace-heading"><div><h1>Homework Helper</h1><p className="workspace-muted">Work through a question, worksheet, or photo without skipping the thinking.</p></div></div>
      <form className="workspace-form homework-form" onSubmit={sendHomeworkRequest}>
        <div className="form-two-column">
          <label>Subject<input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Math, science, history..." /></label>
          <label>Help style<select value={homeworkType} onChange={(event) => setHomeworkType(event.target.value)}><option>Explain and guide</option><option>Check my answer</option><option>Show the method</option><option>Make practice questions</option></select></label>
        </div>
        <label>Question<textarea value={homeworkPrompt} onChange={(event) => setHomeworkPrompt(event.target.value)} placeholder="Paste the question here, or attach a photo/file below." rows={6} /></label>
        <div className="homework-upload-row">
          <div className="attachment-picker">
            <button type="button" className="attachment-button attachment-button-wide" onClick={() => setAttachmentMenuOpen((open) => !open)} aria-label="Add homework attachment" aria-expanded={attachmentMenuOpen}><Icon name="paperclip" /> <span>Add photo or file</span></button>
            {attachmentMenuOpen && <div className="attachment-menu" role="menu"><button type="button" onClick={() => cameraInputRef.current?.click()} role="menuitem">Take photo</button><button type="button" onClick={() => imageInputRef.current?.click()} role="menuitem">Choose image</button><button type="button" onClick={() => documentInputRef.current?.click()} role="menuitem">Upload file</button></div>}
            <input ref={cameraInputRef} className="sr-only" type="file" accept="image/*" capture="environment" onChange={handleAttachmentInput} />
            <input ref={imageInputRef} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleAttachmentInput} />
            <input ref={documentInputRef} className="sr-only" type="file" accept="application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={handleAttachmentInput} />
          </div>
          {pendingAttachment && <div className="attachment-preview homework-attachment-preview" role="status">{pendingAttachment.previewUrl ? <img src={pendingAttachment.previewUrl} alt="Attachment preview" /> : <span className="attachment-file-icon" aria-hidden="true">FILE</span>}<span className="attachment-details"><strong>{pendingAttachment.file.name}</strong><small>{Math.ceil(pendingAttachment.file.size / 1024)} KB</small></span><button type="button" className="attachment-remove" onClick={removeAttachment} aria-label="Remove attachment">×</button></div>}
        </div>
        {attachmentError && <div className="attachment-error" role="alert">{attachmentError}</div>}
        <button className="primary-button" type="submit" disabled={isThinking}>Start helper</button>
      </form>
    </section>
  }

  async function generatePractice() {
    if (!session) {
      setAuthMode('signin')
      setShowAuthModal(true)
      return
    }
    if (!practicePlanId) {
      setPracticeError('Choose a study plan before starting practice.')
      return
    }
    setPracticeLoading(true)
    setPracticeError(null)
    setPracticePacket(null)
    setPracticeAnswers({})
    setPracticeChecked({})
    try {
      const response = await authenticatedFetch(`${API_ROOT}/practice/generate`, session, {
        method: 'POST',
        body: JSON.stringify({ studyPlanId: practicePlanId, kind: practiceKind })
      })
      const data = await response.json()
      if (!response.ok || !data?.ok) throw new Error(data?.error || 'Practice could not be prepared')
      setPracticePacket(data.packet)
    } catch (error) {
      setPracticeError(error instanceof Error ? error.message : 'Practice could not be prepared')
    } finally {
      setPracticeLoading(false)
    }
  }

  function renderPracticeView() {
    if (!session) return <section className="workspace-content"><h1>Practice</h1><p className="workspace-muted">Sign in to practise from your study plans.</p><button type="button" className="primary-button" onClick={() => { setAuthMode('signin'); setShowAuthModal(true) }}>Log in</button></section>
    const selectedPlan = studyPlans.find((plan) => plan.id === practicePlanId)
    return <section className="workspace-content practice-view">
      <div className="workspace-heading"><div><h1>Practice</h1><p className="workspace-muted">Generate a focused quiz, test, or exam from your current study plan.</p></div></div>
      {studyPlans.length === 0 ? <div className="empty-workspace"><strong>Add a study plan first.</strong><p>Create a plan with topics before you can use practice.</p><button type="button" className="primary-button" onClick={() => openWorkspace('plans')}>Create study plan</button></div> : <>
        <div className="practice-controls">
          <label>Study plan<select value={practicePlanId} onChange={(event) => setPracticePlanId(event.target.value)}><option value="">Choose a plan</option>{studyPlans.map((plan) => <option key={plan.id} value={plan.id}>{plan.title} · {plan.subject}</option>)}</select></label>
          <label>Format<select value={practiceKind} onChange={(event) => setPracticeKind(event.target.value as PracticeKind)}><option value="quiz">Quiz · 4 questions</option><option value="test">Test · 6 questions</option><option value="exam">Exam · 8 questions</option></select></label>
          <button type="button" className="primary-button" onClick={generatePractice} disabled={practiceLoading || !practicePlanId}>{practiceLoading ? 'Preparing...' : 'Start practice'}</button>
        </div>
        {practiceError && <div className="workspace-error" role="alert">{practiceError}</div>}
        {selectedPlan && !practicePacket && <p className="workspace-muted">Practice will focus on incomplete topics from {selectedPlan.title} and use current educational sources.</p>}
        {practicePacket && <div className="practice-packet"><div className="practice-packet-header"><div><h2>{practicePacket.plan.title}</h2><p className="workspace-muted">{practicePacket.kind.toUpperCase()} · {practicePacket.plan.subject}</p></div><button type="button" className="text-button" onClick={() => { setPracticePacket(null); setPracticeChecked({}) }}>Choose another</button></div>{practicePacket.questions.map((question, index) => <article className="practice-question" key={question.id}><span className="practice-topic">Question {index + 1} · {question.topic}</span><h3>{question.prompt}</h3><textarea value={practiceAnswers[question.id] || ''} onChange={(event) => setPracticeAnswers((answers) => ({ ...answers, [question.id]: event.target.value }))} placeholder="Write your answer..." rows={3} /><button type="button" className="text-button" onClick={() => setPracticeChecked((checked) => ({ ...checked, [question.id]: !checked[question.id] }))}>{practiceChecked[question.id] ? 'Hide answer' : 'Check answer'}</button>{practiceChecked[question.id] && <div className="practice-guidance"><strong>Model answer</strong><p>{question.answer}</p><strong>Verification</strong><p>{question.verification}</p>{question.source && <a href={question.source} target="_blank" rel="noreferrer">Open source</a>}</div>}</article>)}</div>}
      </>}
    </section>
  }

  function renderSimulationView() {
    const plan = studyPlans.find((item) => item.id === (activeProjectContext?.studyPlanId || practicePlanId))
    const topic = plan?.study_plan_topics?.find((item) => !item.completed)?.title || plan?.subject || subject || 'your topic'
    const labTopics = simulationLab === 'physics' ? PHYSICS_TOPICS : CHEMISTRY_TOPICS
    const selectedTopic = labTopics.find((item) => item.id === selectedLabTopic) || labTopics[0]
    const selectTopic = (id: string) => setSelectedLabTopic(id)
    const element = ELEMENTS[selectedElementNumber - 1]
    const molecule = MOLECULES[selectedMolecule]
    const topicPicker = <div className="lab-topic-grid">{labTopics.map((item) => <button type="button" key={item.id} className={selectedTopic.id === item.id ? 'lab-topic active' : 'lab-topic'} onClick={() => selectTopic(item.id)}><strong>{item.title}</strong><span>{item.description}</span></button>)}</div>
    if (simulationLab === 'chemistry') return <section className="workspace-content simulation-view"><div className="workspace-heading"><div><h1>{selectedTopic.title}</h1><p className="workspace-muted">{selectedTopic.description}</p></div></div>{topicPicker}<div className="lab-switcher"><button type="button" className="simulation-choice" onClick={() => { setSimulationLab('physics'); setSelectedLabTopic('motion') }}>Physics lab</button><button type="button" className="simulation-choice active">Chemistry lab</button></div><div className="chemistry-layout"><div className="simulation-settings"><div className="simulation-setting-heading"><strong>Periodic table</strong><span>118 elements</span></div><label>Element<select value={selectedElementNumber} onChange={(event) => setSelectedElementNumber(Number(event.target.value))}>{ELEMENTS.map((item) => <option key={item.atomicNumber} value={item.atomicNumber}>{item.atomicNumber}. {item.name} ({item.symbol})</option>)}</select></label><div className="element-facts"><strong>{element.name} · {element.symbol}</strong><span>Atomic number {element.atomicNumber}</span><span>Mass {element.atomicMass}</span><span>{element.category}</span><span>Shells {element.shells.join(' · ')}</span></div><label>Molecule<select value={selectedMolecule} onChange={(event) => setSelectedMolecule(Number(event.target.value))}>{MOLECULES.map((item, index) => <option key={item.formula} value={index}>{item.name} · {item.formula}</option>)}</select></label><button type="button" className="primary-button" onClick={() => setAtomPlaying((value) => !value)}>{atomPlaying ? 'Pause electrons' : 'Animate electrons'}</button></div><div className="chemistry-canvases"><div className="simulation-stage"><AtomSimulationCanvas element={element} playing={atomPlaying} resetToken={simulationResetToken} /><div className="simulation-overlay"><span>{element.name}</span><strong>{element.symbol}</strong></div></div><div className="simulation-stage"><MoleculeSimulationCanvas molecule={molecule} playing={atomPlaying} /><div className="simulation-overlay"><span>{molecule.name}</span><strong>{molecule.formula}</strong></div></div></div></div><div className="molecule-card"><strong>{molecule.name} · {molecule.formula}</strong><span>Atoms: {molecule.atoms.join(' · ')}</span><p>{selectedTopic.practical} Use the element selector to inspect atomic structure, then compare how atoms combine in common molecules.</p></div></section>
    return <section className="workspace-content simulation-view"><div className="workspace-heading"><div><h1>{selectedTopic.title}</h1><p className="workspace-muted">{selectedTopic.description}{topic ? ` Current learning context: ${topic}.` : ''}</p></div></div>{topicPicker}<div className="lab-switcher"><button type="button" className="simulation-choice active">Physics lab</button><button type="button" className="simulation-choice" onClick={() => { setSimulationLab('chemistry'); setSelectedLabTopic('atomic') }}>Chemistry lab</button></div><div className="simulation-experiment"><div className="simulation-settings"><div className="simulation-setting-heading"><strong>Experiment controls</strong><span>{simulationPlaying ? 'Running' : 'Paused'}</span></div>{selectedTopic.id === 'electricity' ? <><label>Voltage <output>{electricVoltage.toFixed(1)} V</output><input type="range" min="0" max="24" step="0.1" value={electricVoltage} onChange={(event) => setElectricVoltage(Number(event.target.value))} /></label><label>Resistance <output>{electricResistance.toFixed(1)} Ω</output><input type="range" min="1" max="100" step="0.1" value={electricResistance} onChange={(event) => setElectricResistance(Number(event.target.value))} /></label><label className="switch-control">Switch <button type="button" className="text-button" onClick={() => setCircuitClosed((value) => !value)}>{circuitClosed ? 'Closed' : 'Open'}</button></label><div className="element-facts"><strong>V = {electricVoltage.toFixed(1)} V</strong><span>R = {electricResistance.toFixed(1)} Ω</span><span>I = {circuitClosed ? (electricVoltage / Math.max(electricResistance, .1)).toFixed(2) : '0.00'} A · P = {circuitClosed ? (electricVoltage * electricVoltage / Math.max(electricResistance, .1)).toFixed(2) : '0.00'} W</span><span>Ohm's law: V = I × R</span></div></> : selectedTopic.id === 'magnetism' ? <><label>Field strength <output>{magneticStrength.toFixed(1)} T</output><input type="range" min="0" max="10" step="0.1" value={magneticStrength} onChange={(event) => setMagneticStrength(Number(event.target.value))} /></label><label>Distance <output>{magneticDistance.toFixed(1)} m</output><input type="range" min="0.5" max="10" step="0.1" value={magneticDistance} onChange={(event) => setMagneticDistance(Number(event.target.value))} /></label><div className="element-facts"><strong>Relative field {(magneticStrength / Math.max(magneticDistance * magneticDistance, .1)).toFixed(2)}</strong><span>Field weakens with distance.</span><span>Map the strongest region near the poles.</span></div></> : <><label>Acceleration <output>{simulationAcceleration.toFixed(1)} m/s²</output><input type="range" min="-4" max="8" step="0.1" value={simulationAcceleration} onChange={(event) => setSimulationAcceleration(Number(event.target.value))} /></label><label>Initial velocity <output>{simulationVelocity.toFixed(1)} m/s</output><input type="range" min="0" max="8" step="0.1" value={simulationVelocity} onChange={(event) => setSimulationVelocity(Number(event.target.value))} /></label><label>Mass <output>{simulationMass.toFixed(1)} kg</output><input type="range" min="0.2" max="5" step="0.1" value={simulationMass} onChange={(event) => setSimulationMass(Number(event.target.value))} /></label><label>Gravity <output>{simulationGravity.toFixed(1)} m/s²</output><input type="range" min="0" max="20" step="0.1" value={simulationGravity} onChange={(event) => setSimulationGravity(Number(event.target.value))} /></label></>}<div className="simulation-actions"><button type="button" className="primary-button" onClick={() => setSimulationPlaying((value) => !value)}>{simulationPlaying ? 'Pause' : 'Play'}</button><button type="button" className="text-button" onClick={() => { setSimulationPlaying(false); setSimulationResetToken((value) => value + 1) }}>Reset</button></div></div><div className="simulation-stage">{selectedTopic.id === 'electricity' ? <CircuitSimulationCanvas voltage={electricVoltage} resistance={electricResistance} playing={simulationPlaying} closed={circuitClosed} /> : <PhysicsSimulationCanvas acceleration={selectedTopic.id === 'magnetism' ? magneticStrength / Math.max(magneticDistance, .1) : simulationAcceleration} initialVelocity={simulationVelocity} mass={simulationMass} gravity={simulationGravity} playing={simulationPlaying} resetToken={simulationResetToken} />}<div className="simulation-overlay"><span>{selectedTopic.id === 'electricity' ? 'Circuit flow' : selectedTopic.id === 'magnetism' ? 'Field motion' : 'Ball motion'}</span><strong>{simulationPlaying ? 'Live' : 'Ready'}</strong></div></div></div><div className="simulation-note"><strong>Practical:</strong> {selectedTopic.practical} Change one value, press Play, then reset and compare the result.</div></section>
  }

  function renderResourcesView() {
    const sources = practicePacket?.sources || []
    return <section className="workspace-content"><div className="workspace-heading"><div><h1>Saved resources</h1><p className="workspace-muted">Sources from your latest practice session appear here.</p></div></div>{sources.length ? <div className="resource-list">{sources.map((source, index) => <article className="resource-item" key={`${source.title}-${index}`}><strong>{source.title}</strong><p>{source.snippet}</p>{source.source && <a href={source.source} target="_blank" rel="noreferrer">Open source</a>}</article>)}</div> : <div className="empty-workspace">Start a practice session to collect topic sources here.</div>}</section>
  }

  function renderExperimentRegistryView() {
    const experiment = experimentById(activeExperimentId)
    const selectExperiment = (id: string) => { const next = experimentById(id); setActiveExperimentId(id); setExperimentValues(Object.fromEntries(next.params.map((param) => [param.key, param.value]))); setExperimentReadouts([]); setExperimentResetSignal((value) => value + 1); setSimulationPlaying(false) }
    const updateParam = (key: string, value: number) => setExperimentValues((current) => ({ ...current, [key]: value }))
    return <section className={`workspace-content experiment-workspace ${experimentFullscreen ? 'experiment-fullscreen' : ''}`}><div className="workspace-heading"><div><span className="experiment-eyebrow">Interactive simulation</span><h1>{experiment.title}</h1><p className="workspace-muted">Offline experiment with direct controls, visible equations, and live measurements.</p></div><button type="button" className="text-button" onClick={() => setExperimentFullscreen((value) => !value)}>{experimentFullscreen ? 'Exit focus' : 'Focus stage'}</button></div><div className="experiment-toolbar"><span>{experiment.category}</span><strong>{simulationPlaying ? 'Running' : 'Paused'}</strong><div><button type="button" className="primary-button" onClick={() => setSimulationPlaying((value) => !value)}>{simulationPlaying ? 'Pause' : 'Play'}</button><button type="button" className="text-button" onClick={() => { setSimulationPlaying(false); setExperimentResetSignal((value) => value + 1) }}>Reset</button><button type="button" className="text-button" onClick={() => setExperimentStepSignal((value) => value + 1)}>Step</button></div></div><div className="experiment-layout"><aside className="experiment-sidebar"><strong>Explore</strong>{['Physics', 'Chemistry'].map((category) => <div key={category}><span className="experiment-category">{category}</span>{EXPERIMENTS.filter((item) => category === 'Chemistry' ? item.category === 'Chemistry' : item.category !== 'Chemistry').map((item) => <button type="button" key={item.id} className={item.id === experiment.id ? 'experiment-nav active' : 'experiment-nav'} onClick={() => selectExperiment(item.id)}>{item.title}</button>)}</div>)}</aside><div className="experiment-main"><div className="experiment-canvas-wrap"><ExperimentCanvas experimentId={experiment.id} values={experimentValues} running={simulationPlaying} stepSignal={experimentStepSignal} resetSignal={experimentResetSignal} onReadouts={setExperimentReadouts} /></div><div className="experiment-readouts">{experimentReadouts.map((item) => <div key={item.label}><span>{item.label}</span><strong>{item.value}</strong></div>)}</div></div><aside className="experiment-controls"><strong>Adjust variables</strong>{experiment.params.map((param) => <label key={param.key}>{param.label}<output>{Number(experimentValues[param.key] ?? param.value).toFixed(param.step < 1 ? 2 : 0)}</output><input aria-label={param.label} type="range" min={param.min} max={param.max} step={param.step} value={experimentValues[param.key] ?? param.value} onChange={(event) => updateParam(param.key, Number(event.target.value))} /></label>)}</aside></div></section>
  }

  function renderWikipediaView() {
    return <section className="workspace-content"><div className="workspace-heading"><div><h1>Wikipedia research</h1><p className="workspace-muted">Ask a question or enter a topic. Lumora searches Wikipedia and shows the article here.</p></div></div><form className="workspace-search-form" onSubmit={searchWikipedia}><label htmlFor="wikipedia-query">Question or topic</label><div className="workspace-search-row"><input id="wikipedia-query" value={wikipediaQuery} onChange={(event) => setWikipediaQuery(event.target.value)} placeholder="What is electromagnetic induction?" /><button type="submit" className="primary-button" disabled={wikipediaLoading}>{wikipediaLoading ? 'Searching...' : 'Search Wikipedia'}</button></div></form>{wikipediaMessage && <p className="workspace-muted" role="status">{wikipediaMessage}</p>}<div className="resource-list">{wikipediaArticles.map((article, index) => <article className="resource-item" key={`${article.title}-${index}`}><strong>{article.title}</strong><p>{article.extract || article.snippet}</p>{article.extract && <p className="workspace-muted">Search context: {article.snippet}</p>}{article.source && <a href={article.source} target="_blank" rel="noreferrer">Open full article</a>}</article>)}</div></section>
  }

  function renderYouTubeView() {
    return <section className="workspace-content">
      <div className="workspace-heading"><div><h1>Learn with video</h1><p className="workspace-muted">Find focused lessons for a topic, project, or study plan.</p></div></div>
      <form className="workspace-search-form" onSubmit={searchLearningVideos}>
        <label htmlFor="youtube-query">Topic</label>
        <div className="workspace-search-row"><input id="youtube-query" value={youtubeQuery} onChange={(event) => setYoutubeQuery(event.target.value)} placeholder={activeProjectContext?.subject || subject || 'Python functions'} /><button className="primary-button" type="submit" disabled={youtubeLoading}>{youtubeLoading ? 'Searching…' : 'Find videos'}</button></div>
      </form>
      {youtubeMessage && <p className="workspace-muted" role="status">{youtubeMessage}</p>}
      {selectedVideo && <div className="video-player-panel"><div className="video-frame">{youtubePlayerError ? <div className="video-player-fallback"><strong>This video cannot play here.</strong><a href={selectedVideo.watchUrl} target="_blank" rel="noreferrer">Open it on YouTube</a></div> : <iframe title={selectedVideo.title} onError={() => setYoutubePlayerError(true)} src={`${selectedVideo.embedUrl}?origin=${encodeURIComponent(typeof window !== 'undefined' ? window.location.origin : '')}`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />}</div><div className="video-player-caption"><strong>{selectedVideo.title}</strong><span>{selectedVideo.channelTitle}</span>{!youtubePlayerError && <a href={selectedVideo.watchUrl} target="_blank" rel="noreferrer">Open on YouTube</a>}</div></div>}
      {youtubeVideos.length > 0 && <div className="video-results-grid">{youtubeVideos.map((video) => <article className={`video-result-card ${selectedVideo?.videoId === video.videoId ? 'is-selected' : ''}`} key={video.videoId}><button className="video-thumbnail-button" type="button" onClick={() => { setSelectedVideo(video); setYoutubePlayerError(false) }}><img src={video.thumbnailUrl} alt="" loading="lazy" /><span className="video-play-label">Watch</span></button><div className="video-result-copy"><h2>{video.title}</h2><p>{video.channelTitle}</p><a href={video.watchUrl} target="_blank" rel="noreferrer">Open on YouTube</a></div></article>)}</div>}
    </section>
  }

  return (
    <div className="workspace-shell">
      <Suspense fallback={null}>
        <SearchParamsBridge onPrefill={setPrefill} />
      </Suspense>
      <aside className={`workspace-sidebar ${mobileNavOpen ? 'is-open' : ''}`}>
        <button className="mobile-sidebar-back" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation"><Icon name="arrow-left" /></button>
        <div className="workspace-brand">
          <span className="brand-mark" aria-hidden="true">L</span>
          <span>Lumora Cognita</span>
        </div>
        <button type="button" className="new-chat-btn" onClick={startNewChat}><Icon name="plus" /> New Chat</button>

        <div className="sidebar-search">
          <Icon name="menu" />
          <input type="text" placeholder="Search conversations" value={conversationSearch} onChange={(event) => setConversationSearch(event.target.value)} />
        </div>

        {session && <div className="conversation-history" aria-label="Recent conversations">
          {conversationsLoading && <p className="conversation-status">Loading conversations...</p>}
          {!conversationsLoading && conversationError && <p className="conversation-status conversation-status-error">{conversationError}</p>}
          {!conversationsLoading && !conversationError && conversations.length === 0 && <p className="conversation-status">No saved conversations yet.</p>}
          {!conversationsLoading && !conversationError && conversations.map((conversation) => (
            <div key={conversation.id} className="conversation-history-item">
              <button type="button" className="conversation-item" onClick={() => openConversation(conversation)}>
                <strong>{conversation.title}</strong><small>{formatConversationDate(conversation.updated_at)}</small>
              </button>
              <div className="conversation-actions">
                <button type="button" onClick={() => renameConversation(conversation)} aria-label={`Rename ${conversation.title}`}>Rename</button>
                <button type="button" onClick={() => deleteConversation(conversation)} aria-label={`Delete ${conversation.title}`}>Delete</button>
              </div>
            </div>
          ))}
        </div>}

        <nav className="workspace-nav" aria-label="Workspace">
          <div className="nav-section-label">Workspace</div>
          <button type="button" className="nav-item nav-icon-item" onClick={() => openWorkspace('chat')}><Icon name="home" /> <span>Home</span></button>
          <button type="button" className={`nav-item nav-icon-item ${workspaceView === 'chat' ? 'active' : ''}`} onClick={() => openWorkspace('chat')}><Icon name="chat" /> <span>Chats</span></button>
          <button type="button" className={`nav-item nav-icon-item ${workspaceView === 'projects' ? 'active' : ''}`} onClick={() => openWorkspace('projects')}><Icon name="folder" /> <span>Projects</span></button>
          <div className="nav-section-label">Learning</div>
          <button type="button" className={`nav-item nav-icon-item ${workspaceView === 'plans' ? 'active' : ''}`} onClick={() => openWorkspace('plans')}><Icon name="book" /> <span>Study Plans</span></button>
          <button type="button" className={`nav-item nav-icon-item ${workspaceView === 'homework' ? 'active' : ''}`} onClick={() => { setWorkspaceView('homework'); setMobileNavOpen(false) }}><Icon name="spark" /> <span>Homework Helper</span></button>
          <button type="button" className={`nav-item nav-icon-item ${workspaceView === 'practice' ? 'active' : ''}`} onClick={() => { setWorkspaceView('practice'); setMobileNavOpen(false) }}><Icon name="spark" /> <span>Practice</span></button>
          <button type="button" className={`nav-item nav-icon-item ${workspaceView === 'simulations' ? 'active' : ''}`} onClick={() => { setWorkspaceView('simulations'); setMobileNavOpen(false) }}><Icon name="spark" /> <span>Simulations</span></button>
          <div className="nav-section-label">Resources</div>
          <button type="button" className={`nav-item nav-icon-item ${workspaceView === 'youtube' ? 'active' : ''}`} onClick={() => { setWorkspaceView('youtube'); setMobileNavOpen(false) }}><Icon name="book" /> <span>YouTube</span></button>
          <button type="button" className={`nav-item nav-icon-item ${workspaceView === 'wikipedia' ? 'active' : ''}`} onClick={() => { setWikipediaQuery(''); setWikipediaArticles([]); setWikipediaMessage(null); setWorkspaceView('wikipedia'); setMobileNavOpen(false) }}><Icon name="book" /> <span>Wikipedia</span></button>
          <button type="button" className={`nav-item nav-icon-item ${workspaceView === 'resources' ? 'active' : ''}`} onClick={() => { setWorkspaceView('resources'); setMobileNavOpen(false) }}><Icon name="folder" /> <span>Saved Resources</span></button>
          <button type="button" className="nav-item nav-icon-item" onClick={() => { setWorkspaceView('homework'); setMobileNavOpen(false) }}><Icon name="folder" /> <span>Files</span></button>
          <div className="nav-section-label">Personal</div>
          <button className="nav-item nav-icon-item" onClick={() => setShowStats(true)}><Icon name="home" /> <span>Progress</span></button>
          <button className="nav-item nav-icon-item" onClick={() => setShowStats(true)}><Icon name="user" /> <span>Memory</span></button>
          <div className="nav-section-label">Account</div>
          <button className="nav-item nav-icon-item" onClick={() => setShowStats(true)}><Icon name="settings" /> <span>Settings</span></button>
          {session && <button className="nav-item nav-icon-item" onClick={() => signOut()}><Icon name="logout" /> <span>Log out</span></button>}
        </nav>

        <div className="sidebar-spacer" />
        <div className="sidebar-user">
          {session ? (
            <>
              <div className="user-avatar">{session.user.email?.[0]?.toUpperCase() || 'U'}</div>
              <span>{authenticatedDisplayName}</span>
            </>
          ) : (
            <>
              <div className="user-avatar">G</div>
              <span>Guest</span>
            </>
          )}
        </div>
      </aside>
      {mobileNavOpen && <button className="sidebar-backdrop" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}
      <main className="main" style={{ width: '100%' }}>
        {workspaceView !== 'chat' ? <div className="workspace-panel-shell"><button type="button" className="mobile-workspace-back" onClick={() => setWorkspaceView('chat')} aria-label="Back to chat"> <Icon name="arrow-left" /> <span>Back to chat</span></button>{workspaceError && <div className="workspace-error" role="alert">{workspaceError}</div>}{workspaceView === 'projects' ? renderProjectView() : workspaceView === 'plans' ? renderPlanView() : workspaceView === 'homework' ? renderHomeworkView() : workspaceView === 'practice' ? renderPracticeView() : workspaceView === 'simulations' ? renderExperimentRegistryView() : workspaceView === 'resources' ? renderResourcesView() : workspaceView === 'wikipedia' ? renderWikipediaView() : renderYouTubeView()}</div> : <div className="chat-container" style={{ width: '100%' }}>
          <div className="chat-area">
            <div className="chat-header">
              <div className="chat-header-left">
                <button className="mobile-menu-btn" onClick={() => setMobileNavOpen(true)} aria-label="Open navigation"><Icon name="menu" /></button>
              </div>
              <div className="chat-header-identity">
                <span className="identity-label"><span className="identity-indicator" aria-hidden="true" /> Now using {activeTutor}</span>
                <label className="tutor-selector-label">
                  <span className="sr-only">Select tutor</span>
                  <select className="identity-mode" value={activeTutor} onChange={(event) => setActiveMode(modeForTutor(event.target.value as TutorName))}>
                    {TUTORS.map((tutor) => <option key={tutor.name} value={tutor.name}>{tutor.name} · {tutor.description}</option>)}
                  </select>
                </label>
              </div>
              <div className="chat-header-right">
                <button className="theme-toggle" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} title="Toggle theme"><Icon name={theme === 'dark' ? 'sun' : 'moon'} /></button>
              </div>
            </div>

            {!session && <div className="anonymous-note">Anonymous mode: your current chat stays in this browser. Sign in to save learning progress.</div>}
            {activeProjectContext && (
              <div className="project-context-bar">
                <div className="project-context-kicker">Project context</div>
                <div className="project-context-main">
                  <strong>{activeProjectContext.projectName}</strong>
                  <span>{activeProjectContext.subject || 'Focused learning project'}</span>
                </div>
                {activeProjectContext.studyPlanId && <div className="project-context-badge">Study plan active</div>}
              </div>
            )}

            {/* Focused empty state keeps the first screen conversational. */}
            {messages.length === 0 && !isThinking && (
              <div className="welcome-hero" role="region" aria-label="Welcome">
                <div className="welcome-card">
                  <div className="welcome-title">{greeting}</div>
                  <div className="welcome-sub">What is on your mind?</div>
                  <div className="welcome-actions">
                    <button className="action-btn" onClick={() => handleSend('Explain a concept')}>Explain a concept</button>
                    <button className="action-btn" onClick={() => handleSend('Help me study')}>Help me study</button>
                    <button className="action-btn" onClick={() => handleSend('Build a learning plan')}>Build a learning plan</button>
                    <button className="action-btn" onClick={() => handleSend('Analyze a document')}>Analyze a document</button>
                  </div>
                </div>
              </div>
            )}

            <div className="chat-messages" id="messages">
              {envError && (
                <div style={{ padding: 12, background: '#ffe6e6', color: '#6b0000', borderRadius: 8, marginBottom: 12 }} role="alert">
                  {envError}
                </div>
              )}
              {messages.filter((m) => m.role === 'user' || m.role === 'assistant').map((m, i) => (
                <div key={m.id || i} className={`message ${m.role}`}>
                  <div className={`bubble ${m.role === 'user' ? 'user' : 'assistant'}`}>
                    {m.role === 'assistant' ? renderParsedText(m.text) : <div className="whitespace-pre-line">{m.text}</div>}
                  </div>
                </div>
              ))}

              {isThinking && (
                <div className="message assistant">
                  <div className="bubble assistant">...<span className="dots">●●●</span></div>
                </div>
              )}

              <div ref={lastMessageRef} />
            </div>

            <div className="chat-input">
              {pendingAttachment && <div className="attachment-preview" role="status">{pendingAttachment.previewUrl ? <img src={pendingAttachment.previewUrl} alt="Attachment preview" /> : <span className="attachment-file-icon" aria-hidden="true">FILE</span>}<span className="attachment-details"><strong>{pendingAttachment.file.name}</strong><small>{Math.ceil(pendingAttachment.file.size / 1024)} KB</small></span><button type="button" className="attachment-remove" onClick={removeAttachment} aria-label="Remove attachment">×</button></div>}
              {attachmentError && <div className="attachment-error" role="alert">{attachmentError}</div>}
              <div className="attachment-picker">
                <button type="button" className="attachment-button" onClick={() => setAttachmentMenuOpen((open) => !open)} aria-label="Add attachment" aria-expanded={attachmentMenuOpen}><Icon name="paperclip" /></button>
                {attachmentMenuOpen && <div className="attachment-menu" role="menu"><button type="button" onClick={() => cameraInputRef.current?.click()} role="menuitem">Take photo</button><button type="button" onClick={() => imageInputRef.current?.click()} role="menuitem">Choose image</button><button type="button" onClick={() => documentInputRef.current?.click()} role="menuitem">Upload file</button></div>}
                <input ref={cameraInputRef} className="sr-only" type="file" accept="image/*" capture="environment" onChange={handleAttachmentInput} />
                <input ref={imageInputRef} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleAttachmentInput} />
                <input ref={documentInputRef} className="sr-only" type="file" accept="application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={handleAttachmentInput} />
              </div>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask Cognita anything..."
                className="chat-input-field"
                rows={1}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
              />

              <div className="mic-wrapper">
                <button
                  className={`mic-btn ${micState} ${isRecording ? 'recording' : ''}`}
                  onClick={() => (micState === 'listening' ? stopRecording() : startRecording())}
                  title={micState === 'listening' ? 'Stop recording' : 'Start voice input'}
                  aria-pressed={micState === 'listening'}
                >
                  <Icon name={micState === 'listening' ? 'stop' : 'mic'} />
                </button>

                <div className={`waveform ${micState}`} ref={barsRef} aria-hidden>
                  {Array.from({ length: 16 }).map((_, i) => (
                    <span key={i} className="bar" />
                  ))}
                </div>

                <div className="mic-status" aria-live="polite">
                  {micState === 'listening' ? 'Listening...' : micState === 'processing' ? 'Processing...' : micError ? `Error: ${micError}` : ''}
                </div>
              </div>

              <button
                onClick={() => handleSend()}
                disabled={isThinking || (!input.trim() && !pendingAttachment)}
                className={`send-btn ${isThinking ? '' : 'pulse'}`}
                aria-disabled={isThinking || (!input.trim() && !pendingAttachment)}
              >
                {isThinking ? (pendingAttachment ? 'Analyzing...' : 'Sending...') : 'Send'}
              </button>
            </div>
          </div>
          {showStats && (
            <aside className="stats-panel" role="region" aria-label="Learning statistics">
              {session && <form className="workspace-form" onSubmit={saveProfile}>
                <h4>Account</h4>
                <label className="small" htmlFor="display-name">Display name</label>
                <input id="display-name" value={profileName} onChange={(event) => setProfileName(event.target.value)} placeholder="Your display name" maxLength={80} />
                <button className="send-btn" type="submit" disabled={profileSaving}>{profileSaving ? 'Saving...' : 'Save profile'}</button>
                {profileMessage && <div className="muted" role="status">{profileMessage}</div>}
              </form>}
              <h4>Learning Dashboard</h4>
              <div className="stat-row"><div>Total messages</div><div>{stats.totalMessages}</div></div>
              <div className="stat-row"><div>Responses</div><div>{stats.responses}</div></div>
              <div className="stat-row"><div>Understood</div><div>{stats.understood}</div></div>
              <div style={{ marginTop: 12 }}>
                <strong>By Subject</strong>
                <div className="stat-subject">
                  {Object.keys((stats.subjects as any) || {}).length === 0 && <div className="muted">No data yet</div>}
                  {Object.keys((stats.subjects as any) || {}).map((sub) => {
                    const s = (stats.subjects as any)[sub]
                    const pct = s && s.messages ? Math.round(((s.understood || 0) / s.messages) * 100) : 0
                    return (
                      <div key={sub} style={{ marginTop: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><div>{sub}</div><div>{pct}%</div></div>
                        <div className="subject-bar"><div className="subject-fill" style={{ width: `${pct}%` }} /></div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </aside>
          )}
        </div>}
      </main>
      {showProjectEditForm && <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowProjectEditForm(false)}><form className="auth-modal workspace-form" onSubmit={saveProjectEdit} onMouseDown={(event) => event.stopPropagation()}><button type="button" className="modal-close" onClick={() => setShowProjectEditForm(false)} aria-label="Close">×</button><h2>Edit project</h2><label>Project name<input value={projectEditTitle} onChange={(event) => setProjectEditTitle(event.target.value)} required /></label><label>Subject<input value={projectEditSubject} onChange={(event) => setProjectEditSubject(event.target.value)} required /></label><label>Goal<textarea value={projectEditGoal} onChange={(event) => setProjectEditGoal(event.target.value)} required /></label><label>Details<textarea value={projectEditDescription} onChange={(event) => setProjectEditDescription(event.target.value)} /></label><div className="form-two-column"><label>Deadline<input type="date" value={projectEditDeadline} onChange={(event) => setProjectEditDeadline(event.target.value)} /></label><label>Status<select value={projectEditStatus} onChange={(event) => setProjectEditStatus(event.target.value)}><option value="active">Active</option><option value="completed">Completed</option></select></label></div><label>Progress (%)<input type="number" min="0" max="100" value={projectEditProgress} onChange={(event) => setProjectEditProgress(event.target.value)} /></label><button className="send-btn" type="submit" disabled={projectEditLoading}>{projectEditLoading ? 'Saving…' : 'Save project'}</button></form></div>}
      {showProjectForm && <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowProjectForm(false)}><form className="auth-modal workspace-form" onSubmit={createProject} onMouseDown={(event) => event.stopPropagation()}><button type="button" className="modal-close" onClick={() => setShowProjectForm(false)} aria-label="Close">×</button><h2>New project</h2><p className="workspace-muted">Define the outcome first. Cognita will use this context while you work.</p><label>Project name<input aria-label="Project title" placeholder="e.g. Build a Python calculator" value={projectTitle} onChange={(event) => setProjectTitle(event.target.value)} required /></label><label>Subject<input aria-label="Subject" placeholder="e.g. Computer science" value={projectSubject} onChange={(event) => setProjectSubject(event.target.value)} required /></label><label>Goal<textarea aria-label="Goal" placeholder="What should you be able to do?" value={projectGoal} onChange={(event) => setProjectGoal(event.target.value)} required /></label><label>Details<textarea aria-label="Description" placeholder="Optional project notes" value={projectDescription} onChange={(event) => setProjectDescription(event.target.value)} /></label><div className="form-two-column"><label>Deadline<input aria-label="Deadline" type="date" value={projectDeadline} onChange={(event) => setProjectDeadline(event.target.value)} /></label><label>Status<select aria-label="Status" value={projectStatus} onChange={(event) => setProjectStatus(event.target.value)}><option value="active">Active</option><option value="completed">Completed</option></select></label></div><label>Progress (%)<input aria-label="Progress" type="number" min="0" max="100" value={projectProgress} onChange={(event) => setProjectProgress(event.target.value)} /></label><button className="send-btn" type="submit" disabled={projectLoading}>{projectLoading ? 'Creating…' : 'Create project'}</button></form></div>}
      {showPlanForm && <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowPlanForm(false)}><form className="auth-modal workspace-form" onSubmit={createPlan} onMouseDown={(event) => event.stopPropagation()}><button type="button" className="modal-close" onClick={() => setShowPlanForm(false)} aria-label="Close">×</button><h2>New study plan</h2><p className="workspace-muted">Turn a goal into a short sequence of topics you can continue with Cognita.</p><label>Plan name<input aria-label="Plan title" placeholder="e.g. Algebra foundations" value={planTitle} onChange={(event) => setPlanTitle(event.target.value)} required /></label><label>Subject<input aria-label="Plan subject" placeholder="e.g. Mathematics" value={planSubject} onChange={(event) => setPlanSubject(event.target.value)} required /></label><label>Learning goal<textarea aria-label="Objective" placeholder="What should this plan help you achieve?" value={planObjective} onChange={(event) => setPlanObjective(event.target.value)} required /></label><div className="form-two-column"><label>Level<select aria-label="Learner level" value={planLevel} onChange={(event) => setPlanLevel(event.target.value)}><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></label><label>Deadline<input aria-label="Deadline" type="date" value={planDeadline} onChange={(event) => setPlanDeadline(event.target.value)} /></label></div><label>Available study time<input aria-label="Available time" placeholder="e.g. 30 minutes per day" value={planTime} onChange={(event) => setPlanTime(event.target.value)} /></label><label>Topics <span className="field-help">One topic per line, in study order.</span><textarea aria-label="Topics" placeholder="Linear equations&#10;Graphing&#10;Word problems" value={planTopics} onChange={(event) => setPlanTopics(event.target.value)} required /></label><button className="send-btn" type="submit" disabled={studyPlanLoading}>{studyPlanLoading ? 'Creating…' : 'Create study plan'}</button></form></div>}
      {showAuthModal && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowAuthModal(false)}>
          <form className="auth-modal" onSubmit={handleSignIn} onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="modal-close" onClick={() => setShowAuthModal(false)} aria-label="Close">×</button>
            <h2>{authMode === 'signin' ? 'Welcome back' : 'Create your free account'}</h2>
            <p>Save conversations, learning progress, study plans, and personalized memory.</p>
            <input aria-label="Email" type="email" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} placeholder="Email" required />
            <input aria-label="Password" type="password" value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} placeholder="Password" minLength={6} required />
            {authMode === 'signup' && <label className="terms-check"><input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} /> <span>I accept the <a href="/terms">Terms &amp; Conditions</a>.</span></label>}
            {(authFormError || authError) && <div role="alert" className="form-error">{authFormError || authError}</div>}
            <button className="send-btn" type="submit">{authMode === 'signin' ? 'Sign in' : 'Create account'}</button>
            <button type="button" className="auth-switch" onClick={() => { setAuthMode(authMode === 'signin' ? 'signup' : 'signin'); setAuthFormError(null) }}>{authMode === 'signin' ? 'Need an account? Sign up' : 'Already have an account? Sign in'}</button>
          </form>
        </div>
      )}
    </div>
  )
}
