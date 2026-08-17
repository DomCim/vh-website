import * as migration_20260817_132927_initial from './20260817_132927_initial';
import * as migration_20260817_133657_integrations from './20260817_133657_integrations';

export const migrations = [
  {
    up: migration_20260817_132927_initial.up,
    down: migration_20260817_132927_initial.down,
    name: '20260817_132927_initial',
  },
  {
    up: migration_20260817_133657_integrations.up,
    down: migration_20260817_133657_integrations.down,
    name: '20260817_133657_integrations'
  },
];
