import { mat4 } from '../../../deps/gl-matrix/assembly'

const objs = new Array<Obj3>(0)
class Obj3 {
  id: i32
  disposed: bool
  parent: i32
  children: Set<i32> = new Set<i32>()
  needsUpdate(): bool {
    return false
  }
  update(): void {
    const ids = this.children.values()
    for (let i = 0, n = ids.length; i < n; i ++) {
      const id = ids[i]
      if (id >= 0) {
        const obj = objs[id]
        if (obj.needsUpdate()) {
          obj.update()
        }
      }
    }
  }
}

export function create(id: i32): i32 {
  let i = 0
  for (; i < objs.length; i ++) {
    const obj = objs[i]
    if (obj.disposed) {
      obj.id = id
      obj.parent = -1
      return i
    }
  }
  const obj = new Obj3()
  obj.id = id
  obj.parent = -1
  objs.push(obj)
  return i
}

export function dispose(ptr: i32): void {
  objs[ptr].disposed = true
}

export function removeFrom(cptr: i32, pptr: i32): void {
  const child = objs[cptr]
  if (child) {
    child.parent = -1
  }
  const parent = objs[pptr]
  if (parent) {
    parent.children.delete(cptr)
  }
}

export function addTo(cptr: i32, pptr: i32): void {
  const child = objs[cptr]
  if (child) {
    const pptr = child.parent
    if (pptr >= 0) {
      objs[pptr].children.delete(cptr)
    }
    child.parent = pptr
  }
  const parent = objs[pptr]
  if (parent) {
    parent.children.add(cptr)
  }
}

export function update(ptrs: Int32Array, len: i32): void {
  for (let i = 0, n = ptrs.length; i < n; i ++) {
    const obj = objs[ptrs[i]]
    if (obj.parent === -1) {
      obj.update()
    }
  }
}

export const Int32Array_ID = idof<Int32Array>()
