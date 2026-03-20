/**
 * Odin Phase Contracts
 * Version: 0.1.0
 */

import type { PhaseAgentInstructions, PhaseContract, PhaseId } from '../types.js';

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
    definition_of_done: ['PRD or exemption recorded'],
    required_artifacts: ['prd'],
    allowed_next_phases: ['2'],
  },
  '2': {
    id: '2',
    name: 'Discovery',
    purpose: 'Gather requirements, context, and technical constraints.',
    definition_of_done: ['Requirements recorded'],
    required_artifacts: ['requirements'],
    allowed_next_phases: ['3'],
  },
  '3': {
    id: '3',
    name: 'Architect',
    purpose: 'Produce the technical spec and task shape.',
    definition_of_done: ['Spec recorded', 'Tasks recorded'],
    required_artifacts: ['spec', 'tasks'],
    allowed_next_phases: ['4'],
  },
  '4': {
    id: '4',
    name: 'Guardian',
    purpose: 'Review the plan for correctness, quality, and risk before build.',
    definition_of_done: ['Review recorded'],
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
    definition_of_done: ['Security review completed', 'Test quality evaluation completed'],
    required_artifacts: ['review'],
    allowed_next_phases: ['7'],
  },
  '7': {
    id: '7',
    name: 'Integrator',
    purpose: 'Validate build/runtime behavior and final integration correctness.',
    definition_of_done: ['Integration validation complete'],
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
    constraints: ['Spec-first: do not implement code here.'],
  },
  '4': {
    name: 'guardian-agent',
    role_summary: 'Review for quality, risk, and readiness to build.',
    constraints: ['Do not approve weak or ambiguous specs.'],
  },
  '5': {
    name: 'builder-agent',
    role_summary: 'Implement the approved plan with high code quality.',
    constraints: ['Emit watched-phase claims when required.'],
  },
  '6': {
    name: 'reviewer-agent',
    role_summary: 'Run security and unit-test quality checks and summarize the result.',
    constraints: ['High and critical findings block progression.', 'Weak or missing tests send the feature back to Builder.'],
  },
  '7': {
    name: 'integrator-agent',
    role_summary: 'Verify integrated behavior beyond compile/build success.',
    constraints: ['Runtime validation matters, not just build success.'],
  },
  '8': {
    name: 'documenter-agent',
    role_summary: 'Record the docs and operational notes needed for the feature.',
    constraints: ['Capture changes while they are fresh.'],
  },
  '9': {
    name: 'release-agent',
    role_summary: 'Prepare PR, archival, and release metadata.',
    constraints: ['Agents never merge; humans decide merges.'],
  },
  '10': {
    name: 'complete-agent',
    role_summary: 'The feature is complete and available for historical inspection.',
    constraints: ['No further forward transitions exist.'],
  },
};

export function getPhaseContract(phase: PhaseId): PhaseContract {
  return PHASE_CONTRACTS[phase];
}

export function getPhaseAgentInstructions(phase: PhaseId): PhaseAgentInstructions {
  return PHASE_AGENT_INSTRUCTIONS[phase];
}

export function getNextPhaseId(phase: PhaseId): PhaseId | null {
  const allowed_next_phases = PHASE_CONTRACTS[phase].allowed_next_phases;
  return allowed_next_phases[0] ?? null;
}

export function isWatchedPhase(phase: PhaseId): boolean {
  return phase === '5' || phase === '7' || phase === '9';
}
