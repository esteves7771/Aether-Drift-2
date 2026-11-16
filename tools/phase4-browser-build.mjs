// Test-only transform: the production build never includes this driver or exposes simulation state.
import { execFileSync } from 'node:child_process';

import { build, loadConfigFromFile } from 'vite';
const baseline = process.argv.includes('--baseline');
const outDir = baseline ? '.local-tools/phase4-baseline' : '.local-tools/phase4-preview';
const loaded = await loadConfigFromFile({ command: 'build', mode: 'production' });
await build({
    ...loaded.config,
    configFile: false,
    build: { ...loaded.config.build, outDir },
    plugins: [
        ...loaded.config.plugins,
        {
            name: 'phase4-test-driver',
            enforce: 'pre',
            transform(code, id) {
                const filename = id.replaceAll('\\', '/').split('/').pop();
                if (baseline && ['main.ts', 'scene.ts', 'atmosphere.ts'].includes(filename))
                    code = execFileSync('git', ['show', 'HEAD:src/' + filename], { encoding: 'utf8' });
                if (filename !== 'main.ts')
                    return baseline && ['scene.ts', 'atmosphere.ts'].includes(filename) ? code : undefined;
                return code
                    .replace(
                        'const soundOffset = new Vec3();',
                        'const soundOffset = new Vec3(); const captures:{kind:string,x:number,y:number,z:number,time:number,style?:string}[]=[];'
                    )
                    .replace(
                        'combatView.event(event, point, size, blast);',
                        'combatView.event(event, point, size, blast); if(captures.length>=32)captures.shift();captures.push({kind:event,x:point.x,y:point.y,z:point.z,time:combat.duration,style:blast});'
                    )
                    .replace(
                        "    app.on('update', (dt: number) => {",
                        `
    const pilotAim=new Entity('Test pilot orientation'), pilotPoint=new Vec3(), pilotMove=new Vec3(), pilotDelta=new Vec3();
    let pilotAge=0;
    const driver={combat,flight,app,rocks,cruise,modelLibrary,hangar,living,${baseline ? '' : 'universe,'}thrusters:scene.thrusters,input,chase,settings,pilotCamera,explosions:combatView.explosions,view:combatView,events:captures,useAbilities:true,autoUpgrades:true,pilot:false,controlsOnly:false,advance(ticks:number){for(let i=0;i<ticks;i++)app.fire('update',.05);}};
    Object.assign(globalThis,{__phase4:driver});
    app.on('update',(dt:number)=>{
        if(driver.pilot&&driver.autoUpgrades&&combat.upgrades.pending){chooseUpgrade(combat.upgrades.offers[0]);window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyZ',bubbles:true}));return;}
        if(!driver.pilot||!active||dt<=0)return;
        pilotAge+=dt;
        if(driver.controlsOnly){
            const bosses=combat.allBosses;
            const boss=combat.boss;
            const target= boss.active?(boss.parts.find(p=>p.targetable)??combat.enemies.find(e=>e.targetable)??boss.parts.find(p=>p.active)):combat.enemies.find(e=>e.targetable);
            if(!target)return;
            const distance=target.position.distance(flight.position);
            pilotPoint.copy(target.velocity).sub(flight.velocity).mulScalar(distance/480).add(target.position);
            const local=flight.rotation.clone().invert().transformVector(pilotPoint.clone().sub(flight.position));
            const yaw=Math.atan2(local.x,-local.z),pitch=Math.atan2(local.y,Math.hypot(local.x,local.z));
            window.dispatchEvent(new MouseEvent('mousemove',{movementX:Math.round(yaw*3*dt/(.002*settings.sensitivity)),movementY:Math.round(-pitch*3*dt/(.002*settings.sensitivity)),bubbles:true}));
            const set=(code:string,down:boolean)=>window.dispatchEvent(new KeyboardEvent(down?'keydown':'keyup',{code,bubbles:true,repeat:down}));
            const tap=(code:string)=>{window.dispatchEvent(new KeyboardEvent('keydown',{code,bubbles:true}));window.dispatchEvent(new KeyboardEvent('keyup',{code,bubbles:true}));};
            set('KeyW',distance>440);set('KeyS',distance<300);set('KeyD',Math.sin(pilotAge*.65)>0);set('KeyA',Math.sin(pilotAge*.65)<=0);
            set('KeyF',Math.sin(pilotAge*.83)>.3);set('ControlLeft',Math.sin(pilotAge*.83)<-.3);set('ShiftLeft',distance>700||bosses.some(b=>b.active&&b.patterns.beamActive));
            if(Math.abs(yaw)<.16&&Math.abs(pitch)<.16)document.getElementById('application-canvas')!.dispatchEvent(new MouseEvent('mousedown',{button:2,bubbles:true}));
            if(driver.useAbilities){
                if(combat.ammo>0&&combat.missileCooldown<=0)tap('KeyM');
                if(combat.storm.ready)tap('KeyV');
                if(combat.empCooldown<=0&&combat.enemies.some(e=>e.targetable&&e.position.distance(flight.position)<170))tap('KeyG');
                if(flight.evasion.cooldown<=0&&bosses.some(b=>b.active&&b.patterns.state==='fire'))tap('Space');
            }
            return;
        }

        let target=combat.targets.find(t=>t.active&&t.targetable&&(t.id<16||t.id>=22&&t.id<=28));
        const artillery=combat.boss;
        if(artillery.active){
            target=artillery.parts.find(p=>p.active&&p.targetable)??artillery.parts.find(p=>p.active);
            if(artillery.arriving){pilotAim.setPosition(flight.position);pilotAim.lookAt(artillery.arrival.anchor);flight.rotation.copy(pilotAim.getRotation());flight.previousRotation.copy(flight.rotation);target=undefined;}
        }
        if(target){
            const distance=target.position.distance(flight.position);
            pilotPoint.copy(target.velocity).sub(flight.velocity).mulScalar(distance/flight.spec.weapon.speed).add(target.position);
            pilotAim.setPosition(flight.position);pilotAim.lookAt(pilotPoint);flight.rotation.copy(pilotAim.getRotation());flight.previousRotation.copy(flight.rotation);combat.selected=target.id;
            pilotMove.set(Math.sin(pilotAge*1.6)*18,Math.cos(pilotAge*1.9)*18,0);
            if(artillery.active&&!artillery.arriving){
                const radial=artillery.position.clone().sub(flight.position),range=radial.length();radial.normalize();
                const side=new Vec3().cross(radial,Vec3.UP).normalize(),vertical=new Vec3().cross(side,radial).normalize();
                pilotMove.copy(side).mulScalar(Math.sin(pilotAge*1.3)*48).add(vertical.mulScalar(Math.cos(pilotAge*.91)*36)).add(radial.mulScalar(range>410?42:range<330?-32:0));
                if(pilotMove.length()>70)pilotMove.normalize().mulScalar(70);
            }
            if(distance<125)pilotMove.add(pilotDelta.sub2(flight.position,target.position).normalize().mulScalar(28));
            for(const rock of rocks){
                pilotDelta.sub2(flight.position,rock.position);const d=pilotDelta.length();
                if(d<rock.radius+35&&d>.01)pilotMove.add(pilotDelta.mulScalar((rock.radius+35-d)*3/d));
                // Move sideways when a rock occludes the line of fire, rather than bypassing collisions.
                const ray=pilotPoint.clone().sub(flight.position);const t=Math.max(0,Math.min(1,rock.position.clone().sub(flight.position).dot(ray)/ray.lengthSq()));
                const closest=ray.mulScalar(t).add(flight.position);
                if(t>0&&t<1&&closest.distance(rock.position)<rock.radius+4)pilotMove.x+=35;
            }
            if(combat.guardian.active&&target.id>=22){
                const center=combat.guardian.position;
                const current=Math.atan2(flight.position.z-center.z,flight.position.x-center.x);
                const goal=Math.atan2(target.position.z-center.z,target.position.x-center.x);
                const gap=Math.atan2(Math.sin(goal-current),Math.cos(goal-current));
                const heading=current+Math.max(-.45,Math.min(.45,gap));
                const radius=target.position.distance(center)+170;
                pilotDelta.set(center.x+Math.cos(heading)*radius,target.position.y,center.z+Math.sin(heading)*radius);
                pilotDelta.sub(flight.position);
                if(pilotDelta.length()>15)pilotMove.copy(pilotDelta).normalize().mulScalar(75);
            }
            flight.velocity.copy(pilotMove);
            if(driver.useAbilities&&combat.storm.ready)combat.activateStorm();
            if(driver.useAbilities&&combat.wave>=3&&combat.ammo>0&&combat.missileCooldown<=0)combat.launchMissile();
        }
        if(driver.useAbilities&&combat.empCooldown<=0&&combat.enemies.some(e=>e.active&&e.position.distance(flight.position)<150))combat.emp();
    });
    app.on('update', (dt: number) => {`
                    );
            }
        }
    ]
});

if (process.argv.includes('--serve')) {
    const { preview } = await import('vite');
    await preview({
        configFile: false,
        build: { outDir },
        preview: {
            host: '0.0.0.0',
            port: Number(process.argv.find((a) => a.startsWith('--port='))?.split('=')[1] ?? 5181),
            strictPort: true
        }
    });
}
