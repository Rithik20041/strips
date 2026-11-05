'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence, useScroll, useTransform, useInView } from 'framer-motion'

// ─── Types ───────────────────────────────────────────────────────────────────

type Predicate = string
type STRIPSState = Set<Predicate>

interface STRIPSAction {
  name: string
  params: string[]
  preconditions: Predicate[]
  addEffects: Predicate[]
  deleteEffects: Predicate[]
}

interface PlanStep {
  action: STRIPSAction
  instantiation: Record<string, string>
  stateAfter: Predicate[]
}

interface BlockConfig {
  stacks: string[][]
  onTable: string[]
}

// ─── STRIPS Domain Data ──────────────────────────────────────────────────────

const BLOCK_ACTIONS: STRIPSAction[] = [
  {
    name: 'pickup',
    params: ['?x'],
    preconditions: ['on-table(?x)', 'clear(?x)', 'arm-empty'],
    addEffects: ['holding(?x)'],
    deleteEffects: ['on-table(?x)', 'clear(?x)', 'arm-empty'],
  },
  {
    name: 'putdown',
    params: ['?x'],
    preconditions: ['holding(?x)'],
    addEffects: ['on-table(?x)', 'clear(?x)', 'arm-empty'],
    deleteEffects: ['holding(?x)'],
  },
  {
    name: 'stack',
    params: ['?x', '?y'],
    preconditions: ['holding(?x)', 'clear(?y)'],
    addEffects: ['on(?x,?y)', 'clear(?x)', 'arm-empty'],
    deleteEffects: ['holding(?x)', 'clear(?y)'],
  },
  {
    name: 'unstack',
    params: ['?x', '?y'],
    preconditions: ['on(?x,?y)', 'clear(?x)', 'arm-empty'],
    addEffects: ['holding(?x)', 'clear(?y)'],
    deleteEffects: ['on(?x,?y)', 'clear(?x)', 'arm-empty'],
  },
]

// ─── Helper Components ───────────────────────────────────────────────────────

function SectionHeading({ tag, title, subtitle }: { tag: string; title: string; subtitle: string }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-100px' })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7 }}
      className="mb-16 text-center"
    >
      <span className="text-xs font-mono tracking-[0.3em] text-cyan-400/60 uppercase">{tag}</span>
      <h2 className="mt-3 text-4xl md:text-5xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
        {title}
      </h2>
      <p className="mt-4 text-slate-400 max-w-2xl mx-auto text-lg">{subtitle}</p>
    </motion.div>
  )
}

function CodeBlock({ children, title, accent = 'cyan' }: { children: string; title?: string; accent?: string }) {
  const colors: Record<string, string> = {
    cyan: 'border-cyan-500/20',
    purple: 'border-purple-500/20',
    green: 'border-green-500/20',
    orange: 'border-orange-500/20',
  }
  return (
    <div className={`code-block border ${colors[accent] || colors.cyan} overflow-hidden`}>
      {title && (
        <div className="px-4 py-2 border-b border-white/5 flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/70" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
            <div className="w-3 h-3 rounded-full bg-green-500/70" />
          </div>
          <span className="text-xs text-slate-500 ml-2">{title}</span>
        </div>
      )}
      <pre className="p-4 overflow-x-auto"><code>{children}</code></pre>
    </div>
  )
}

