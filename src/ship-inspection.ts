/** Pure menu-only inspection state. Never reads or writes flight/camera simulation. */
export class InspectionState {
    yaw = 0;
    pitch = 0;
    zoom = 1;
    targetYaw = 0;
    targetPitch = 0;
    targetZoom = 1;
    idle = 0;
    dragging = false;
    drag(dx: number, dy: number) {
        this.targetYaw += dx * 0.32;
        this.targetPitch = Math.max(-65, Math.min(65, this.targetPitch + dy * 0.24));
        this.idle = 0;
    }
    wheel(delta: number) {
        this.targetZoom = Math.max(0.65, Math.min(1.3, this.targetZoom * Math.exp(-delta * 0.001)));
        this.idle = 0;
    }
    reset() {
        this.targetYaw = Math.round(this.yaw / 360) * 360;
        this.targetPitch = 0;
        this.targetZoom = 1;
        this.idle = 0;
    }
    step(dt: number) {
        this.idle += dt;
        if (!this.dragging && this.idle > 6) this.targetYaw += dt * 2.2;
        const a = 1 - Math.exp(-dt * 10);
        this.yaw += (this.targetYaw - this.yaw) * a;
        this.pitch += (this.targetPitch - this.pitch) * a;
        this.zoom += (this.targetZoom - this.zoom) * a;
    }
}
export class ShipInspection {
    readonly state = new InspectionState();
    readonly surface: HTMLDivElement;
    private readonly events = new AbortController();
    private x = 0;
    private y = 0;
    private pointer = -1;
    private selected = '';
    constructor() {
        this.surface = document.createElement('div');
        this.surface.id = 'ship-inspection';
        this.surface.hidden = true;
        this.surface.setAttribute(
            'aria-label',
            'Ship inspection: drag to rotate, scroll to zoom, double-click to reset'
        );
        this.surface.innerHTML = '<small>DRAG TO ROTATE · SCROLL TO ZOOM</small>';
        const options = { signal: this.events.signal };
        const end = () => {
            this.state.dragging = false;
            this.pointer = -1;
            this.surface.classList.remove('dragging');
        };
        this.surface.addEventListener(
            'pointerdown',
            (e) => {
                if (e.button !== 0) return;
                e.preventDefault();
                e.stopPropagation();
                this.pointer = e.pointerId;
                this.x = e.clientX;
                this.y = e.clientY;
                this.state.dragging = true;
                this.state.idle = 0;
                this.surface.setPointerCapture(e.pointerId);
                this.surface.classList.add('dragging');
            },
            options
        );
        this.surface.addEventListener(
            'pointermove',
            (e) => {
                if (!this.state.dragging || this.pointer !== e.pointerId) return;
                this.state.drag(e.clientX - this.x, e.clientY - this.y);
                this.x = e.clientX;
                this.y = e.clientY;
            },
            options
        );
        for (const name of ['pointerup', 'pointercancel', 'lostpointercapture'])
            this.surface.addEventListener(name, end, options);
        window.addEventListener('blur', end, options);
        this.surface.addEventListener(
            'wheel',
            (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.state.wheel(e.deltaY);
            },
            { ...options, passive: false }
        );
        this.surface.addEventListener(
            'dblclick',
            (e) => {
                e.preventDefault();
                this.state.reset();
            },
            options
        );
        window.addEventListener('resize', () => this.resize(), options);
    }
    private resize() {
        const card = document.querySelector('#menu .menu-card')!.getBoundingClientRect();
        this.surface.style.left = Math.max(innerWidth * 0.43, card.right + 12) + 'px';
    }
    update(show: boolean, dt: number, ship: string) {
        if (!this.surface.parentElement) document.getElementById('menu')?.append(this.surface);
        const opened = this.surface.hidden && show;
        this.surface.hidden = !show;
        if (!show) {
            this.state.dragging = false;
            return;
        }
        if (opened || this.selected !== ship) this.resize();
        if (this.selected !== ship) {
            this.selected = ship;
            this.state.reset();
        }
        this.state.step(Math.min(0.05, dt));
    }
    destroy() {
        this.events.abort();
        this.surface.remove();
    }
}
