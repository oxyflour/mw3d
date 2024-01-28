#include "primitive.h"
#include <BRepPrimAPI_MakeBox.hxx>
#include <BRepPrimAPI_MakeSphere.hxx>

#include "../topo/shape.h"
#include "../utils.h"

Napi::Value MakeSphere(const Napi::CallbackInfo &info) {
    auto p = obj2pt(info[0]);
    auto r = info[1].As<Napi::Number>().DoubleValue();
    return Shape::Create(BRepPrimAPI_MakeSphere(p, r));
}

Napi::Value MakeBox(const Napi::CallbackInfo &info) {
    auto p0 = obj2pt(info[0]), p1 = obj2pt(info[1]);
    return Shape::Create(BRepPrimAPI_MakeBox(p0, p1).Shape());
}
