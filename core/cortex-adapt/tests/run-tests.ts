export {};
async function main() {
  try {
    // Use require() for compatibility with ts-node execution
    const adaptMod = require('./test-adaptationEngine')
    const feedbackMod = require('./test-feedbackLoop')

    if (adaptMod && typeof adaptMod.run === 'function') adaptMod.run()
    if (feedbackMod && typeof feedbackMod.run === 'function') await feedbackMod.run()

    console.log('\nALL TESTS PASSED')
    process.exit(0)
  } catch (e) {
    console.error('\nTESTS FAILED:', e)
    process.exit(2)
  }
}

main()
