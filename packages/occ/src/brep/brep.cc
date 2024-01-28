#include "brep.h"

#include <BRep_Builder.hxx>
#include <BRepTools.hxx>

#include "../topo/shape.h"

Napi::Value LoadBrep(const Napi::CallbackInfo &info) {
    TopoDS_Shape shape;
    BRep_Builder builder;
    if (info[0].IsString()) {
        std::string file = info[0].As<Napi::String>();
        if (!BRepTools::Read(shape, file.c_str(), builder)) {
            auto msg = std::string("failed to read ") + file;
            Napi::Error::New(info.Env(), msg).ThrowAsJavaScriptException();
        }
        return Shape::Create(shape);
    } else if (info[0].IsBuffer()) {
        std::istringstream stream(info[0].As<Napi::Buffer<char>>().Data());
        BRepTools::Read(shape, stream, builder);
        return Shape::Create(shape);
    } else {
        Napi::Error::New(info.Env(), "Only file name or buffer supported").ThrowAsJavaScriptException();
        return info.Env().Undefined();
    }
}

Napi::Value SaveBrep(const Napi::CallbackInfo &info) {
    if (info[0].IsString()) {
        std::string file = info[0].As<Napi::String>();
        auto &shape = Shape::Unwrap(info[1].As<Napi::Object>())->shape;
        if (!BRepTools::Write(shape, file.c_str())) {
            auto msg = std::string("failed to write ") + file;
            Napi::Error::New(info.Env(), msg).ThrowAsJavaScriptException();
        }
        // return value is required
        return info.Env().Null();
    } else {
        auto &shape = Shape::Unwrap(info[0].As<Napi::Object>())->shape;
        std::ostringstream stream;
        BRepTools::Write(shape, stream);
        auto str = stream.str();
        return Napi::Buffer<char>::Copy(info.Env(), str.c_str(), str.size());
    }
}
