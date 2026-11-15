import { Vec3 } from 'playcanvas';

import { FLIGHT } from './config';
import type { Flight } from './flight';
export interface Rock {
    position: Vec3;
    radius: number;
}
export function field(): Rock[] {
    let seed = 7771;
    const rand = () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 4294967296;
    };
    const rocks: Rock[] = [{ position: new Vec3(0, 0, -95), radius: 9 }];
    for (let i = 0; i < 170; i++)
        rocks.push({
            position: new Vec3((rand() - 0.5) * 1500, (rand() - 0.5) * 850, -100 - rand() * 1800),
            radius: 5 + rand() * 22
        });
    rocks.push(
        { position: new Vec3(-620, -330, -1900), radius: 65 },
        { position: new Vec3(900, 350, -2250), radius: 95 },
        { position: new Vec3(-1150, 120, -2500), radius: 125 }
    );
    return rocks;
}
export class Collisions {
    private readonly segment = new Vec3();
    private readonly offset = new Vec3();
    private readonly closest = new Vec3();
    private readonly normal = new Vec3();
    solve(ship: Flight, rocks: Rock[]) {
        this.segment.sub2(ship.position, ship.previous);
        const length = this.segment.lengthSq();
        for (const rock of rocks) {
            this.offset.sub2(rock.position, ship.previous);
            const t = length > 0 ? Math.max(0, Math.min(1, this.offset.dot(this.segment) / length)) : 0;
            this.closest.copy(this.segment).mulScalar(t).add(ship.previous);
            this.normal.sub2(this.closest, rock.position);
            const radius = rock.radius + FLIGHT.radius;
            if (this.normal.lengthSq() >= radius * radius) continue;
            if (this.normal.lengthSq() < 0.00001) this.normal.set(0, 0, 1);
            else this.normal.normalize();
            ship.position
                .copy(this.normal)
                .mulScalar(radius + 0.05)
                .add(rock.position);
            const closing = ship.velocity.dot(this.normal);
            if (closing < 0) {
                if (ship.impact < 0.1) ship.hull = Math.max(0, ship.hull - Math.max(6, -closing * 0.65));
                ship.velocity.add(this.offset.copy(this.normal).mulScalar(-closing * 1.45));
                ship.impact = 1;
            }
            ship.previous.copy(ship.position);
            break;
        }
    }
}
