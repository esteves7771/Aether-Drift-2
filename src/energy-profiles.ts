/** Cosmetic profiles only. Gameplay tags and sphere sweeps stay authoritative. */
export const ENERGY_PROFILES = {
    'plasma-ring': { tag: 1, radius: 3.2, trail: 2 },
    'kinetic-red': { tag: 2, radius: 0.8, trail: 19 },
    'linked-violet': { tag: 4, radius: 2, trail: 4 },
    'guided-energy': { tag: 5, radius: 1.2, trail: 7 },
    'ion-blue': { tag: 0, radius: 1.2, trail: 10 },
    'heavy-beam': { tag: 8, radius: 2.8, trail: 0 }
} as const;
export const ENERGY_LINKS = 96;

export const energyProfile = (tag: number) =>
    ENERGY_PROFILES[
        tag === 1
            ? 'plasma-ring'
            : tag === 2
              ? 'kinetic-red'
              : tag === 4
                ? 'linked-violet'
                : tag === 5
                  ? 'guided-energy'
                  : 'ion-blue'
    ];
