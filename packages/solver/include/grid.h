#ifndef GRID_H
#define GRID_H

typedef struct float3 {
    float x, y, z;
    float3 operator- (const float3& first);
    float length();
} float3;

typedef struct int3 {
    int x, y, z;
    int3 operator- (const int3& first);
    int3 operator+ (const int3& first);
    int sum();
    int3 abs();
} int3;

typedef struct Grid {
    int nx, ny, nz;
    double *xs, *ys, *zs;
    float3 at(int3 idx);
    int getFlatIndex(int3 idx);
    int3 findIndex(float3 p, float epsi);
} Grid;

#endif
