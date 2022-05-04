import { mat4 } from '../../../deps/gl-matrix/assembly'

const objs = new Array<Obj3>(0)
class Obj3 {
  idx: i32
  disposed: bool
  parent: i32
  children: Set<i32> = new Set<i32>()

  needsUpdate(): bool {
    return false
  }
  update(): void {
    const ids = this.children.values()
    for (let i = 0, n = ids.length; i < n; i ++) {
      const idx = ids[i]
      if (idx >= 0 && idx < objs.length) {
        objs[idx].update()
      }
    }
  }
}

function getFree(): i32 {
  let idx = 0
  for (let n = objs.length; idx < n; idx ++) {
    const obj = objs[idx]
    if (obj.disposed) {
      return idx
    }
  }
  const obj = new Obj3()
  objs.push(obj)
  return idx
}

export function create(): i32 {
  const idx = getFree()
  const obj = new Obj3()
  obj.idx = idx
  obj.parent = -1
  obj.disposed = false
  return obj.idx
}

export function dispose(idx: i32): void {
  objs[idx].disposed = true
}

export function removeFrom(cidx: i32, pidx: i32): void {
  if (cidx >= 0 && cidx < objs.length) {
    objs[cidx].parent = -1
  }
  if (pidx >= 0 && pidx < objs.length) {
    objs[pidx].children.delete(cidx)
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
