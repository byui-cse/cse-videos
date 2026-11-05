/**
 * Reads a JPEG's width and height from its frame header, so the pages can
 * give every cover its true size without an image library.
 */
import fs from "node:fs/promises";

const START_OF_IMAGE = 0xffd8;
const END_OF_IMAGE = 0xd9;
const START_OF_SCAN = 0xda;
const FRAME_MARKERS = new Set([0xc0, 0xc2]);

/**
 * True for markers that carry no length: TEM and the restart markers.
 * @param {number} marker
 */
const isStandalone = (marker) => marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7);

/**
 * The size of a baseline (SOF0) or progressive (SOF2) JPEG.
 * @param {string | URL} file
 * @returns {Promise<{ width: number, height: number }>}
 */
export const readJpegSize = async (file) => {
    const bytes = await fs.readFile(file);
    const invalid = () => new Error(`${file} is not a readable JPEG with a SOF0 or SOF2 frame`);

    if (bytes.length < 4 || bytes.readUInt16BE(0) !== START_OF_IMAGE) {
        throw invalid();
    }

    let offset = 2;

    while (offset + 3 < bytes.length) {
        if (bytes[offset++] !== 0xff) {
            throw invalid();
        }

        while (bytes[offset] === 0xff) {
            offset++;
        }

        const marker = bytes[offset++];

        if (marker === END_OF_IMAGE || marker === START_OF_SCAN) {
            break;
        }

        if (isStandalone(marker)) {
            continue;
        }

        if (offset + 2 > bytes.length) {
            throw invalid();
        }

        const length = bytes.readUInt16BE(offset);

        if (length < 2 || offset + length > bytes.length) {
            throw invalid();
        }

        if (FRAME_MARKERS.has(marker)) {
            if (length < 8) {
                throw invalid();
            }

            const height = bytes.readUInt16BE(offset + 3);
            const width = bytes.readUInt16BE(offset + 5);

            if (!width || !height) {
                throw invalid();
            }

            return { width, height };
        }

        offset += length;
    }

    throw invalid();
};
