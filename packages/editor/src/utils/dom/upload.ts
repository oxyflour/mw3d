export function upload(cb: (files: FileList | null) => any) {
    const input = document.createElement('input')
    input.type = 'file'
    input.style.display = 'none'
    input.onchange = () => {
        cb(input.files);
        document.body.removeChild(input)
    }
    document.body.appendChild(input)
    input.click()
}
