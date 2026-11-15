/** Fixed celestial coordinates; no gameplay solids or mission entries. */
export const CINEMATIC = {
    starCounts: [1800, 1500, 2100],
    bodies: [
        { name: 'Selene / mineral moon', position: [-1850, 580, -5600], radius: 230, color: '#c2bac1' },
        { name: 'Nacre / distant ocean world', position: [260, -950, -6800], radius: 350, color: '#457d94' },
        { name: 'Vesper / outer crescent', position: [3050, 1700, -7400], radius: 155, color: '#a49788' }
    ]
} as const;
