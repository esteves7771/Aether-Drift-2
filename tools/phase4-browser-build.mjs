// Test-only transform: the production build never includes this driver or exposes simulation state.
import { build, loadConfigFromFile } from 'vite';
const loaded = await loadConfigFromFile({ command: 'build', mode: 'production' });
await build({
    ...loaded.config,
    configFile: false,
    build: { ...loaded.config.build, outDir: '.local-tools/phase4-preview' },
    plugins: [
        ...loaded.config.plugins,
        {
            name: 'phase4-test-driver',
            enforce: 'pre',
            transform(code, id) {
                if (!id.replaceAll('\\', '/').endsWith('/src/main.ts')) return;
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
    const driver={combat,flight,app,rocks,cruise,modelLibrary,hangar,living,thrusters:scene.thrusters,input,chase,settings,pilotCamera,explosions:combatView.explosions,events:captures,useAbilities:true,autoUpgrades:true,pilot:false,advance(ticks:number){for(let i=0;i<ticks;i++)app.fire('update',.05);}};
    Object.assign(globalThis,{__phase4:driver});
    app.on('update',(dt:number)=>{
        if(driver.pilot&&driver.autoUpgrades&&combat.upgrades.pending){chooseUpgrade(combat.upgrades.offers[0]);window.dispatchEvent(new KeyboardEvent('keydown',{code:'Space',bubbles:true}));return;}
        if(!driver.pilot||!active||dt<=0)return;
        pilotAge+=dt;
        const target=combat.targets.find(t=>t.active&&t.targetable&&(t.id<16||t.id>=22&&t.id<=28));
        if(target){
            const distance=target.position.distance(flight.position);
            pilotPoint.copy(target.velocity).sub(flight.velocity).mulScalar(distance/480).add(target.position);
            pilotAim.setPosition(flight.position);pilotAim.lookAt(pilotPoint);flight.rotation.copy(pilotAim.getRotation());flight.previousRotation.copy(flight.rotation);combat.selected=target.id;
            pilotMove.set(Math.sin(pilotAge*1.6)*18,Math.cos(pilotAge*1.9)*18,0);
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
        build: { outDir: '.local-tools/phase4-preview' },
        preview: { host: '0.0.0.0', port: 5181, strictPort: true }
    });
}
