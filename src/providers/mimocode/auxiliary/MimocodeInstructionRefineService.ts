import { QueryBackedInstructionRefineService } from '../../../core/auxiliary/QueryBackedInstructionRefineService';
import type GrimoirePlugin from '../../../main';
import { MimocodeAuxQueryRunner } from '../runtime/MimocodeAuxQueryRunner';

export class MimocodeInstructionRefineService extends QueryBackedInstructionRefineService {
  constructor(plugin: GrimoirePlugin) {
    super(new MimocodeAuxQueryRunner(plugin, {
      agentProfile: 'passive',
      artifactPurpose: 'instructions',
    }));
  }
}
