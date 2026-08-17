import * as migration_20260817_132927_initial from './20260817_132927_initial';

export const migrations = [
  {
    up: migration_20260817_132927_initial.up,
    down: migration_20260817_132927_initial.down,
    name: '20260817_132927_initial'
  },
];
