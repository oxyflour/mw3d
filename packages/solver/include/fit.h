#include <napi.h>
#include "tpl.h"
#include "grid.h"

#ifndef FIT_H
#define FIT_H

#ifdef __linux__
#define LIBTYPE void*
#define OPENLIB(libname) dlopen((libname), RTLD_LAZY)
#define LIBFUNC(lib, fn) dlsym((lib), (fn))
#endif

#ifdef _WIN32
#include <Windows.h>
#define LIBTYPE HINSTANCE
#define OPENLIB(libname) LoadLibraryW(libname)
#define LIBFUNC(lib, fn) GetProcAddress((lib), (fn))
#endif

typedef struct CompileResult {
    int code;
    std::string log;
    std::string dll;
    std::string cmd;
} CompileResult;

class FitSolver : public Napi::ObjectWrap<FitSolver> {
public:
    static void Init(Napi::Env env, Napi::Object exports);
    FitSolver(const Napi::CallbackInfo& info);

private:
    static Napi::FunctionReference constructor;

    Napi::Value Destroy(const Napi::CallbackInfo& info);
    Napi::Value Step(const Napi::CallbackInfo& info);

    LIBTYPE dll;
    init_ptr fInit;
    step_ptr fStep;
    quit_ptr fQuit;

    Grid grid;
    float *le, *re, *lh, *rh;
};

Napi::Object InitFit(Napi::Env env, Napi::Object exports);

#endif
