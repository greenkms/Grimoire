import { QueryBackedTitleGenerationService } from '../../../core/auxiliary/QueryBackedTitleGenerationService';
import type GrimoirePlugin from '../../../main';
import { decodeMimocodeModelId } from '../models';
import { MimocodeAuxQueryRunner } from '../runtime/MimocodeAuxQueryRunner';
import { mimocodeChatUIConfig } from '../ui/MimocodeChatUIConfig';

export class MimocodeTitleGenerationService extends QueryBackedTitleGenerationService {
  constructor(plugin: GrimoirePlugin) {
    super({
      createRunner: () => new MimocodeAuxQueryRunner(plugin, {
        agentProfile: 'passive',
        artifactPurpose: 'title-gen',
      }),
      resolveModel: () => {
        const settings = plugin.settings as unknown as Record<string, unknown>;
        const titleModel = typeof settings.titleGenerationModel === 'string'
          ? settings.titleGenerationModel
          : '';
        if (!mimocodeChatUIConfig.ownsModel(titleModel, settings)) {
          return undefined;
        }

        return decodeMimocodeModelId(titleModel) ?? undefined;
      },
    });
  }
}
