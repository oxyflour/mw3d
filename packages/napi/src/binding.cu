#include <napi.h>
#include <cuda_runtime.h>

Napi::Value Test(const Napi::CallbackInfo &info) {
    return info.Env().Undefined();
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set("test", Napi::Function::New(env, Test));
    return exports;
}

NODE_API_MODULE(binding, Init)
