#ifndef HAZAKURA_PDF_TEXT_BRIDGE_H
#define HAZAKURA_PDF_TEXT_BRIDGE_H

#include <stddef.h>
#include <stdint.h>

// The result owns its buffer until hz_pdf_text_result_free, including errors.
// JSON is UTF-8 and length-delimited, so extracted text may contain NULs.
typedef struct HZPdfTextResult {
    uint8_t *json;
    size_t length;
    uint32_t status;
} HZPdfTextResult;

void hz_pdf_text_extract(const char *path, size_t max_pages, size_t max_text_bytes,
                         size_t max_json_bytes, HZPdfTextResult *result);
void hz_pdf_text_result_free(HZPdfTextResult *result);

#endif
