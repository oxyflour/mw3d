export function Group({ title, children }: {
    title: string
    children?: any
}) {
    return <div className="group flex flex-nowrap flex-col">
        <div className="content flex grow">
            { children }
        </div>
        <div className="title text-center">{ title }</div>
    </div>
}
