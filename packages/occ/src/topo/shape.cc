#include "shape.h"
#include <set>

#include <Bnd_Box.hxx>
#include <GProp_GProps.hxx>

#include <TopoDS_Face.hxx>
#include <TopoDS_Edge.hxx>
#include <TopoDS_Wire.hxx>
#include <TopExp_Explorer.hxx>

#include <Geom_BSplineSurface.hxx>
#include <Geom_BSplineCurve.hxx>

#include <BRepAdaptor_Surface.hxx>
#include <BRepBuilderAPI_MakeFace.hxx>
#include <BRepBndLib.hxx>
#include <BRepGProp.hxx>

#include "../utils.h"

std::map<int, std::map<std::string, std::string>> Shape::MetaMap;

Shape::Shape(const Napi::CallbackInfo &info) : Napi::ObjectWrap<Shape>(info) {
}

void Shape::Init(Napi::Env env, Napi::Object exports) {
    auto func = DefineClass(env, "Shape", {
        InstanceAccessor("type", &Shape::Type, NULL),
        InstanceAccessor("meta", &Shape::Meta, NULL),
        InstanceMethod("bound", &Shape::Bound),
        InstanceMethod("find", &Shape::Find),

        InstanceMethod("getLinearProps", &Shape::GetLinearProps),
        InstanceMethod("getSurfaceProps", &Shape::GetSurfaceProps),
        InstanceMethod("getVolumeProps", &Shape::GetVolumeProps),
    });

    constructor = Napi::Persistent(func);
    constructor.SuppressDestruct();

    auto types = Napi::Object::New(env);
    types.Set("COMPOUND", Napi::Number::New(env, TopAbs_ShapeEnum::TopAbs_COMPOUND));
    types.Set("COMPSOLID", Napi::Number::New(env, TopAbs_ShapeEnum::TopAbs_COMPSOLID));
    types.Set("EDGE", Napi::Number::New(env, TopAbs_ShapeEnum::TopAbs_EDGE));
    types.Set("FACE", Napi::Number::New(env, TopAbs_ShapeEnum::TopAbs_FACE));
    types.Set("SHAPE", Napi::Number::New(env, TopAbs_ShapeEnum::TopAbs_SHAPE));
    types.Set("SHELL", Napi::Number::New(env, TopAbs_ShapeEnum::TopAbs_SHELL));
    types.Set("SOLID", Napi::Number::New(env, TopAbs_ShapeEnum::TopAbs_SOLID));
    types.Set("VERTEX", Napi::Number::New(env, TopAbs_ShapeEnum::TopAbs_VERTEX));
    types.Set("WIRE", Napi::Number::New(env, TopAbs_ShapeEnum::TopAbs_WIRE));
    func.Set("types", types);

    exports.Set("ShapeType", types);
    exports.Set("Shape", func);
}

Napi::Value Shape::Type(const Napi::CallbackInfo &info) {
    return Napi::Number::New(info.Env(), shape.ShapeType());
}

Napi::Value Shape::Meta(const Napi::CallbackInfo &info) {
    auto &meta = Shape::MetaMap[shape.HashCode(0x0fffffff)];
    auto ret = Napi::Object::New(info.Env());
    for (auto &[key, val] : meta) {
        ret.Set(key, val);
    }
    return ret;
}

Napi::Value Shape::Bound(const Napi::CallbackInfo &info) {
    Bnd_Box box;
    BRepBndLib::Add(shape, box);

    double xmin, ymin, zmin, xmax, ymax, zmax;
    box.Get(xmin, ymin, zmin, xmax, ymax, zmax);

    auto min = Napi::Object::New(info.Env());
    min.Set("x", xmin);
    min.Set("y", ymin);
    min.Set("z", zmin);
    auto max = Napi::Object::New(info.Env());
    max.Set("x", xmax);
    max.Set("y", ymax);
    max.Set("z", zmax);
    auto ret = Napi::Object::New(info.Env());
    ret.Set("min", min);
    ret.Set("max", max);
    return ret;
}

Napi::Value Shape::Find(const Napi::CallbackInfo &info) {
    auto type = static_cast<TopAbs_ShapeEnum>(info[0].As<Napi::Number>().Int32Value());
    TopExp_Explorer exp;
    auto arr = Napi::Array::New(info.Env());
    std::set<int> added;
    int i = 0;
    for (exp.Init(shape, type); exp.More(); exp.Next()) {
        auto topo = exp.Current();
        auto hash = topo.HashCode(0x0fffffff);
        if (!added.count(hash)) {
            added.insert(hash);
            arr.Set(i ++, Shape::Create(topo));
        }
    }
    return arr;
}

Napi::Value Shape::GetLinearProps(const Napi::CallbackInfo &info) {
    GProp_GProps props;
    BRepGProp::LinearProperties(shape, props);
    auto ret = Napi::Object::New(info.Env());
    ret.Set("mass", props.Mass());
    return ret;
}

Napi::Value Shape::GetSurfaceProps(const Napi::CallbackInfo &info) {
    GProp_GProps props;
    BRepGProp::SurfaceProperties(shape, props);
    auto ret = Napi::Object::New(info.Env());
    ret.Set("mass", props.Mass());
    return ret;
}

Napi::Value Shape::GetVolumeProps(const Napi::CallbackInfo &info) {
    GProp_GProps props;
    BRepGProp::VolumeProperties(shape, props);
    auto ret = Napi::Object::New(info.Env());
    ret.Set("mass", props.Mass());
    return ret;
}

Napi::Value Shape::Create(const TopoDS_Shape &shape) {
    auto inst = constructor.New({ });
    Shape::Unwrap(inst)->shape = shape;
    return inst;
}

Napi::FunctionReference Shape::constructor;
