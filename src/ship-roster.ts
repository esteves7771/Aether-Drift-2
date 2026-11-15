/** Pagination changes visibility only. Selection remains owned by ShipHangar. */
export class RosterPages {
    page = 0;
    count: number;
    readonly size: number;
    constructor(count: number, size = 2) {
        this.count = count;
        this.size = size;
    }
    get pages() {
        return Math.max(1, Math.ceil(this.count / this.size));
    }
    move(delta: number) {
        this.page = Math.max(0, Math.min(this.pages - 1, this.page + delta));
    }
    visible(index: number) {
        return Math.floor(index / this.size) === this.page;
    }
}
export class ShipRoster {
    readonly pages: RosterPages;
    private readonly arrows: HTMLButtonElement[] = [];
    private readonly events = new AbortController();
    private readonly cards: HTMLElement;
    constructor(cards: HTMLElement) {
        this.cards = cards;
        const ships = [...cards.children] as HTMLElement[];
        this.pages = new RosterPages(ships.length);
        cards.classList.add('roster-cards');
        cards.setAttribute('role', 'group');
        for (const delta of [-1, 1]) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'roster-arrow';
            button.textContent = delta < 0 ? '‹' : '›';
            button.setAttribute('aria-label', delta < 0 ? 'Previous ships' : 'Next ships');
            button.addEventListener(
                'click',
                () => {
                    this.pages.move(delta);
                    this.render();
                },
                { signal: this.events.signal }
            );
            cards.parentElement!.append(button);
            this.arrows.push(button);
        }
        this.render();
    }
    render() {
        const ships = [...this.cards.children] as HTMLElement[];
        this.pages.count = ships.length;
        this.pages.move(0);
        ships.forEach((card, i) => {
            card.hidden = !this.pages.visible(i);
        });
        this.arrows.forEach((button, i) => {
            button.hidden = this.pages.count <= this.pages.size;
            button.disabled = i === 0 ? this.pages.page === 0 : this.pages.page === this.pages.pages - 1;
        });
        this.cards.setAttribute('aria-label', `Ship roster, page ${this.pages.page + 1} of ${this.pages.pages}`);
    }
    destroy() {
        this.events.abort();
        this.arrows.forEach((b) => b.remove());
    }
}
