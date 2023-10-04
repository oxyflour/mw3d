#include "fit.h"
#include "utils.h"
#include "grid.h"

#include <regex>
#include <iostream>

template <typename T> void copyFromArray(Napi::TypedArrayOf<T> arr, int &len, T *&buf) {
    len = arr.ElementLength();
    buf = new T[len];
    for (int i = 0; i < len; i ++) {
        buf[i] = arr[i];
    }
}

Napi::FunctionReference FitSolver::constructor;
void FitSolver::Init(Napi::Env env, Napi::Object exports) {
    Napi::HandleScope scope(env);
    Napi::Function func = DefineClass(env, "Solver", {
        InstanceMethod("destroy", &FitSolver::Destroy),
        InstanceMethod("step", &FitSolver::Step),
    });
    constructor = Napi::Persistent(func);
    constructor.SuppressDestruct();
    exports.Set("Solver", func);
}

static int ParsePort(float3 src, float3 dst, Grid &grid, int3 *&arr, float epsi = 1e-6) {
    auto i = grid.findIndex(src, epsi),
        j = grid.findIndex(dst, epsi);
    if (grid.getFlatIndex(i) > grid.getFlatIndex(j)) {
        auto t = i; i = j; j = t;
        auto m = src; src = dst; dst = m;
    }
    auto len = (i - j).abs().sum();
    if (len == 0) {
        return 0;
    }

    arr = new int3[len + 1];
    arr[0] = i;
    int3 dir[6] = { 1, 0, 0, -1, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 1, 0, 0, -1 };
    for (int s = 1; s < len + 1; s ++) {
        float dist = INFINITE;
        int3 idx;
        for (int m = 0; m < 6; m ++) {
            auto n = i + dir[m];
            auto r = (grid.at(n) - dst).length();
            if (r < dist) {
                dist = r;
                idx = n;
            }
        }
        arr[s] = i = idx;
    }
    return len;
}

static auto InitCoe(Grid &grid, float dt, Napi::Float32Array eps, Napi::Float32Array mue,
        int3 *ports, int portLen,
        float *&le, float *&re, float *&lh, float *&rh) {
    float kap = 0, rho = 0;
    auto nvar = grid.nx * grid.ny * grid.nz * 3;
    le = new float[nvar];
    re = new float[nvar];
    lh = new float[nvar];
    rh = new float[nvar];

    for (int i = 0; i < nvar; i ++) {
        auto ep = eps[i], mu = mue[i];
        le[i] = (1 - kap * ep * dt / 2) / (1 + kap * ep * dt / 2);
        re[i] = dt * ep / (1 + kap * ep * dt / 2);
        lh[i] = (1 - rho * mu * dt / 2) / (1 + rho * mu * dt / 2);
        rh[i] = dt * mu / (1 + rho * mu * dt / 2);
    }

    for (int i = 0, c = portLen / 2; i < portLen; i ++) {
        auto g = grid.getFlatIndex(ports[i]);
        if (i != c) {
            le[g] = 1;
            re[g] = 0;
        }
    }
}

static CompileResult Compile(Grid &grid, int3 *ports, int portLen) {
    int sg = -1, sd = 0;
    if (portLen) {
        auto port = ports[portLen / 2];
        sg = grid.getFlatIndex(port);
        auto delta = ports[portLen / 2 + 1] - port;
        sd = delta.x ? 0 : delta.y ? 1 : 2;
    }

    auto root = dirname(dirname(__FILE__));
    auto chunkSrc = readFile(root + "/tpl/chunk.cu");
    chunkSrc = std::regex_replace(chunkSrc, std::regex("_\\$i(\\W)"), "_0$1");
    chunkSrc = std::regex_replace(chunkSrc, std::regex("\\$nx(\\W)"), std::to_string(grid.nx) + "$1");
    chunkSrc = std::regex_replace(chunkSrc, std::regex("\\$ny(\\W)"), std::to_string(grid.ny) + "$1");
    chunkSrc = std::regex_replace(chunkSrc, std::regex("\\$nz(\\W)"), std::to_string(grid.nz) + "$1");
    chunkSrc = std::regex_replace(chunkSrc, std::regex("\\$sg(\\W)"), std::to_string(sg) + "$1");
    chunkSrc = std::regex_replace(chunkSrc, std::regex("\\$sd(\\W)"), std::to_string(sd) + "$1");

    auto postSrc = readFile(root + "/tpl/post.cu");
    writeFile(root + "/build/tpl.cu", chunkSrc + postSrc);

    auto inc = root + "/include",
        src = root + "/build/tpl.cu",
        dll = root + "/build/tpl.dll",
        log = root + "/build/tpl.log",
        cmd = "nvcc -I" + inc + " " + src + " --shared -o " + dll +" > " + log + " 2>&1";
    auto code = system(cmd.c_str());
    CompileResult ret = { code, log, dll, cmd };
    return ret;
}

