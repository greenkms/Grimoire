import { QueryBackedInstructionRefineService } from '../../../core/auxiliary/QueryBackedInstructionRefineService';
import type GrimoirePlugin from '../../../main';
import { KimicodeAuxQueryRunner } from '../runtime/KimicodeAuxQueryRunner';

export class KimicodeInstructionRefineService extends QueryBackedInstructionRefineService {
  constructor(plugin: GrimoirePlugin) {
    super(new KimicodeAuxQueryRunner(plugin, {
      agentProfile: 'passive',
      artifactPurpose: 'instructions',
    }));
  }
}
