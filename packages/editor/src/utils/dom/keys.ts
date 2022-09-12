export type KeyMap = Record<string, (down: boolean, keys: KeyBinding) => any>

export class KeyBinding {
    readonly keystates = { } as Record<string, { down: boolean, shortcuts: string[] }>
    readonly shortcuts = { } as Record<string, { down: boolean, keys: string[], callback: (down: boolean, keys: KeyBinding) => any }>
    constructor(private elem: HTMLElement) {
        elem.tabIndex = -1
        elem.addEventListener('keydown', this.onKeyDown = this.onKeyDown.bind(this))
        elem.addEventListener('keyup', this.onKeyUp = this.onKeyUp.bind(this))
    }
    load(map: KeyMap) {
        for (const key in this.keystates) delete this.keystates[key]
        for (const key in this.shortcuts) delete this.shortcuts[key]
        for (const [combo, callback] of Object.entries(map)) {
            const keys = combo.split('+').map(item => item.trim())
            for (const key of keys) {
                const state = this.keystates[key] || (this.keystates[key] = { down: false, shortcuts: [] })
                state.shortcuts.push(combo)
            }
            this.shortcuts[combo] = { down: false, keys, callback }
        }
    }
    update(key: string, down: boolean) {
        const item = this.keystates[key] || (this.keystates[key] = { down: false, shortcuts: [] })
        item.down = down
        for (const name of item.shortcuts) {
            const shortcut = this.shortcuts[name]
            if (shortcut?.keys.every(key => this.keystates[key]?.down)) {
                !shortcut.down && shortcut.callback(shortcut.down = true, this)
            } else {
                shortcut?.down && shortcut.callback(shortcut.down = false, this)
            }
        }
    }
    onKeyDown(evt: KeyboardEvent) {
        this.update(evt.key, true)
    }
    onKeyUp(evt: KeyboardEvent) {
        this.update(evt.key, false)
    }
    destroy() {
        this.elem.removeEventListener('keydown', this.onKeyDown)
        this.elem.removeEventListener('keyup', this.onKeyUp)
    }
}
