#ifndef TPL_H
#define TPL_H

extern "C" {
    typedef int (__cdecl *init_ptr)(float *le, float *re, float *lh, float *rh);
    typedef float (__cdecl *step_ptr)(float s);
    typedef int (__cdecl *quit_ptr)();
}

#endif
