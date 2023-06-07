#include <stdio.h>
#include <stdlib.h>

#include "cuda_runtime.h"
#include "cuda_fp16.h"

#ifndef CUDA_UTILS_H
#define CUDA_UTILS_H

#ifdef _WIN32
#define DLL_EXPORT __declspec(dllexport)
#else
#define DLL_EXPORT
#endif

// https://stackoverflow.com/a/27992604
#ifdef __INTELLISENSE__
dim3 blockIdx;
dim3 blockDim;
dim3 threadIdx;
dim3 gridDim;
#define CU_DIM(grid, block)
#define CU_DIM_MEM(grid, block, bytes)
#define CU_DIM_MEM_STREAM(grid, block, bytes, stream)
extern void __syncthreads();
#else
#define CU_DIM(grid, block) <<<grid, block>>>
#define CU_DIM_MEM(grid, block, bytes) <<<grid, block, bytes>>>
#define CU_DIM_MEM_STREAM(grid, block, bytes, stream) <<<grid, block, bytes, stream>>>
#endif

#define CU_ASSERT(ans) do { gpuAssert((ans), __FILE__, __LINE__); } while (0)
inline void gpuAssert(cudaError_t code, const char *file, int line, bool abort=true)
{
    if (code != cudaSuccess) {
        fprintf(stderr, "CUDA ERR: %s %s:%d\n", cudaGetErrorString(code), file, line);
        if (abort) {
            exit(code);
        }
    }
}

#define cuIdx(D) (threadIdx.D + blockIdx.D * blockDim.D)
#define cuDim(D) (blockDim.D * gridDim.D)

template <typename T> T *malloc_device(size_t sz) {
    T* out = NULL;
    if (sz > 0) {
        CU_ASSERT(cudaMalloc(&out, sizeof(T) * sz));
    }
    return out;
}

template <typename T> T *to_device(const T *in, size_t sz) {
    T* out = NULL;
    if (sz > 0) {
        CU_ASSERT(cudaMalloc(&out, sizeof(T) * sz));
        CU_ASSERT(cudaMemcpy(out, in, sizeof(T) * sz, cudaMemcpyDefault));
    }
    return out;
}

template <typename T> T *from_device(const T *in, size_t sz, T *out = NULL) {
    if (out == NULL) {
        CU_ASSERT(cudaHostAlloc(&out, sizeof(T) * sz, 0));
    }
    if (sz > 0) {
        CU_ASSERT(cudaMemcpy(out, in, sizeof(T) * sz, cudaMemcpyDefault));
    }
    return out;
}

#endif
