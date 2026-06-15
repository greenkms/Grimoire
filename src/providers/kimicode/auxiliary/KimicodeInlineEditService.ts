import { QueryBackedInlineEditService } from '../../../core/auxiliary/QueryBackedInlineEditService';
import type GrimoirePlugin from '../../../main';
import { KimicodeAuxQueryRunner } from '../runtime/KimicodeAuxQueryRunner';

export class KimicodeInlineEditService extends QueryBackedInlineEditService {
  constructor(plugin: GrimoirePlugin) {
    super(new KimicodeAuxQueryRunner(plugin, {
      agentProfile: 'readonly',
      artifactPurpose: 'inline',
      allowReadTextFile: true,
    }));
  }
}
