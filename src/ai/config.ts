/**
 * Configurazione provider LLM. Tutto via variabili d'ambiente.
 * Default provider: anthropic (Claude). La chiave è opzionale: se assente,
 * la chat usa il parser di fallback a regole (src/ai/assistant.ts).
 */
export const aiConfig = {
  provider: process.env.AI_PROVIDER || 'anthropic',
  apiKey: process.env.ANTHROPIC_API_KEY || '',
  model: process.env.ANTHROPIC_MODEL || 'claude-opus-4-8',
  get enabled(): boolean {
    return this.provider === 'anthropic' && this.apiKey.length > 0;
  },
};
