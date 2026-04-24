/**
 * Odin Phase Contracts
 * Version: 0.1.0
 */

import type {
  PhaseAgentInstructions,
  PhaseContract,
  PhaseExecutionContract,
  PhaseExecutionMode,
  PhaseExecutionPolicy,
  PhaseId,
  PromptRealizationPolicy,
  PhaseResponseStyle,
} from '../types.js';

const PHASE_CONTRACTS: Record<PhaseId, PhaseContract> = {
  '0': {
    id: '0',
    name: 'Planning',
    purpose: 'Establish the feature request and prepare the workflow entry point.',
    definition_of_done: ['Feature request understood', 'Next phase identified'],
    required_artifacts: [],
    allowed_next_phases: ['1'],
  },
  '1': {
    id: '1',
    name: 'Product',
    purpose: 'Capture the product requirements for the feature.',
    definition_of_done: ['PRD or exemption recorded', 'Success / non-goals / failure shape captured'],
    required_artifacts: ['prd'],
    allowed_next_phases: ['2'],
  },
  '2': {
    id: '2',
    name: 'Discovery',
    purpose: 'Gather requirements, context, and technical constraints.',
    definition_of_done: ['Requirements recorded', 'Eval-relevant scenarios captured'],
    required_artifacts: ['requirements'],
    allowed_next_phases: ['3'],
  },
  '3': {
    id: '3',
    name: 'Architect',
    purpose: 'Produce the technical spec and task shape.',
    definition_of_done: ['Spec recorded', 'Tasks recorded', 'Eval plan recorded when required'],
    required_artifacts: ['spec', 'tasks'],
    allowed_next_phases: ['4'],
  },
  '4': {
    id: '4',
    name: 'Guardian',
    purpose: 'Review the plan for correctness, quality, and risk before build.',
    definition_of_done: ['Review recorded', 'Eval readiness decided when required'],
    required_artifacts: ['review'],
    allowed_next_phases: ['5'],
  },
  '5': {
    id: '5',
    name: 'Builder',
    purpose: 'Implement the approved specification.',
    definition_of_done: ['Implementation completed', 'Build/test obligations met'],
    required_artifacts: ['spec', 'tasks'],
    allowed_next_phases: ['6'],
  },
  '6': {
    id: '6',
    name: 'Reviewer',
    purpose: 'Run security and unit-test quality review before integration.',
    definition_of_done: ['Security review completed', 'Test quality evaluation completed', 'Eval run recorded when required'],
    required_artifacts: ['review'],
    allowed_next_phases: ['7'],
  },
  '7': {
    id: '7',
    name: 'Integrator',
    purpose: 'Validate build/runtime behavior and final integration correctness.',
    definition_of_done: ['Integration validation complete', 'Partial eval state resolved when required'],
    required_artifacts: ['spec', 'tasks'],
    allowed_next_phases: ['8'],
  },
  '8': {
    id: '8',
    name: 'Documenter',
    purpose: 'Update docs and finalize implementation notes.',
    definition_of_done: ['Documentation notes recorded'],
    required_artifacts: ['documentation'],
    allowed_next_phases: ['9'],
  },
  '9': {
    id: '9',
    name: 'Release',
    purpose: 'Prepare the feature for PR, archival, and completion.',
    definition_of_done: ['Release notes recorded', 'Feature artifacts archived via odin.archive_feature_release'],
    required_artifacts: ['release_notes'],
    allowed_next_phases: ['10'],
  },
  '10': {
    id: '10',
    name: 'Complete',
    purpose: 'The feature is fully complete.',
    definition_of_done: ['Feature completed'],
    required_artifacts: [],
    allowed_next_phases: [],
  },
};

const PHASE_AGENT_INSTRUCTIONS: Record<PhaseId, PhaseAgentInstructions> = {
  '0': {
    name: 'planning-agent',
    role_summary: 'Translate the request into a workflow entry point.',
    constraints: ['Do not skip the Product phase.'],
  },
  '1': {
    name: 'product-agent',
    role_summary: 'Create a product-ready PRD or exemption.',
    constraints: ['Do not leak implementation details into the PRD.'],
  },
  '2': {
    name: 'discovery-agent',
    role_summary: 'Gather concrete requirements and technical context.',
    constraints: ['Read existing artifacts before adding new assumptions.'],
  },
  '3': {
    name: 'architect-agent',
    role_summary: 'Turn the requirements into an implementation plan.',
    constraints: ['Spec-first: do not implement code here.', 'Record eval planning when required.'],
  },
  '4': {
    name: 'guardian-agent',
    role_summary: 'Review for quality, risk, and readiness to build.',
    constraints: ['Do not approve weak or ambiguous specs.', 'Development eval readiness never overrides formal verification or other gates.'],
  },
  '5': {
    name: 'builder-agent',
    role_summary: 'Implement the approved plan with high code quality.',
    constraints: ['Emit watched-phase claims when required.'],
  },
  '6': {
    name: 'reviewer-agent',
    role_summary: 'Run security and unit-test quality checks and summarize the result.',
    constraints: ['High and critical findings block progression.', 'Weak or missing tests send the feature back to Builder.', 'Passing eval runs do not override security failures.'],
  },
  '7': {
    name: 'integrator-agent',
    role_summary: 'Verify integrated behavior beyond compile/build success.',
    constraints: ['Runtime validation matters, not just build success.', 'Resolve any partial eval state with observable end-state evidence.'],
  },
  '8': {
    name: 'documenter-agent',
    role_summary: 'Record the docs and operational notes needed for the feature.',
    constraints: ['Capture changes while they are fresh.'],
  },
  '9': {
    name: 'release-agent',
    role_summary: 'Prepare PR, archival, and release metadata.',
    constraints: [
      'Consult context.automation before any PR action; guarded mode stops at human handoff, auto_pr only continues on allowlisted branches with clean gates.',
      'Agents never merge; humans decide merges.',
    ],
  },
  '10': {
    name: 'complete-agent',
    role_summary: 'The feature is complete and available for historical inspection.',
    constraints: ['No further forward transitions exist.'],
  },
};

