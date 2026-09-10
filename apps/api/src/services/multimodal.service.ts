import path from 'path'
import { PDFParse } from 'pdf-parse'
import mammoth from 'mammoth'

export const MULTIMODAL_LIMITS = {
  maxBytes: 15 * 1024 * 1024,
  maxExtractedCharacters: 50000
} as const

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const DOCUMENT_TYPES = new Set(['application/pdf', 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
const EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.pdf', '.txt', '.docx'])

export type NormalizedMultimodalInput = {
  type: 'image' | 'document'
  filename: string
  mimeType: string
  sizeBytes: number
  imageDataUrl?: string
  extractedText?: string
}

function safeFilename(value: unknown) {
  return path.basename(String(value || 'attachment')).replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 160) || 'attachment'
}

export function validateUpload(file: { originalname?: string; mimetype?: string; size?: number }) {
  const mimeType = String(file.mimetype || '').toLowerCase()
  const extension = path.extname(safeFilename(file.originalname)).toLowerCase()
  if (!EXTENSIONS.has(extension) || (!IMAGE_TYPES.has(mimeType) && !DOCUMENT_TYPES.has(mimeType))) throw new Error('That file type is not supported.')
  if (Number(file.size || 0) > MULTIMODAL_LIMITS.maxBytes) throw new Error('That file is too large to process.')
  if ((extension === '.jpg' || extension === '.jpeg') && mimeType !== 'image/jpeg') throw new Error('That file type is not supported.')
  if (extension === '.png' && mimeType !== 'image/png') throw new Error('That file type is not supported.')
  if (extension === '.webp' && mimeType !== 'image/webp') throw new Error('That file type is not supported.')
  if (extension === '.gif' && mimeType !== 'image/gif') throw new Error('That file type is not supported.')
  if (extension === '.pdf' && mimeType !== 'application/pdf') throw new Error('That file type is not supported.')
  if (extension === '.txt' && mimeType !== 'text/plain') throw new Error('That file type is not supported.')
  if (extension === '.docx' && mimeType !== 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') throw new Error('That file type is not supported.')
  return { filename: safeFilename(file.originalname), mimeType, sizeBytes: Number(file.size || 0), type: IMAGE_TYPES.has(mimeType) ? 'image' as const : 'document' as const }
}

function hasImageSignature(buffer: Buffer, mimeType: string) {
  if (mimeType === 'image/jpeg') return buffer.length > 2 && buffer[0] === 0xff && buffer[1] === 0xd8
  if (mimeType === 'image/png') return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  if (mimeType === 'image/gif') return ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii'))
  if (mimeType === 'image/webp') return buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  return false
}

export async function normalizeUpload(file: { originalname?: string; mimetype?: string; size?: number; buffer: Buffer }): Promise<NormalizedMultimodalInput> {
  const metadata = validateUpload(file)
  if (metadata.type === 'image') {
    if (!hasImageSignature(file.buffer, metadata.mimeType)) throw new Error('That image could not be read.')
    return { ...metadata, imageDataUrl: `data:${metadata.mimeType};base64,${file.buffer.toString('base64')}` }
  }

  let extractedText = ''
  if (metadata.mimeType === 'text/plain') extractedText = file.buffer.toString('utf8')
  if (metadata.mimeType === 'application/pdf') {
    const parser = new PDFParse({ data: file.buffer })
    try { extractedText = (await parser.getText()).text } finally { await parser.destroy() }
  }
  if (metadata.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') extractedText = (await mammoth.extractRawText({ buffer: file.buffer })).value
  extractedText = extractedText.replace(/\u0000/g, '').trim().slice(0, MULTIMODAL_LIMITS.maxExtractedCharacters)
  if (!extractedText) throw new Error('That document does not contain readable text.')
  return { ...metadata, extractedText }
}

export function attachmentSummary(input: NormalizedMultimodalInput) {
  return `[Attachment: ${input.filename}; type: ${input.mimeType}; size: ${input.sizeBytes} bytes]`
}