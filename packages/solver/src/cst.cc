#include "cst.h"
#include "utils.h"

static std::map<std::string, CstDll> dllCache;
auto getCstPath(std::string &version, std::wstring &output) {
    HKEY handle;
    auto key = std::wstring(L"SOFTWARE\\Wow6432Node\\CST AG\\CST DESIGN ENVIRONMENT\\") + utf8_to_wstring(version);
    auto ret = RegOpenKeyExW(HKEY_LOCAL_MACHINE, key.c_str(), 0, KEY_READ, &handle);
    if (ret == ERROR_SUCCESS) {
        wchar_t buf[1024];
        DWORD len = sizeof(buf) / sizeof(wchar_t);
        ret = RegQueryValueExW(handle, L"INSTALLPATH", 0, NULL, (LPBYTE) buf, &len);
        if (ret == ERROR_SUCCESS) {
            output = buf;
        }
    }
    return ret;
}

Napi::FunctionReference CstProject::constructor;
void CstProject::Init(Napi::Env env, Napi::Object exports) {
    Napi::HandleScope scope(env);
    Napi::Function func = DefineClass(env, "Project", {
        InstanceMethod("destroy", &CstProject::Destroy),
        InstanceMethod("getHexGrid", &CstProject::GetHexGrid),
        InstanceMethod("getMatrix", &CstProject::GetMatrix),
        InstanceMethod("get1DResult", &CstProject::Get1DResult),
    });
    constructor = Napi::Persistent(func);
    constructor.SuppressDestruct();
    exports.Set("Project", func);
}

CstProject::CstProject(const Napi::CallbackInfo& info) : Napi::ObjectWrap<CstProject>(info) {
    auto self = info.This().As<Napi::Object>();
    if (info.Length() > 1) {
        path = std::string(info[0].ToString());
        self.Set("path", info[0]);
        version = std::string(info[1].ToString());
        self.Set("version", info[1]);
        if (dllCache.count(version) == 0) {
            CstDll dll;
            std::wstring cstPath;
            auto ret = getCstPath(version, cstPath);
            if (ret == ERROR_SUCCESS) {
                wchar_t szCwd[1024] = { 0 };
                DWORD len = sizeof(szCwd) / sizeof(wchar_t);
                GetCurrentDirectoryW(len, szCwd);

                auto dllRoot = cstPath + L"AMD64";
                SetCurrentDirectoryW(dllRoot.c_str());

                auto dllPath = dllRoot + L"\\CSTResultReader_AMD64.dll";
                auto module = dll.module = LoadLibraryW(dllPath.c_str());
                dll.path = wstring_to_utf8(dllPath);
                SetCurrentDirectoryW(szCwd);

                if (module != NULL) {
                    dllCache[version] = dll;
                } else {
                    Napi::Error::New(info.Env(), "LoadLibrary Error: " + wstring_to_utf8(dllPath)).ThrowAsJavaScriptException();
                }
            } else {
                Napi::Error::New(info.Env(), "RegQuery Error: " + std::to_string(ret)).ThrowAsJavaScriptException();
            }
        }
        if (dllCache.count(version) == 1) {
            dll = &dllCache[version];
            auto func = (CST_OpenProject_PTR) dll->getProc("CST_OpenProject");
            auto ret = func ? func(path.c_str(), &handle) : -1;
            if (ret == 0) {
                // ok
            } else {
                Napi::Error::New(info.Env(), "Cst Error: " + std::to_string(ret)).ThrowAsJavaScriptException();
            }
        }
    } else {
        Napi::TypeError::New(info.Env(), "version should be set").ThrowAsJavaScriptException();
    }
}

Napi::Value CstProject::GetHexGrid(const Napi::CallbackInfo& info) {
    auto env = info.Env();
    auto result = env.Null();
    if (dll != NULL) {
        int nxyz[3] = { 0 };
        auto func = (CST_GetHexMeshInfo_PTR) dll->getProc("CST_GetHexMeshInfo");
        auto ret = func ? func(&handle, nxyz) : -1;
        if (ret == 0) {
            int nx = nxyz[0], ny = nxyz[1], nz = nxyz[2], sz = nx + ny + nz;
            auto array = new double[sz];
            auto func = (CST_GetHexMesh_PTR) dll->getProc("CST_GetHexMesh");
            auto ret = func ? func(&handle, array) : -1;
            if (ret == 0) {
                auto xs = Napi::Float64Array::New(env, nx);
                for (int i = 0; i < nx; i ++) {
                    xs[i] = array[i];
                }
                auto ys = Napi::Float64Array::New(env, ny);
                for (int i = 0; i < ny; i ++) {
                    ys[i] = array[i + nx];
                }
                auto zs = Napi::Float64Array::New(env, nz);
                for (int i = 0; i < nz; i ++) {
                    zs[i] = array[i + nx + ny];
                }
                auto arr = Napi::Object::New(env);
                arr.Set("xs", xs);
                arr.Set("ys", ys);
                arr.Set("zs", zs);
                result = arr;
            } else {
                Napi::Error::New(info.Env(), "GetHexMesh Error: " + std::to_string(ret)).ThrowAsJavaScriptException();
            }
            delete array;
        } else {
            Napi::Error::New(info.Env(), "GetHexMeshInfo Error: " + std::to_string(ret)).ThrowAsJavaScriptException();
        }
    } else {
        Napi::Error::New(info.Env(), "Already Destroyed");
    }
    return result;
}

