/**
 * Reads a JPEG's width and height from its frame header, so the pages can
 * give every cover its true size without an image library.
 */
import fs from "node:fs/promises";

const START_OF_IMAGE = 0xffd8;
const END_OF_IMAGE = 0xd9;
const START_OF_SCAN = 0xda;
const FRAME_MARKERS = new Set([0xc0, 0xc1, 0xc2]);

/**
 * Orientation from an APP1 EXIF segment, or null when it is incomplete.
 * @param {Buffer} bytes
 * @param {number} start
 * @param {number} end
 */
const exifOrientation = (bytes, start, end) => {
    if (end - start < 14 || bytes.toString("ascii", start, start + 6) !== "Exif\0\0") {
        return null;
    }

    const tiff = start + 6;
    const order = bytes.toString("ascii", tiff, tiff + 2);

    if (order !== "II" && order !== "MM") {
        return null;
    }

    const read16 = order === "II" ? (at) => bytes.readUInt16LE(at) : (at) => bytes.readUInt16BE(at);
    const read32 = order === "II" ? (at) => bytes.readUInt32LE(at) : (at) => bytes.readUInt32BE(at);

    if (read16(tiff + 2) !== 42) {
        return null;
    }

    const directory = tiff + read32(tiff + 4);

    if (directory < tiff || directory + 2 > end) {
        return null;
    }

    const count = read16(directory);

    if (count > Math.floor((end - directory - 2) / 12)) {
        return null;
    }

    for (let index = 0; index < count; index++) {
        const entry = directory + 2 + index * 12;

        if (read16(entry) === 0x0112 && read16(entry + 2) === 3 && read32(entry + 4) === 1) {
            const orientation = read16(entry + 8);
            return orientation >= 1 && orientation <= 8 ? orientation : null;
        }
    }

    return null;
};

/**
 * True for markers that carry no length: TEM and the restart markers.
 * @param {number} marker
 */
const isStandalone = (marker) => marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7);

/**
 * The displayed size of an 8-bit SOF0, SOF1 or SOF2 JPEG.
 * @param {string | URL} file
 * @returns {Promise<{ width: number, height: number }>}
 */
export const readJpegSize = async (file) => {
    const bytes = await fs.readFile(file);
    const invalid = () => new Error(`${file} is not a readable JPEG with an 8-bit SOF0, SOF1 or SOF2 frame`);

    if (bytes.length < 4 || bytes.readUInt16BE(0) !== START_OF_IMAGE) {
        throw invalid();
    }

    let offset = 2;
    let size = null;
    let orientation = 1;

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

        if (marker === 0xe1) {
            orientation = exifOrientation(bytes, offset + 2, offset + length) ?? orientation;
        }

        if (FRAME_MARKERS.has(marker)) {
            if (length < 8 || bytes[offset + 2] !== 8) {
                throw invalid();
            }

            const height = bytes.readUInt16BE(offset + 3);
            const width = bytes.readUInt16BE(offset + 5);

            if (!width || !height) {
                throw invalid();
            }

            size = { width, height };
        }

        offset += length;
    }

    if (!size) {
        throw invalid();
    }

    return orientation >= 5 && orientation <= 8
        ? { width: size.height, height: size.width }
        : size;
};
