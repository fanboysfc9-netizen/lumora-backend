import { NormalizedInput, ResponseType, ResponseStructure } from './types'

/** Select an appropriate response structure (sections, tone, pacing) based on the response type. */
export function selectResponseStructure(type: ResponseType, normalized: NormalizedInput): ResponseStructure {
  const base: ResponseStructure = { useSections: false, sections: [], tone: 'calm', pacing: 'normal', empathy: false, brief: false }

  switch (type) {
    case 'casual':
      return { ...base, useSections: false, tone: 'friendly', brief: true }
    case 'conversation':
      return { ...base, useSections: false, tone: 'engaging', brief: true }
    case 'definition':
      return { ...base, useSections: false, tone: 'clear', sections: ['Explanation', 'Why it works', 'Example'], brief: true }
    case 'conceptual':
      return { ...base, useSections: false, tone: 'thoughtful', sections: ['Explanation', 'Why it works', 'Example'], brief: false }
    case 'problem_solving':
      return { ...base, useSections: true, sections: ['Explanation', 'Steps', 'Example', 'Recap'], tone: 'measured', pacing: 'measured', brief: false }
    case 'advanced_learning':
      return { ...base, useSections: true, sections: ['Explanation', 'Why it works', 'Steps', 'Examples', 'Recap'], tone: 'analytical', pacing: 'measured', brief: false }
    case 'emotional':
      return { ...base, useSections: false, tone: 'empathetic', empathy: true, brief: true }
    default:
      return base
  }
}

export default { selectResponseStructure }
