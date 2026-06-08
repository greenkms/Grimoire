import { QueryBackedTitleGenerationService } from '../../../core/auxiliary/QueryBackedTitleGenerationService';
import type GrimoirePlugin from '../../../main';
import { decodeOpencodeModelId } from '../models';
import { OpencodeAuxQueryRunner } from '../runtime/OpencodeAuxQueryRunner';
import { opencodeChatUIConfig } from '../ui/OpencodeChatUIConfig';

export class OpencodeTitleGenerationService extends QueryBackedTitleGenerationService {
  constructor(plugin: GrimoirePlugin) {
    super({
      createRunner: () => new OpencodeAuxQueryRunner(plugin, {
        agentProfile: 'passive',
        artifactPurpose: 'title-gen',
      }),
      resolveModel: () => {
        const settings = plugin.settings as unknown as Record<string, unknown>;
        const titleModel = typeof settings.titleGenerationModel === 'string'
          ? settings.titleGenerationModel
          : '';
        if (!opencodeChatUIConfig.ownsModel(titleModel, settings)) {
          return undefined;
        }

        return decodeOpencodeModelId(titleModel) ?? undefined;
      },
    });
  }
}