function PredicateBadge({ text, variant = 'default' }: { text: string; variant?: 'default' | 'add' | 'delete' | 'active' }) {
  const styles: Record<string, string> = {
    default: 'border-slate-600 text-slate-300 bg-slate-800/50',
    add: 'border-green-500/50 text-green-400 bg-green-500/10',
    delete: 'border-red-500/50 text-red-400 bg-red-500/10 line-through',
    active: 'border-cyan-500/50 text-cyan-400 bg-cyan-500/10',
  }
  return (
    <span className={`state-badge ${styles[variant]}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {text}
    </span>
  )
}

// ─── Floating Particles Background ───────────────────────────────────────────

function ParticleField() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {Array.from({ length: 30 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 bg-cyan-400/20 rounded-full"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
          }}
          animate={{
            y: [0, -30, 0],
            x: [0, Math.random() * 20 - 10, 0],
            opacity: [0.1, 0.4, 0.1],
          }}
          transition={{
            duration: 4 + Math.random() * 4,
            repeat: Infinity,
            delay: Math.random() * 4,
          }}
        />
      ))}
    </div>
  )
}

// ─── Navigation ──────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { id: 'overview', label: 'Overview' },
  { id: 'formalism', label: 'Formalism' },
  { id: 'operators', label: 'Operators' },
  { id: 'planner', label: 'Planner' },
  { id: 'learning', label: 'Learning' },
  { id: 'complexity', label: 'Complexity' },
]

function Navigation({ active }: { active: string }) {
  return (
    <motion.nav
      initial={{ y: -60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-[#0a0a0f]/80 border-b border-white/5"
    >
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        <a href="#" className="font-mono text-sm font-bold tracking-wider text-cyan-400">
          STRIPS<span className="text-purple-400">.explain</span>
        </a>
        <div className="hidden md:flex items-center gap-8">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className={`nav-link font-mono ${active === item.id ? 'active' : ''}`}
            >
              {item.label}
            </a>
          ))}
        </div>
        <div className="text-xs font-mono text-slate-500">
          v3.1 <span className="text-green-400">●</span>
        </div>
      </div>
    </motion.nav>
  )
}

// ─── Hero Section ────────────────────────────────────────────────────────────

function HeroSection() {
  const [typed, setTyped] = useState('')
  const fullText = 'STRIPS( S₀, G, A ) → π*'

  useEffect(() => {
    let i = 0
    const interval = setInterval(() => {
      if (i <= fullText.length) {
        setTyped(fullText.slice(0, i))
        i++
      } else {
        clearInterval(interval)
      }
    }, 80)
    return () => clearInterval(interval)
  }, [])

  return (
    <section className="relative min-h-screen flex items-center justify-center grid-bg overflow-hidden">
      {/* Gradient orbs */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-purple-500/10 rounded-full blur-[120px]" />

      <div className="relative z-10 text-center px-6 max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8 }}
        >
          <div className="mb-6 inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-cyan-500/20 bg-cyan-500/5 text-xs font-mono text-cyan-400">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            Stanford Research Institute, 1971
          </div>

          <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tight">
            <span className="bg-gradient-to-r from-cyan-400 via-white to-purple-400 bg-clip-text text-transparent">
              STRIPS
            </span>
          </h1>

          <p className="mt-4 text-xl md:text-2xl text-slate-400 font-light">
            Classical Planning & Action Model Learning
          </p>

          <div className="mt-10 inline-block">
            <div className="code-block px-8 py-4 text-lg md:text-xl font-mono">
              <span className="text-purple-400">solve</span>
              <span className="text-slate-500">(</span>
              <span className="text-cyan-400">{typed}</span>
              <span className="animate-pulse text-cyan-400">▋</span>
              <span className="text-slate-500">)</span>
            </div>
          </div>

          <p className="mt-8 text-sm text-slate-500 max-w-xl mx-auto">
            A foundational AI formalism for representing states, actions, and goals — enabling automated reasoning about how to transform the world from an initial state to a desired goal.
          </p>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-10 left-1/2 -translate-x-1/2"
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <div className="w-6 h-10 rounded-full border-2 border-cyan-500/30 flex items-start justify-center pt-2">
            <div className="w-1 h-2 bg-cyan-400 rounded-full" />
          </div>
        </motion.div>
      </div>
    </section>
  )
}

// ─── Overview Section ────────────────────────────────────────────────────────

function OverviewSection() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-100px' })

  const cards = [
    {
      icon: '⟨S⟩',
      title: 'States',
      desc: 'A finite set of ground atomic propositions (predicates) describing the world.',
      color: 'cyan',
      detail: 'S ⊆ P(Predicates)',
    },
    {
      icon: '⟨A⟩',
      title: 'Actions',
      desc: 'Parameterized operators with preconditions, add-lists, and delete-lists.',
      color: 'purple',
      detail: 'A = ⟨Pre, Add, Del⟩',
    },
    {
      icon: '⟨G⟩',
      title: 'Goals',
      desc: 'A conjunction of predicates that the planner must achieve.',
      color: 'green',
      detail: 'G ⊆ S_goal',
    },
    {
      icon: '⟨π⟩',
      title: 'Plans',
      desc: 'A sequence of grounded actions transforming S₀ into a state satisfying G.',
      color: 'orange',
      detail: 'π = ⟨a₁, a₂, …, aₙ⟩',
    },
  ]

  const colorMap: Record<string, string> = {
    cyan: 'border-cyan-500/30 hover:border-cyan-500/60',
    purple: 'border-purple-500/30 hover:border-purple-500/60',
    green: 'border-green-500/30 hover:border-green-500/60',
    orange: 'border-orange-500/30 hover:border-orange-500/60',
  }

  const glowMap: Record<string, string> = {
    cyan: 'box-glow-cyan',
    purple: 'box-glow-purple',
    green: 'box-glow-green',
    orange: 'box-glow-orange',
  }

  return (
    <section id="overview" className="py-32 px-6 relative">
      <div className="max-w-6xl mx-auto">
        <SectionHeading
          tag="01 — Foundation"
          title="The Planning Problem"
          subtitle="STRIPS formalizes planning as a state-space search: given an initial state and goal conditions, find a sequence of operators that reaches the goal."
        />

        <div ref={ref} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {cards.map((card, i) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 40 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: i * 0.15, duration: 0.6 }}
              className={`group relative p-6 rounded-xl border bg-[#12121a]/80 backdrop-blur transition-all duration-300 ${colorMap[card.color]} ${glowMap[card.color]}`}
            >
              <div className="text-3xl font-mono font-bold text-white/20 group-hover:text-white/40 transition-colors">
                {card.icon}
              </div>
              <h3 className="mt-4 text-lg font-semibold">{card.title}</h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">{card.desc}</p>
              <div className="mt-4 font-mono text-xs text-cyan-400/60">{card.detail}</div>
            </motion.div>
          ))}
        </div>

        {/* Formal definition */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.7, duration: 0.6 }}
          className="mt-16"
        >
          <CodeBlock title="formal_definition.strips">
            {`  ╔══════════════════════════════════════════════════════════════════╗
  ║  STRIPS Planning Problem  Π = ⟨ P, A, I, G ⟩                  ║
  ╠══════════════════════════════════════════════════════════════════╣
  ║                                                                ║
  ║  P  =  { p₁, p₂, …, pₙ }          ▸ finite set of predicates ║
  ║  A  =  { a₁, a₂, …, aₘ }          ▸ finite set of actions    ║
  ║  I  ⊆  P                           ▸ initial state            ║
  ║  G  ⊆  P                           ▸ goal conditions          ║
  ║                                                                ║
  ║  Each action  aᵢ = ⟨ Pre(aᵢ), Add(aᵢ), Del(aᵢ) ⟩            ║
  ║                                                                ║
  ║  Applicability:  a applicable in s  ⟺  Pre(a) ⊆ s            ║
  ║  Successor:      γ(s, a) = (s \\ Del(a)) ∪ Add(a)             ║
  ║                                                                ║
  ║  Solution:  π = ⟨a₁,…,aₖ⟩  s.t.  G ⊆ γ(…γ(γ(I,a₁),a₂)…,aₖ)║
  ╚══════════════════════════════════════════════════════════════════╝`}
          </CodeBlock>
        </motion.div>
      </div>
    </section>
  )
}

