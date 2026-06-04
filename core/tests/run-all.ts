export {};
async function main() {
  try {
    const core = require('../lumora-core/tests/test-core')
    const adapt = require('../cortex-adapt/tests/test-adaptationEngine')
    const feedback = require('../cortex-adapt/tests/test-feedbackLoop')
    const integration = require('./test-integration')
    const kr = require('../cortex-adapt/tests/test-knowledgeRouter')
    const refine = require('../cortex-refine/tests/test-refineEngine')

    if (core && typeof core.run === 'function') core.run()
    if (adapt && typeof adapt.run === 'function') adapt.run()
    if (kr && typeof kr.run === 'function') kr.run()
    if (refine && typeof refine.run === 'function') refine.run()
    if (integration && typeof integration.run === 'function') await integration.run()
    if (feedback && typeof feedback.run === 'function') await feedback.run()

    console.log('\nALL TESTS PASSED')
    process.exit(0)
  } catch (e) {
    console.error('\nTESTS FAILED:', e)
    process.exit(2)
  }
}

main()