Napi::Value CstProject::GetMatrix(const Napi::CallbackInfo& info) {
    auto env = info.Env();
    auto result = env.Null();
    auto mat = info[0].ToNumber().Int32Value();
    if (dll != NULL) {
        int nxyz[3] = { 0 };
        auto func = (CST_GetHexMeshInfo_PTR) dll->getProc("CST_GetHexMeshInfo");
        auto ret = func ? func(&handle, nxyz) : -1;
        if (ret == 0) {
            int nx = nxyz[0], ny = nxyz[1], nz = nxyz[2], sz = nx * ny * nz * 3;
            auto array = new float[sz];
            auto func = (CST_GetMaterialMatrixHexMesh_PTR) dll->getProc("CST_GetMaterialMatrixHexMesh");
            auto ret = func ? func(&handle, mat, array) : -1;
            if (ret == 0) {
                auto arr = Napi::Float32Array::New(env, sz);
                if (mat == 101) {
                    // reorder for mue
                    int nxy = nx * ny, nxyz = nxy * nz;
                    for (int i = 0; i < nx; i ++) {
                        for (int j = 0; j < ny; j ++) {
                            for (int k = 0; k < nz; k ++) {
                                arr[i + j * nx + k * nxy         ] = array[((i+1) % nx) + j * nx + k * nxy         ];
                                arr[i + j * nx + k * nxy + nxyz  ] = array[i + ((j+1) % ny) * nx + k * nxy + nxyz  ];
                                arr[i + j * nx + k * nxy + nxyz*2] = array[i + j * nx + ((k+1) % nz) * nxy + nxyz*2];
                            }
                        }
                    }
                } else {
                    // normal order
                    for (int i = 0; i < sz; i ++) {
                        arr[i] = array[i];
                    }
                }
                result = arr;
            } else {
                Napi::Error::New(info.Env(), "GetMaterialMatrix Error: " + std::to_string(ret)).ThrowAsJavaScriptException();
            }
            delete array;
        } else {
            Napi::Error::New(info.Env(), "GetHexMeshInfo Error: " + std::to_string(ret)).ThrowAsJavaScriptException();
        }
    } else {
        Napi::Error::New(info.Env(), "Already Destroyed");
    }
    return result;
}

Napi::Value CstProject::Get1DResult(const Napi::CallbackInfo& info) {
    auto env = info.Env();
    auto result = env.Null();
    auto tree = info[0].ToString().Utf8Value();
    auto num = info.Length() > 1 ? info[1].ToNumber().Int32Value() : 0;
    auto type = info.Length() > 2 ? info[2].ToNumber().Int32Value() : 0;
    if (dll != NULL) {
        auto func = (CST_Get1DResultSize_PTR) dll->getProc("CST_Get1DResultSize");
        int size = 0;
        auto ret = func ? func(&handle, tree.c_str(), num, &size) : -1;
        if (ret == 0) {
            auto func = type == 0 ?
                (CST_Get1DRealDataAbszissa_PTR) dll->getProc("CST_Get1DRealDataAbszissa") :
                (CST_Get1DRealDataOrdinate_PTR) dll->getProc("CST_Get1DRealDataOrdinate");
            auto array = new double[size];
            auto ret = func ? func(&handle, tree.c_str(), num, array) : -1;
            if (ret == 0) {
                auto arr = Napi::Float64Array::New(env, size);
                for (int i = 0; i < size; i ++) {
                    arr[i] = array[i];
                }
                result = arr;
            } else {
                Napi::Error::New(info.Env(), "Get1DResultData Error: " + std::to_string(ret)).ThrowAsJavaScriptException();
            }
            delete array;
        } else {
            Napi::Error::New(info.Env(), "Get1DResultSize Error: " + std::to_string(ret)).ThrowAsJavaScriptException();
        }
    } else {
        Napi::Error::New(info.Env(), "Already Destroyed");
    }
    return result;
}

Napi::Value CstProject::Destroy(const Napi::CallbackInfo& info) {
    if (dll != NULL) {
        auto func = (CST_CloseProject_PTR) dll->getProc("CST_CloseProject");
        func(&handle);
        dll = NULL;
    } else {
        Napi::Error::New(info.Env(), "Already Destroyed");
    }
    return info.Env().Null();
}

Napi::Object InitCst(Napi::Env env, Napi::Object exports) {
    auto cst = Napi::Object::New(env);
    CstProject::Init(env, cst);
    exports.Set("cst", cst);
    return exports;
}
