#include <map>

#include <napi.h>
#include <windows.h>

#include <utils/cst_interface.h>

#ifndef CST_H
#define CST_H

typedef struct CstDll {
    HMODULE module;
    std::string path;
    std::map<const char*, FARPROC> procs;
    auto getProc(const char *name) {
        if (procs.count(name) == 1) {
            return procs[name];
        }
        return procs[name] = GetProcAddress(module, name);
    }
} CstDll;

class CstProject : public Napi::ObjectWrap<CstProject> {
public:
    static void Init(Napi::Env env, Napi::Object exports);
    CstProject(const Napi::CallbackInfo& info);

private:
    static Napi::FunctionReference constructor;

    Napi::Value Destroy(const Napi::CallbackInfo& info);
    Napi::Value GetHexGrid(const Napi::CallbackInfo& info);
    Napi::Value GetMatrix(const Napi::CallbackInfo& info);
    Napi::Value Get1DResult(const Napi::CallbackInfo& info);

    Napi::Value ExportGeometry(const Napi::CallbackInfo& info);

    std::string path;
    std::string version;
    CstDll *dll;
    CSTProjHandle handle;
};

Napi::Object InitCst(Napi::Env env, Napi::Object exports);

#endif
