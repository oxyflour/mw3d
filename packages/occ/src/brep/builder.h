#include <napi.h>

Napi::Value MakeVertex(const Napi::CallbackInfo &info);
Napi::Value MakeEdge(const Napi::CallbackInfo &info);
Napi::Value MakeFace(const Napi::CallbackInfo &info);
Napi::Value MakeWire(const Napi::CallbackInfo &info);
Napi::Value MakeShell(const Napi::CallbackInfo &info);
Napi::Value MakeCompound(const Napi::CallbackInfo &info);
Napi::Value MakeSolid(const Napi::CallbackInfo &info);
Napi::Value ToNurbs(const Napi::CallbackInfo &info);
