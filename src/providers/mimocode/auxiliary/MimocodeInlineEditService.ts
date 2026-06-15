import { QueryBackedInlineEditService } from '../../../core/auxiliary/QueryBackedInlineEditService';
import type GrimoirePlugin from '../../../main';
import { MimocodeAuxQueryRunner } from '../runtime/MimocodeAuxQueryRunner';

export class MimocodeInlineEditService extends QueryBackedInlineEditService {
  constructor(plugin: GrimoirePlugin) {
    super(new MimocodeAuxQueryRunner(plugin, {
      agentProfile: 'readonly',
      artifactPurpose: 'inline',
      allowReadTextFile: true,
    }));
  }
}
