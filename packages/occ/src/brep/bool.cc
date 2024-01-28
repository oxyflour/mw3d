#include "bool.h"

#include <BRepAlgoAPI_Fuse.hxx>
#include <BRepAlgoAPI_Common.hxx>
#include <BRepAlgoAPI_Cut.hxx>
#include <BRepAlgoAPI_Section.hxx>
#include <BRepAlgoAPI_Splitter.hxx>

#include "../topo/shape.h"

TopoDS_ListOfShape &arr2list(Napi::Array arr, TopoDS_ListOfShape &list) {
    for (int i = 0, n = arr.Length(); i < n; i ++) {
        auto item = arr.Get(i).As<Napi::Object>();
        list.Append(Napi::ObjectWrap<Shape>::Unwrap(item)->shape);
    }
    return list;
}

Napi::Value fuse(const Napi::CallbackInfo &info) {
    BRepAlgoAPI_Fuse api;
    TopTools_ListOfShape args, tools;
    api.SetArguments(arr2list(info[0].As<Napi::Array>(), args));
    api.SetTools(arr2list(info[1].As<Napi::Array>(), tools));
    if (info.Length() > 2) {
        auto opts = info[2].As<Napi::Object>();
        if (opts.Has("fuzzyValue")) {
            auto fuzzyValue = opts.Get("fuzzyValue").As<Napi::Number>().DoubleValue();
            api.SetFuzzyValue(fuzzyValue);
        }
        // TODO:
        // https://www.opencascade.com/doc/occt-7.3.0/overview/html/occt_user_guides__boolean_operations.html
    }

    api.Build();
    if (api.HasErrors()) {
        Napi::Error::New(info.Env(), "Fuse Failed").ThrowAsJavaScriptException();
        return info.Env().Undefined();
    } else {
        return Shape::Create(api.Shape());
    }
}

Napi::Value common(const Napi::CallbackInfo &info) {
    BRepAlgoAPI_Common api;
    TopTools_ListOfShape args, tools;
    api.SetArguments(arr2list(info[0].As<Napi::Array>(), args));
    api.SetTools(arr2list(info[1].As<Napi::Array>(), tools));

    api.Build();
    if (api.HasErrors()) {
        Napi::Error::New(info.Env(), "Common Failed").ThrowAsJavaScriptException();
        return info.Env().Undefined();
    } else {
        return Shape::Create(api.Shape());
    }
}

Napi::Value cut(const Napi::CallbackInfo &info) {
    BRepAlgoAPI_Cut api;
    TopTools_ListOfShape args, tools;
    api.SetArguments(arr2list(info[0].As<Napi::Array>(), args));
    api.SetTools(arr2list(info[1].As<Napi::Array>(), tools));

    api.Build();
    if (api.HasErrors()) {
        Napi::Error::New(info.Env(), "Cut Failed").ThrowAsJavaScriptException();
        return info.Env().Undefined();
    } else {
        return Shape::Create(api.Shape());
    }
}

Napi::Value section(const Napi::CallbackInfo &info) {
    BRepAlgoAPI_Section api;
    TopTools_ListOfShape args, tools;
    api.SetArguments(arr2list(info[0].As<Napi::Array>(), args));
    api.SetTools(arr2list(info[1].As<Napi::Array>(), tools));

    api.Build();
    if (api.HasErrors()) {
        Napi::Error::New(info.Env(), "Section Failed").ThrowAsJavaScriptException();
        return info.Env().Undefined();
    } else {
        return Shape::Create(api.Shape());
    }
}

Napi::Value split(const Napi::CallbackInfo &info) {
    BRepAlgoAPI_Splitter api;
    TopTools_ListOfShape args, tools;
    api.SetArguments(arr2list(info[0].As<Napi::Array>(), args));
    api.SetTools(arr2list(info[1].As<Napi::Array>(), tools));

    api.Build();
    if (api.HasErrors()) {
        Napi::Error::New(info.Env(), "Split Failed").ThrowAsJavaScriptException();
        return info.Env().Undefined();
    } else {
        return Shape::Create(api.Shape());
    }
}
