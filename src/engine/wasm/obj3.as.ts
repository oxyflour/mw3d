import { mat4 } from '../../../deps/gl-matrix/assembly'

const objs = new Map<i32, Obj3>()
class Obj3 {
  id: i32
  parent: i32
  children: Set<i32> = new Set<i32>()
  needsUpdate(): bool {
    return false
  }
  update(out: i32[]): void {
    const ids = this.children.values()
    for (let i = 0, n = ids.length; i < n; i ++) {
      const id = ids[i]
      if (id >= 0 && objs.has(id)) {
        const obj = objs[id]
        if (obj.needsUpdate()) {
          out.push(id)
          obj.update(out)
        }
      }
    }
  }
}

export function create(id: i32): i32 {
  const obj = new Obj3()
  obj.id = id
  obj.parent = -1
  objs.set(id, obj)
  return objs.size
}

export function dispose(id: i32): void {
  objs.delete(id)
}

export function removeFrom(cid: i32, pid: i32): void {
  const child = objs[cid]
  if (child) {
    child.parent = -1
  }
  const parent = objs[pid]
  if (parent) {
    parent.children.delete(cid)
  }
}

export function addTo(cid: i32, pid: i32): void {
  const child = objs[cid]
  if (child) {
    const pid = child.parent
    if (pid >= 0 && objs.has(pid)) {
      objs[pid].children.delete(cid)
    }
    child.parent = pid
  }
  const parent = objs[pid]
  if (parent) {
    parent.children.add(cid)
  }
}

export function update(ids: i32[]): i32[] {
  const out: i32[] = []
  for (let i = 0, n = ids.length; i < n; i ++) {
    objs[ids[i]].update(out)
  }
  return out
}
