export function mapGrimoireModeToQwen(mode: string | null | undefined): string {
  switch (mode) {
    case 'full_access': return 'yolo';
    case 'plan': return 'plan';
    case 'yolo': return 'yolo';
    case 'normal':
    case 'auto-edit':
    case 'auto':
    case 'default':
    default: return 'default';
  }
}

export function mapQwenModeToGrimoire(mode: string | null | undefined): 'normal' | 'full_access' | 'plan' {
  switch (mode) {
    case 'yolo': return 'full_access';
    case 'plan': return 'plan';
    default: return 'normal';
  }
}