float3 posFromArray(Napi::Array arr) {
    return float3 {
        arr.Get((uint32_t) 0).As<Napi::Number>().FloatValue(),
        arr.Get((uint32_t) 1).As<Napi::Number>().FloatValue(),
        arr.Get((uint32_t) 2).As<Napi::Number>().FloatValue(),
    };
}

typedef struct Port {
    float3 src;
    float3 dst;
} Port;

FitSolver::FitSolver(const Napi::CallbackInfo& info) : Napi::ObjectWrap<FitSolver>(info) {
    auto gridMesh = info[0].As<Napi::Array>();
    copyFromArray(gridMesh.Get("xs").As<Napi::Float64Array>(), grid.nx, grid.xs);
    copyFromArray(gridMesh.Get("ys").As<Napi::Float64Array>(), grid.ny, grid.ys);
    copyFromArray(gridMesh.Get("zs").As<Napi::Float64Array>(), grid.nz, grid.zs);
    auto portPos = info[1].As<Napi::Object>();
    auto src = posFromArray(portPos.Get("src").As<Napi::Array>()),
        dst = posFromArray(portPos.Get("dst").As<Napi::Array>());
    auto mat = info[2].As<Napi::Object>();
    auto eps = mat.Get("eps").As<Napi::Float32Array>(),
        mue = mat.Get("mue").As<Napi::Float32Array>();
    auto dt = info[3].ToNumber().FloatValue();

    int3 *ports;
    auto portLen = ParsePort(src, dst, grid, ports, 1e-3);
    if (portLen == 0) {
        Napi::Error::New(info.Env(), "find port failed").ThrowAsJavaScriptException();
        return;
    }

    InitCoe(grid, dt, eps, mue, ports, portLen, le, re, lh, rh);

    auto ret = Compile(grid, ports, portLen);
    if (ret.code == 0) {
        dll = OPENLIB(utf8_to_wstring(ret.dll).c_str());
        if (dll != NULL) {
            fInit = (init_ptr) LIBFUNC(dll, "init_0");
            fStep = (step_ptr) LIBFUNC(dll, "step_0");
            fQuit = (quit_ptr) LIBFUNC(dll, "quit_0");
            auto ret = fInit ? fInit(le, re, lh, rh) : -1;
            if (ret == 0) {
                // pass
            } else {
                Napi::Error::New(info.Env(), "call init failed")
                    .ThrowAsJavaScriptException();
            }
        } else {
            Napi::Error::New(info.Env(), "load dll failed: build/tpl.dll")
                .ThrowAsJavaScriptException();
        }
    } else {
        std::cerr << readFile(ret.log);
        Napi::Error::New(info.Env(), "compile failed: code " + std::to_string(ret.code) + ", cmd: " + ret.cmd)
            .ThrowAsJavaScriptException();
    }
}

Napi::Value FitSolver::Destroy(const Napi::CallbackInfo& info) {
    delete le;
    delete re;
    delete lh;
    delete rh;
    delete grid.xs;
    delete grid.ys;
    delete grid.zs;
    if (fQuit) {
        fQuit();
    }
    return info.Env().Null();
}

Napi::Value FitSolver::Step(const Napi::CallbackInfo& info) {
    auto s = info[0].ToNumber().FloatValue();
    if (fStep != NULL) {
        if (info[0].IsTypedArray()) {
            auto arr = info[0].As<Napi::Float32Array>();
            auto len = arr.ElementLength();
            auto buf = new float[len];
            for (int idx = 0; idx < len; idx ++) {
                buf[idx] = arr.Get(idx).As<Napi::Number>().DoubleValue();
            }
            auto start = std::chrono::high_resolution_clock::now();
            for (int idx = 0; idx < len; idx ++) {
                buf[idx] = fStep(buf[idx]);
            }
            std::chrono::duration<float> duration = std::chrono::high_resolution_clock::now() - start;
            printf("PERF: %f MCells/s\n", grid.nx * grid.ny * grid.nz * len / 1e6 / duration.count());
            auto out = Napi::Float32Array::New(info.Env(), len);
            for (int idx = 0; idx < len; idx ++) {
                out.Set(idx, Napi::Number::New(info.Env(), buf[idx]));
            }
            delete buf;
            return out;
        } else if (info[0].IsNumber()) {
            s = fStep(s);
            return Napi::Number::New(info.Env(), s);
        } else {
            Napi::Error::New(info.Env(), "bad argument")
                .ThrowAsJavaScriptException();
        }
    } else {
        Napi::Error::New(info.Env(), "load dll failed: build/tpl.dll")
            .ThrowAsJavaScriptException();
    }
    return info.Env().Null();
}

Napi::Object InitFit(Napi::Env env, Napi::Object exports) {
    auto fit = Napi::Object::New(env);
    FitSolver::Init(env, fit);
    exports.Set(Napi::String::New(env, "fit"), fit);
    return exports;
}
