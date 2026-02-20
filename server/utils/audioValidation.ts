/**
 * Audio Magic Bytes Validation
 * 
 * Validates uploaded files by checking their actual binary content (magic bytes)
 * rather than trusting the client-provided MIME type. This prevents malicious
 * file uploads disguised as audio files.
 */

interface MagicBytesEntry {
  name: string;
  bytes: number[];
  offset: number;
}

/**
 * Known audio format magic bytes signatures.
 * Each entry defines the expected bytes at a specific offset.
 */
const AUDIO_MAGIC_BYTES: MagicBytesEntry[] = [
  // MP3 with ID3v2 tag
  { name: "MP3/ID3v2", bytes: [0x49, 0x44, 0x33], offset: 0 },
  // MP3 MPEG-1 Layer III frame sync
  { name: "MP3/MPEG1-L3", bytes: [0xFF, 0xFB], offset: 0 },
  { name: "MP3/MPEG2-L3", bytes: [0xFF, 0xF3], offset: 0 },
  { name: "MP3/MPEG2.5-L3", bytes: [0xFF, 0xF2], offset: 0 },
  // WAV (RIFF....WAVE)
  { name: "WAV/RIFF", bytes: [0x52, 0x49, 0x46, 0x46], offset: 0 },
  // FLAC
  { name: "FLAC", bytes: [0x66, 0x4C, 0x61, 0x43], offset: 0 },
  // OGG Vorbis
  { name: "OGG", bytes: [0x4F, 0x67, 0x67, 0x53], offset: 0 },
  // M4A/AAC in MP4 container — ftyp at offset 4
  { name: "M4A/ftyp", bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 },
  // WebM (EBML header)
  { name: "WebM/EBML", bytes: [0x1A, 0x45, 0xDF, 0xA3], offset: 0 },
];

/**
 * Validates the magic bytes of a file buffer against known audio format signatures.
 * Returns true if the buffer matches any known audio format.
 * 
 * @param buffer - The file buffer (at least first 16 bytes needed)
 * @returns Whether the buffer matches a known audio format
 */
export function validateAudioMagicBytes(buffer: Buffer | Uint8Array): { valid: boolean; detectedFormat: string | null } {
  if (buffer.length < 16) {
    return { valid: false, detectedFormat: null };
  }

  for (const entry of AUDIO_MAGIC_BYTES) {
    if (buffer.length < entry.offset + entry.bytes.length) {
      continue;
    }

    let match = true;
    for (let i = 0; i < entry.bytes.length; i++) {
      if (buffer[entry.offset + i] !== entry.bytes[i]) {
        match = false;
        break;
      }
    }

    if (match) {
      // Additional WAV check: verify "WAVE" at offset 8
      if (entry.name === "WAV/RIFF" && buffer.length >= 12) {
        const isWave = buffer[8] === 0x57 && buffer[9] === 0x41 &&
                       buffer[10] === 0x56 && buffer[11] === 0x45;
        if (!isWave) continue; // RIFF but not WAVE — skip
      }
      return { valid: true, detectedFormat: entry.name };
    }
  }

  return { valid: false, detectedFormat: null };
}
