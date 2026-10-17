#ifndef HAZAKURA_REMOTE_IMAGE_BRIDGE_H
#define HAZAKURA_REMOTE_IMAGE_BRIDGE_H

#include <stddef.h>
#include <stdint.h>

// The caller copies the owned buffers and then frees the whole result once.
// URL must be a NUL-terminated UTF-8 string; embedded NULs are rejected in Rust.
typedef struct HZRemoteImageResult {
    uint8_t *bytes;
    size_t length;
    uint16_t status;
    char *content_type;
    char *final_url;
    char *error;
} HZRemoteImageResult;

void hz_remote_image_fetch(const char *url, size_t limit, HZRemoteImageResult *result);
void hz_remote_image_result_free(HZRemoteImageResult *result);

#endif
