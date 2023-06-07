#include <napi.h>
#include <cst.h>
#include <fit.h>

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  InitCst(env, exports);
  InitFit(env, exports);
  return exports;
}

NODE_API_MODULE(binding, Init)
