#import <Foundation/Foundation.h>
#import <PDFKit/PDFKit.h>
#include "pdf_text_bridge.h"
#include <stdlib.h>
#include <string.h>

static void HZPdfResult(HZPdfTextResult *result, NSData *data, uint32_t status) {
    result->status = status;
    if (data == nil || data.length == 0) return;
    result->json = malloc(data.length);
    if (result->json == NULL) { result->status = 4; return; }
    memcpy(result->json, data.bytes, data.length);
    result->length = data.length;
}

static void HZPdfError(HZPdfTextResult *result, NSString *error, uint32_t status) {
    NSData *data = [NSJSONSerialization dataWithJSONObject:@{@"error": error}
                                                  options:0 error:NULL];
    HZPdfResult(result, data, status);
}

// Match the live helper's three PDFKit APIs, including empty-page preservation.
static NSString *HZPageText(PDFPage *page) {
    if (page == nil) return @"";
    NSCharacterSet *whitespace = NSCharacterSet.whitespaceAndNewlineCharacterSet;
    NSString *text = page.string;
    if ([text stringByTrimmingCharactersInSet:whitespace].length > 0) return text;
    text = page.attributedString.string;
    if ([text stringByTrimmingCharactersInSet:whitespace].length > 0) return text;
    text = [page selectionForRect:[page boundsForBox:kPDFDisplayBoxMediaBox]].string;
    if ([text stringByTrimmingCharactersInSet:whitespace].length > 0) return text;
    return page.string ?: @"";
}

void hz_pdf_text_extract(const char *path, size_t max_pages, size_t max_text_bytes,
                         size_t max_json_bytes, HZPdfTextResult *result) {
    if (result == NULL) return;
    memset(result, 0, sizeof(*result));
    @autoreleasepool {
        @try {
            if (path == NULL || path[0] != '/' || max_pages == 0 ||
                max_text_bytes == 0 || max_json_bytes == 0) {
                HZPdfError(result, @"Invalid PDF text extraction request.", 1);
                return;
            }
            NSURL *url = [NSURL fileURLWithFileSystemRepresentation:path
                                                     isDirectory:NO relativeToURL:nil];
            PDFDocument *document = [[PDFDocument alloc] initWithURL:url];
            if (document == nil) {
                HZPdfError(result, @"Cannot open PDF for text-layer extraction.", 1);
                return;
            }
            if (document.isLocked) {
                HZPdfError(result, @"PDF requires a password for text-layer extraction.", 2);
                return;
            }
            if (document.pageCount > max_pages) {
                HZPdfError(result, @"PDF text-layer extraction exceeds the page limit.", 3);
                return;
            }
            NSMutableData *json = [NSMutableData dataWithBytes:"{\"pages\":[" length:10];
            size_t text_bytes = 0;
            for (NSUInteger index = 0; index < document.pageCount; index++) {
                @autoreleasepool {
                    NSString *text = HZPageText([document pageAtIndex:index]);
                    NSUInteger length = [text lengthOfBytesUsingEncoding:NSUTF8StringEncoding];
                    if (length > max_text_bytes - text_bytes) {
                        HZPdfError(result, @"PDF text-layer extraction exceeds the text size limit.", 3);
                        return;
                    }
                    text_bytes += length;
                    // JSON escapes each UTF-8 byte into at most six bytes. Bound
                    // each serialized page before JSONSerialization allocates it.
                    size_t remaining = max_json_bytes > json.length ? max_json_bytes - json.length : 0;
                    if (remaining < 128 || length > (remaining - 128) / 6) {
                        HZPdfError(result, @"PDF text-layer extraction exceeds the response size limit.", 3);
                        return;
                    }
                    NSData *page = [NSJSONSerialization dataWithJSONObject:@{
                        @"index": @(index), @"text": text
                    } options:0 error:NULL];
                    if (page == nil) {
                        HZPdfError(result, @"Cannot serialize PDF text-layer extraction.", 4);
                        return;
                    }
                    if (index > 0) [json appendBytes:"," length:1];
                    [json appendData:page];
                }
            }
            [json appendBytes:"]}" length:2];
            if (json.length > max_json_bytes) {
                HZPdfError(result, @"PDF text-layer extraction exceeds the response size limit.", 3);
                return;
            }
            HZPdfResult(result, json, 0);
        } @catch (NSException *exception) {
            // Never unwind an Objective-C exception across Rust's C ABI.
            (void)exception;
            HZPdfError(result, @"PDFKit failed during text-layer extraction.", 4);
        }
    }
}

void hz_pdf_text_result_free(HZPdfTextResult *result) {
    if (result == NULL) return;
    free(result->json);
    memset(result, 0, sizeof(*result));
}
