/** Explicit pause/cancel/confirm ownership; repeated requests cannot replace a pending action. */
export class RestartDialog {
    readonly root: HTMLElement;
    private confirm?: () => void;
    private cancel?: () => void;
    private previous?: HTMLElement;
    private readonly events = new AbortController();
    constructor() {
        document.body.insertAdjacentHTML(
            'beforeend',
            `<div id="restart-confirm" hidden><section role="dialog" aria-modal="true" aria-labelledby="restart-title"><small>PATROL CONTROL / CONFIRMATION</small><h2 id="restart-title">RESTART PATROL?</h2><p>Your current run progress will be lost. Restart?</p><div><button id="restart-cancel">CANCEL</button><button id="restart-accept">RESTART PATROL</button></div></section></div>`
        );
        this.root = document.getElementById('restart-confirm')!;
        document.getElementById('restart-cancel')!.onclick = () => this.close(false);
        document.getElementById('restart-accept')!.onclick = () => this.close(true);
        window.addEventListener(
            'keydown',
            (e) => {
                if (this.root.hidden) return;
                if (e.code === 'Escape') {
                    e.preventDefault();
                    this.close(false);
                }
                if (e.code === 'Tab') {
                    e.preventDefault();
                    const a = document.getElementById('restart-cancel')!,
                        b = document.getElementById('restart-accept')!;
                    (document.activeElement === a ? b : a).focus();
                }
                if (!['Enter', 'Tab', 'Escape'].includes(e.code)) e.preventDefault();
                e.stopImmediatePropagation();
            },
            { capture: true, signal: this.events.signal }
        );
    }
    get open() {
        return !this.root.hidden;
    }
    show(confirm: () => void, cancel: () => void) {
        if (this.open) return;
        this.confirm = confirm;
        this.cancel = cancel;
        this.previous = document.activeElement as HTMLElement;
        this.root.hidden = false;
        document.body.classList.add('dialog-open');
        document.getElementById('restart-cancel')!.focus();
    }
    private close(confirmed: boolean) {
        if (!this.open) return;
        this.root.hidden = true;
        document.body.classList.remove('dialog-open');
        const callback = confirmed ? this.confirm : this.cancel;
        this.confirm = this.cancel = undefined;
        this.previous?.focus();
        callback?.();
    }
    destroy() {
        document.body.classList.remove('dialog-open');
        this.events.abort();
        this.root.remove();
    }
}
