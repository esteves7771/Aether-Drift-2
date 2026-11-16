import type { PlayerShip } from './thruster-state';

/** Public packaging never enables models whose redistribution is unresolved. */
export const PUBLIC_RELEASE = import.meta.env.MODE === 'public-release';
export const AVAILABLE_SHIPS: readonly PlayerShip[] = PUBLIC_RELEASE
    ? ['classic', 'surveyor']
    : ['classic', 'surveyor', 'ptah'];
export const VOYAGE_AVAILABLE = !PUBLIC_RELEASE;
export const modelAvailable = (key: string) => !PUBLIC_RELEASE || (key !== 'ptah' && key !== 'voyage');
