import { normalizeProjectContext, normalizeStudyPlanContext, learningContextPrompt } from '../services/learning-context.service'

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message)
}

export function run() {
  const project = normalizeProjectContext({
    id: 'project-a', title: 'Python Calculator', subject: 'Computer Science',
    description: 'Build a working calculator', goal: 'Learn Python functions', status: 'active', progress_percent: 25
  })
  const projectPrompt = learningContextPrompt(project)
  assert(project.kind === 'project', 'Project context must identify its kind')
  assert(projectPrompt.includes('Python Calculator'), 'Project title must reach the AI context')
  assert(projectPrompt.includes('Learn Python functions'), 'Project goal must reach the AI context')
  assert(projectPrompt.includes('progress: 25%'), 'Project progress must reach the AI context')

  const plan = normalizeStudyPlanContext({
    id: 'plan-a', title: 'Mathematics Revision', subject: 'Mathematics', objective: 'Master the exam topics', learner_level: 'beginner',
    study_plan_topics: [
      { id: 'one', title: 'Algebra', completed: true, sort_order: 0 },
      { id: 'two', title: 'Pythagoras', completed: false, sort_order: 1 },
      { id: 'three', title: 'Geometry', completed: false, sort_order: 2 }
    ]
  })
  const planPrompt = learningContextPrompt(plan)
  assert(plan.studyPlan?.completedCount === 1, 'Completed topic count must be normalized')
  assert(plan.studyPlan?.currentTopic === 'Pythagoras', 'Current topic must be the first incomplete item')
  assert(plan.studyPlan?.recommendedAction.includes('Pythagoras'), 'Study plan must provide a deterministic recommended action')
  assert(plan.studyPlan?.deadlineStatus === 'none', 'Missing deadline must have no deadline status')
  assert(planPrompt.includes('Mathematics Revision'), 'Study-plan title must reach the AI context')
  assert(planPrompt.includes('Current topic: Pythagoras'), 'Current topic must reach the AI context')
  assert(planPrompt.includes('Progress: 1/3 items complete'), 'Study-plan progress must reach the AI context')

  assert(learningContextPrompt(null) === '', 'Empty context must not add prompt content')
  console.log('[PASS] learning context normalization and prompt integration')
}

if (require.main === module) run()
