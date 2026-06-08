import { QueryBackedInstructionRefineService } from '../../../core/auxiliary/QueryBackedInstructionRefineService';
import type GrimoirePlugin from '../../../main';
import { OpencodeAuxQueryRunner } from '../runtime/OpencodeAuxQueryRunner';

export class OpencodeInstructionRefineService extends QueryBackedInstructionRefineService {
  constructor(plugin: GrimoirePlugin) {
    super(new OpencodeAuxQueryRunner(plugin, {
      agentProfile: 'passive',
      artifactPurpose: 'instructions',
    }));
  }
}
