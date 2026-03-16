import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from 'react'
import {
  Background,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import './App.css'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Chapter {
  id: string
  index: string
  group: string
  title: string
  subtitle: string
  Figure: ComponentType
  docs: ReactNode
}

/* ------------------------------------------------------------------ */
/*  Chapter definitions                                                */
/* ------------------------------------------------------------------ */

const chapters: Chapter[] = [
  {
    id: 'hero',
    index: '01',
    group: 'Overview',
    title: 'WASM Binary to Rust Source',
    subtitle: 'Landing transformation',
    Figure: HeroFigure,
    docs: (
      <>
        <p>
          The Soroban Decompiler converts compiled WASM smart contracts back
          into readable, idiomatic Rust source code. Unlike generic WASM
          decompilers that produce C-like pseudocode, this tool understands
          Soroban SDK patterns and reconstructs the original developer
          intent&mdash;including storage access, authentication, events, and
          cross-contract calls.
        </p>
        <div className="doc-grid">
          <div className="doc-card">
            <h5>Input</h5>
            <p>
              Any <code>.wasm</code> binary compiled from a Soroban smart
              contract&mdash;from 660B simple contracts to 34KB complex ones.
            </p>
          </div>
          <div className="doc-card">
            <h5>Output</h5>
            <p>
              Formatted Rust source with <code>#[contract]</code>,{' '}
              <code>#[contractimpl]</code>, type definitions, and SDK method
              chains.
            </p>
          </div>
        </div>
        <h4>Core modules</h4>
        <ul>
          <li>
            <code>lib.rs</code> &mdash; Pipeline entry point, orchestrates all 4
            stages
          </li>
          <li>
            <code>spec_extract.rs</code> &mdash; XDR metadata extraction from
            WASM custom sections
          </li>
          <li>
            <code>wasm_analysis/</code> &mdash; Stack simulation engine with
            cross-function tracking
          </li>
          <li>
            <code>pattern_recognizer/</code> &mdash; Host call to SDK pattern
            mapping (150+ patterns)
          </li>
          <li>
            <code>codegen/</code> &mdash; IR to Rust code generation via{' '}
            <code>syn</code> + <code>prettyplease</code>
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'pipeline',
    index: '02',
    group: 'Overview',
    title: 'Four-Stage Pipeline',
    subtitle: 'Core architecture',
    Figure: PipelineFlowFigure,
    docs: (
      <>
        <p>
          The decompiler processes contracts through four sequential stages.
          Each stage produces a well-defined intermediate artifact that feeds
          into the next.
        </p>
        <div className="doc-stages">
          <div className="doc-stage">
            <span className="doc-stage-num">1</span>
            <div>
              <h5>Spec Extraction</h5>
              <p>
                Reads the <code>contractspecv0</code> custom section from the
                WASM binary. Deserializes XDR-encoded metadata describing all
                public functions, struct types, enum types, error codes, and
                events.
              </p>
              <code className="doc-artifact">
                Output: Vec&lt;ScSpecEntry&gt;
              </code>
            </div>
          </div>
          <div className="doc-stage">
            <span className="doc-stage-num">2</span>
            <div>
              <h5>Stack Simulation</h5>
              <p>
                Parses WASM bytecode using the <code>walrus</code> crate, traces
                dispatcher chains to find real implementations, then simulates
                the operand stack instruction-by-instruction.
              </p>
              <code className="doc-artifact">Output: AnalyzedModule</code>
            </div>
          </div>
          <div className="doc-stage">
            <span className="doc-stage-num">3</span>
            <div>
              <h5>Pattern Recognition</h5>
              <p>
                Walks the analyzed block tree, mapping host function calls to SDK
                equivalents. A two-pass algorithm assigns variable names then
                builds IR statements. 11 optimization passes clean up the IR.
              </p>
              <code className="doc-artifact">
                Output: Vec&lt;FunctionIR&gt;
              </code>
            </div>
          </div>
          <div className="doc-stage">
            <span className="doc-stage-num">4</span>
            <div>
              <h5>Code Generation</h5>
              <p>
                Converts the IR into Rust AST using <code>syn</code> and{' '}
                <code>quote</code>, then formats with <code>prettyplease</code>.
                Generates type definitions, function implementations, and
                imports.
              </p>
              <code className="doc-artifact">Output: String (Rust source)</code>
            </div>
          </div>
        </div>
      </>
    ),
  },
  {
    id: 'stack',
    index: '03',
    group: 'Analysis engine',
    title: 'Stack Simulation Engine',
    subtitle: 'Execution semantics',
    Figure: StackFigure,
    docs: (
      <>
        <p>
          The simulation engine executes WASM instructions symbolically,
          tracking abstract values through the operand stack, local variables,
          global variables, and linear memory.
        </p>
        <h4>StackValue types</h4>
        <div className="doc-type-grid">
          {[
            ['Param(n)', 'Function parameter at index n'],
            ['Const(val)', 'Literal i32/i64/f32/f64 constant'],
            ['CallResult(id)', 'Return value from host function call #id'],
            ['BinOp { op, left, right }', 'Arithmetic or comparison expression'],
            ['Local(id) / Global(id)', 'Variable references (locals, globals)'],
            ['Unknown', 'Unresolvable value — fallback'],
          ].map(([type, desc]) => (
            <div key={type}>
              <code>{type}</code>
              <span>{desc}</span>
            </div>
          ))}
        </div>
        <h4>Engine capabilities</h4>
        <ul>
          <li>
            Nested control flow blocks (<code>if/else</code>,{' '}
            <code>loop</code>, <code>block</code>)
          </li>
          <li>
            Guard detection &mdash; <code>br_if</code> + unreachable patterns
          </li>
          <li>Cross-function analysis with depth limit (max 9 levels)</li>
          <li>Shadow stack pointer tracking through globals</li>
          <li>Memory state propagation across function calls</li>
        </ul>
      </>
    ),
  },
  {
    id: 'val',
    index: '04',
    group: 'Analysis engine',
    title: 'Val Encoding Strip',
    subtitle: 'Type recovery',
    Figure: ValFigure,
    docs: (
      <>
        <p>
          Soroban uses a 64-bit tagged value encoding for all data crossing the
          host/guest boundary. Every value is a <code>Val</code>&mdash;a u64
          where low bits encode the type tag and remaining bits encode the
          payload. The decompiler strips this encoding to recover typed Rust
          values.
        </p>
        <h4>Tag encoding</h4>
        <div className="doc-type-grid">
          {[
            ['Bits [0:7]', 'Type tag — identifies the value type'],
            ['Bits [8:63]', 'Payload — the actual data'],
            ['Tag 0 / 1', 'False / True (boolean)'],
            ['Tag 2', 'Void (unit)'],
            ['Tag 4 / 5', 'U32Val / I32Val'],
            ['Tag 6', 'U64Val'],
            ['Tag 14', 'SymbolSmall (6-bit packed chars, max 9)'],
            ['Tag 63', 'Object handle (Vec, Map, Bytes, Address)'],
          ].map(([tag, desc]) => (
            <div key={tag}>
              <code>{tag}</code>
              <span>{desc}</span>
            </div>
          ))}
        </div>
        <h4>Key functions in val_decoding.rs</h4>
        <ul>
          <li>
            <code>strip_val_boilerplate()</code> &mdash; recursively removes
            shift/mask operations from expressions
          </li>
          <li>
            <code>extract_u32_val()</code> &mdash; extracts typed integer from
            tagged Val
          </li>
          <li>
            SymbolSmall decoder &mdash; extracts 6-bit characters from packed
            u64
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'patterns',
    index: '05',
    group: 'Analysis engine',
    title: 'Pattern Recognition',
    subtitle: 'SDK reconstruction',
    Figure: PatternFigure,
    docs: (
      <>
        <p>
          The pattern recognizer maps sequences of host function calls to
          idiomatic Soroban SDK method chains. The system maintains a database of
          150+ host functions loaded from <code>env.json</code>.
        </p>
        <h4>Pattern categories</h4>
        <div className="doc-pattern-list">
          {[
            [
              'Storage',
              'get/put/has/del_contract_data',
              'env.storage().{tier}().get/set/has/remove()',
            ],
            ['Auth', 'require_auth', 'addr.require_auth()'],
            [
              'Events',
              'contract_event',
              'env.events().publish(topics, data)',
            ],
            [
              'Token',
              'call(addr, "transfer", args)',
              'token::Client::new(&env, &addr).transfer(...)',
            ],
            [
              'Collections',
              'vec_new / map_new / vec_push_back',
              'Vec::new() / Map::new() / vec.push_back()',
            ],
            [
              'Crypto',
              'verify_sig_ed25519',
              'env.crypto().ed25519_verify(&pk, &msg, &sig)',
            ],
          ].map(([category, host, sdk]) => (
            <div key={category}>
              <strong>{category}</strong>
              <code>{host}</code>
              <span>&rarr;</span>
              <code className="is-green">{sdk}</code>
            </div>
          ))}
        </div>
      </>
    ),
  },
  {
    id: 'call-graph',
    index: '06',
    group: 'Contract model',
    title: 'Cross-Contract Call Graph',
    subtitle: 'Inter-contract flow',
    Figure: CallGraphFigure,
    docs: (
      <>
        <p>
          When a contract calls another contract via{' '}
          <code>invoke_contract</code>, the decompiler detects the target and
          method. Three recognition tiers handle increasingly generic patterns.
        </p>
        <div className="doc-stages">
          <div className="doc-stage">
            <span className="doc-stage-num">1</span>
            <div>
              <h5>Token calls</h5>
              <p>
                Recognized by method name matching a known set (transfer,
                balance, burn, approve, etc.). Emits{' '}
                <code>token::Client::new(&env, &addr).method(args)</code>.
              </p>
            </div>
          </div>
          <div className="doc-stage">
            <span className="doc-stage-num">2</span>
            <div>
              <h5>Typed calls</h5>
              <p>
                Symbol name extracted, generic client generated. Emits{' '}
                <code>contract_client::new(&env, &addr).method(args)</code>.
              </p>
            </div>
          </div>
          <div className="doc-stage">
            <span className="doc-stage-num">3</span>
            <div>
              <h5>Raw calls (fallback)</h5>
              <p>
                Emits{' '}
                <code>env.invoke_contract(&addr, &func, &args)</code>.
              </p>
            </div>
          </div>
        </div>
        <p className="doc-note">
          Auth edges are detected via <code>require_auth()</code> calls and
          annotated in the output with shield markers.
        </p>
      </>
    ),
  },
  {
    id: 'storage',
    index: '07',
    group: 'Contract model',
    title: 'Storage Layout',
    subtitle: 'Tiered state model',
    Figure: StorageFigure,
    docs: (
      <>
        <p>
          Soroban provides three storage tiers with different cost and lifetime
          characteristics. The decompiler detects which tier is used from the
          last argument to storage host calls.
        </p>
        <div className="doc-type-grid">
          {[
            ['Instance (const 2)', 'Contract instance lifetime — .instance()'],
            [
              'Persistent (const 1)',
              '~4 weeks, extensible via extend_ttl — .persistent()',
            ],
            ['Temporary (const 0)', 'Current ledger only — .temporary()'],
          ].map(([tier, desc]) => (
            <div key={tier}>
              <code>{tier}</code>
              <span>{desc}</span>
            </div>
          ))}
        </div>
        <h4>Key features</h4>
        <ul>
          <li>
            Storage key synthesis via Tuple Key Synthesis optimization:{' '}
            <code>{'vec![&env, Symbol::new("Balance"), addr]'}</code> &rarr;{' '}
            <code>DataKey::Balance(addr)</code>
          </li>
          <li>
            TTL management reconstructed from{' '}
            <code>extend_ttl_for_contract_instance()</code> and{' '}
            <code>extend_ttl_for_contract_code()</code>
          </li>
          <li>
            Function access traces show which exported functions read/write each
            storage key
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'ast',
    index: '08',
    group: 'Validation',
    title: 'AST Benchmark Comparison',
    subtitle: 'Accuracy scoring',
    Figure: AstFigure,
    docs: (
      <>
        <p>
          The benchmark system compares original and decompiled source at the AST
          level using <code>syn</code> parsing. Scoring uses three weighted
          dimensions.
        </p>
        <div className="doc-grid doc-grid--thirds">
          <div className="doc-card">
            <h5>Types &mdash; 20%</h5>
            <p>Struct/enum field count and type matching</p>
          </div>
          <div className="doc-card">
            <h5>Signatures &mdash; 20%</h5>
            <p>Parameter count, types, return type</p>
          </div>
          <div className="doc-card">
            <h5>Bodies &mdash; 60%</h5>
            <p>Statement alignment, expression matching, placeholder penalty</p>
          </div>
        </div>
        <h4>Current results (19 test contracts)</h4>
        <ul>
          <li>
            <strong>6 contracts at 90%+</strong> &mdash; deployer (100%),
            hello_world (97%), increment (94%), events (94%), auth (93%),
            cross_contract_b (91%)
          </li>
          <li>
            <strong>Overall average: 69.1%</strong> &mdash; bodies average:
            51.0%
          </li>
          <li>
            <strong>Default::default() count: 13</strong> &mdash; down from 33
            in earlier versions
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'browser',
    index: '09',
    group: 'Runtime',
    title: 'Browser WASM Execution',
    subtitle: 'Client-side runtime',
    Figure: BrowserFigure,
    docs: (
      <>
        <p>
          The entire decompiler compiles to WASM via <code>wasm-pack</code> and
          runs client-side in the browser. No server required. The npm package is{' '}
          <code>@riverith/soroban-decompiler-wasm</code> (v0.2.3, ~2.5MB).
        </p>
        <h4>WASM API exports</h4>
        <div className="doc-type-grid">
          {[
            ['decompile(bytes, sigs_only?)', 'Rust source string'],
            [
              'inspect(bytes)',
              'Contract spec JSON (functions, types, errors, events)',
            ],
            ['imports(bytes)', 'Host function mapping JSON'],
            ['score(original, decompiled)', 'Accuracy scores JSON'],
            [
              'benchmark(name, orig, dec)',
              'Full report JSON with per-function breakdown',
            ],
          ].map(([fn, ret]) => (
            <div key={fn}>
              <code>{fn}</code>
              <span>&rarr; {ret}</span>
            </div>
          ))}
        </div>
        <p className="doc-note">
          Build target: <code>wasm32-unknown-unknown</code>. Simple contracts
          decompile in &lt;1 second.
        </p>
      </>
    ),
  },
  {
    id: 'optimization',
    index: '10',
    group: 'Runtime',
    title: 'Optimization Passes',
    subtitle: 'IR cleanup',
    Figure: OptimizationFigure,
    docs: (
      <>
        <p>
          11 IR optimization passes run in sequence after pattern recognition,
          progressively cleaning the output from verbose compiler artifacts to
          minimal idiomatic Rust.
        </p>
        <div className="doc-pass-list">
          {[
            [
              'CSE',
              'Common Subexpression Elimination — collapses duplicate let bindings',
            ],
            [
              'Identity',
              'Removes let x = y; and substitutes all references',
            ],
            [
              'Guard Fold',
              'Inlines if true { ... } and removes type checks',
            ],
            [
              'i128 Collapse',
              'Merges carry-chain i64 pairs into i128 operations',
            ],
            [
              'Hoisting',
              'Flattens if-blocks whose bindings escape scope',
            ],
            [
              'Tuple Keys',
              'vec![&env, Symbol::new("X"), val] → DataKey::X(val)',
            ],
            ['Re-CSE', 'Catches duplicates exposed by hoisting'],
            ['Identity 2', 'Substitutes generated aliases'],
            [
              'Increment',
              'get().unwrap_or(0) + N; set() → count += N',
            ],
            [
              'Struct Mutation',
              'Rewrites struct rebuild as field updates',
            ],
            [
              'DCE',
              'Dead Code Elimination — removes unused bindings',
            ],
          ].map(([name, desc]) => (
            <div key={name}>
              <code>{name}</code>
              <span>{desc}</span>
            </div>
          ))}
        </div>
        <p className="doc-note">
          Typical reduction: 34 lines &rarr; 12 lines for medium-complexity
          contracts.
        </p>
      </>
    ),
  },
]

const chapterGroups = Array.from(
  chapters.reduce((map, ch) => {
    const list = map.get(ch.group) ?? []
    list.push(ch)
    map.set(ch.group, list)
    return map
  }, new Map<string, Chapter[]>()),
)

const chapterTransitions: Record<string, string> = {
  pipeline:
    'The hero view shows the end result — but how does binary become readable Rust? It starts with a pipeline of four specialized stages, each solving a different part of the problem.',
  stack:
    'With the contract spec extracted, the next challenge is understanding what the WASM bytecode actually does. This is where the stack simulation engine takes over.',
  val:
    'The simulator tracks values through the stack — but those values are encoded in Soroban\'s 64-bit Val format. Before we can recognize patterns, we need to strip that encoding away.',
  patterns:
    'Now that we have clean typed values and a complete picture of every host function call, the pattern recognizer can map raw call sequences to the SDK methods a developer would have written.',
  'call-graph':
    'Some patterns span beyond a single function. When contracts call other contracts — especially token operations — the decompiler traces those cross-contract boundaries.',
  storage:
    'Cross-contract calls often interact with storage. Soroban\'s three-tier storage model (Instance, Persistent, Temporary) has different lifetimes and costs — and the decompiler detects which tier every operation targets.',
  ast:
    'With code generation complete, we need to know: how close is the output to the original? The AST benchmark system answers this by comparing structure, not just text.',
  browser:
    'Accuracy matters, but so does accessibility. The entire decompiler compiles to WASM and runs client-side — no server, no uploads, no trust required.',
  optimization:
    'Before the final Rust source is emitted, 11 optimization passes clean up the IR. The compiler generates verbose patterns that need collapsing — this is where the output goes from "correct" to "readable."',
}

/* ------------------------------------------------------------------ */
/*  App                                                                */
/* ------------------------------------------------------------------ */

function App() {
  const [activeId, setActiveId] = useState<string>('intro')

  useEffect(() => {
    const ids = ['intro', ...chapters.map((ch) => ch.id)]
    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => Boolean(el))

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        if (visible[0]?.target.id) setActiveId(visible[0].target.id)
      },
      { rootMargin: '-15% 0px -35% 0px', threshold: [0.15, 0.4, 0.65] },
    )

    elements.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  const activeChapter = chapters.find((ch) => ch.id === activeId)
  const ActiveFigure = activeChapter?.Figure ?? IntroOverviewFigure
  const activeIndex = chapters.findIndex((ch) => ch.id === activeId)

  return (
    <div className="page">
      <div className="page-grid" />

      {/* ---- Sidebar ---- */}
      <nav className="sidebar">
        <div className="sidebar-track">
          <div
            className="sidebar-fill"
            style={{
              height: `${((Math.max(activeIndex, 0) + 0.5) / chapters.length) * 100}%`,
            }}
          />
        </div>

        {chapterGroups.map(([group, items]) => (
          <div key={group} className="sidebar-group">
            <span className="sidebar-group-label">{group}</span>
            {items.map((ch) => {
              const idx = chapters.indexOf(ch)
              const isPast = activeIndex >= 0 && idx < activeIndex
              const isActive = ch.id === activeId

              return (
                <a
                  key={ch.id}
                  href={`#${ch.id}`}
                  className={`sidebar-item ${isActive ? 'is-active' : ''} ${isPast ? 'is-past' : ''}`}
                >
                  <span className="sidebar-dot" />
                  <span className="sidebar-index">{ch.index}</span>
                  <span className="sidebar-title">{ch.title}</span>
                </a>
              )
            })}
          </div>
        ))}
      </nav>

      {/* ---- Main grid: scrollable left + sticky right ---- */}
      <main className="content">
        <div className="content-grid">
          {/* Left: scrollable text */}
          <div className="content-scroll">
            <header className="content-header">
              <div className="content-header__logo">
                <span>Soroban Decompiler</span>
                <span>Architecture Atlas</span>
              </div>
            </header>

            {/* Intro */}
            <section id="intro" className="intro">
              <p className="intro-eyebrow">
                Soroban Decompiler &mdash; RFP Submission
              </p>
              <h1 className="intro-title">
                A production-grade WASM-to-Rust decompiler for Stellar Soroban
                smart contracts
              </h1>
              <p className="intro-body">
                Not a proof of concept. A fully built decompiler with a
                four-stage semantic analysis pipeline, a published CLI, a
                browser WASM module, an AST-level benchmarking tool, and 19 test
                contracts&mdash;all shipped to crates.io and npm.
              </p>
              <div className="intro-stats">
                {[
                  ['4-stage', 'pipeline'],
                  ['150+', 'host patterns'],
                  ['11', 'optim passes'],
                  ['69.1%', 'AST accuracy'],
                  ['19', 'test contracts'],
                  ['0', 'server trips'],
                ].map(([value, label]) => (
                  <div key={label} className="intro-stat">
                    <span className="intro-stat__value">{value}</span>
                    <span className="intro-stat__label">{label}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Competitive comparison */}
            <section className="compare-section">
              <h2 className="compare-heading">
                Why this decompiler is different
              </h2>
              <p className="compare-lead">
                Until now I find two competitors building this RFP&mdash;
                <a
                  href="https://sororeveal.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  SoroReveal
                </a>{' '}
                and{' '}
                <a
                  href="https://github.com/AhaLabs/soroban-auditor"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  soroban-auditor
                </a>
                . Here is how our approach fundamentally differs from both.
              </p>

              <div className="compare-card compare-card--highlight">
                <div className="compare-card__header">
                  <span className="compare-card__badge compare-card__badge--us">
                    Our approach
                  </span>
                  <h3>Semantic analysis &mdash; understanding the contract</h3>
                </div>
                <p>
                  A 4-stage pipeline that simulates the WASM stack, traces
                  Soroban&apos;s dispatcher chain, strips Val encoding, and maps
                  host calls to actual SDK method chains using the{' '}
                  <code>contractspecv0</code> metadata&mdash;producing idiomatic
                  Rust with real types, named parameters, and{' '}
                  <code>#[contractimpl]</code> attributes that reads like the
                  original source.
                </p>
                <a
                  href="https://www.unsoroban.xyz/gallery"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="compare-link"
                >
                  See live results &rarr; unsoroban.xyz/gallery
                </a>
              </div>

              <div className="compare-grid">
                <div className="compare-card">
                  <div className="compare-card__header">
                    <span className="compare-card__badge compare-card__badge--them">
                      Competitor 1
                    </span>
                    <h3>
                      <a
                        href="https://sororeveal.com/"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        SoroReveal
                      </a>{' '}
                      <a
                        href="https://sororeveal.com/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="compare-card__url"
                      >
                        sororeveal.com
                      </a>
                    </h3>
                  </div>
                  <p>
                    Produces largely broken output for most contracts. Try any
                    example contract on their site and compare with our gallery
                    at{' '}
                    <a
                      href="https://www.unsoroban.xyz/gallery"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      unsoroban.xyz/gallery
                    </a>
                    &mdash;our decompiled code is miles ahead in accuracy and
                    readability. Most of SoroReveal&apos;s decompiled output is
                    broken or incomplete.
                  </p>
                </div>

                <div className="compare-card">
                  <div className="compare-card__header">
                    <span className="compare-card__badge compare-card__badge--them">
                      Competitor 2
                    </span>
                    <h3>
                      <a
                        href="https://github.com/AhaLabs/soroban-auditor"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        soroban-auditor
                      </a>{' '}
                      <a
                        href="https://github.com/AhaLabs/soroban-auditor"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="compare-card__url"
                      >
                        stellarchain/soroban-auditor
                      </a>
                    </h3>
                  </div>
                  <p>
                    Uses <code>parity-wasm</code> with 107+ regex-based text
                    transformations to produce pseudo-Rust with raw memory macros
                    (<code>mload64!</code>, <code>mstore64!</code>), hex
                    constants, and single-letter variables. It pattern-matches at
                    the text level after a generic WASM-to-C-like pass.
                  </p>
                  <p className="compare-verdict">
                    The difference: <strong>text munging</strong> vs{' '}
                    <strong>understanding what the contract actually does</strong>
                    .
                  </p>
                </div>
              </div>
            </section>

            {/* Published ecosystem */}
            <section className="ecosystem-section">
              <h2 className="ecosystem-heading">Published ecosystem</h2>
              <p className="ecosystem-lead">
                Not a PoC&mdash;a fully fledged decompiler with a complete
                supporting ecosystem, all published and installable today.
              </p>

              <div className="ecosystem-grid">
                <div className="ecosystem-column">
                  <h4>Cargo (crates.io)</h4>
                  <a
                    href="https://crates.io/crates/soroban-decompiler"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ecosystem-pkg"
                  >
                    <strong>soroban-decompiler</strong>
                    <span>Core library crate</span>
                  </a>
                  <a
                    href="https://crates.io/crates/soroban-decompiler-cli"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ecosystem-pkg"
                  >
                    <strong>soroban-decompiler-cli</strong>
                    <span>CLI binary</span>
                  </a>
                  <a
                    href="https://crates.io/crates/soroban-decompiler-bench"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ecosystem-pkg"
                  >
                    <strong>soroban-decompiler-bench</strong>
                    <span>AST benchmark tool</span>
                  </a>
                </div>
                <div className="ecosystem-column">
                  <h4>npm</h4>
                  <a
                    href="https://www.npmjs.com/package/@riverith/soroban-decompiler-wasm"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ecosystem-pkg"
                  >
                    <strong>@riverith/soroban-decompiler-wasm</strong>
                    <span>Browser WASM build (2.5MB)</span>
                  </a>
                </div>
              </div>
            </section>

            {/* Author note */}
            <section className="author-section">
              <p>
                I have been actively contributing to the official{' '}
                <strong>Rust compiler</strong> and{' '}
                <strong>Cargo</strong> repositories&mdash;giving me deep,
                hands-on knowledge of parsing, token-level Rust internals, and
                how compilers work. This project is built on that foundation:
                real compiler engineering, not surface-level pattern matching.
              </p>
              <p>
                I hope the judges and community members evaluate this RFP
                submission based on the depth of the technical work, the
                completeness of the shipped ecosystem, and the actual accuracy of
                the decompiled output.
              </p>
            </section>

            {/* Architecture walkthrough transition */}
            <section className="walkthrough-intro">
              <h2 className="walkthrough-title">
                Let&apos;s walk through the architecture
              </h2>
              <p className="walkthrough-body">
                The decompiler is not a single monolithic pass. It is a pipeline
                of specialized stages, each solving a different part of the
                reverse engineering problem. The following ten sections trace the
                full journey of a <code>.wasm</code> binary from raw bytes to
                idiomatic Rust&mdash;and explain every decision made along the
                way.
              </p>
            </section>

            {/* Chapters with connecting narratives */}
            {chapters.map((ch) => (
              <section
                key={ch.id}
                id={ch.id}
                className={`chapter ${ch.id === activeId ? 'is-active' : ''}`}
              >
                {/* Connecting narrative from previous chapter */}
                {chapterTransitions[ch.id] && (
                  <p className="chapter-transition">
                    {chapterTransitions[ch.id]}
                  </p>
                )}
                <div className="chapter-header">
                  <span className="chapter-number">{ch.index}</span>
                  <span className="chapter-subtitle">{ch.subtitle}</span>
                  <h2 className="chapter-title">{ch.title}</h2>
                </div>
                <div className="chapter-docs">{ch.docs}</div>
              </section>
            ))}

            <footer className="content-footer">
              <span>Soroban Decompiler</span>
              <span>v0.2.3 &middot; Apache-2.0</span>
              <span>github.com/Gmin2/soroban-decoder</span>
            </footer>
          </div>

          {/* Right: sticky figure panel */}
          <aside className="content-sticky">
            <div className="figure-panel">
              <div className="figure-panel__header">
                <span>{activeChapter?.index ?? '00'}</span>
                <span>
                  {activeChapter?.subtitle ?? 'Architecture overview'}
                </span>
              </div>
              <div className="figure-panel__body" key={activeId}>
                <ActiveFigure />
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Intro figure — vertical ReactFlow architecture overview            */
/* ------------------------------------------------------------------ */

function IntroOverviewFigure() {
  const nodes = useMemo<Node[]>(
    () => [
      {
        id: 'input',
        position: { x: 140, y: 0 },
        data: { label: '.wasm binary' },
        sourcePosition: Position.Bottom,
        type: 'input',
        style: introEdgeStyle,
      },
      {
        id: 'spec',
        position: { x: 20, y: 90 },
        data: { label: 'Spec Extraction\nScSpecEntry[]' },
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
        style: introStageStyle,
      },
      {
        id: 'analysis',
        position: { x: 220, y: 90 },
        data: { label: 'Stack Simulation\nAnalyzedModule' },
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
        style: introStageStyle,
      },
      {
        id: 'pattern',
        position: { x: 120, y: 220 },
        data: { label: 'Pattern Recognition\nFunctionIR[]' },
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
        style: introStageStyle,
      },
      {
        id: 'optim',
        position: { x: 120, y: 340 },
        data: { label: '11 Optimization Passes\nCSE · DCE · i128 · Guards' },
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
        style: {
          ...introStageStyle,
          background: 'rgba(57,100,73,0.06)',
          borderColor: 'rgba(57,100,73,0.22)',
        },
      },
      {
        id: 'codegen',
        position: { x: 120, y: 460 },
        data: { label: 'Code Generation\nsyn + prettyplease' },
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
        style: introStageStyle,
      },
      {
        id: 'output',
        position: { x: 140, y: 570 },
        data: { label: '.rs source' },
        targetPosition: Position.Top,
        type: 'output',
        style: introEdgeStyle,
      },
    ],
    [],
  )

  const edges = useMemo<Edge[]>(
    () => [
      makeEdge('input', 'spec'),
      makeEdge('input', 'analysis'),
      makeEdge('spec', 'pattern', 'types'),
      makeEdge('analysis', 'pattern', 'frames'),
      makeEdge('pattern', 'optim'),
      makeEdge('optim', 'codegen'),
      makeEdge('codegen', 'output'),
    ],
    [],
  )

  return (
    <div className="figure intro-flow-figure">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        zoomOnScroll={false}
        panOnDrag={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={28} size={1} color="rgba(26,26,26,0.06)" />
      </ReactFlow>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Figure components                                                  */
/* ------------------------------------------------------------------ */

function HeroFigure() {
  return (
    <div className="figure hero-figure">
      <div className="hero-figure__hex">
        {[
          '00 61 73 6D',
          '01 00 00 00',
          '10 7F 02 60',
          '02 7F 7F 01',
          '7F 03 01 01',
        ].map((row, i) => (
          <span key={row} style={{ animationDelay: `${i * 0.35}s` }}>
            {row}
          </span>
        ))}
      </div>

      <div className="hero-figure__core">
        <div className="hero-figure__diamond" />
        <div className="hero-figure__label">Decompile</div>
        <div className="hero-figure__stream">
          {Array.from({ length: 5 }).map((_, i) => (
            <i key={i} style={{ animationDelay: `${i * 0.5}s` }} />
          ))}
        </div>
      </div>

      <div className="hero-figure__code">
        {[
          'pub fn increment(env: Env) {',
          '  let key = symbol_short!("COUNTER");',
          '  env.storage().instance().get(&key);',
          '}',
        ].map((line, i) => (
          <span key={line} style={{ animationDelay: `${i * 0.35}s` }}>
            {line}
          </span>
        ))}
      </div>
    </div>
  )
}

function PipelineFlowFigure() {
  const nodes = useMemo<Node[]>(
    () => [
      {
        id: 'input',
        position: { x: 130, y: 0 },
        data: { label: '.wasm binary' },
        sourcePosition: Position.Bottom,
        type: 'input',
        style: pipeEdgeStyle,
      },
      {
        id: 'spec',
        position: { x: 80, y: 100 },
        data: { label: 'Stage 1 — Spec Extraction\nReads contractspecv0 XDR metadata\n→ ScSpecEntry[]' },
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
        style: pipeStageStyle,
      },
      {
        id: 'stack',
        position: { x: 80, y: 250 },
        data: { label: 'Stage 2 — Stack Simulation\nSymbolic execution of WASM bytecode\n→ AnalyzedModule' },
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
        style: pipeStageStyle,
      },
      {
        id: 'pattern',
        position: { x: 80, y: 400 },
        data: { label: 'Stage 3 — Pattern Recognition\nHost calls → SDK method chains\n→ FunctionIR[]' },
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
        style: pipeStageStyle,
      },
      {
        id: 'codegen',
        position: { x: 80, y: 550 },
        data: { label: 'Stage 4 — Code Generation\nsyn + quote + prettyplease\n→ String (Rust source)' },
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
        style: pipeStageStyle,
      },
      {
        id: 'output',
        position: { x: 130, y: 700 },
        data: { label: '.rs source' },
        targetPosition: Position.Top,
        type: 'output',
        style: pipeEdgeStyle,
      },
    ],
    [],
  )

  const edges = useMemo<Edge[]>(
    () => [
      makeEdge('input', 'spec'),
      makeEdge('spec', 'stack', 'types'),
      makeEdge('stack', 'pattern', 'frames'),
      makeEdge('pattern', 'codegen', 'ir'),
      makeEdge('codegen', 'output'),
    ],
    [],
  )

  return (
    <div className="figure flow-figure">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        zoomOnScroll={false}
        panOnDrag={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={28} size={1} color="rgba(26,26,26,0.08)" />
      </ReactFlow>
    </div>
  )
}

function StackFigure() {
  return (
    <div className="figure stack-figure">
      <div className="stack-figure__column">
        <small>Instructions</small>
        <span>local.get 0</span>
        <span>i64.const 201326592</span>
        <span>call $b.j</span>
        <span>local.set 3</span>
        <span>call $a.0</span>
      </div>
      <div className="stack-figure__stack">
        <small>Operand stack</small>
        <i className="chip chip--blue">Param(0)</i>
        <i className="chip chip--stone">Const(201326592)</i>
        <i className="chip chip--gold">CallResult(0)</i>
      </div>
      <div className="stack-figure__column">
        <small>Resolved meaning</small>
        <span>symbol_short!(&quot;COUNTER&quot;)</span>
        <span>env.storage().instance().get(&amp;key)</span>
      </div>
    </div>
  )
}

function ValFigure() {
  return (
    <div className="figure val-figure">
      <div className="val-figure__row">
        <span>value &gt;&gt; 32</span>
        <span>value &amp; 0xFF</span>
        <span>result &lt;&lt; 8 | 0x04</span>
      </div>
      <div className="val-figure__lens">
        <div>Decoder lens</div>
      </div>
      <div className="val-figure__row val-figure__row--clean">
        <span>count: u32</span>
        <span>symbol_short!(&quot;KEY&quot;)</span>
        <span>true</span>
      </div>
      <div className="val-figure__legend">
        <span>0 False</span>
        <span>1 True</span>
        <span>4 U32</span>
        <span>14 SymbolSmall</span>
      </div>
    </div>
  )
}

function PatternFigure() {
  return (
    <div className="figure pattern-figure">
      <div className="pattern-figure__panel">
        <small>Host call sequence</small>
        <span>symbol_new_from_linear_memory(&quot;COUNTER&quot;)</span>
        <span>get_contract_data(symbol, Instance)</span>
        <span>obj_to_u64(result)</span>
      </div>
      <div className="pattern-figure__matcher">
        <div className="pattern-figure__scan" />
        <strong>Storage read pattern</strong>
      </div>
      <div className="pattern-figure__panel pattern-figure__panel--clean">
        <small>SDK method chain</small>
        <span>
          env.storage().instance().get(&amp;symbol_short!(&quot;COUNTER&quot;))
        </span>
        <span>addr.require_auth()</span>
        <span>env.events().publish(topics, data)</span>
      </div>
    </div>
  )
}

function CallGraphFigure() {
  return (
    <div className="figure graph-figure">
      <svg
        viewBox="0 0 600 280"
        className="graph-figure__svg"
        aria-hidden="true"
      >
        <path d="M100 140 C160 140, 180 140, 240 140" />
        <path d="M320 125 C390 100, 420 80, 480 70" />
        <path d="M320 155 C390 185, 420 200, 480 210" />
      </svg>
      <div
        className="graph-node graph-node--system"
        style={{ left: '1.5rem', top: '6rem' }}
      >
        <strong>Deployer</strong>
        <span>deploy()</span>
        <span>init()</span>
      </div>
      <div
        className="graph-node graph-node--user"
        style={{ left: '13rem', top: '6rem' }}
      >
        <strong>Contract A</strong>
        <span>swap()</span>
      </div>
      <div
        className="graph-node graph-node--token"
        style={{ right: '1.5rem', top: '1.5rem' }}
      >
        <strong>Token A</strong>
        <span>transfer()</span>
        <span>balance()</span>
      </div>
      <div
        className="graph-node graph-node--token"
        style={{ right: '1.5rem', bottom: '1.5rem' }}
      >
        <strong>Token B</strong>
        <span>transfer()</span>
        <span>balance()</span>
      </div>
    </div>
  )
}

function StorageFigure() {
  return (
    <div className="figure storage-figure">
      <div className="storage-figure__functions">
        <span>increment()</span>
        <span>init()</span>
        <span>extend_ttl()</span>
      </div>
      <div className="storage-figure__layers">
        {(
          [
            ['Instance', 'COUNTER: u32', 'ADMIN: Address'],
            [
              'Persistent',
              'Balance: Map<Address, i128>',
              'Allowance: Map<...>',
            ],
            ['Temporary', 'Session: Data', '(empty on expiry)'],
          ] as const
        ).map(([title, first, second]) => (
          <div key={title} className="storage-layer">
            <header>{title}</header>
            <div className="storage-entry">
              <span>{first}</span>
              <i />
            </div>
            <div className="storage-entry">
              <span>{second}</span>
              <i />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function AstFigure() {
  return (
    <div className="figure ast-figure">
      <div className="ast-figure__panel">
        <small>Original</small>
        <span>struct Counter</span>
        <span>fn increment(env: Env)</span>
        <span>env.storage().get(&amp;key)</span>
      </div>
      <div className="ast-figure__links">
        <i className="is-green" />
        <i className="is-green" />
        <i className="is-amber" />
        <i className="is-red" />
      </div>
      <div className="ast-figure__panel">
        <small>Decompiled</small>
        <span>struct Counter</span>
        <span>fn increment(env: Env)</span>
        <span>env.storage().instance().get(&amp;key)</span>
      </div>
      <div className="ast-figure__score">
        <b />
        <b />
        <b className="is-partial" />
        <span>69.1%</span>
      </div>
    </div>
  )
}

function BrowserFigure() {
  return (
    <div className="figure browser-figure">
      <div className="browser-window">
        <div className="browser-window__chrome">
          <i />
          <i />
          <i />
          <span>localhost:3000</span>
        </div>
        <div className="browser-window__body">
          <div className="browser-window__module">
            <div className="browser-window__ring" />
            <strong>.wasm</strong>
            <span>2.5MB</span>
          </div>
          <pre>{`pub fn hello() {\n  env.storage().get(&key)\n}`}</pre>
        </div>
      </div>
      <div className="browser-figure__badge">
        <span>Zero server round-trips</span>
        <em>&lt; 1 second</em>
      </div>
    </div>
  )
}

function OptimizationFigure() {
  return (
    <div className="figure optimization-figure">
      <div className="optimization-figure__belt">
        {['CSE', 'DCE', 'i128', 'Guard', 'Identity', 'Hoist'].map((item) => (
          <div key={item} className="optimization-figure__stop">
            {item}
          </div>
        ))}
        <div className="optimization-figure__carriage">
          <span>let a = env.get();</span>
          <span className="is-fading">let b = env.get();</span>
          <span>return a + a;</span>
        </div>
      </div>
      <div className="optimization-figure__footer">
        <span>Verbose IR</span>
        <strong>34 lines &rarr; 12 lines</strong>
        <span>Clean Rust</span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  XYFlow styles                                                      */
/* ------------------------------------------------------------------ */

const pipeStageStyle = {
  width: 260,
  borderRadius: 0,
  padding: '16px 20px',
  border: '1px solid rgba(23,23,23,0.2)',
  background: 'rgba(255,255,255,0.65)',
  color: '#1a1a1a',
  fontFamily: 'Inter, sans-serif',
  fontSize: '12px',
  lineHeight: 1.6,
  whiteSpace: 'pre-line' as const,
  boxShadow: '0 10px 30px rgba(71,65,48,0.08)',
}

const pipeEdgeStyle = {
  width: 130,
  borderRadius: 999,
  padding: '12px 18px',
  border: '1px solid rgba(23,23,23,0.16)',
  background: 'rgba(244,241,232,0.92)',
  color: 'rgba(23,23,23,0.75)',
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: '11px',
  fontWeight: 500,
}

const introStageStyle = {
  width: 170,
  borderRadius: 0,
  padding: '14px 16px',
  border: '1px solid rgba(23,23,23,0.16)',
  background: 'rgba(255,255,255,0.58)',
  color: '#171717',
  fontFamily: 'Inter, sans-serif',
  fontSize: '11px',
  lineHeight: 1.5,
  whiteSpace: 'pre-line' as const,
  boxShadow: '0 8px 24px rgba(71,65,48,0.06)',
}

const introEdgeStyle = {
  width: 120,
  borderRadius: 999,
  padding: '10px 16px',
  border: '1px solid rgba(23,23,23,0.12)',
  background: 'rgba(244,241,232,0.92)',
  color: 'rgba(23,23,23,0.65)',
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: '10px',
}

function makeEdge(source: string, target: string, label?: string): Edge {
  return {
    id: `${source}-${target}`,
    source,
    target,
    label,
    type: 'smoothstep',
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: 'rgba(42,60,89,0.55)',
      width: 16,
      height: 16,
    },
    style: { stroke: 'rgba(42,60,89,0.5)', strokeWidth: 1.2 },
    labelStyle: {
      fill: 'rgba(23,23,23,0.55)',
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: 9,
      letterSpacing: '0.14em',
    },
    labelBgStyle: {
      fill: 'rgba(244,241,232,0.94)',
      fillOpacity: 1,
    },
  }
}

export default App
