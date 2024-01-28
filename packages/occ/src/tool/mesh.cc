#include "mesh.h"

#include <gp_Pln.hxx>
#include <Bnd_Box.hxx>
#include <GProp_GProps.hxx>
#include <BRepGProp.hxx>

#include <TopTools_ListOfShape.hxx>
#include <BRepAlgoAPI_Fuse.hxx>
#include <BRepAlgoAPI_Common.hxx>
#include <BRepBuilderAPI_MakeFace.hxx>
#include <BRepPrimAPI_MakeBox.hxx>
#include <BRepBndLib.hxx>

#include "../topo/shape.h"
#include "../utils.h"

typedef struct double3 {
    double x;
    double y;
    double z;
} double3;

template<class T> auto &makeArgsAndTools(T &api, TopoDS_Shape &arg, TopoDS_Shape &tool) {
    TopTools_ListOfShape args, tools;
    args.Append(arg);
    tools.Append(tool);
    api.SetArguments(args);
    api.SetTools(tools);
    api.Build();
    return api.Shape();
}

Napi::Value MakeMesh(const Napi::CallbackInfo &info) {
    auto xs = toDoubleArr(info[1].As<Napi::Array>());
    auto ys = toDoubleArr(info[2].As<Napi::Array>());
    auto zs = toDoubleArr(info[3].As<Napi::Array>());
    double3 min = { xs[0], ys[0], zs[0] };
    double3 max = { xs[xs.size() - 1], ys[ys.size() - 1], zs[zs.size() - 1] };

    auto plane = gp_Pln(
        gp_Pnt(min.x, min.y, min.z),
        gp_Dir(min.x == max.x ? 1 : 0, min.y == max.y ? 1 : 0, min.z == max.z ? 1 : 0));
    auto face = BRepBuilderAPI_MakeFace(plane).Face();

    std::vector<TopoDS_Shape> shapes;
    auto list = info[0].As<Napi::Array>();
    for (int i = 0, n = list.Length(); i < n; i ++) {
        auto shape = Shape::Unwrap(list.Get(i).As<Napi::Object>())->shape;
        BRepAlgoAPI_Common api;
        shapes.push_back(makeArgsAndTools(api, shape, face));
    }

    auto merged = shapes[0];
    for (int i = 1, n = shapes.size(); i < n; i ++) {
        BRepAlgoAPI_Fuse api;
        merged = makeArgsAndTools(api, shapes[i], merged);
    }

    Bnd_Box box;
    BRepBndLib::Add(merged, box);
    double xmin, ymin, zmin, xmax, ymax, zmax;
    box.Get(xmin, ymin, zmin, xmax, ymax, zmax);

    auto ret = Napi::Array::New(info.Env());
    int num = 0;
    for (int i = 0, nx = xs.size(); i < nx - 1; i ++) {
        auto xa = xs[i], xb = xs[i + 1];
        if (xmin <= xb && xa <= xmax) {
            auto px = merged;
            if (xa != xb) {
                BRepAlgoAPI_Common api;
                auto box = BRepPrimAPI_MakeBox(
                    gp_Pnt(xa, min.y - 1, min.z - 1),
                    gp_Pnt(xb, max.y + 1, max.z + 1)).Shape();
                px = makeArgsAndTools(api, merged, box);
            }
            for (int j = 0, ny = ys.size(), nb = px.NbChildren(); nb && j < ny - 1; j ++) {
                auto ya = ys[j], yb = ys[j + 1];
                if (ymin <= yb && ya <= ymax) {
                    auto py = px;
                    if (ya != yb) {
                        BRepAlgoAPI_Common api;
                        auto box = BRepPrimAPI_MakeBox(
                            gp_Pnt(min.x - 1, ya, min.z - 1),
                            gp_Pnt(max.x + 1, yb, max.z + 1)).Shape();
                        py = makeArgsAndTools(api, px, box);
                    }
                    for (int k = 0, nz = zs.size(), nb = py.NbChildren(); nb && k < nz - 1; k ++) {
                        auto za = zs[k], zb = zs[k + 1];
                        if (zmin <= zb && za <= zmax) {
                            auto pz = py;
                            if (za != zb) {
                                BRepAlgoAPI_Common api;
                                auto box = BRepPrimAPI_MakeBox(
                                    gp_Pnt(min.x - 1, min.y - 1, za),
                                    gp_Pnt(max.x + 1, max.y + 1, zb)).Shape();
                                pz = makeArgsAndTools(api, py, box);
                            }
                            if (pz.NbChildren()) {
                                auto item = Napi::Object::New(info.Env());
                                item.Set("i", i);
                                item.Set("j", j);
                                item.Set("k", k);
                                item.Set("p", Shape::Create(pz));
                                GProp_GProps props;
                                BRepGProp::SurfaceProperties(pz, props);
                                item.Set("s", props.Mass());
                                BRepGProp::LinearProperties(pz, props);
                                item.Set("l", props.Mass());
                                ret.Set(num ++, item);
                            }
                        }
                    }
                }
            }
        }
    }
    return ret;
}