const PHASE_RECOMMENDED_EXECUTION_MODES: Record<PhaseId, PhaseExecutionMode> = {
  '0': 'inline',
  '1': 'inline',
  '2': 'inline',
  '3': 'inline',
  '4': 'inline',
  '5': 'subagent',
  '6': 'subagent',
  '7': 'subagent',
  '8': 'subagent',
  '9': 'inline',
  '10': 'inline',
};

const PHASE_CHILD_STATE_STRATEGIES: Record<PhaseId, PhaseExecutionContract['child_state_strategy']> = {
  '0': 'return_intent_to_parent',
  '1': 'return_intent_to_parent',
  '2': 'return_intent_to_parent',
  '3': 'return_intent_to_parent',
  '4': 'return_intent_to_parent',
  '5': 'direct_odin_tools_if_available',
  '6': 'direct_odin_tools_if_available',
  '7': 'direct_odin_tools_if_available',
  '8': 'direct_odin_tools_if_available',
  '9': 'return_intent_to_parent',
  '10': 'return_intent_to_parent',
};

const PHASE_EXECUTION_POLICIES: Record<PhaseId, PhaseExecutionPolicy> = {
  '0': 'inline_allowed',
  '1': 'inline_allowed',
  '2': 'inline_allowed',
  '3': 'inline_allowed',
  '4': 'inline_allowed',
  '5': 'distinct_session_preferred',
  '6': 'distinct_session_preferred',
  '7': 'distinct_session_preferred',
  '8': 'inline_allowed',
  '9': 'inline_allowed',
  '10': 'inline_allowed',
};

const PHASE_PROMPT_REALIZATION_POLICIES: Record<PhaseId, PromptRealizationPolicy> = {
  '0': 'phase_bundle_optional',
  '1': 'phase_bundle_optional',
  '2': 'phase_bundle_optional',
  '3': 'phase_bundle_optional',
  '4': 'phase_bundle_optional',
  '5': 'phase_bundle_preferred',
  '6': 'phase_bundle_preferred',
  '7': 'phase_bundle_preferred',
  '8': 'phase_bundle_optional',
  '9': 'phase_bundle_optional',
  '10': 'phase_bundle_optional',
};

const PHASE_RESPONSE_STYLES: Record<PhaseId, PhaseResponseStyle> = {
  '0': 'normal',
  '1': 'normal',
  '2': 'normal',
  '3': 'normal',
  '4': 'normal',
  '5': 'terse_execution',
  '6': 'terse_execution',
  '7': 'terse_execution',
  '8': 'normal',
  '9': 'terse_execution',
  '10': 'normal',
};

const PHASE_PROMPT_SECTIONS: PhaseExecutionContract['prompt_sections'] = [
  'phase',
  'role_summary',
  'constraints',
  'development_evals',
  'automation',
  'verification',
  'workflow',
  'artifacts',
  'skills',
  'learnings',
];

/**
 * Retrieve the PhaseContract for a given phase identifier.
 *
 * @param phase - The phase identifier ('0'–'10') whose contract to fetch
 * @returns The PhaseContract corresponding to `phase`
 */
export function getPhaseContract(phase: PhaseId): PhaseContract {
  return PHASE_CONTRACTS[phase];
}

/**
 * Retrieve the agent instructions configured for a phase.
 *
 * @param phase - The phase identifier ('0' … '10')
 * @returns The `PhaseAgentInstructions` object associated with `phase`
 */
export function getPhaseAgentInstructions(phase: PhaseId): PhaseAgentInstructions {
  return PHASE_AGENT_INSTRUCTIONS[phase];
}

/**
 * Build a PhaseExecutionContract for a specific phase and acting agent.
 *
 * @param phase - The phase id (`'0'`…`'10'`) to derive phase-specific execution settings from
 * @param acting_agent_name - The name of the agent that will act under the returned contract
 * @returns A PhaseExecutionContract populated with standardized execution fields and phase-derived values (phase role name, recommended execution mode, child-state strategy, and a copied `prompt_sections` array)
 */
export function getPhaseExecutionContract(phase: PhaseId, acting_agent_name: string): PhaseExecutionContract {
  return {
    actor_model: 'logical_role',
    execution_owner: 'harness',
    phase_role_name: PHASE_AGENT_INSTRUCTIONS[phase].name,
    acting_agent_name,
    child_agent_role: 'acts_as_phase_role',
    supported_modes: ['inline', 'subagent'],
    recommended_mode: PHASE_RECOMMENDED_EXECUTION_MODES[phase],
    execution_policy: PHASE_EXECUTION_POLICIES[phase],
    prompt_realization_policy: PHASE_PROMPT_REALIZATION_POLICIES[phase],
    child_state_strategy: PHASE_CHILD_STATE_STRATEGIES[phase],
    response_style: PHASE_RESPONSE_STYLES[phase],
    phase_prompt_manifest: null,
    prompt_sections: [...PHASE_PROMPT_SECTIONS],
  };
}

/**
 * Get the primary next phase id for a given phase.
 *
 * @returns The first allowed next phase id for `phase`, or `null` if none is permitted.
 */
export function getNextPhaseId(phase: PhaseId): PhaseId | null {
  const allowed_next_phases = PHASE_CONTRACTS[phase].allowed_next_phases;
  return allowed_next_phases[0] ?? null;
}

export function isWatchedPhase(phase: PhaseId): boolean {
  return phase === '5' || phase === '7' || phase === '9';
}
