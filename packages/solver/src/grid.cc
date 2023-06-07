#include "grid.h"

#include "math.h"

int3 int3::operator- (const int3& first) {
    return int3 { first.x - x, first.y - y, first.z - z };
}

int3 int3::operator+ (const int3& first) {
    return int3 { first.x + x, first.y + y, first.z + z };
}

int3 int3::abs() {
    return int3 { ::abs(x), ::abs(y), ::abs(z) };
}

int int3::sum() {
    return x + y + z;
}

float3 float3::operator- (const float3& first) {
    return float3 { first.x - x, first.y - y, first.z - z };
}

float float3::length() {
    return sqrt(x * x + y * y + z * z);
}

float3 Grid::at(int3 idx) {
    return float3 { (float) xs[idx.x], (float) ys[idx.y], (float) zs[idx.z] };
}

int Grid::getFlatIndex(int3 idx) {
    return idx.x + idx.y * nx + idx.z * nx * ny;
}

int3 Grid::findIndex(float3 p, float epsi) {
    for (int i = 0; i < nx; i ++) {
        for (int j = 0; j < ny; j ++) {
            for (int k = 0; k < nz; k ++) {
                float3 b = { (float) xs[i], (float) ys[j], (float) zs[k] };
                if ((p - b).length() < epsi) {
                    return int3 { i, j, k };
                }
            }
        }
    }
    return int3 { -1, -1, -1 };
}
