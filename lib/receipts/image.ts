// Photo du ticket → JPEG prêt pour le modèle (et pour le Storage / l'agent H).
// HEIC/PNG/WebP/JPEG, orientation EXIF corrigée, réduite à un budget de pixels
// (pas à une hauteur fixe) pour qu'un ticket long et étroit reste lisible.
import "server-only";
import sharp from "sharp";
import convertHeic from "heic-convert";

const PIXEL_BUDGET = 1600 * 1200; // ~1,9 MP
const HEIC_BRANDS = ["heic", "heix", "hevc", "hevx", "heim", "heis", "hevm", "hevs"];

export type PreparedImage = { mediaType: "image/jpeg"; base64: string; buffer: Buffer; width: number; height: number };

/** Marque du conteneur ISO-BMFF ("ftyp"), ex. "heic", "mif1", "avif". */
function ftypBrand(buf: Buffer): string | null {
  return buf.length > 12 && buf.toString("ascii", 4, 8) === "ftyp" ? buf.toString("ascii", 8, 12) : null;
}

async function heicToJpeg(buf: Buffer): Promise<Buffer> {
  // Le sharp précompilé ne décode pas le HEIC (seulement l'AVIF) → heic-convert (wasm).
  return Buffer.from(await convertHeic({ buffer: buf, format: "JPEG", quality: 0.95 }));
}

export async function prepareImage(input: Buffer): Promise<PreparedImage> {
  const brand = ftypBrand(input);
  let source = brand && HEIC_BRANDS.includes(brand) ? await heicToJpeg(input) : input;

  // 1) rotation EXIF ; mif1/msf1 peut être du HEIC ou de l'AVIF : on tente sharp d'abord.
  const orient = (buf: Buffer) => sharp(buf).rotate().toBuffer({ resolveWithObject: true });
  let oriented: Awaited<ReturnType<typeof orient>>;
  try {
    oriented = await orient(source);
  } catch (err) {
    if (!brand) throw err;
    source = await heicToJpeg(input);
    oriented = await orient(source);
  }

  // 2) réduction au budget de pixels, en gardant les proportions
  const { width, height } = oriented.info;
  const scale = Math.min(1, Math.sqrt(PIXEL_BUDGET / (width * height)));
  const w = Math.round(width * scale), h = Math.round(height * scale);
  const buffer = await sharp(oriented.data).resize(w, h).jpeg({ quality: 90 }).toBuffer();

  return { mediaType: "image/jpeg", base64: buffer.toString("base64"), buffer, width: w, height: h };
}
