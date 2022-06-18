export function withMouseDown(
        onMove?: (evt: MouseEvent) => void,
        onUp?: (evt: MouseEvent) => void) {
    function onMouseMove(evt: MouseEvent) {
        onMove?.(evt)
    }
    function onMouseUp(evt: MouseEvent) {
        onUp?.(evt)
        document.body.removeEventListener('mousemove', onMouseMove)
        document.body.removeEventListener('mouseup', onMouseUp)
    }
    document.body.addEventListener('mousemove', onMouseMove)
    document.body.addEventListener('mouseup', onMouseUp)
}
