import { getDefaultHiddenProviderCommands } from '../../core/providers/commands/hiddenCommands';
import { type GrimoireSettings } from '../../core/types/settings';
import { DEFAULT_CODEX_PRIMARY_MODEL } from '../../providers/codex/types/models';
import { getBuiltInProviderDefaultConfigs } from '../../providers/defaultProviderConfigs';

export const DEFAULT_GRIMOIRE_SETTINGS: GrimoireSettings = {
  userName: '',

  permissionMode: 'normal',

  model: DEFAULT_CODEX_PRIMARY_MODEL,
  thinkingBudget: 'off',
  effortLevel: 'high',
  serviceTier: 'default',
  enableAutoTitleGeneration: true,
  titleGenerationModel: '',

  excludedTags: [],
  mediaFolder: '',
  systemPrompt: '',
  persistentExternalContextPaths: [],
  contextEngine: {
    vaultSearchEnabled: true,
    vaultSearchMaxResults: 8,
    vaultSearchMaxSnippetChars: 700,
    relevantNotesEnabled: true,
    relevantNotesMaxResults: 6,
    projectWorkspaces: [],
    activeProjectWorkspaceId: '',
  },

  sharedEnvironmentVariables: '',
  envSnippets: [],
  customContextLimits: {},
  customModelAliases: {},

  keyboardNavigation: {
    scrollUpKey: 'w',
    scrollDownKey: 's',
    focusInputKey: 'i',
  },
  requireCommandOrControlEnterToSend: false,
  advancedSectionsOpen: {},
  usageIndicatorsEnabled: true,
  debugLoggingEnabled: false,

  locale: 'en',

  providerConfigs: getBuiltInProviderDefaultConfigs(),

  settingsProvider: 'codex',
  savedProviderModel: {},
  savedProviderEffort: {},
  savedProviderServiceTier: {},
  savedProviderThinkingBudget: {},
  savedProviderPermissionMode: {},

  lastCustomModel: '',

  maxTabs: 5,
  tabBarPosition: 'header',
  enableAutoScroll: true,
  deferMathRenderingDuringStreaming: true,
  chatViewPlacement: 'right-sidebar',

  hiddenProviderCommands: getDefaultHiddenProviderCommands(),
};