// ─── Formalism Section with CWA ──────────────────────────────────────────────

function FormalismSection() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-100px' })
  const [showCWA, setShowCWA] = useState(false)

  const worldFacts = [
    'on(A, B)', 'on(B, Table)', 'on(C, Table)',
    'clear(A)', 'clear(C)', 'arm-empty',
  ]
  const cwaNegative = [
    '¬on(A, C)', '¬on(B, A)', '¬on(C, B)',
    '¬on(A, Table)', '¬on(C, A)', '¬holding(A)',
    '¬holding(B)', '¬holding(C)', '¬clear(B)',
  ]

  return (
    <section id="formalism" className="py-32 px-6 relative">
      <div className="absolute top-0 right-0 w-80 h-80 bg-purple-500/5 rounded-full blur-[100px]" />
      <div className="max-w-6xl mx-auto relative">
        <SectionHeading
          tag="02 — State Representation"
          title="Closed-World Assumption"
          subtitle="STRIPS adopts the Closed-World Assumption: any predicate not explicitly in the state is assumed false."
        />

        <div ref={ref} className="grid md:grid-cols-2 gap-8">
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6 }}
            className="p-6 rounded-xl border border-green-500/20 bg-[#12121a]/80"
          >
            <div className="flex items-center gap-2 mb-4">
              <span className="w-3 h-3 rounded-full bg-green-500" />
              <h3 className="font-mono text-green-400 text-sm font-semibold">TRUE — Explicit Propositions</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {worldFacts.map((fact) => (
                <motion.div key={fact} layout>
                  <PredicateBadge text={fact} variant="add" />
                </motion.div>
              ))}
            </div>
            <p className="mt-4 text-xs text-slate-500">
              These 6 predicates fully describe the state. Everything else is false.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="p-6 rounded-xl border border-red-500/20 bg-[#12121a]/80"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500/50" />
                <h3 className="font-mono text-red-400 text-sm font-semibold">FALSE — Implicit via CWA</h3>
              </div>
              <button onClick={() => setShowCWA(!showCWA)} className="btn-cyber text-xs py-1 px-3">
                {showCWA ? 'HIDE' : 'REVEAL'}
              </button>
            </div>
            <AnimatePresence>
              {showCWA ? (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex flex-wrap gap-2"
                >
                  {cwaNegative.map((fact) => (
                    <PredicateBadge key={fact} text={fact} variant="delete" />
                  ))}
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="h-20 flex items-center justify-center border border-dashed border-red-500/20 rounded-lg"
                >
                  <span className="text-sm text-slate-500 font-mono">[ click REVEAL to expose implicit negations ]</span>
                </motion.div>
              )}
            </AnimatePresence>
            <p className="mt-4 text-xs text-slate-500">
              Infinite negations are never stored — only positive atoms live in the state.
            </p>
          </motion.div>
        </div>

        {/* State transition formula */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="mt-12 text-center"
        >
          <div className="inline-block p-6 rounded-xl border border-cyan-500/20 bg-[#12121a]/80 box-glow-cyan">
            <p className="font-mono text-sm text-slate-400 mb-2">State Transition Function</p>
            <p className="font-mono text-lg md:text-xl">
              <span className="text-cyan-400">γ</span>
              <span className="text-slate-500">(</span>
              <span className="text-white">s</span>
              <span className="text-slate-500">, </span>
              <span className="text-purple-400">a</span>
              <span className="text-slate-500">)</span>
              <span className="text-slate-500"> = (</span>
              <span className="text-white">s</span>
              <span className="text-red-400"> ∖ Del</span>
              <span className="text-slate-500">(</span>
              <span className="text-purple-400">a</span>
              <span className="text-slate-500">)</span>
              <span className="text-slate-500">)</span>
              <span className="text-green-400"> ∪ Add</span>
              <span className="text-slate-500">(</span>
              <span className="text-purple-400">a</span>
              <span className="text-slate-500">)</span>
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

// ─── Operators Section ───────────────────────────────────────────────────────

function OperatorsSection() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-100px' })
  const [selectedAction, setSelectedAction] = useState(0)

  const actionColors = ['text-cyan-400', 'text-purple-400', 'text-green-400', 'text-orange-400']

  return (
    <section id="operators" className="py-32 px-6 relative">
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-[120px]" />
      <div className="max-w-6xl mx-auto relative">
        <SectionHeading
          tag="03 — Action Schema"
          title="STRIPS Operators"
          subtitle="Each action is a triple of preconditions, add-effects, and delete-effects — the building blocks of state transformation."
        />

        <div ref={ref} className="grid lg:grid-cols-3 gap-8">
          {/* Action selector */}
          <div className="space-y-3">
            <p className="text-xs font-mono text-slate-500 mb-4">SELECT OPERATOR ▸</p>
            {BLOCK_ACTIONS.map((action, i) => (
              <motion.button
                key={action.name}
                initial={{ opacity: 0, x: -20 }}
                animate={isInView ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: i * 0.1 }}
                onClick={() => setSelectedAction(i)}
                className={`w-full text-left p-4 rounded-lg border transition-all font-mono text-sm ${
                  selectedAction === i
                    ? 'border-cyan-500/50 bg-cyan-500/10 box-glow-cyan'
                    : 'border-white/5 bg-[#12121a]/60 hover:border-white/10'
                }`}
              >
                <span className={actionColors[i]}>{action.name}</span>
                <span className="text-slate-500">({action.params.join(', ')})</span>
              </motion.button>
            ))}
          </div>

          {/* Action detail */}
          <div className="lg:col-span-2">
            <AnimatePresence mode="wait">
              <motion.div
                key={selectedAction}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                {/* Header */}
                <div className="p-6 rounded-xl border border-white/10 bg-[#12121a]/80">
                  <h3 className="text-2xl font-mono font-bold">
                    <span className={actionColors[selectedAction]}>
                      {BLOCK_ACTIONS[selectedAction].name}
                    </span>
                    <span className="text-slate-500">
                      ({BLOCK_ACTIONS[selectedAction].params.join(', ')})
                    </span>
                  </h3>
                </div>

                {/* Preconditions */}
                <div className="p-5 rounded-xl border border-blue-500/20 bg-blue-500/5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-blue-400 text-lg">⊢</span>
                    <h4 className="font-mono text-blue-400 text-sm font-semibold">PRECONDITIONS</h4>
                    <span className="text-xs text-slate-500 font-mono ml-auto">must hold in current state</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {BLOCK_ACTIONS[selectedAction].preconditions.map((p) => (
                      <PredicateBadge key={p} text={p} variant="active" />
                    ))}
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  {/* Add effects */}
                  <div className="p-5 rounded-xl border border-green-500/20 bg-green-500/5">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-green-400 text-lg">+</span>
                      <h4 className="font-mono text-green-400 text-sm font-semibold">ADD LIST</h4>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {BLOCK_ACTIONS[selectedAction].addEffects.map((p) => (
                        <PredicateBadge key={p} text={p} variant="add" />
                      ))}
                    </div>
                  </div>

                  {/* Delete effects */}
                  <div className="p-5 rounded-xl border border-red-500/20 bg-red-500/5">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-red-400 text-lg">−</span>
                      <h4 className="font-mono text-red-400 text-sm font-semibold">DELETE LIST</h4>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {BLOCK_ACTIONS[selectedAction].deleteEffects.map((p) => (
                        <PredicateBadge key={p} text={p} variant="delete" />
                      ))}
                    </div>
                  </div>
                </div>

                {/* PDDL-like representation */}
                <CodeBlock title={`${BLOCK_ACTIONS[selectedAction].name}.pddl`} accent="purple">
                  {`(:action ${BLOCK_ACTIONS[selectedAction].name}
  :parameters (${BLOCK_ACTIONS[selectedAction].params.join(' ')})
  :precondition (and
    ${BLOCK_ACTIONS[selectedAction].preconditions.map((p) => `(${p.replace(/\(/, ' ').replace(/,/g, ' ').replace(/\)/, '')})`).join('\n    ')})
  :effect (and
    ${BLOCK_ACTIONS[selectedAction].addEffects.map((p) => `(${p.replace(/\(/, ' ').replace(/,/g, ' ').replace(/\)/, '')})`).join('\n    ')}
    ${BLOCK_ACTIONS[selectedAction].deleteEffects.map((p) => `(not (${p.replace(/\(/, ' ').replace(/,/g, ' ').replace(/\)/, '')}))`).join('\n    ')}))`}
                </CodeBlock>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Interactive Planner Section ─────────────────────────────────────────────

function PlannerSection() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-100px' })
  const [step, setStep] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Block World: move A from on top of B to on top of C
  const planSteps = [
    {
      label: 'Initial State',
      action: null,
      stacks: [['B', 'A'], ['C']],
      state: ['on(A,B)', 'on(B,Table)', 'on(C,Table)', 'clear(A)', 'clear(C)', 'arm-empty'],
      highlight: null,
    },
    {
      label: 'unstack(A, B)',
      action: 'unstack',
      stacks: [['B'], ['C']],
      holding: 'A',
      state: ['on(B,Table)', 'on(C,Table)', 'clear(B)', 'clear(C)', 'holding(A)'],
      highlight: 'unstack',
      added: ['holding(A)', 'clear(B)'],
      deleted: ['on(A,B)', 'clear(A)', 'arm-empty'],
    },
    {
      label: 'stack(A, C)',
      action: 'stack',
      stacks: [['B'], ['C', 'A']],
      state: ['on(B,Table)', 'on(C,Table)', 'on(A,C)', 'clear(B)', 'clear(A)', 'arm-empty'],
      highlight: 'stack',
      added: ['on(A,C)', 'clear(A)', 'arm-empty'],
      deleted: ['holding(A)', 'clear(C)'],
    },
  ]

  const blockColors: Record<string, string> = {
    A: 'bg-gradient-to-br from-cyan-500 to-cyan-600 shadow-lg shadow-cyan-500/30',
    B: 'bg-gradient-to-br from-purple-500 to-purple-600 shadow-lg shadow-purple-500/30',
    C: 'bg-gradient-to-br from-orange-500 to-orange-600 shadow-lg shadow-orange-500/30',
  }

  const play = useCallback(() => {
    if (isPlaying) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      setIsPlaying(false)
      return
    }
    setIsPlaying(true)
    setStep(0)
    let current = 0
    intervalRef.current = setInterval(() => {
      current++
      if (current >= planSteps.length) {
        if (intervalRef.current) clearInterval(intervalRef.current)
        setIsPlaying(false)
        return
      }
      setStep(current)
    }, 2000)
  }, [isPlaying])

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  const current = planSteps[step]

  return (
    <section id="planner" className="py-32 px-6 relative">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/5 rounded-full blur-[150px]" />
      <div className="max-w-6xl mx-auto relative">
        <SectionHeading
          tag="04 — Forward Search"
          title="Interactive Planner"
          subtitle="Watch a forward-search planner solve a Blocks World problem step-by-step. Click play or step through manually."
        />

        <div ref={ref} className="grid lg:grid-cols-2 gap-8">
          {/* Block World Visualization */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            className="p-8 rounded-xl border border-cyan-500/20 bg-[#12121a]/80 box-glow-cyan"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-mono text-sm text-cyan-400">BLOCKS WORLD</h3>
              <span className="text-xs font-mono text-slate-500">
                step {step}/{planSteps.length - 1}
              </span>
            </div>

            {/* Visual blocks */}
            <div className="relative h-56 flex items-end justify-center gap-16">
              {/* Holding area */}
              {'holding' in current && current.holding && (
                <motion.div
                  className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-col items-center"
                  initial={{ y: 60, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 200 }}
                >
                  <div className="text-xs font-mono text-slate-500 mb-2">🤖 holding</div>
                  <div className={`block ${blockColors[current.holding]}`}>
                    {current.holding}
                  </div>
                </motion.div>
              )}

              {/* Stacks */}
              {current.stacks.map((stack, si) => (
                <div key={si} className="flex flex-col-reverse items-center">
                  {/* Table surface */}
                  <div className="w-20 h-1 bg-slate-700 rounded-full mb-1" />
                  {stack.map((block, bi) => (
                    <motion.div
                      key={block}
                      layout
                      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                      className={`block ${blockColors[block]} mb-1`}
                    >
                      {block}
                    </motion.div>
                  ))}
                </div>
              ))}
            </div>

            {/* Controls */}
            <div className="mt-6 flex items-center justify-center gap-4">
              <button
                onClick={() => setStep(Math.max(0, step - 1))}
                disabled={step === 0 || isPlaying}
                className="btn-cyber py-2 px-4 disabled:opacity-30"
              >
                ◀ PREV
              </button>
              <button onClick={play} className={`btn-cyber py-2 px-6 ${isPlaying ? 'active' : ''}`}>
                {isPlaying ? '■ STOP' : '▶ PLAY'}
              </button>
              <button
                onClick={() => setStep(Math.min(planSteps.length - 1, step + 1))}
                disabled={step === planSteps.length - 1 || isPlaying}
                className="btn-cyber py-2 px-4 disabled:opacity-30"
              >
                NEXT ▶
              </button>
            </div>

            {/* Current action label */}
            <div className="mt-4 text-center">
              <span className={`font-mono text-sm ${current.action ? 'text-cyan-400' : 'text-slate-500'}`}>
                {current.label}
              </span>
            </div>
          </motion.div>

          {/* State panel */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.2 }}
            className="space-y-4"
          >
            {/* Current state */}
            <div className="p-5 rounded-xl border border-white/10 bg-[#12121a]/80">
              <h4 className="font-mono text-xs text-slate-500 mb-3">CURRENT STATE S{step > 0 ? `₍${step}₎` : '₀'}</h4>
              <div className="flex flex-wrap gap-2">
                {current.state.map((p) => (
                  <PredicateBadge
                    key={p}
                    text={p}
                    variant={'added' in current && current.added?.includes(p) ? 'add' : 'active'}
                  />
                ))}
              </div>
            </div>

            {/* Effects */}
            {'added' in current && current.added && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-3"
              >
                <div className="p-4 rounded-xl border border-green-500/20 bg-green-500/5">
                  <h4 className="font-mono text-xs text-green-400 mb-2">+ ADDED</h4>
                  <div className="flex flex-wrap gap-2">
                    {current.added.map((p) => (
                      <PredicateBadge key={p} text={p} variant="add" />
                    ))}
                  </div>
                </div>
                {'deleted' in current && current.deleted && (
                  <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5">
                    <h4 className="font-mono text-xs text-red-400 mb-2">− DELETED</h4>
                    <div className="flex flex-wrap gap-2">
                      {current.deleted.map((p) => (
                        <PredicateBadge key={p} text={p} variant="delete" />
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* Goal check */}
            <div className={`p-4 rounded-xl border ${
              step === planSteps.length - 1
                ? 'border-green-500/30 bg-green-500/10'
                : 'border-white/5 bg-[#12121a]/50'
            }`}>
              <h4 className="font-mono text-xs text-slate-500 mb-2">GOAL CHECK</h4>
              <div className="flex items-center gap-3">
                <PredicateBadge text="on(A,C)" variant={step === planSteps.length - 1 ? 'add' : 'default'} />
                <span className="font-mono text-xs">
                  {step === planSteps.length - 1 ? (
                    <span className="text-green-400">✓ SATISFIED</span>
                  ) : (
                    <span className="text-slate-500">✗ not yet</span>
                  )}
                </span>
              </div>
            </div>

            {/* Plan so far */}
            <div className="p-4 rounded-xl border border-purple-500/20 bg-purple-500/5">
              <h4 className="font-mono text-xs text-purple-400 mb-2">PLAN π</h4>
              <div className="font-mono text-sm text-slate-300">
                {step === 0 ? (
                  <span className="text-slate-500">[ empty ]</span>
                ) : (
                  planSteps
                    .slice(1, step + 1)
                    .map((s, i) => (
                      <span key={i}>
                        <span className="text-purple-400">{s.label}</span>
                        {i < step - 1 && <span className="text-slate-500"> → </span>}
                      </span>
                    ))
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

// ─── Learning Section ────────────────────────────────────────────────────────

function LearningSection() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-100px' })
  const [activeTab, setActiveTab] = useState<'observe' | 'learn' | 'refine'>('observe')

  const tabs = {
    observe: {
      title: 'Observe Traces',
      icon: '👁',
      content: (
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            The agent observes state-action-state transitions without knowing the action models:
          </p>
          <CodeBlock title="trace_001.observation">
            {`Trace τ₁:
  s₀ = {on(A,B), clear(A), on-table(B), arm-empty}
  
  action: unstack(A,B)
  
  s₁ = {clear(B), on-table(B), holding(A)}
  
─────────────────────────────────────
  Δ⁺ = s₁ \\ s₀ = {clear(B), holding(A)}
  Δ⁻ = s₀ \\ s₁ = {on(A,B), clear(A), arm-empty}`}
          </CodeBlock>
          <div className="p-4 rounded-lg border border-cyan-500/10 bg-cyan-500/5">
            <p className="text-xs font-mono text-cyan-400/70">
              KEY INSIGHT: Δ⁺ gives us candidate add-effects, Δ⁻ gives candidate delete-effects.
              Preconditions are bounded by s₀ (everything true before the action).
            </p>
          </div>
        </div>
      ),
    },
    learn: {
      title: 'Learn Models',
      icon: '🧠',
      content: (
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            Using ARMS (Action-Relation Modeling System) or similar algorithms, we converge on action models:
          </p>
          <CodeBlock title="learned_model.strips" accent="green">
            {`╔═══ LEARNED ACTION MODEL ═══════════════════════╗
║                                                ║
║  After observing n=50 traces:                  ║
║                                                ║
║  unstack(?x, ?y):                              ║
║    Pre  = {on(?x,?y), clear(?x), arm-empty}    ║
║    Add  = {holding(?x), clear(?y)}             ║
║    Del  = {on(?x,?y), clear(?x), arm-empty}    ║
║                                                ║
║  Confidence: 94.2%                             ║
║  Traces used: 50 | Converged at: trace 37      ║
║                                                ║
║  Status: ██████████████████████░░ 94%           ║
╚════════════════════════════════════════════════╝`}
          </CodeBlock>
          <div className="grid grid-cols-3 gap-3 mt-2">
            {[
              { label: 'Precision', value: '97.1%', color: 'text-green-400' },
              { label: 'Recall', value: '91.5%', color: 'text-cyan-400' },
              { label: 'F1 Score', value: '94.2%', color: 'text-purple-400' },
            ].map((metric) => (
              <div key={metric.label} className="text-center p-3 rounded-lg border border-white/5 bg-white/[0.02]">
                <div className={`font-mono text-lg font-bold ${metric.color}`}>{metric.value}</div>
                <div className="text-xs text-slate-500">{metric.label}</div>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    refine: {
      title: 'Refine & Verify',
      icon: '🔬',
      content: (
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            The learned model is refined through MAX-SAT constraints and verified against held-out traces:
          </p>
          <CodeBlock title="verification.log" accent="orange">
            {`[VERIFY] Running learned model against 20 held-out traces...

  Trace 51: ✓ predicted state matches observed state
  Trace 52: ✓ predicted state matches observed state
  Trace 53: ✗ MISMATCH in predicate 'clear(?x)'
            → Updating precondition constraints
            → Re-solving weighted MAX-SAT...
  Trace 54: ✓ match after refinement
  ...
  Trace 70: ✓ all predicates match

[RESULT] 19/20 traces matched (95.0%)
[ACTION] Precondition for 'stack' refined:
         Old: {holding(?x)}
         New: {holding(?x), clear(?y)}     ← added constraint`}
          </CodeBlock>
          <div className="p-4 rounded-lg border border-orange-500/10 bg-orange-500/5">
            <p className="text-xs font-mono text-orange-400/70">
              CONVERGENCE: With sufficient diverse traces, learned models provably converge
              to the true STRIPS model under noise-free observations (ARMS guarantee).
            </p>
          </div>
        </div>
      ),
    },
  }

  return (
    <section id="learning" className="py-32 px-6 relative">
      <div className="absolute top-0 left-0 w-80 h-80 bg-green-500/5 rounded-full blur-[100px]" />
      <div className="max-w-6xl mx-auto relative">
        <SectionHeading
          tag="05 — Action Model Learning"
          title="Learning STRIPS Models"
          subtitle="When action schemas are unknown, agents can learn them from observed state-transition traces — inferring preconditions and effects automatically."
        />

        <div ref={ref}>
          {/* Pipeline diagram */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            className="flex flex-wrap items-center justify-center gap-4 mb-12"
          >
            {[
              { label: 'Observe\nTraces', color: 'border-cyan-500/40 text-cyan-400', tab: 'observe' as const },
              null,
              { label: 'Extract\nΔ⁺ / Δ⁻', color: 'border-purple-500/40 text-purple-400', tab: 'learn' as const },
              null,
              { label: 'Solve\nMAX-SAT', color: 'border-blue-500/40 text-blue-400', tab: 'learn' as const },
              null,
              { label: 'Verify &\nRefine', color: 'border-green-500/40 text-green-400', tab: 'refine' as const },
              null,
              { label: 'Learned\nModel', color: 'border-orange-500/40 text-orange-400', tab: 'refine' as const },
            ].map((item, i) =>
              item === null ? (
                <span key={i} className="text-slate-600 font-mono text-lg">→</span>
              ) : (
                <button
                  key={i}
                  onClick={() => setActiveTab(item.tab)}
                  className={`p-4 rounded-lg border text-xs font-mono whitespace-pre-line text-center transition-all ${item.color} ${
                    activeTab === item.tab ? 'bg-white/5 scale-105' : 'bg-transparent hover:bg-white/[0.02]'
                  }`}
                >
                  {item.label}
                </button>
              )
            )}
          </motion.div>

          {/* Tabs */}
          <div className="flex gap-2 mb-6">
            {Object.entries(tabs).map(([key, tab]) => (
              <button
                key={key}
                onClick={() => setActiveTab(key as typeof activeTab)}
                className={`btn-cyber py-2 px-4 text-xs ${activeTab === key ? 'active' : ''}`}
              >
                {tab.icon} {tab.title}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="p-6 rounded-xl border border-white/10 bg-[#12121a]/80"
            >
              {tabs[activeTab].content}
            </motion.div>
          </AnimatePresence>

          {/* Algorithms comparison */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.4 }}
            className="mt-12 overflow-x-auto"
          >
            <table className="w-full text-sm font-mono">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 px-4 text-slate-400 font-normal">Algorithm</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-normal">Input</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-normal">Technique</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-normal">Noise?</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-normal">Year</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['ARMS', 'Traces (s,a,s′)', 'Weighted MAX-SAT', '✗', '2005'],
                  ['SLAF', 'Action sequences', 'Logical filtering', '✗', '2005'],
                  ['LOCM', 'Action sequences only', 'FSM induction', '✗', '2009'],
                  ['AMAN', 'Noisy traces', 'EM + MAX-SAT', '✓', '2012'],
                  ['FAMA', 'Partial obs.', 'Classical planning', '✓', '2018'],
                ].map((row, i) => (
                  <motion.tr
                    key={row[0]}
                    initial={{ opacity: 0, x: -20 }}
                    animate={isInView ? { opacity: 1, x: 0 } : {}}
                    transition={{ delay: 0.5 + i * 0.08 }}
                    className="border-b border-white/5 hover:bg-white/[0.02]"
                  >
                    <td className="py-3 px-4 text-cyan-400">{row[0]}</td>
                    <td className="py-3 px-4 text-slate-300">{row[1]}</td>
                    <td className="py-3 px-4 text-purple-400">{row[2]}</td>
                    <td className="py-3 px-4">{row[3]}</td>
                    <td className="py-3 px-4 text-slate-500">{row[4]}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

// ─── Complexity Section ──────────────────────────────────────────────────────

function ComplexitySection() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-100px' })

  const complexityItems = [
    {
      problem: 'Plan Existence',
      result: 'PSPACE-complete',
      note: 'Given Π, does a valid plan exist?',
      color: 'border-red-500/30',
    },
    {
      problem: 'Bounded Planning',
      result: 'NP-complete',
      note: 'Does a plan of length ≤ k exist?',
      color: 'border-orange-500/30',
    },
    {
      problem: 'Optimal Planning',
      result: 'FP^{NP[log n]}',
      note: 'Find the shortest plan',
      color: 'border-purple-500/30',
    },
    {
      problem: 'Plan Verification',
      result: 'P (polynomial)',
      note: 'Is π valid for Π?',
      color: 'border-green-500/30',
    },
  ]

  return (
    <section id="complexity" className="py-32 px-6 relative">
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-500/5 rounded-full blur-[120px]" />
      <div className="max-w-6xl mx-auto relative">
        <SectionHeading
          tag="06 — Computational Complexity"
          title="Hardness Results"
          subtitle="Classical planning is inherently intractable — yet modern heuristic search planners solve large instances remarkably well in practice."
        />

        <div ref={ref} className="grid md:grid-cols-2 gap-6">
          {complexityItems.map((item, i) => (
            <motion.div
              key={item.problem}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: i * 0.12, duration: 0.5 }}
              className={`p-6 rounded-xl border ${item.color} bg-[#12121a]/80`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-white">{item.problem}</h3>
                  <p className="mt-1 text-sm text-slate-400">{item.note}</p>
                </div>
                <span className="font-mono text-sm text-cyan-400 bg-cyan-500/10 px-3 py-1 rounded-lg whitespace-nowrap">
                  {item.result}
                </span>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Historical timeline */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.6, duration: 0.6 }}
          className="mt-16"
        >
          <h3 className="text-center font-mono text-sm text-slate-500 mb-8">EVOLUTION TIMELINE</h3>
          <div className="relative">
            <div className="absolute top-1/2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />
            <div className="flex justify-between items-center relative">
              {[
                { year: '1971', event: 'STRIPS', color: 'text-cyan-400' },
                { year: '1995', event: 'Graphplan', color: 'text-purple-400' },
                { year: '1998', event: 'PDDL Std.', color: 'text-blue-400' },
                { year: '2004', event: 'FF / Fast\nDownward', color: 'text-green-400' },
                { year: '2011', event: 'LAMA', color: 'text-orange-400' },
                { year: '2020+', event: 'Neural\nPlanners', color: 'text-pink-400' },
              ].map((item, i) => (
                <motion.div
                  key={item.year}
                  initial={{ opacity: 0, y: 20 }}
                  animate={isInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ delay: 0.8 + i * 0.1 }}
                  className="text-center relative"
                >
                  <div className="w-3 h-3 rounded-full bg-current mx-auto mb-2 ring-4 ring-[#0a0a0f]" style={{ color: 'var(--accent-cyan)' }} />
                  <div className={`font-mono text-xs font-bold ${item.color}`}>{item.year}</div>
                  <div className="text-xs text-slate-500 mt-1 whitespace-pre-line">{item.event}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Key insight / relation to modern AI */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 1, duration: 0.6 }}
          className="mt-16 p-8 rounded-xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 to-purple-500/5 box-glow-cyan"
        >
          <div className="flex items-start gap-4">
            <span className="text-3xl">🔗</span>
            <div>
              <h3 className="text-lg font-semibold mb-2">Why STRIPS Still Matters</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                STRIPS underpins modern AI planning: from <span className="text-cyan-400">PDDL-based competition planners</span> to{' '}
                <span className="text-purple-400">robotics task planning</span>,{' '}
                <span className="text-green-400">game AI</span>, and{' '}
                <span className="text-orange-400">LLM-augmented planning</span>. The action-model learning pipeline enables agents to autonomously
                acquire planning knowledge from interaction — bridging the gap between symbolic reasoning and data-driven AI.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

// ─── Footer ──────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="py-16 px-6 border-t border-white/5">
      <div className="max-w-6xl mx-auto text-center">
        <div className="font-mono text-sm text-slate-500">
          <span className="text-cyan-400">STRIPS</span>.explain — An interactive guide to classical planning
        </div>
        <div className="mt-4 flex flex-wrap justify-center gap-4 text-xs font-mono text-slate-600">
          <span>Fikes & Nilsson, 1971</span>
          <span>·</span>
          <span>PDDL 3.1</span>
          <span>·</span>
          <span>IPC Benchmarks</span>
          <span>·</span>
          <span>ARMS (Yang et al., 2005)</span>
        </div>
        <div className="mt-6 text-xs text-slate-700">
          Built with Next.js · Framer Motion · Tailwind CSS
        </div>
      </div>
    </footer>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function Home() {
  const [activeSection, setActiveSection] = useState('overview')

  useEffect(() => {
    const handleScroll = () => {
      const sections = NAV_ITEMS.map((item) => {
        const el = document.getElementById(item.id)
        if (!el) return { id: item.id, top: Infinity }
        return { id: item.id, top: Math.abs(el.getBoundingClientRect().top - 100) }
      })
      const closest = sections.reduce((a, b) => (a.top < b.top ? a : b))
      setActiveSection(closest.id)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <main className="relative">
      <ParticleField />
      <Navigation active={activeSection} />
      <HeroSection />
      <div className="section-divider" />
      <OverviewSection />
      <div className="section-divider" />
      <FormalismSection />
      <div className="section-divider" />
      <OperatorsSection />
      <div className="section-divider" />
      <PlannerSection />
      <div className="section-divider" />
      <LearningSection />
      <div className="section-divider" />
      <ComplexitySection />
      <Footer />
    </main>
  )
}
